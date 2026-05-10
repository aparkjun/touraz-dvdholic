package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.kma.KmaForecastSeriesExtractor;
import fast.campus.netplix.kma.KmaLambertGridConverter;
import fast.campus.netplix.kma.KmaNearestReg;
import fast.campus.netplix.kma.KmaRegCentroid;
import fast.campus.netplix.kma.KmaShrtGrdSeriesService;
import fast.campus.netplix.kma.KmaShortRegFetchResult;
import fast.campus.netplix.kma.KmaShortRegHttpClient;
import fast.campus.netplix.kma.KmaVsrtGrdHourlyService;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 기상청 단기예보(API허브) 프록시 — 클라이언트에 authKey 노출 방지.
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
    private final KmaShrtGrdSeriesService kmaShrtGrdSeriesService;
    private final KmaVsrtGrdHourlyService kmaVsrtGrdHourlyService;
    private final ObjectMapper objectMapper;

    @Value("${kma.auth.default-reg}")
    private String defaultReg;

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
                    "단기·초단기 예보는 기상청 API허브(apihub.kma.go.kr) 인증키가 필요합니다. Heroku Config Vars에 KMA_API_KEY(또는 KMA_AUTH_API_KEY)로 허브에서 발급한 키를 넣고 dyno를 재시작하세요. 공공데이터포털(data.go.kr) 키만으로는 동작하지 않을 수 있습니다.");
            return cacheAndOk(cacheKey, out);
        }

        KmaShortRegFetchResult shortRegFetch = kmaShortRegHttpClient.fetchWithDiagnostics(effectiveReg, tmfc);
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
            out.put("shortRegDiagnostic", diag);

            double[] coords = resolveGridCoords(lat, lng, effectiveReg, out);
            if (coords != null) {
                try {
                    final double glat = coords[0];
                    final double glng = coords[1];
                    CompletableFuture<List<Map<String, Object>>> shrtF = CompletableFuture.supplyAsync(
                            () -> {
                                try {
                                    return kmaShrtGrdSeriesService.fetchSeriesForLatLng(glat, glng, 4);
                                } catch (Exception e) {
                                    log.debug("격자 단기 폴백 생략: {}", e.getMessage());
                                    return List.of();
                                }
                            });
                    CompletableFuture<List<Map<String, Object>>> vsrtF = CompletableFuture.supplyAsync(
                            () -> {
                                try {
                                    return kmaVsrtGrdHourlyService.fetchHourlyForLatLng(glat, glng, 4);
                                } catch (Exception e) {
                                    log.debug("격자 초단기 폴백 생략: {}", e.getMessage());
                                    return List.of();
                                }
                            });
                    CompletableFuture.allOf(shrtF, vsrtF).join();
                    List<Map<String, Object>> shrtSeries = shrtF.join();
                    List<Map<String, Object>> vsrt = vsrtF.join();

                    if (!shrtSeries.isEmpty()) {
                        out.put("configured", true);
                        out.put("shortRegUsedShrtGrid", true);
                        out.put("series", shrtSeries);
                        putVsrtGrid(out, glat, glng);
                        out.put(
                                "message",
                                "단기 예보구역(reg) 통보문은 받지 못했으나, 단기 격자(nph-dfs_shrt_grd)로 3시간 간격 예보를 표시합니다.");
                        return cacheAndOk(cacheKey, out);
                    }
                    if (!vsrt.isEmpty()) {
                        out.put("configured", true);
                        out.put("shortRegUsedGridFallback", true);
                        out.put("vsrtHourly", vsrt);
                        putVsrtGrid(out, glat, glng);
                        out.put(
                                "message",
                                "단기 예보구역(reg) 통보문은 허브에서 받지 못했지만, 초단기 격자 데이터로 시간대별 기온을 표시합니다. "
                                        + "허브가 일부 reg 에 대해 「구역 목록」 텍스트만 주는 경우가 있으며, 승인과 무관할 수 있습니다.");
                        return cacheAndOk(cacheKey, out);
                    }
                } catch (Exception e) {
                    log.warn("단기 실패 후 격자 폴백 중 예외 — reg={} lat={} lng={}: {}", effectiveReg, lat, lng, e.getMessage());
                }
            }

            out.put("configured", false);
            if (coords != null) {
                out.put("gridFallbackAttempted", true);
                out.put("gridFallbackEmpty", true);
            }
            String userMessage;
            if (att > 0 && att == cat) {
                userMessage =
                        "기상청 API허브가 예보 JSON 대신 「예보구역 목록」(#로 시작하는 텍스트)만 반환했습니다. "
                                + "API허브 마이페이지에서 「단기 개황·JSON(disp=1)」 등 실제 단기 예보 데이터 API 활용승인이 있는지 확인하세요. "
                                + "「단기 예보구역 조회」만 승인된 경우 이 증상이 날 수 있습니다. 단기/초단기 격자 API는 별도 신청입니다.";
            } else {
                userMessage = shortRegFailureUserMessage(shortRegFetch, coords != null);
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
                if (st != null && st.isNumber() && st.intValue() != 0) {
                    out.put("upstreamError", true);
                    out.put("upstreamStatus", st.intValue());
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

        double[] coords = resolveGridCoords(lat, lng, effectiveReg, out);
        if (coords != null) {
            try {
                List<Map<String, Object>> existing = castSeries(out.get("series"));
                boolean upstream = Boolean.TRUE.equals(out.get("upstreamError"));
                if ((existing == null || existing.isEmpty()) && !upstream) {
                    List<Map<String, Object>> shrt =
                            kmaShrtGrdSeriesService.fetchSeriesForLatLng(coords[0], coords[1], 6);
                    if (!shrt.isEmpty()) {
                        out.put("series", shrt);
                        out.put("shortRegSupplementedByShrtGrid", true);
                        putVsrtGrid(out, coords[0], coords[1]);
                    }
                }
            } catch (Exception e) {
                log.debug("단기 격자로 series 보강 생략: {}", e.getMessage());
            }
            if (Boolean.TRUE.equals(out.get("configured"))) {
                attachVsrtHourlyOptional(out, coords[0], coords[1], 6);
            }
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

    /**
     * 단기(reg/개황) 본문 없음 + 격자 폴백 실패 시 사용자 안내 — 진단값(HTTP·예외)에 따라 구체화.
     */
    private static String shortRegFailureUserMessage(KmaShortRegFetchResult shortRegFetch, boolean gridFallbackAttempted) {
        Integer http = shortRegFetch.lastHttpStatus();
        String ex = shortRelAccessSummary(shortRegFetch.lastExceptionSummary());
        String core;
        if (http != null && (http == 401 || http == 403)) {
            core =
                    "기상청 API허브가 인증을 거부했습니다(HTTP "
                            + http
                            + "). apihub.kma.go.kr 에서 발급한 허브용 인증키(KMA_API_KEY)인지, "
                            + "그리고 단기·개황(fct_afs_ds, fct_shrt_reg) API 활용이 승인됐는지 확인하세요. 공공데이터포털(data.go.kr) 키는 사용할 수 없습니다.";
        } else if (http != null && http >= 500) {
            core =
                    "기상청 API허브에서 일시 오류(HTTP "
                            + http
                            + ")를 반환했습니다. 잠시 후 다시 시도해 주세요.";
        } else if (ex != null && !ex.isBlank()) {
            core =
                    "기상청 API허브까지의 연결이 끊기거나 시간이 초과된 것으로 보입니다("
                            + ex
                            + "). 네트워크·Heroku 게이트웨이·허브 장애 가능성을 확인한 뒤 잠시 후 다시 시도해 주세요.";
        } else {
            core =
                    "기상청 API허브에서 단기 예보 본문을 받지 못했습니다. 허브 전용 인증키·단기(개황/구역)·네트워크를 확인하세요.";
        }
        if (gridFallbackAttempted) {
            return core
                    + " 격자 폴백(동네예보 단기 nph-dfs_shrt_grd, 초단기 odam/vsrt)도 데이터가 없었습니다. "
                    + "API허브 마이페이지에서 해당 격자 API 활용 승인 여부와 일일 호출 한도를 함께 확인하세요.";
        }
        return core;
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
                || u.contains("read timed out")) {
            return ex.length() > 200 ? ex.substring(0, 200) + "…" : ex;
        }
        return null;
    }

    private static double[] resolveGridCoords(Double lat, Double lng, String effectiveReg, Map<String, Object> out) {
        if (lat != null && lng != null) {
            return new double[] {lat, lng};
        }
        var c = KmaRegCentroid.byReg(effectiveReg);
        if (c.isEmpty()) {
            return null;
        }
        out.put("gridCoordsFromRegPreset", true);
        return new double[] {c.get().lat(), c.get().lng()};
    }

    private static void putVsrtGrid(Map<String, Object> out, double gridLat, double gridLng) {
        int[] g = KmaLambertGridConverter.toGrid(gridLat, gridLng);
        out.put("vsrtGrid", Map.of("nx", g[0], "ny", g[1]));
    }

    private void attachVsrtHourlyOptional(Map<String, Object> out, double gridLat, double gridLng, int lookahead) {
        if (out.containsKey("vsrtHourly")) {
            return;
        }
        try {
            List<Map<String, Object>> vsrt = kmaVsrtGrdHourlyService.fetchHourlyForLatLng(gridLat, gridLng, lookahead);
            if (!vsrt.isEmpty()) {
                out.put("vsrtHourly", vsrt);
                if (!out.containsKey("vsrtGrid")) {
                    putVsrtGrid(out, gridLat, gridLng);
                }
            }
        } catch (Exception e) {
            log.debug("초단기 격자 vsrtHourly 생략: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castSeries(Object o) {
        if (o instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return null;
    }
}
