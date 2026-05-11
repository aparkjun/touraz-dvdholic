package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.kma.KmaFcstZoneInfoHttpClient;
import fast.campus.netplix.kma.KmaFcstZoneInfoXmlParser;
import fast.campus.netplix.kma.KmaForecastSeriesExtractor;
import fast.campus.netplix.kma.KmaHubJson;
import fast.campus.netplix.kma.KmaNearestReg;
import fast.campus.netplix.kma.KmaShortRegFetchResult;
import fast.campus.netplix.kma.KmaShortRegHttpClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 기상청 단기예보(API허브) 프록시 — 클라이언트에 authKey 노출 방지.
 * 단기는 예보구역(reg) 기반 {@code fct_afs_ds}·{@code fct_shrt_reg} 만 사용한다 (격자 API 미사용).
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/weather")
@RequiredArgsConstructor
public class WeatherController {

    /** 동일 지역 연속 탭·재시도 시 Heroku 부하·지연 완화 (얕은 복사본 저장) */
    private static final long SHORT_REG_CACHE_TTL_MS = 90_000L;

    private static final int SHORT_REG_CACHE_MAX = 256;

    private final ConcurrentHashMap<String, ShortRegCacheEntry> shortRegCache = new ConcurrentHashMap<>();

    private final KmaShortRegHttpClient kmaShortRegHttpClient;
    private final KmaFcstZoneInfoHttpClient kmaFcstZoneInfoHttpClient;
    private final ObjectMapper objectMapper;

    @Value("${kma.auth.default-reg}")
    private String defaultReg;

    /**
     * 기상청 API허브 예보구역정보 — {@code FcstZoneInfoService/getFcstZoneCd} 프록시 (인증키 비노출).
     *
     * @param regId      예보구역코드 (예: 11A00101)
     * @param pageNo     페이지 (기본 1)
     * @param numOfRows  페이지당 행 수 (기본 10)
     */
    @GetMapping("/fcst-zone")
    public NetplixApiResponse<Map<String, Object>> fcstZone(
            @RequestParam(name = "regId") String regId,
            @RequestParam(name = "pageNo", defaultValue = "1") int pageNo,
            @RequestParam(name = "numOfRows", defaultValue = "10") int numOfRows) {

        Map<String, Object> out = new HashMap<>();
        if (!kmaFcstZoneInfoHttpClient.isConfigured()) {
            out.put("configured", false);
            out.put(
                    "message",
                    "예보구역정보(getFcstZoneCd) URL이 비었거나 KMA_API_KEY 가 없습니다. adapter-http-property 의 kma.api.fcst-zone-info-get-zone-cd 와 Heroku Config Vars 를 확인하세요.");
            return NetplixApiResponse.ok(out);
        }

        String xml = kmaFcstZoneInfoHttpClient.fetchGetFcstZoneCdXml(regId, pageNo, numOfRows);
        if (xml == null) {
            out.put("configured", true);
            out.put("success", false);
            out.put("message", "기상청 허브 호출에 실패했습니다. regId·네트워크·활용승인을 확인하세요.");
            return NetplixApiResponse.ok(out);
        }

        var parsedOpt = KmaFcstZoneInfoXmlParser.parse(xml);
        if (parsedOpt.isEmpty()) {
            out.put("configured", true);
            out.put("success", false);
            out.put("message", "XML 응답을 파싱하지 못했습니다.");
            out.put("rawPreview", xml.length() > 600 ? xml.substring(0, 600) + "…" : xml);
            return NetplixApiResponse.ok(out);
        }

        KmaFcstZoneInfoXmlParser.FcstZoneCdParse p = parsedOpt.get();
        out.put("configured", true);
        out.put("success", p.isOk());
        out.put("resultCode", p.resultCode());
        out.put("resultMsg", p.resultMsg());
        out.put("items", p.items());
        if (p.pageNo() != null) {
            out.put("pageNo", p.pageNo());
        }
        if (p.numOfRows() != null) {
            out.put("numOfRows", p.numOfRows());
        }
        if (p.totalCount() != null) {
            out.put("totalCount", p.totalCount());
        }
        return NetplixApiResponse.ok(out);
    }

    @GetMapping("/short-reg")
    public NetplixApiResponse<Map<String, Object>> shortReg(
            @RequestParam(name = "reg", required = false) String reg,
            @RequestParam(name = "tmfc", required = false) String tmfc,
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lng", required = false) Double lng) {

        String effectiveReg = (reg != null && !reg.isBlank()) ? reg.trim() : null;
        Map<String, Object> out = new HashMap<>();

        if (effectiveReg == null && lat != null && lng != null) {
            KmaNearestReg.Resolution geo = KmaNearestReg.resolve(lat, lng);
            if (geo != null) {
                effectiveReg = geo.reg();
                out.put("regFromGeo", true);
                out.put("regLabel", geo.label());
                out.put("regDistanceKm", Math.round(geo.distanceKm() * 10) / 10.0);
            }
        }

        if (effectiveReg == null || effectiveReg.isBlank()) {
            effectiveReg = defaultReg;
        }

        out.put("reg", effectiveReg);

        String cacheKey = shortRegCacheKey(effectiveReg, lat, lng, tmfc);
        ShortRegCacheEntry cached = shortRegCache.get(cacheKey);
        if (cached != null && cached.expiresAtMs() > System.currentTimeMillis()) {
            return NetplixApiResponse.ok(new HashMap<>(cached.payload()));
        }

        if (!kmaShortRegHttpClient.isApiKeyConfigured()) {
            out.put("configured", false);
            out.put("kmaKeyMissing", true);
            out.put(
                    "message",
                    "단기 예보는 기상청 API허브(apihub.kma.go.kr) 인증키가 필요합니다. Heroku Config Vars에 KMA_API_KEY(또는 KMA_AUTH_API_KEY)로 허브에서 발급한 키를 넣고 dyno를 재시작하세요. 공공데이터포털(data.go.kr) 키만으로는 동작하지 않을 수 있습니다.");
            return cacheAndOk(cacheKey, out);
        }

        final String regForKma = effectiveReg;
        final String tmfcForKma = tmfc;
        long wall0 = System.nanoTime();
        KmaShortRegFetchResult shortRegFetch = kmaShortRegHttpClient.fetchWithDiagnostics(regForKma, tmfcForKma);
        long wallMs = (System.nanoTime() - wall0) / 1_000_000L;
        log.info("KMA weather_short_reg reg={} wallMs={}", effectiveReg, wallMs);

        String raw = shortRegFetch.raw();
        if (raw == null) {
            int att = shortRegFetch.attempts();
            int cat = shortRegFetch.catalogTextResponsesSkipped();
            Map<String, Object> diag = new LinkedHashMap<>();
            diag.put("attempts", att);
            diag.put("catalogTextResponsesSkipped", cat);
            if (att > 0 && att == cat) {
                diag.put("likelyCause", "hub_returned_zone_catalog_only");
            }
            if (shortRegFetch.lastHttpStatus() != null) {
                diag.put("httpStatus", shortRegFetch.lastHttpStatus());
            }
            if (shortRegFetch.lastNonJsonBodyPreview() != null && !shortRegFetch.lastNonJsonBodyPreview().isBlank()) {
                diag.put("bodyPreview", shortRegFetch.lastNonJsonBodyPreview());
            }
            if (shortRegFetch.lastExceptionSummary() != null && !shortRegFetch.lastExceptionSummary().isBlank()) {
                diag.put("error", shortRegFetch.lastExceptionSummary());
            }
            if (diagnosticIndicatesAfsDsShellNoForecast(shortRegFetch)) {
                diag.put("afsDsResponsePattern", "shell_no_dollar0_forecast");
                if (!diag.containsKey("likelyCause")) {
                    diag.put("likelyCause", "fct_afs_ds_shell_then_shrt_reg_no_body");
                }
            }
            out.put("shortRegDiagnostic", diag);

            out.put("configured", false);
            String userMessage;
            if (att > 0 && att == cat) {
                userMessage =
                        "기상청 API허브가 예보 JSON 대신 「예보구역 목록」(#로 시작하는 텍스트)만 반환했습니다. "
                                + "API허브 마이페이지에서 「단기 개황·JSON(disp=1)」 등 실제 단기 예보 데이터 API 활용승인이 있는지 확인하세요. "
                                + "「단기 예보구역 조회」만 승인된 경우 이 증상이 날 수 있습니다.";
            } else {
                userMessage = shortRegFailureUserMessage(shortRegFetch);
            }
            out.put("message", userMessage);
            return cacheAndOk(cacheKey, out);
        }
        out.put("configured", true);
        try {
            JsonNode tree = objectMapper.readTree(raw);
            out.put("payload", tree);
            JsonNode afsNode = tree.get("afsDs");
            if (afsNode != null && !afsNode.isNull() && afsNode.isObject()) {
                @SuppressWarnings("unchecked")
                Map<String, Object> afsMap = objectMapper.convertValue(afsNode, Map.class);
                out.put("afsDs", afsMap);
            }
            var result = tree.get("result");
            if (result != null && result.isObject()) {
                var st = result.get("status");
                if (st != null && KmaHubJson.hubResultStatusIndicatesFailure(st)) {
                    out.put("upstreamError", true);
                    if (st.isNumber()) {
                        out.put("upstreamStatus", st.intValue());
                    } else if (st.isTextual()) {
                        try {
                            out.put("upstreamStatus", Integer.parseInt(st.asText().trim()));
                        } catch (NumberFormatException ignored) {
                            out.put("upstreamStatusRaw", st.asText());
                        }
                    }
                    var msg = result.get("message");
                    if (msg != null && !msg.isNull()) {
                        out.put("upstreamMessage", msg.asText());
                    }
                } else {
                    List<Map<String, Object>> series = KmaForecastSeriesExtractor.extractRows(tree);
                    if (!series.isEmpty()) {
                        out.put("series", series.stream().limit(56).toList());
                    }
                }
            } else {
                List<Map<String, Object>> series = KmaForecastSeriesExtractor.extractRows(tree);
                if (!series.isEmpty()) {
                    out.put("series", series.stream().limit(56).toList());
                }
            }
        } catch (Exception e) {
            log.debug("KMA 응답 JSON 아님: {}", e.getMessage());
            out.put("payloadRaw", raw.length() > 8000 ? raw.substring(0, 8000) : raw);
        }

        return cacheAndOk(cacheKey, out);
    }

    private record ShortRegCacheEntry(long expiresAtMs, Map<String, Object> payload) {}

    private static String shortRegCacheKey(String effectiveReg, Double lat, Double lng, String tmfc) {
        String t = (tmfc != null && !tmfc.isBlank()) ? tmfc.trim() : "auto";
        if (lat != null && lng != null) {
            return effectiveReg
                    + "|"
                    + String.format(Locale.US, "%.4f,%.4f", lat, lng)
                    + "|"
                    + t;
        }
        return effectiveReg + "||" + t;
    }

    private void putShortRegCache(String key, Map<String, Object> out) {
        long now = System.currentTimeMillis();
        shortRegCache.entrySet().removeIf(e -> e.getValue().expiresAtMs() < now);
        if (shortRegCache.size() >= SHORT_REG_CACHE_MAX) {
            shortRegCache.clear();
        }
        shortRegCache.put(key, new ShortRegCacheEntry(now + SHORT_REG_CACHE_TTL_MS, new HashMap<>(out)));
    }

    private NetplixApiResponse<Map<String, Object>> cacheAndOk(String cacheKey, Map<String, Object> out) {
        putShortRegCache(cacheKey, out);
        return NetplixApiResponse.ok(out);
    }

    /** 단기(reg/개황) 본문 없음 시 사용자 안내 — 진단값(HTTP·예외·본문 미리보기)에 따라 구체화. */
    private static String shortRegFailureUserMessage(KmaShortRegFetchResult shortRegFetch) {
        Integer http = shortRegFetch.lastHttpStatus();
        String exNet = shortRelAccessSummary(shortRegFetch.lastExceptionSummary());
        if (http != null && (http == 401 || http == 403)) {
            return "기상청 API허브가 인증을 거부했습니다(HTTP "
                    + http
                    + "). apihub.kma.go.kr 에서 발급한 허브용 인증키(KMA_API_KEY)인지, "
                    + "그리고 단기·개황(fct_afs_ds, fct_shrt_reg) API 활용이 승인됐는지 확인하세요. 공공데이터포털(data.go.kr) 키는 사용할 수 없습니다.";
        }
        if (http != null && http >= 500) {
            return "기상청 API허브에서 일시 오류(HTTP "
                    + http
                    + ")를 반환했습니다. 잠시 후 다시 시도해 주세요.";
        }
        if (diagnosticIndicatesAfsDsShellNoForecast(shortRegFetch)) {
            return "단기 개황(fct_afs_ds)에 $0# 본문 없이 껍데기(#START7777)만 왔고, 구역 단기(fct_shrt_reg)도 본문이 없었습니다. "
                    + "표시된 status 502는 허브 HTTP가 아니라 앱이 파싱 불가 응답을 정리한 값입니다. "
                    + "API허브에서 두 API 승인·reg·발표시각(tmfc)을 확인하세요. 상세는 shortRegDiagnostic 입니다.";
        }
        if (exNet != null && !exNet.isBlank()) {
            return "기상청 API허브까지의 연결이 끊기거나 시간이 초과된 것으로 보입니다("
                    + exNet
                    + "). 네트워크·Heroku 게이트웨이·허브 장애 가능성을 확인한 뒤 잠시 후 다시 시도해 주세요.";
        }
        String preview = shortRegFetch.lastNonJsonBodyPreview();
        if (preview != null && !preview.isBlank()) {
            String snip = KmaHubJson.previewSnippet(preview);
            if (snip.length() > 220) {
                snip = snip.substring(0, 220) + "…";
            }
            return "기상청 API허브는 응답했으나 단기 예보 본문(JSON·afsDs 등)을 만들 수 없었습니다. "
                    + "마지막 응답 일부: "
                    + snip
                    + " — API허브 마이페이지에서 동네예보 단기·단기예보구역(fct_afs_ds, fct_shrt_reg) 활용 승인과 일일 한도를 확인하세요. "
                    + "공공데이터포털(data.go.kr) 키는 이 주소와 호환되지 않습니다. 응답 JSON의 shortRegDiagnostic 필드에 요약이 있습니다.";
        }
        String exAny = shortRegFetch.lastExceptionSummary();
        if (exAny != null && !exAny.isBlank()) {
            String brief = exAny.length() > 180 ? exAny.substring(0, 180) + "…" : exAny;
            return "기상청 API허브 호출 중 예외가 있었습니다: "
                    + brief
                    + " — shortRegDiagnostic.error 를 확인하세요. 허브 전용 키·단기(개황/구역) 승인·네트워크를 점검하세요.";
        }
        int att = shortRegFetch.attempts();
        int cat = shortRegFetch.catalogTextResponsesSkipped();
        if (att > 0) {
            return "기상청 API허브에서 총 "
                    + att
                    + "회 호출 후에도 단기 예보 본문을 확보하지 못했습니다(구역 목록형 응답 "
                    + cat
                    + "회). API허브(apihub.kma.go.kr) 인증키가 아닌 공공데이터포털(data.go.kr) 키를 쓰고 있지 않은지, "
                    + "fct_afs_ds·fct_shrt_reg 활용 승인이 있는지 확인하세요. 상세는 응답 JSON의 shortRegDiagnostic 입니다.";
        }
        return "기상청 API허브에서 단기 예보 본문을 받지 못했습니다. Heroku의 KMA_API_KEY 가 apihub.kma.go.kr 용인지, "
                + "단기(개황/구역) API 활용 승인·네트워크를 확인하세요. 공공데이터포털 키와는 별도입니다.";
    }

    /**
     * 허브 fct_afs_ds 가 $0# 통보문 없이 #START7777 껍데기만 온 뒤, 클라이언트가 합성한
     * {@code {"result":{"status":502,"message":"fct_afs_ds: #START7777…"}}} 형태가 마지막 미리보기에 남은 경우.
     */
    private static boolean diagnosticIndicatesAfsDsShellNoForecast(KmaShortRegFetchResult f) {
        String p = f.lastNonJsonBodyPreview();
        String e = f.lastExceptionSummary();
        String s = ((p != null ? p : "") + "\n" + (e != null ? e : "")).toLowerCase();
        return s.contains("fct_afs_ds") && s.contains("start7777");
    }

    private static String shortRelAccessSummary(String ex) {
        if (ex == null || ex.isBlank()) {
            return null;
        }
        String u = ex.toLowerCase();
        if (u.contains("resourceaccessexception")
                || u.contains("timeout")
                || u.contains("timed out")
                || u.contains("i/o error")
                || u.contains("connection reset")
                || u.contains("connection refused")
                || u.contains("connect timed out")
                || u.contains("read timed out")
                || u.contains("ssl")
                || u.contains("handshake")
                || u.contains("unknownhost")) {
            return ex.length() > 200 ? ex.substring(0, 200) + "…" : ex;
        }
        return null;
    }
}
