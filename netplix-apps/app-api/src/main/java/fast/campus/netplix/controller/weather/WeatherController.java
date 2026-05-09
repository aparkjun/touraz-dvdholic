package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.kma.KmaForecastSeriesExtractor;
import fast.campus.netplix.kma.KmaLambertGridConverter;
import fast.campus.netplix.kma.KmaNearestReg;
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
import java.util.Map;

/**
 * 기상청 단기예보(API허브) 프록시 — 클라이언트에 authKey 노출 방지.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final KmaShortRegHttpClient kmaShortRegHttpClient;
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

        if (!kmaShortRegHttpClient.isApiKeyConfigured()) {
            out.put("configured", false);
            out.put("kmaKeyMissing", true);
            out.put(
                    "message",
                    "단기·초단기 예보는 기상청 API허브(apihub.kma.go.kr) 인증키가 필요합니다. Heroku Config Vars에 KMA_API_KEY(또는 KMA_AUTH_API_KEY)로 허브에서 발급한 키를 넣고 dyno를 재시작하세요. 공공데이터포털(data.go.kr) 키만으로는 동작하지 않을 수 있습니다.");
            return NetplixApiResponse.ok(out);
        }

        KmaShortRegFetchResult shortRegFetch = kmaShortRegHttpClient.fetchWithDiagnostics(effectiveReg, tmfc);
        String raw = shortRegFetch.raw();
        if (raw == null) {
            out.put("configured", false);
            int att = shortRegFetch.attempts();
            int cat = shortRegFetch.catalogTextResponsesSkipped();
            String userMessage;
            if (att > 0 && att == cat) {
                userMessage =
                        "기상청 API허브가 예보 JSON 대신 「예보구역 목록」(#로 시작하는 텍스트)만 반환했습니다. "
                                + "API허브 마이페이지에서 「단기 개황·JSON(disp=1)」 등 실제 단기 예보 데이터 API 활용승인이 있는지 확인하세요. "
                                + "「단기 예보구역 조회」만 승인된 경우 이 증상이 날 수 있습니다. 초단기 격자(dfs_vsrt_grd)는 별도 신청입니다.";
            } else {
                userMessage =
                        "기상청 API허브 호출에 실패했습니다. 인증키 종류(허브용)·단기/초단기(격자) 활용승인·네트워크를 확인하세요.";
            }
            out.put("message", userMessage);
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
            return NetplixApiResponse.ok(out);
        }
        out.put("configured", true);
        try {
            JsonNode tree = objectMapper.readTree(raw);
            out.put("payload", tree);
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

        if (Boolean.TRUE.equals(out.get("configured")) && lat != null && lng != null) {
            try {
                List<Map<String, Object>> vsrt = kmaVsrtGrdHourlyService.fetchHourlyForLatLng(lat, lng, 8);
                if (!vsrt.isEmpty()) {
                    out.put("vsrtHourly", vsrt);
                    int[] g = KmaLambertGridConverter.toGrid(lat, lng);
                    out.put("vsrtGrid", Map.of("nx", g[0], "ny", g[1]));
                }
            } catch (Exception e) {
                log.debug("초단기 격자 vsrtHourly 생략: {}", e.getMessage());
            }
        }
        return NetplixApiResponse.ok(out);
    }
}
