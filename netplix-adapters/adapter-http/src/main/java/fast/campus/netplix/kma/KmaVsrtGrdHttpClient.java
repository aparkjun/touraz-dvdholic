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
 * 기상청 API허브 동네예보 격자 —
 * <ul>
 *   <li>{@code nph-dfs_odam_grd} (실황): 허브 샘플은 {@code tmfc},{@code vars},{@code authKey} 만 사용 — 전역 격자 JSON 후 클라이언트에서 nx·ny 추출.
 *   <li>{@code nph-dfs_vsrt_grd} 등 (초단기 예보): {@code tmef},{@code nx},{@code ny} 포함.
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaVsrtGrdHttpClient {

    @Value("${kma.api.dfs-vsrt-grd}")
    private String dfsVsrtGrdUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    /** 설정 URL 이 실황 격자(odam)이면 허브 샘플과 동일하게 tmef·nx·ny 를 쿼리에 넣지 않는다. */
    public boolean isOdamGrdProduct() {
        String u = dfsVsrtGrdUrl != null ? dfsVsrtGrdUrl.toLowerCase() : "";
        return u.contains("odam_grd");
    }

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(12));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param tmfc 발표(생산) 시각 — {@code yyyyMMddHHmm} 12자리 (예: 202403051010)
     * @param tmef 예보 시각 — vsrt 계열에서만 쿼리에 포함 ({@code yyyyMMddHH}). odam(실황)에서는 무시.
     * @param nx, ny 파싱용 격자 ({@link KmaLambertGridConverter}). odam 쿼리에는 포함하지 않음.
     * @param vars   조회 변수 (예: T1H 또는 T1H,PTY)
     */
    public String fetchRaw(String tmfc, String tmef, int nx, int ny, String vars) {
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }
        if (tmfc == null || vars == null || tmfc.isBlank() || vars.isBlank()) {
            return null;
        }
        boolean odam = isOdamGrdProduct();
        if (!odam && (tmef == null || tmef.isBlank())) {
            return null;
        }
        try {
            UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(dfsVsrtGrdUrl)
                    .queryParam("tmfc", tmfc)
                    .queryParam("vars", vars)
                    .queryParam("authKey", apiKey);
            if (!odam) {
                ub.queryParam("tmef", tmef).queryParam("nx", nx).queryParam("ny", ny);
            }
            URI uri = ub.build(true).toUri();
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
