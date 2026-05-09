package fast.campus.netplix.kma;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 기상청 API허브 단기예보(일반특보 구역) — fct_shrt_reg.php 프록시 호출용.
 * 인증키는 서버 환경변수 {@code KMA_API_KEY} 만 사용한다 (저장소에 커밋 금지).
 */
@Slf4j
@Component
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

    /** 환경변수 {@code KMA_API_KEY} / {@code KMA_AUTH_API_KEY} 로 주입된 허브용 인증키 존재 여부 */
    public boolean isApiKeyConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * @param reg          예보구역코드(reg). null 이면 default-reg.
     * @param tmfcOverride 비우면 최근 발표 시각 후보를 순차 시도. "0" 은 무시(자동과 동일).
     */
    public String fetchRaw(String reg, String tmfcOverride) {
        return fetchWithDiagnostics(reg, tmfcOverride).raw();
    }

    /**
     * {@link #fetchRaw} 와 동일 호출이나, 실패 시 HTTP·본문 미리보기·예외 요약을 함께 돌려 추적에 쓴다.
     */
    public KmaShortRegFetchResult fetchWithDiagnostics(String reg, String tmfcOverride) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("KMA_API_KEY 미설정 — 단기예보 프록시 비활성");
            return new KmaShortRegFetchResult(null, null, null, "api_key_not_configured", 0, 0);
        }
        String r = (reg != null && !reg.isBlank()) ? reg : defaultReg;
        List<String> tries = new ArrayList<>();
        if (tmfcOverride != null && !tmfcOverride.isBlank() && !"0".equals(tmfcOverride.trim())) {
            String n = KmaShortRegIssuanceTime.normalizeTmfc(tmfcOverride);
            if (n != null && n.length() >= 10) {
                tries.add(n.length() == 10 ? n + "00" : n);
            }
        }
        if (tries.isEmpty()) {
            tries.addAll(KmaShortRegIssuanceTime.candidatesNewestFirst());
        }
        int attempts = 0;
        int catalogSkips = 0;
        Integer lastHttp = null;
        String lastPreview = null;
        String lastEx = null;
        for (String tmfc : tries) {
            for (boolean useJsonDisp : new boolean[] {false, true}) {
                OnceFetch once = fetchOnceDetailed(r, tmfc, useJsonDisp);
                attempts++;
                if (once.catalogLike()) {
                    catalogSkips++;
                    log.debug(
                            "KMA fct_shrt_reg 구역 텍스트 응답 건너뜀 reg={} tmfc={} disp1={}",
                            r,
                            tmfc,
                            useJsonDisp);
                    continue;
                }
                if (once.body() != null) {
                    return new KmaShortRegFetchResult(once.body(), null, null, null, attempts, catalogSkips);
                }
                if (once.httpStatus() != null) {
                    lastHttp = once.httpStatus();
                }
                if (once.nonJsonPreview() != null) {
                    lastPreview = once.nonJsonPreview();
                }
                if (once.exceptionSummary() != null) {
                    lastEx = once.exceptionSummary();
                }
            }
        }
        log.warn("KMA fct_shrt_reg 유효 예보 본문 없음 reg={} tmfc후보={} 시도횟수={}", r, tries.size(), attempts);
        return new KmaShortRegFetchResult(null, lastHttp, lastPreview, lastEx, attempts, catalogSkips);
    }

    private record OnceFetch(
            String body, Integer httpStatus, String nonJsonPreview, String exceptionSummary, boolean catalogLike) {}

    private static boolean isTextCatalogResponse(String body) {
        if (body == null || body.isBlank()) {
            return false;
        }
        String t = body.stripLeading();
        return t.startsWith("#");
    }

    /** API허브 단기 일부 엔드포인트는 disp=1 일 때 JSON(개황) 형태로 내려준다. */
    private OnceFetch fetchOnceDetailed(String reg, String tmfc, boolean jsonDisp) {
        try {
            UriComponentsBuilder ub = UriComponentsBuilder.fromHttpUrl(fctShrtRegUrl)
                    .queryParam("tmfc", tmfc)
                    .queryParam("reg", reg)
                    .queryParam("authKey", apiKey);
            if (jsonDisp) {
                ub.queryParam("disp", 1);
            }
            URI uri = ub.build(true).toUri();
            String body = restClient().get().uri(uri).retrieve().body(String.class);
            log.debug("KMA fct_shrt_reg ok reg={} tmfc={} disp1={} len={}", reg, tmfc, jsonDisp, body != null ? body.length() : 0);
            if (body != null && isTextCatalogResponse(body)) {
                return new OnceFetch(body, null, null, null, true);
            }
            return new OnceFetch(body, null, null, null, false);
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            if (b != null && !b.isBlank()) {
                String trimmed = b.stripLeading();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    log.warn("KMA fct_shrt_reg HTTP {} reg={} tmfc={} — 응답 본문 반환.", e.getStatusCode().value(), reg, tmfc);
                    return new OnceFetch(b, null, null, null, false);
                }
            }
            String preview =
                    (b == null || b.isEmpty())
                            ? "(empty)"
                            : (b.length() > 400 ? b.substring(0, 400) + "…" : b).replaceAll("\\s+", " ").trim();
            log.warn(
                    "KMA fct_shrt_reg HTTP {} reg={} tmfc={} bodyPreview={}",
                    e.getStatusCode().value(),
                    reg,
                    tmfc,
                    preview);
            return new OnceFetch(null, e.getStatusCode().value(), preview, null, false);
        } catch (Exception e) {
            log.warn("KMA fct_shrt_reg 실패 reg={} tmfc={}: {}", reg, tmfc, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(null, null, null, e.getClass().getSimpleName() + ": " + msg, false);
        }
    }
}
