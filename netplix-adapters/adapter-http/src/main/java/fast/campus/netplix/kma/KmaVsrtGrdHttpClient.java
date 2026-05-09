package fast.campus.netplix.kma;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;

/**
 * 기상청 API허브 동네예보 초단기 격자 — {@code nph-dfs_vsrt_grd}.
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
            String body = restClient().get().uri(uri).retrieve().body(String.class);
            log.debug("KMA dfs_vsrt_grd ok tmfc={} tmef={} len={}", tmfc, tmef, body != null ? body.length() : 0);
            return body;
        } catch (Exception e) {
            log.warn("KMA dfs_vsrt_grd 실패 tmfc={} tmef={}: {}", tmfc, tmef, e.getMessage());
            return null;
        }
    }
}
