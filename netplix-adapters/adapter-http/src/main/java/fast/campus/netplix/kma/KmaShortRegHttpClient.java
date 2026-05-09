package fast.campus.netplix.kma;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;

/**
 * 기상청 API허브 단기예보(일반특보 구역) — fct_shrt_reg.php 프록시 호출용.
 * 인증키는 서버 환경변수 {@code KMA_API_KEY} 만 사용한다 (저장소에 커밋 금지).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaShortRegHttpClient {

    @Value("${kma.api.fct-shrt-reg}")
    private String fctShrtRegUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    @Value("${kma.auth.default-reg}")
    private String defaultReg;

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(8));
        factory.setReadTimeout(Duration.ofSeconds(25));
        return RestClient.builder().requestFactory(factory).build();
    }

    /**
     * @param reg     예보구역코드(reg). null 이면 default-reg.
     * @param tmfc    API 문서 기준 발표시각 플래그 — null 이면 0.
     */
    public String fetchRaw(String reg, Integer tmfc) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("KMA_API_KEY 미설정 — 단기예보 프록시 비활성");
            return null;
        }
        String r = (reg != null && !reg.isBlank()) ? reg : defaultReg;
        int tm = tmfc != null ? tmfc : 0;
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(fctShrtRegUrl)
                    .queryParam("tmfc", tm)
                    .queryParam("reg", r)
                    .queryParam("authKey", apiKey)
                    .build(true)
                    .toUri();
            String body = restClient().get().uri(uri).retrieve().body(String.class);
            log.debug("KMA fct_shrt_reg ok reg={} len={}", r, body != null ? body.length() : 0);
            return body;
        } catch (RestClientResponseException e) {
            String snippet = "";
            try {
                String b = e.getResponseBodyAsString();
                if (b != null && !b.isEmpty()) {
                    snippet = b.length() > 400 ? b.substring(0, 400) + "…" : b;
                }
            } catch (Exception ignored) {
            }
            log.warn(
                    "KMA fct_shrt_reg HTTP {} reg={} — 인증·승인·일일한도·엔드포인트를 확인하세요. bodyPreview={}",
                    e.getStatusCode().value(),
                    r,
                    snippet.isEmpty() ? "(empty)" : snippet.replaceAll("\\s+", " ").trim());
            return null;
        } catch (Exception e) {
            log.warn("KMA fct_shrt_reg 실패 reg={}: {}", r, e.getMessage());
            return null;
        }
    }
}
