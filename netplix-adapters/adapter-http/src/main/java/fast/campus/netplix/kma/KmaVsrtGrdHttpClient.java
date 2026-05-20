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
 * 기상청 API허브 동네예보 격자 —
 * <ul>
 *   <li>주소 {@code kma.api.dfs-vsrt-grd}: 보통 {@code nph-dfs_vsrt_grd}(초단기 예보 격자, tmef·nx·ny).
 *   <li>선택 {@code kma.api.dfs-odam-grd}: {@code nph-dfs_odam_grd}(실황) — 초단기 실패 시 폴백.
 * </ul>
 */
@Slf4j
@Component
public class KmaVsrtGrdHttpClient {

    /** 초단기 예보 격자 권장. 예전처럼 실황만 쓸 경우 odam URL 단독 지정 가능 */
    @Value("${kma.api.dfs-vsrt-grd}")
    private String dfsVsrtGrdUrl;

    /** 실황 격자 폴백 URL — 비우면 폴백 없음 */
    @Value("${kma.api.dfs-odam-grd:}")
    private String dfsOdamGrdUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    private String hubAuthKey() {
        return apiKey == null ? "" : apiKey.trim();
    }

    /** 기본(주소)이 실황(odam) 전용 URL 인지 */
    public boolean primaryUrlIsOdam() {
        return isOdamUrl(dfsVsrtGrdUrl);
    }

    /** 하위 호환: 예전 메서드명 */
    public boolean isOdamGrdProduct() {
        return primaryUrlIsOdam();
    }

    public boolean hasOdamFallback() {
        return dfsOdamGrdUrl != null && !dfsOdamGrdUrl.isBlank();
    }

    /** 허브 키·격자 API URL 이 있으면 초단기(vsrt) 조회 가능 */
    public boolean isConfigured() {
        return !hubAuthKey().isEmpty() && !effectiveBaseUrl(false).isBlank();
    }

    /**
     * 이번 호출에 쓰는 베이스 URL이 odam(실황)이면 tmef·nx·ny 를 쿼리에 넣지 않는다.
     *
     * @param useOdamFallback true 이면 {@link #dfsOdamGrdUrl} 로 호출(설정된 경우).
     */
    public boolean isOdamEffective(boolean useOdamFallback) {
        return isOdamUrl(effectiveBaseUrl(useOdamFallback));
    }

    private String effectiveBaseUrl(boolean useOdamFallback) {
        if (useOdamFallback && hasOdamFallback()) {
            return dfsOdamGrdUrl.trim();
        }
        return dfsVsrtGrdUrl != null ? dfsVsrtGrdUrl.trim() : "";
    }

    private static boolean isOdamUrl(String url) {
        return url != null && url.toLowerCase().contains("odam_grd");
    }

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(6));
        factory.setReadTimeout(Duration.ofSeconds(18));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param tmfc 발표(생산) 시각 — {@code yyyyMMddHHmm} 12자리 (예: 202403051010)
     * @param tmef 예보 시각 — vsrt 계열에서만 쿼리에 포함 ({@code yyyyMMddHH}). odam(실황)에서는 무시.
     * @param nx, ny 파싱용 격자 ({@link KmaLambertGridConverter}). odam 쿼리에는 포함하지 않음.
     * @param vars   조회 변수 (예: T1H 또는 T1H,PTY)
     */
    public String fetchRaw(String tmfc, String tmef, int nx, int ny, String vars) {
        return fetchRaw(tmfc, tmef, nx, ny, vars, false);
    }

    public String fetchRaw(String tmfc, String tmef, int nx, int ny, String vars, boolean useOdamFallback) {
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }
        if (useOdamFallback && !hasOdamFallback()) {
            return null;
        }
        if (tmfc == null || vars == null || tmfc.isBlank() || vars.isBlank()) {
            return null;
        }
        String base = effectiveBaseUrl(useOdamFallback);
        if (base.isBlank()) {
            return null;
        }
        boolean odam = isOdamUrl(base);
        if (!odam && (tmef == null || tmef.isBlank())) {
            return null;
        }
        try {
            UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(base)
                    .queryParam("tmfc", tmfc)
                    .queryParam("vars", vars)
                    .queryParam("authKey", hubAuthKey());
            if (!odam) {
                ub.queryParam("tmef", tmef).queryParam("nx", nx).queryParam("ny", ny);
            }
            URI uri = ub.build(true).toUri();
            RestClient rc = restClient();
            String body = null;
            long hubMs = 0;
            String baseKind = base.contains("odam") ? "odam" : "vsrt";
            {
                long hub0 = System.nanoTime();
                try {
                    body = KmaHubJson.getWithRetry(rc, uri);
                } finally {
                    hubMs = (System.nanoTime() - hub0) / 1_000_000L;
                    int len = body != null ? body.length() : -1;
                    if (hubMs >= 2_000) {
                        log.warn(
                                "KMA dfs_grd 허브 지연 hubLatencyMs={} base={} tmfc={} tmef={} nx={} ny={} odamFb={} len={}",
                                hubMs,
                                baseKind,
                                tmfc,
                                tmef,
                                nx,
                                ny,
                                useOdamFallback,
                                len);
                    } else {
                        log.debug(
                                "KMA dfs_grd hubLatencyMs={} base={} tmfc={} tmef={} nx={} ny={} odamFb={} len={}",
                                hubMs,
                                baseKind,
                                tmfc,
                                tmef,
                                nx,
                                ny,
                                useOdamFallback,
                                len);
                    }
                }
            }
            if (body == null || body.isBlank()) {
                return KmaHubJson.syntheticResult(502, "(empty body)");
            }
            if (!KmaHubJson.looksLikeJson(body)) {
                return KmaHubJson.syntheticResult(502, "Non-JSON: " + KmaHubJson.previewSnippet(body));
            }
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
