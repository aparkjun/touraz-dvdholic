package fast.campus.netplix.kma;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;

/**
 * 기상청 API허브 동네예보 단기(3시간 간격) 격자 — {@code nph-dfs_shrt_grd}.
 * 격자점 축소를 위해 {@code nx},{@code ny} 를 쿼리에 포함한다.
 */
@Slf4j
@Component
public class KmaShrtGrdHttpClient {

    @Value("${kma.api.dfs-shrt-grd:}")
    private String dfsShrtGrdUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    public boolean isConfigured() {
        return dfsShrtGrdUrl != null
                && !dfsShrtGrdUrl.isBlank()
                && apiKey != null
                && !apiKey.isBlank();
    }

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(8));
        factory.setReadTimeout(Duration.ofSeconds(25));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param tmfc 발표 시각 {@code yyyyMMddHHmm}
     * @param tmef 예보 시각(유효시간) {@code yyyyMMddHH} — 초단기 격자와 동일 패턴
     */
    public String fetchRaw(String tmfc, String tmef, int nx, int ny, String vars) {
        if (!isConfigured()) {
            return null;
        }
        if (tmfc == null
                || tmef == null
                || vars == null
                || tmfc.isBlank()
                || tmef.isBlank()
                || vars.isBlank()) {
            return null;
        }
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(dfsShrtGrdUrl.trim())
                    .queryParam("tmfc", tmfc)
                    .queryParam("tmef", tmef)
                    .queryParam("nx", nx)
                    .queryParam("ny", ny)
                    .queryParam("vars", vars)
                    .queryParam("authKey", apiKey)
                    .build(true)
                    .toUri();
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            if (body == null || body.isBlank()) {
                return KmaHubJson.syntheticResult(502, "(empty body)");
            }
            if (!KmaHubJson.looksLikeJson(body)) {
                return KmaHubJson.syntheticResult(502, "Non-JSON: " + KmaHubJson.previewSnippet(body));
            }
            log.debug("KMA dfs_shrt_grd ok tmfc={} tmef={} nx={} ny={} len={}", tmfc, tmef, nx, ny, body.length());
            return body;
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            if (b != null && !b.isBlank() && KmaHubJson.looksLikeJson(b)) {
                log.warn(
                        "KMA dfs_shrt_grd HTTP {} tmfc={} tmef={} — JSON 본문 반환",
                        e.getStatusCode().value(),
                        tmfc,
                        tmef);
                return b;
            }
            String preview = KmaHubJson.previewSnippet(b);
            log.warn("KMA dfs_shrt_grd HTTP {} tmfc={} tmef={} bodyPreview={}", e.getStatusCode().value(), tmfc, tmef, preview);
            return KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
        } catch (ResourceAccessException e) {
            log.warn("KMA dfs_shrt_grd 네트워크/타임아웃 tmfc={} tmef={}: {}", tmfc, tmef, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return KmaHubJson.syntheticResult(503, e.getClass().getSimpleName() + ": " + msg);
        } catch (Exception e) {
            log.warn("KMA dfs_shrt_grd 실패 tmfc={} tmef={}: {}", tmfc, tmef, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return KmaHubJson.syntheticResult(503, msg);
        }
    }
}
