package fast.campus.netplix.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.movie.MovieRagPort;
import fast.campus.netplix.movie.NetplixMovie;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OpenAI 임베딩(text-embedding-3-small) 기반 인메모리 RAG 포트.
 * Spring AI 대신 경량 구현 — Spring Boot 3.3 호환성 문제 회피 + 외부 의존성 최소화.
 *
 * 동작:
 *  1. 앱 기동 시 {@link MovieRagLoader} 가 영화 500편을 addMovieDocuments 로 넘겨줌
 *  2. 제목·장르·개요·감독·캐스트·태그라인을 하나의 문서 문자열로 합침
 *  3. OpenAI /v1/embeddings 로 배치 임베딩(1회에 최대 100개)
 *  4. 메모리 맵(movieName -> float[]) 에 적재
 *  5. 질의 시 질의도 임베딩 → 코사인 유사도 top-K 반환
 *
 * OPENAI_API_KEY 가 비어 있으면 isAvailable() = false 로 비활성.
 */
@Slf4j
@Primary
@Component
public class OpenAiMovieRagPort implements MovieRagPort {

    private static final String EMBEDDING_URL = "https://api.openai.com/v1/embeddings";
    private static final String EMBEDDING_MODEL = "text-embedding-3-small";
    private static final int BATCH_SIZE = 64;
    private static final int CONNECT_TIMEOUT_SEC = 10;
    private static final int READ_TIMEOUT_SEC = 60;

    @Value("${openai.api-key:}")
    private String apiKey;

    private final ObjectMapper mapper = new ObjectMapper();
    private final RestTemplate restTemplate = createRestTemplate();
    private final Map<String, float[]> vectors = new ConcurrentHashMap<>();
    private volatile boolean ready = false;

    private static RestTemplate createRestTemplate() {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(CONNECT_TIMEOUT_SEC));
        factory.setReadTimeout(Duration.ofSeconds(READ_TIMEOUT_SEC));
        return new RestTemplate(factory);
    }

    @PostConstruct
    void init() {
        if (apiKey == null || apiKey.isBlank()) {
            log.info("OpenAI API 키 미설정 → RAG 비활성");
        } else {
            log.info("OpenAI RAG 포트 활성 — 모델={}, 문서는 기동 후 적재됩니다.", EMBEDDING_MODEL);
        }
    }

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public void addMovieDocuments(List<NetplixMovie> movies) {
        if (!isAvailable() || movies == null || movies.isEmpty()) return;

        List<String> names = new ArrayList<>(movies.size());
        List<String> texts = new ArrayList<>(movies.size());
        for (NetplixMovie m : movies) {
            if (m.getMovieName() == null || m.getMovieName().isBlank()) continue;
            if (vectors.containsKey(m.getMovieName())) continue;
            names.add(m.getMovieName());
            texts.add(buildDocument(m));
        }
        if (texts.isEmpty()) {
            ready = true;
            return;
        }

        int ok = 0;
        for (int from = 0; from < texts.size(); from += BATCH_SIZE) {
            int to = Math.min(from + BATCH_SIZE, texts.size());
            List<String> nameSub = names.subList(from, to);
            List<String> textSub = texts.subList(from, to);
            try {
                List<float[]> embs = embedBatch(textSub);
                for (int i = 0; i < embs.size() && i < nameSub.size(); i++) {
                    vectors.put(nameSub.get(i), embs.get(i));
                    ok++;
                }
            } catch (Exception e) {
                log.warn("RAG 임베딩 배치 실패({}건): {}", textSub.size(), e.getMessage());
            }
        }
        ready = !vectors.isEmpty();
        log.info("RAG 영화 문서 적재 완료: 요청={}편 / 누적={}편 (이번 배치 성공 {})", texts.size(), vectors.size(), ok);
    }

    @Override
    public List<String> findSimilarMovieNames(String query, int topK) {
        if (!isAvailable() || !ready || query == null || query.isBlank() || vectors.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            float[] q = embedBatch(List.of(query)).get(0);
            List<Map.Entry<String, Double>> scored = new ArrayList<>(vectors.size());
            for (Map.Entry<String, float[]> e : vectors.entrySet()) {
                scored.add(Map.entry(e.getKey(), cosine(q, e.getValue())));
            }
            scored.sort(Comparator.comparingDouble(Map.Entry<String, Double>::getValue).reversed());
            int limit = Math.min(topK, scored.size());
            List<String> result = new ArrayList<>(limit);
            for (int i = 0; i < limit; i++) result.add(scored.get(i).getKey());
            return result;
        } catch (Exception e) {
            log.warn("RAG 질의 임베딩 실패: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    private String buildDocument(NetplixMovie m) {
        StringBuilder sb = new StringBuilder(512);
        sb.append("제목: ").append(nullSafe(m.getMovieName()));
        if (m.getOriginalTitle() != null) sb.append(" (원제: ").append(m.getOriginalTitle()).append(")");
        sb.append('\n');
        if (m.getGenre() != null) sb.append("장르: ").append(m.getGenre()).append('\n');
        if (m.getDirector() != null) sb.append("감독: ").append(m.getDirector()).append('\n');
        if (m.getCast() != null) sb.append("출연: ").append(m.getCast()).append('\n');
        if (m.getTagline() != null) sb.append("한 줄: ").append(m.getTagline()).append('\n');
        if (m.getOverview() != null) sb.append("개요: ").append(m.getOverview()).append('\n');
        if (m.getReleasedAt() != null) sb.append("개봉: ").append(m.getReleasedAt()).append('\n');
        if (m.getContentType() != null) sb.append("타입: ").append(m.getContentType()).append('\n');
        return sb.toString();
    }

    private String nullSafe(String s) {
        return s == null ? "" : s;
    }

    private List<float[]> embedBatch(List<String> texts) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("model", EMBEDDING_MODEL);
        body.put("input", texts);

        ResponseEntity<String> res = restTemplate.exchange(
                EMBEDDING_URL, HttpMethod.POST,
                new HttpEntity<>(body, headers), String.class);

        JsonNode root = mapper.readTree(res.getBody());
        JsonNode data = root.path("data");
        List<float[]> out = new ArrayList<>(data.size());
        for (JsonNode item : data) {
            JsonNode emb = item.path("embedding");
            float[] v = new float[emb.size()];
            for (int i = 0; i < emb.size(); i++) v[i] = (float) emb.get(i).asDouble();
            out.add(v);
        }
        return out;
    }

    private static double cosine(float[] a, float[] b) {
        if (a == null || b == null || a.length != b.length) return 0.0;
        double dot = 0, na = 0, nb = 0;
        for (int i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        if (na == 0 || nb == 0) return 0.0;
        return dot / (Math.sqrt(na) * Math.sqrt(nb));
    }

    public int size() {
        return vectors.size();
    }
}
