package fast.campus.netplix.translation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OpenAI(gpt-4o-mini) 기반 텍스트 번역 어댑터.
 *
 * <p>원칙:
 *  - 한국어 원문 → en/zh/ja 번역. 그 외 언어는 원문 그대로 반환.
 *  - 인메모리 캐시(언어+원문 키)로 동일 텍스트 재번역 방지 → 모달 재오픈·언어 토글 시 무비용.
 *  - 미번역 텍스트들만 모아 <b>한 번의 호출</b>로 일괄 번역(JSON in/out).
 *  - 어떤 실패든 입력 원문을 그대로 반환 — 절대 예외 전파하지 않는다.
 */
@Slf4j
@Component
public class OpenAiTranslationAdapter implements TextTranslationPort {

    private static final String CHAT_URL = "https://api.openai.com/v1/chat/completions";
    private static final String MODEL = "gpt-4o-mini";
    private static final int CONNECT_TIMEOUT_SEC = 5;
    // Heroku 라우터 30s(H12) 제한 안에서 끝나도록 보수적으로 설정.
    private static final int READ_TIMEOUT_SEC = 24;
    /** 토큰·지연 폭주 방지 — 항목당 번역 입력 길이 상한. */
    private static final int MAX_CHARS_PER_TEXT = 3000;
    /** 캐시 무한 증식 방지 — 초과 시 단순 초기화. */
    private static final int MAX_CACHE_ENTRIES = 8000;

    private static final Map<String, String> LANG_NAMES = Map.of(
            "en", "English",
            "zh", "Simplified Chinese",
            "ja", "Japanese"
    );

    @Value("${openai.api-key:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestTemplate restTemplate = createRestTemplate();
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    private static RestTemplate createRestTemplate() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(CONNECT_TIMEOUT_SEC));
        factory.setReadTimeout(Duration.ofSeconds(READ_TIMEOUT_SEC));
        return new RestTemplate(factory);
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public List<String> translate(List<String> texts, String targetLang) {
        if (texts == null || texts.isEmpty()) {
            return texts == null ? List.of() : texts;
        }
        String lang = targetLang == null ? "" : targetLang.trim().toLowerCase(Locale.ROOT);
        if (!LANG_NAMES.containsKey(lang) || !isAvailable()) {
            return new ArrayList<>(texts);
        }

        // 결과 버퍼를 원문으로 초기화(번역 실패 시 자연 폴백).
        List<String> out = new ArrayList<>(texts);

        // 캐시에 없는 '고유' 텍스트만 모은다(중복 제거 → 호출 비용 절감).
        LinkedHashMap<String, List<Integer>> pending = new LinkedHashMap<>();
        for (int i = 0; i < texts.size(); i++) {
            String src = texts.get(i);
            if (src == null) {
                out.set(i, null);
                continue;
            }
            if (src.isBlank()) {
                continue; // 공백은 그대로
            }
            String cached = cache.get(cacheKey(lang, src));
            if (cached != null) {
                out.set(i, cached);
            } else {
                pending.computeIfAbsent(src, k -> new ArrayList<>()).add(i);
            }
        }

        if (pending.isEmpty()) {
            return out;
        }

        List<String> uniqueSources = new ArrayList<>(pending.keySet());
        List<String> translated = callTranslate(uniqueSources, lang);
        if (translated == null || translated.size() != uniqueSources.size()) {
            // 실패 → 원문 유지(out 은 이미 원문). 캐시에 넣지 않는다.
            return out;
        }

        if (cache.size() > MAX_CACHE_ENTRIES) {
            cache.clear();
        }
        for (int u = 0; u < uniqueSources.size(); u++) {
            String src = uniqueSources.get(u);
            String dst = translated.get(u);
            if (dst == null || dst.isBlank()) {
                dst = src; // 빈 번역은 원문 유지
            }
            cache.put(cacheKey(lang, src), dst);
            for (int idx : pending.get(src)) {
                out.set(idx, dst);
            }
        }
        return out;
    }

    private List<String> callTranslate(List<String> sources, String lang) {
        try {
            String langName = LANG_NAMES.get(lang);
            ArrayNode inItems = mapper.createArrayNode();
            for (String s : sources) {
                inItems.add(truncate(s, MAX_CHARS_PER_TEXT));
            }
            ObjectNode userPayload = mapper.createObjectNode();
            userPayload.set("items", inItems);

            String system = "You are a professional translator localizing Korean tourism audio-guide narration into "
                    + langName + ". Translate every string in the input JSON array \"items\" from Korean into "
                    + langName + ". Keep place names and proper nouns natural for " + langName
                    + " readers. Preserve meaning and tone; do not summarize or add notes. "
                    + "Return ONLY a JSON object of the form {\"items\":[...]} whose array has EXACTLY the same "
                    + "length and order as the input. Each element is the translated string.";

            Map<String, Object> body = new HashMap<>();
            body.put("model", MODEL);
            body.put("temperature", 0);
            body.put("response_format", Map.of("type", "json_object"));
            body.put("messages", List.of(
                    Map.of("role", "system", "content", system),
                    Map.of("role", "user", "content", mapper.writeValueAsString(userPayload))
            ));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            ResponseEntity<String> res = restTemplate.exchange(
                    CHAT_URL, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

            JsonNode root = mapper.readTree(res.getBody());
            String content = root.path("choices").path(0).path("message").path("content").asText("");
            if (content.isBlank()) {
                return null;
            }
            JsonNode parsed = mapper.readTree(content);
            JsonNode arr = parsed.path("items");
            if (!arr.isArray()) {
                return null;
            }
            List<String> result = new ArrayList<>(arr.size());
            for (JsonNode n : arr) {
                result.add(n.isNull() ? null : n.asText(""));
            }
            return result;
        } catch (Exception e) {
            log.warn("[TRANSLATE] OpenAI 번역 실패 lang={} count={}: {}", lang, sources.size(), e.getMessage());
            return null;
        }
    }

    private static String cacheKey(String lang, String src) {
        return lang + "\u0001" + src;
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max);
    }
}
