package fast.campus.netplix.openai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.cinetrip.LlmMappingPort;
import fast.campus.netplix.cinetrip.MovieRegionSuggestion;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.tour.TourPhoto;
import fast.campus.netplix.tour.TourPhotoPort;
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
import java.util.Map;
import java.util.Set;

/**
 * OpenAI gpt-4o-mini 기반 LLM 매핑 어댑터.
 *
 * 원칙:
 *  - DB 필드(overview/genre/productionCountries/cast/director)만 프롬프트에 주입 — TMDB 추가 호출 없음.
 *  - 한국이 아닌 영화(productionCountries 에 'Korea' 미포함)는 LLM 호출 스킵 → 비용 절감.
 *  - JSON 모드(response_format=json_object) 로 구조화 응답 강제.
 *  - 응답 파싱 실패·빈 배열·API 에러 전부 '빈 리스트' 반환 — 자동 태깅은 보조일 뿐 장애를 만들지 않는다.
 *  - 반환된 area_code 는 17개 표준 코드(1~8,31~39) 화이트리스트 검증.
 */
@Slf4j
@Component
public class OpenAiMappingAdapter implements LlmMappingPort {

    private static final String CHAT_URL = "https://api.openai.com/v1/chat/completions";
    private static final String MODEL = "gpt-4o-mini";
    private static final int CONNECT_TIMEOUT_SEC = 10;
    private static final int READ_TIMEOUT_SEC = 30;

    private static final Set<String> VALID_AREA_CODES = Set.of(
            "1","2","3","4","5","6","7","8",
            "31","32","33","34","35","36","37","38","39"
    );
    private static final Set<String> VALID_MAPPING_TYPES = Set.of("SHOT", "BACKGROUND", "THEME");

    // lDongRegnCd(11/26/...) → KorService2 areaCode(1~8,31~39). Photo 어댑터와 동일한 표.
    private static final Map<String, String> LDONG_TO_AREA_CODE = Map.ofEntries(
            Map.entry("11", "1"),  Map.entry("26", "6"),  Map.entry("27", "4"),
            Map.entry("28", "2"),  Map.entry("29", "5"),  Map.entry("30", "3"),
            Map.entry("31", "7"),  Map.entry("36", "8"),  Map.entry("41", "31"),
            Map.entry("42", "32"), Map.entry("43", "33"), Map.entry("44", "34"),
            Map.entry("45", "35"), Map.entry("46", "36"), Map.entry("47", "37"),
            Map.entry("48", "38"), Map.entry("50", "39"), Map.entry("51", "32"),
            Map.entry("52", "35")
    );

    @Value("${openai.api-key:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestTemplate restTemplate = createRestTemplate();

    /**
     * 관광공모전(사진) 수상작 조회 포트. LLM 프롬프트 보강용으로만 사용하므로 선택적 의존성.
     * 포토 API 가 미설정이면 자연스럽게 빈 리스트를 반환하므로 별도 가드 불필요.
     */
    private final TourPhotoPort tourPhotoPort;

    public OpenAiMappingAdapter(TourPhotoPort tourPhotoPort) {
        this.tourPhotoPort = tourPhotoPort;
    }

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
    public List<MovieRegionSuggestion> suggest(NetplixMovie movie) {
        if (!isAvailable() || movie == null || movie.getMovieName() == null) return List.of();

        if (!isKoreanProduction(movie)) {
            log.debug("[LLM-MAPPING] 한국 영화 아님 스킵: {}", movie.getMovieName());
            return List.of();
        }

        try {
            String raw = callChat(buildPrompt(movie));
            return parseResponse(movie.getMovieName(), raw);
        } catch (Exception e) {
            log.warn("[LLM-MAPPING] '{}' 매핑 실패: {}", movie.getMovieName(), e.getMessage());
            return List.of();
        }
    }

    private boolean isKoreanProduction(NetplixMovie m) {
        String countries = m.getProductionCountries();
        String lang = m.getOriginalLanguage();
        if (countries != null) {
            String lower = countries.toLowerCase();
            if (lower.contains("korea") || lower.contains("한국")) return true;
        }
        return "ko".equalsIgnoreCase(lang);
    }

    private String buildPrompt(NetplixMovie m) {
        StringBuilder sb = new StringBuilder(900);
        sb.append("영화 제목: ").append(nullSafe(m.getMovieName())).append('\n');
        if (m.getOriginalTitle() != null) sb.append("원제: ").append(m.getOriginalTitle()).append('\n');
        if (m.getGenre() != null)          sb.append("장르: ").append(m.getGenre()).append('\n');
        if (m.getReleasedAt() != null)     sb.append("개봉: ").append(m.getReleasedAt()).append('\n');
        if (m.getDirector() != null)       sb.append("감독: ").append(m.getDirector()).append('\n');
        if (m.getCast() != null)           sb.append("출연: ").append(m.getCast()).append('\n');
        if (m.getTagline() != null)        sb.append("태그라인: ").append(m.getTagline()).append('\n');
        if (m.getOverview() != null)       sb.append("줄거리: ").append(m.getOverview()).append('\n');

        String photoContext = buildPhotoContext(m);
        if (!photoContext.isEmpty()) {
            sb.append('\n').append("[참고 - 한국관광공사 관광공모전 수상작 중 해당 영화 키워드에 걸리는 항목]\n")
              .append(photoContext)
              .append("위 항목이 있으면 촬영지/배경지 후보 단서로만 참고하고, 확실한 근거 없이 SHOT 으로 단정하지 말 것. ")
              .append("단순 키워드 일치만으로는 confidence 최대 3 까지만 허용.\n");
        }
        return sb.toString();
    }

    /**
     * 관광공모전 사진 중 영화 제목/원제를 부분 일치 키워드로 검색해 있으면 상위 5건의
     * (촬영지명, 광역명, 키워드) 를 프롬프트에 붙인다.
     * - lDongRegnCd 를 KorService2 areaCode 로 변환해 함께 제시 → LLM 이 area_code 결정을 돕는다.
     * - 포토 API 미설정/오류는 조용히 빈 문자열 반환.
     */
    private String buildPhotoContext(NetplixMovie m) {
        try {
            if (tourPhotoPort == null || !tourPhotoPort.isConfigured()) return "";
            Map<String, TourPhoto> dedup = new LinkedHashMap<>();
            for (String kw : collectKeywords(m)) {
                for (TourPhoto p : tourPhotoPort.fetchByKeyword(kw, 5)) {
                    String id = p.getContentId();
                    if (id == null) id = nullSafe(p.getTitle()) + "|" + nullSafe(p.getFilmSite());
                    dedup.putIfAbsent(id, p);
                    if (dedup.size() >= 5) break;
                }
                if (dedup.size() >= 5) break;
            }
            if (dedup.isEmpty()) return "";
            StringBuilder sb = new StringBuilder(400);
            for (TourPhoto p : dedup.values()) {
                sb.append("- ");
                if (p.getTitle() != null) sb.append(p.getTitle());
                if (p.getFilmSite() != null) sb.append(" @ ").append(p.getFilmSite());
                String area = LDONG_TO_AREA_CODE.get(p.getLDongRegnCd());
                if (area != null) sb.append(" [areaCode=").append(area).append(']');
                if (p.getKeywords() != null && !p.getKeywords().isBlank()) {
                    String kws = p.getKeywords().trim();
                    if (kws.length() > 80) kws = kws.substring(0, 80);
                    sb.append(" · keywords: ").append(kws);
                }
                sb.append('\n');
            }
            return sb.toString();
        } catch (Exception ex) {
            log.debug("[LLM-MAPPING] 사진 컨텍스트 실패 (무시): {}", ex.getMessage());
            return "";
        }
    }

    private static List<String> collectKeywords(NetplixMovie m) {
        List<String> out = new ArrayList<>(2);
        if (m.getMovieName() != null && !m.getMovieName().isBlank()) out.add(m.getMovieName().trim());
        if (m.getOriginalTitle() != null && !m.getOriginalTitle().isBlank()
                && !m.getOriginalTitle().equalsIgnoreCase(m.getMovieName())) {
            out.add(m.getOriginalTitle().trim());
        }
        return out;
    }

    /** 시스템 프롬프트 — 구조화된 JSON 출력 강제 + 환각 방지. */
    private static final String SYSTEM_PROMPT = """
            너는 한국 영화를 실제 촬영지·배경·테마 지역과 연결하는 분석가다.
            아래 영화 정보만으로 판단이 어려우면 빈 배열을 반환한다. 절대 추측하지 말고 '근거 있는 매핑'만 반환한다.

            출력은 반드시 JSON 객체 하나 — {"mappings":[...]} 형식이며 각 원소는 다음 스키마를 따른다:
              - area_code  : 17개 광역 지자체 코드 중 하나 (문자열)
                  1=서울, 2=인천, 3=대전, 4=대구, 5=광주, 6=부산, 7=울산, 8=세종,
                  31=경기, 32=강원, 33=충북, 34=충남, 35=전북, 36=전남, 37=경북, 38=경남, 39=제주
              - region_name : 위 area_code 와 정확히 매칭되는 한국어 지역명
              - mapping_type: "SHOT"(실제 촬영지) | "BACKGROUND"(극중 배경) | "THEME"(지역을 모티브로 한 주제/분위기)
              - evidence    : 왜 이 지역과 연결되는지 40자 이내의 한국어 근거
              - confidence  : 1~5 정수. 공개된 촬영지 정보·감독 인터뷰 수준의 근거가 없으면 최대 3.

            주의:
              - 줄거리에 지명이 단순 언급된 수준이면 confidence=2.
              - "서울이 배경인 도시 영화" 같은 일반론만 있는 경우 반환하지 않는다.
              - 한 영화당 최대 3개까지만 반환한다.
            """;

    private String callChat(String userContent) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("model", MODEL);
        body.put("temperature", 0);
        body.put("response_format", Map.of("type", "json_object"));
        body.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user",   "content", userContent)
        ));

        ResponseEntity<String> res = restTemplate.exchange(
                CHAT_URL, HttpMethod.POST, new HttpEntity<>(body, headers), String.class);

        JsonNode root = mapper.readTree(res.getBody());
        return root.path("choices").path(0).path("message").path("content").asText("");
    }

    private List<MovieRegionSuggestion> parseResponse(String movieName, String rawJson) {
        if (rawJson == null || rawJson.isBlank()) return List.of();
        try {
            JsonNode root = mapper.readTree(rawJson);
            JsonNode arr = root.path("mappings");
            if (!arr.isArray() || arr.isEmpty()) return List.of();

            List<MovieRegionSuggestion> out = new ArrayList<>();
            for (JsonNode n : arr) {
                String areaCode = n.path("area_code").asText(null);
                String regionName = n.path("region_name").asText(null);
                String mappingType = n.path("mapping_type").asText("BACKGROUND").toUpperCase();
                String evidence = n.path("evidence").asText(null);
                int confidence = clamp(n.path("confidence").asInt(3), 1, 5);

                if (areaCode == null || !VALID_AREA_CODES.contains(areaCode)) continue;
                if (!VALID_MAPPING_TYPES.contains(mappingType)) mappingType = "BACKGROUND";

                out.add(MovieRegionSuggestion.builder()
                        .movieName(movieName)
                        .areaCode(areaCode)
                        .regionName(regionName)
                        .mappingType(mappingType)
                        .evidence(truncate(evidence, 500))
                        .confidence(confidence)
                        .source("LLM")
                        .rawResponse(truncate(rawJson, 2000))
                        .build());
                if (out.size() >= 3) break;
            }
            return out;
        } catch (Exception e) {
            log.warn("[LLM-MAPPING] 응답 JSON 파싱 실패 ({}): {}", movieName, e.getMessage());
            return List.of();
        }
    }

    private static int clamp(int v, int lo, int hi) { return Math.max(lo, Math.min(hi, v)); }
    private static String nullSafe(String s) { return s == null ? "" : s; }
    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
