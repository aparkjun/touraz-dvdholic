package fast.campus.netplix.kma;

import lombok.RequiredArgsConstructor;
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
 * 기상청 API허브 동네예보 초단기 격자 —
 * {@code nph-dfs_odam_grd}, {@code nph-dfs_vsrt_grd} 등(설정 URL).
 * 예: {@code ?tmfc=202403011010&tmef=2024030111&vars=T1H&authKey=...}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaVsrtGrdHttpClient {

    @Value("${kma.api.dfs-vsrt-grd}")
    private String dfsVsrtGrdUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(8));
        factory.setReadTimeout(Duration.ofSeconds(25));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param tmfc 발표(생산) 시각 — {@code yyyyMMddHHmm} 12자리 (예: 202403011010)
     * @param tmef 예보 시각 — API 샘플 기준 {@code yyyyMMddHH} 10자리 (예: 2024030111)
     * @param vars   조회 변수 (예: T1H 또는 T1H,PTY)
     */
    public String fetchRaw(String tmfc, String tmef, String vars) {
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }
        if (tmfc == null || tmef == null || vars == null || tmfc.isBlank() || tmef.isBlank() || vars.isBlank()) {
            return null;
        }
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(dfsVsrtGrdUrl)
                    .queryParam("tmfc", tmfc)
                    .queryParam("tmef", tmef)
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
            log.debug("KMA dfs_grd ok tmfc={} tmef={} len={}", tmfc, tmef, body.length());
            return body;
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            if (b != null && !b.isBlank() && KmaHubJson.looksLikeJson(b)) {
                log.warn(
                        "KMA dfs_grd HTTP {} tmfc={} tmef={} — JSON 본문 반환",
                        e.getStatusCode().value(),
                        tmfc,
                        tmef);
                return b;
            }
            String preview = KmaHubJson.previewSnippet(b);
            log.warn(
                    "KMA dfs_grd HTTP {} tmfc={} tmef={} bodyPreview={}",
                    e.getStatusCode().value(),
                    tmfc,
                    tmef,
                    preview);
            return KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
        } catch (ResourceAccessException e) {
            log.warn("KMA dfs_grd 네트워크/타임아웃 tmfc={} tmef={}: {}", tmfc, tmef, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return KmaHubJson.syntheticResult(503, e.getClass().getSimpleName() + ": " + msg);
        } catch (Exception e) {
            log.warn("KMA dfs_grd 실패 tmfc={} tmef={}: {}", tmfc, tmef, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return KmaHubJson.syntheticResult(503, msg);
        }
    }
}
