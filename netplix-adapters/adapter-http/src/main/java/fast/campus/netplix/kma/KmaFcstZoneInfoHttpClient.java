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
 * 기상청 API허브 typ02 — 예보구역정보서비스 {@code getFcstZoneCd}.
 *
 * @see <a href="https://apihub.kma.go.kr">apihub.kma.go.kr</a>
 */
@Slf4j
@Component
public class KmaFcstZoneInfoHttpClient {

    @Value("${kma.api.fcst-zone-info-get-zone-cd:}")
    private String fcstZoneCdUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    private String hubAuthKey() {
        return apiKey == null ? "" : apiKey.trim();
    }

    public boolean isConfigured() {
        return fcstZoneCdUrl != null && !fcstZoneCdUrl.isBlank() && !hubAuthKey().isEmpty();
    }

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(6));
        factory.setReadTimeout(Duration.ofSeconds(18));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param regId 예보구역코드 (예: 11A00101)
     * @return 응답 XML 본문, 미설정·오류 시 null
     */
    public String fetchGetFcstZoneCdXml(String regId, int pageNo, int numOfRows) {
        if (!isConfigured()) {
            return null;
        }
        if (regId == null || regId.isBlank()) {
            return null;
        }
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(fcstZoneCdUrl.trim())
                    .queryParam("pageNo", pageNo)
                    .queryParam("numOfRows", numOfRows)
                    .queryParam("dataType", "XML")
                    .queryParam("regId", regId.trim())
                    .queryParam("authKey", hubAuthKey())
                    .build(true)
                    .toUri();
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            if (body == null || body.isBlank()) {
                log.warn("FcstZoneInfo getFcstZoneCd 빈 본문 regId={}", regId);
                return null;
            }
            log.debug("FcstZoneInfo getFcstZoneCd ok regId={} len={}", regId, body.length());
            return body;
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            log.warn(
                    "FcstZoneInfo getFcstZoneCd HTTP {} regId={} bodyPreview={}",
                    e.getStatusCode().value(),
                    regId,
                    KmaHubJson.previewSnippet(b));
            return null;
        } catch (ResourceAccessException e) {
            log.warn("FcstZoneInfo getFcstZoneCd 네트워크/타임아웃 regId={}: {}", regId, e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("FcstZoneInfo getFcstZoneCd 실패 regId={}: {}", regId, e.getMessage());
            return null;
        }
    }
}
