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
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * 기상청 API허브 단기 데이터 — {@code fct_afs_ds.php}(단기 개황) 우선, 이어서 {@code fct_shrt_reg.php}.
 * 인증키는 서버 환경변수 {@code KMA_API_KEY} 만 사용한다 (저장소에 커밋 금지).
 */
@Slf4j
@Component
public class KmaShortRegHttpClient {

    /** 자동 tmfc 후보가 많으면 끝까지 시도 시 Heroku 30초 한도에 걸린다 — 최신 N회만 시도 (HH00+HH10·정각 중복 확장 반영) */
    private static final int MAX_AUTO_TMFC_CANDIDATES = 14;

    @Value("${kma.api.fct-afs-ds:}")
    private String fctAfsDsUrl;

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
        factory.setConnectTimeout(Duration.ofSeconds(6));
        factory.setReadTimeout(Duration.ofSeconds(18));
        return RestClient.builder().requestFactory(factory).build();
    }

    /** Heroku 등에서 복사 시 붙는 앞뒤 공백·개행 제거 (허브는 불일치 시 전부 실패로 보임). */
    private String hubAuthKey() {
        return apiKey == null ? "" : apiKey.trim();
    }

    /** 환경변수 {@code KMA_API_KEY} / {@code KMA_AUTH_API_KEY} 로 주입된 허브용 인증키 존재 여부 */
    public boolean isApiKeyConfigured() {
        return !hubAuthKey().isEmpty();
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
        if (hubAuthKey().isEmpty()) {
            log.warn("KMA_API_KEY 미설정 — 단기예보 프록시 비활성");
            return new KmaShortRegFetchResult(null, null, null, "api_key_not_configured", 0, 0);
        }
        String r = (reg != null && !reg.isBlank()) ? reg : defaultReg;
        boolean autoTmfc =
                tmfcOverride == null || tmfcOverride.isBlank() || "0".equals(tmfcOverride.trim());
        List<String> tries = new ArrayList<>();
        if (!autoTmfc) {
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
        if (autoTmfc) {
            tries = expandTmfcCandidatesWithHourFloor(tries);
        }
        if (autoTmfc && tries.size() > MAX_AUTO_TMFC_CANDIDATES) {
            tries = new ArrayList<>(tries.subList(0, MAX_AUTO_TMFC_CANDIDATES));
        }
        int attempts = 0;
        int catalogSkips = 0;
        Integer lastHttp = null;
        String lastPreview = null;
        String lastEx = null;
        boolean useAfs = fctAfsDsUrl != null && !fctAfsDsUrl.isBlank();
        // disp=1(JSON)은 tmfc마다 반복하면 라우터 30초 한도에 걸리기 쉬움 — 최신 후보 1회만 시도
        if (useAfs && !tries.isEmpty()) {
            int stn0 = KmaRegToAfsDsStn.stnForReg(r, defaultAfsStn);
            OnceFetch disp1Once = afsDsHttp(r, stn0, tries.get(0), 1);
            attempts++;
            if (disp1Once.body() != null && KmaHubJson.isHubSuccessEnvelope(disp1Once.body())) {
                return new KmaShortRegFetchResult(disp1Once.body(), null, null, null, attempts, catalogSkips);
            }
            if (disp1Once.httpStatus() != null) {
                lastHttp = disp1Once.httpStatus();
            }
            if (disp1Once.nonJsonPreview() != null) {
                lastPreview = disp1Once.nonJsonPreview();
            }
            if (disp1Once.exceptionSummary() != null) {
                lastEx = disp1Once.exceptionSummary();
            }
            if (disp1Once.body() != null && KmaHubJson.looksLikeJson(disp1Once.body())) {
                lastPreview = KmaHubJson.previewSnippet(disp1Once.body());
            }
        }
        for (String tmfc : tries) {
            AfsBundle afsB = useAfs ? fetchAfsDsTextStrategiesOnly(r, tmfc) : null;
            OnceFetch afs = afsB != null ? afsB.fetch() : null;
            if (useAfs) {
                attempts += afsB != null ? afsB.rounds() : 0;
            }

            if (useAfs && afs != null) {
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

            OnceFetch shrtJ = fetchOnceDetailed(r, tmfc, true);
            attempts++;
            if (!shrtJ.catalogLike()
                    && shrtJ.body() != null
                    && !KmaHubJson.isHubJsonOnlyErrorEnvelope(shrtJ.body())) {
                return new KmaShortRegFetchResult(shrtJ.body(), null, null, null, attempts, catalogSkips);
            }
            if (shrtJ.catalogLike()) {
                catalogSkips++;
                log.debug("KMA fct_shrt_reg 구역 텍스트 응답 건너뜀 reg={} tmfc={} disp1={}", r, tmfc, true);
            } else {
                if (shrtJ.httpStatus() != null) {
                    lastHttp = shrtJ.httpStatus();
                }
                if (shrtJ.nonJsonPreview() != null) {
                    lastPreview = shrtJ.nonJsonPreview();
                }
                if (shrtJ.exceptionSummary() != null) {
                    lastEx = shrtJ.exceptionSummary();
                }
            }

            OnceFetch shrtP = fetchOnceDetailed(r, tmfc, false);
            attempts++;
            if (!shrtP.catalogLike()
                    && shrtP.body() != null
                    && !KmaHubJson.isHubJsonOnlyErrorEnvelope(shrtP.body())) {
                return new KmaShortRegFetchResult(shrtP.body(), null, null, null, attempts, catalogSkips);
            }
            if (shrtP.catalogLike()) {
                catalogSkips++;
                log.debug("KMA fct_shrt_reg 구역 텍스트 응답 건너뜀 reg={} tmfc={} disp1={}", r, tmfc, false);
            } else {
                if (shrtP.httpStatus() != null) {
                    lastHttp = shrtP.httpStatus();
                }
                if (shrtP.nonJsonPreview() != null) {
                    lastPreview = shrtP.nonJsonPreview();
                }
                if (shrtP.exceptionSummary() != null) {
                    lastEx = shrtP.exceptionSummary();
                }
            }
        }
        log.warn(
                "KMA fct_shrt_reg 유효 예보 본문 없음 reg={} tmfc후보={} 시도횟수={} catalogSkips={} lastHttp={} lastEx={} lastPreview={}",
                r,
                tries.size(),
                attempts,
                catalogSkips,
                lastHttp,
                lastEx != null ? (lastEx.length() > 160 ? lastEx.substring(0, 160) + "…" : lastEx) : null,
                lastPreview != null ? KmaHubJson.previewSnippet(lastPreview) : null);
        return new KmaShortRegFetchResult(null, lastHttp, lastPreview, lastEx, attempts, catalogSkips);
    }

    private record OnceFetch(
            String body, Integer httpStatus, String nonJsonPreview, String exceptionSummary, boolean catalogLike) {}

    /** fct_afs_ds 다중 전략(disp=1 JSON → disp=0 텍스트·-3h 백오프) 결과 + HTTP 라운드 수 */
    private record AfsBundle(OnceFetch fetch, int rounds) {}

    private static List<String> expandTmfcCandidatesWithHourFloor(List<String> tries) {
        LinkedHashSet<String> s = new LinkedHashSet<>();
        for (String t : tries) {
            if (t == null || t.isBlank()) {
                continue;
            }
            s.add(t.trim());
            String n = KmaShortRegIssuanceTime.normalizeTmfc(t);
            if (n != null && n.length() >= 12) {
                String floored = n.substring(0, 10) + "00";
                if (!floored.equals(n.substring(0, 12))) {
                    s.add(floored);
                }
            }
        }
        List<String> out = new ArrayList<>(s);
        out.sort(Comparator.reverseOrder());
        return out;
    }

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

    /**
     * 단기 개황(fct_afs_ds) 텍스트 경로만: {@code disp=0} 본 창 → 동일 관서 발표시각 -3h 재시도.
     * {@code disp=1}(JSON)은 {@link #fetchWithDiagnostics}에서 최신 tmfc 1회만 호출한다.
     */
    private AfsBundle fetchAfsDsTextStrategiesOnly(String reg, String tmfc12) {
        if (fctAfsDsUrl == null || fctAfsDsUrl.isBlank()) {
            return new AfsBundle(null, 0);
        }
        int stn = KmaRegToAfsDsStn.stnForReg(reg, defaultAfsStn);
        int rounds = 0;
        OnceFetch last = null;

        String tPrimary = KmaShortRegIssuanceTime.normalizeTmfc(tmfc12);
        if (tPrimary == null) {
            return new AfsBundle(last, rounds);
        }
        List<String> textTmfcTries = new ArrayList<>();
        textTmfcTries.add(tPrimary);
        String tMinus3 = KmaAfsDsTimeWindow.shiftTmfc12(tPrimary, -3);
        if (tMinus3 != null && !tMinus3.equals(tPrimary)) {
            textTmfcTries.add(tMinus3);
        }
        for (String t12 : textTmfcTries) {
            OnceFetch z = afsDsHttp(reg, stn, t12, 0);
            rounds++;
            last = z;
            if (z.body() != null && KmaHubJson.isHubSuccessEnvelope(z.body())) {
                return new AfsBundle(z, rounds);
            }
            if (z.body() != null && !KmaHubJson.looksLikeJson(z.body()) && z.body().contains("$0#")) {
                String[] win = KmaAfsDsTimeWindow.tmfc1Tmfc2(t12);
                String json = KmaAfsDsParser.toForecastJson(z.body(), stn, win[0], win[1]);
                if (json != null) {
                    return new AfsBundle(new OnceFetch(json, null, null, null, false), rounds);
                }
            }
            if (z.body() != null && KmaHubJson.looksLikeJson(z.body()) && !KmaHubJson.isHubJsonOnlyErrorEnvelope(z.body())) {
                return new AfsBundle(z, rounds);
            }
        }
        return new AfsBundle(last, rounds);
    }

    private OnceFetch afsDsHttp(String reg, int stn, String tmfc12, int disp) {
        String[] win = KmaAfsDsTimeWindow.tmfc1Tmfc2(tmfc12);
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(fctAfsDsUrl.trim())
                    .queryParam("stn", stn)
                    .queryParam("tmfc1", win[0])
                    .queryParam("tmfc2", win[1])
                    .queryParam("disp", disp)
                    .queryParam("authKey", hubAuthKey())
                    .build(true)
                    .toUri();
            RestClient rc = restClient();
            String body = KmaHubJson.getWithRetry(rc, uri);
            log.debug(
                    "KMA fct_afs_ds reg={} stn={} disp={} tmfc1={} tmfc2={} len={}",
                    reg,
                    stn,
                    disp,
                    win[0],
                    win[1],
                    body != null ? body.length() : 0);
            if (body == null || body.isBlank()) {
                return new OnceFetch(null, 200, "(empty body)", null, false);
            }
            if (disp == 1) {
                if (KmaHubJson.looksLikeJson(body)) {
                    return new OnceFetch(body, null, null, null, false);
                }
                String syn =
                        KmaHubJson.syntheticResult(502, "fct_afs_ds disp=1 Non-JSON: " + KmaHubJson.previewSnippet(body));
                return new OnceFetch(syn, null, null, null, false);
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
                    "KMA fct_afs_ds HTTP {} reg={} stn={} disp={} bodyPreview={}",
                    e.getStatusCode().value(),
                    reg,
                    stn,
                    disp,
                    preview);
            String syn = KmaHubJson.syntheticResult(e.getStatusCode().value(), preview);
            return new OnceFetch(syn, null, null, null, false);
        } catch (ResourceAccessException e) {
            log.warn("KMA fct_afs_ds 네트워크/타임아웃 reg={} disp={}: {}", reg, disp, e.getMessage());
            String msg = e.getMessage() != null ? e.getMessage() : e.toString();
            if (msg.length() > 240) {
                msg = msg.substring(0, 240) + "…";
            }
            return new OnceFetch(null, null, null, e.getClass().getSimpleName() + ": " + msg, false);
        } catch (Exception e) {
            log.warn("KMA fct_afs_ds 실패 reg={} disp={}: {}", reg, disp, e.getMessage());
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
                    .queryParam("authKey", hubAuthKey());
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
}
