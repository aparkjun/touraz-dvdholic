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
import java.util.ArrayList;
import java.util.List;

/**
 * 기상청 API허브 단기 데이터 — {@code fct_afs_ds.php}(단기 개황) 우선, 이어서 {@code fct_shrt_reg.php},
 * 모두 실패 시 {@code fct_afs_dl.php}(reg·육상 다운로드) 폴백.
 * 인증키는 서버 환경변수 {@code KMA_API_KEY} 만 사용한다 (저장소에 커밋 금지).
 */
@Slf4j
@Component
public class KmaShortRegHttpClient {

    @Value("${kma.api.fct-afs-ds:}")
    private String fctAfsDsUrl;

    @Value("${kma.api.fct-afs-dl:}")
    private String fctAfsDlUrl;

    @Value("${kma.api.fct-shrt-reg}")
    private String fctShrtRegUrl;

    @Value("${kma.auth.api-key:}")
    private String apiKey;

    @Value("${kma.auth.default-reg}")
    private String defaultReg;

    @Value("${kma.auth.default-afs-stn:109}")
    private int defaultAfsStn;

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
        if (tries.isEmpty()) {
            tries.add(KmaShortRegIssuanceTime.conservativeFallbackTmfc());
        }
        int attempts = 0;
        int catalogSkips = 0;
        Integer lastHttp = null;
        String lastPreview = null;
        String lastEx = null;
        for (String tmfc : tries) {
            if (fctAfsDsUrl != null && !fctAfsDsUrl.isBlank()) {
                OnceFetch afs = fetchAfsDsOnce(r, tmfc);
                attempts++;
                if (afs.body() != null && KmaHubJson.isHubSuccessEnvelope(afs.body())) {
                    return new KmaShortRegFetchResult(afs.body(), null, null, null, attempts, catalogSkips);
                }
                if (afs.httpStatus() != null) {
                    lastHttp = afs.httpStatus();
                }
                if (afs.nonJsonPreview() != null) {
                    lastPreview = afs.nonJsonPreview();
                }
                if (afs.exceptionSummary() != null) {
                    lastEx = afs.exceptionSummary();
                }
                if (afs.body() != null && KmaHubJson.looksLikeJson(afs.body())) {
                    lastPreview = KmaHubJson.previewSnippet(afs.body());
                }
            }
            for (boolean useJsonDisp : new boolean[] {true, false}) {
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
        if (fctAfsDlUrl != null && !fctAfsDlUrl.isBlank()) {
            OnceFetch dl = fetchFctAfsDlOnce(r);
            attempts++;
            if (dl.body() != null && KmaHubJson.isHubSuccessEnvelope(dl.body())) {
                return new KmaShortRegFetchResult(dl.body(), null, null, null, attempts, catalogSkips);
            }
            if (dl.body() != null && KmaHubJson.looksLikeJson(dl.body())) {
                lastPreview = KmaHubJson.previewSnippet(dl.body());
            }
            if (dl.nonJsonPreview() != null) {
                lastPreview = dl.nonJsonPreview();
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
        // #START7777 로 시작해도 「예보구역 목록·도움말」인 경우가 많음 (개황 본문과 구분)
        if (t.contains("단기예보구역 조회")
                || t.contains("REG_ID : 예보구역코드")
                || t.contains("REG_ID: 예보구역코드")) {
            return true;
        }
        if (t.startsWith("#START7777") && t.contains("단기예보 개황")) {
            return false;
        }
        // 단기 통보문 텍스트도 # 로 시작하며 $0# 블록을 포함 — 구역 목록이 아님
        if (body.contains("$0#")) {
            return false;
        }
        return t.startsWith("#");
    }

    /** 단기 개황 — 텍스트 응답을 표준 JSON(afsDs)으로 변환해 프록시가 동일하게 처리. */
    private OnceFetch fetchAfsDsOnce(String reg, String tmfc12) {
        int stn = KmaRegToAfsDsStn.stnForReg(reg, defaultAfsStn);
        String[] win = KmaAfsDsTimeWindow.tmfc1Tmfc2(tmfc12);
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(fctAfsDsUrl)
                    .queryParam("stn", stn)
                    .queryParam("tmfc1", win[0])
                    .queryParam("tmfc2", win[1])
                    .queryParam("disp", 0)
                    .queryParam("authKey", apiKey)
                    .build(true)
                    .toUri();
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            log.debug(
                    "KMA fct_afs_ds ok reg={} stn={} tmfc1={} tmfc2={} len={}",
                    reg,
                    stn,
                    win[0],
                    win[1],
                    body != null ? body.length() : 0);
            if (body == null || body.isBlank()) {
                return new OnceFetch(null, 200, "(empty body)", null, false);
            }
            if (KmaHubJson.looksLikeJson(body)) {
                return new OnceFetch(body, null, null, null, false);
            }
            if (!body.contains("$0#")) {
                String syn = KmaHubJson.syntheticResult(502, "fct_afs_ds: " + KmaHubJson.previewSnippet(body));
                return new OnceFetch(syn, null, null, null, false);
            }
            String json = KmaAfsDsParser.toForecastJson(body, stn, win[0], win[1]);
            if (json == null) {
                String syn =
                        KmaHubJson.syntheticResult(502, "fct_afs_ds parse: " + KmaHubJson.previewSnippet(body));
                return new OnceFetch(syn, null, null, null, false);
            }
            return new OnceFetch(json, null, null, null, false);
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            if (b != null && !b.isBlank()) {
                String trimmed = b.stripLeading();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    return new OnceFetch(b, null, null, null, false);
                }
            }
            String preview = KmaHubJson.previewSnippet(b);
            log.warn(
                    "KMA fct_afs_ds HTTP {} reg={} stn={} bodyPreview={}",
                    e.getStatusCode().value(),
                    reg,
                    stn,
                    preview);
            String syn = KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
            return new OnceFetch(syn, null, null, null, false);
        } catch (ResourceAccessException e) {
            log.warn("KMA fct_afs_ds 네트워크/타임아웃 reg={}: {}", reg, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(null, null, null, e.getClass().getSimpleName() + ": " + msg, false);
        } catch (Exception e) {
            log.warn("KMA fct_afs_ds 실패 reg={}: {}", reg, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(KmaHubJson.syntheticResult(503, msg), null, null, null, false);
        }
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
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            log.debug("KMA fct_shrt_reg ok reg={} tmfc={} disp1={} len={}", reg, tmfc, jsonDisp, body != null ? body.length() : 0);
            if (body == null || body.isBlank()) {
                return new OnceFetch(null, 200, "(empty body)", null, false);
            }
            if (isTextCatalogResponse(body)) {
                return new OnceFetch(body, null, null, null, true);
            }
            if (!KmaHubJson.looksLikeJson(body) && body.contains("$0#")) {
                int stn = KmaRegToAfsDsStn.stnForReg(reg, defaultAfsStn);
                String[] win = KmaAfsDsTimeWindow.tmfc1Tmfc2(tmfc);
                String parsed = KmaAfsDsParser.toForecastJson(body, stn, win[0], win[1]);
                if (parsed != null) {
                    return new OnceFetch(parsed, null, null, null, false);
                }
            }
            if (!KmaHubJson.looksLikeJson(body)) {
                String syn = KmaHubJson.syntheticResult(502, "Non-JSON: " + KmaHubJson.previewSnippet(body));
                return new OnceFetch(syn, null, null, null, false);
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
            String preview = KmaHubJson.previewSnippet(b);
            log.warn(
                    "KMA fct_shrt_reg HTTP {} reg={} tmfc={} bodyPreview={}",
                    e.getStatusCode().value(),
                    reg,
                    tmfc,
                    preview);
            String syn = KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
            return new OnceFetch(syn, null, null, null, false);
        } catch (ResourceAccessException e) {
            log.warn("KMA fct_shrt_reg 네트워크/타임아웃 reg={} tmfc={}: {}", reg, tmfc, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(null, null, null, e.getClass().getSimpleName() + ": " + msg, false);
        } catch (Exception e) {
            log.warn("KMA fct_shrt_reg 실패 reg={} tmfc={}: {}", reg, tmfc, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(KmaHubJson.syntheticResult(503, msg), null, null, null, false);
        }
    }

    /**
     * 단기 육상 다운로드(reg) — stn 기반 개황·shrt_reg 가 빈 응답일 때 예보 행 확보용 폴백.
     * typ01 샘플: {@code ?reg=…&disp=0&help=0&authKey=…}
     */
    private OnceFetch fetchFctAfsDlOnce(String reg) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(fctAfsDlUrl)
                    .queryParam("reg", reg)
                    .queryParam("disp", 0)
                    .queryParam("help", 0)
                    .queryParam("authKey", apiKey)
                    .build(true)
                    .toUri();
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            log.debug("KMA fct_afs_dl ok reg={} len={}", reg, body != null ? body.length() : 0);
            if (body == null || body.isBlank()) {
                return new OnceFetch(null, 200, "(empty body)", null, false);
            }
            if (KmaHubJson.looksLikeJson(body)) {
                return new OnceFetch(body, null, null, null, false);
            }
            String json = KmaFctAfsDlParser.tabularTextToSeriesJson(body, reg);
            if (json != null) {
                return new OnceFetch(json, null, null, null, false);
            }
            String syn = KmaHubJson.syntheticResult(502, "fct_afs_dl parse: " + KmaHubJson.previewSnippet(body));
            return new OnceFetch(syn, null, null, null, false);
        } catch (RestClientResponseException e) {
            String b = null;
            try {
                b = e.getResponseBodyAsString();
            } catch (Exception ignored) {
            }
            if (b != null && !b.isBlank()) {
                String trimmed = b.stripLeading();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    return new OnceFetch(b, null, null, null, false);
                }
            }
            String preview = KmaHubJson.previewSnippet(b);
            log.warn("KMA fct_afs_dl HTTP {} reg={} bodyPreview={}", e.getStatusCode().value(), reg, preview);
            String syn = KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
            return new OnceFetch(syn, null, null, null, false);
        } catch (ResourceAccessException e) {
            log.warn("KMA fct_afs_dl 네트워크/타임아웃 reg={}: {}", reg, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(null, null, null, e.getClass().getSimpleName() + ": " + msg, false);
        } catch (Exception e) {
            log.warn("KMA fct_afs_dl 실패 reg={}: {}", reg, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(KmaHubJson.syntheticResult(503, msg), null, null, null, false);
        }
    }
}
