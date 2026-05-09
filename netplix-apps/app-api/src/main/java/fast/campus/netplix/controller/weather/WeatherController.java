package fast.campus.netplix.controller.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.kma.KmaForecastSeriesExtractor;
import fast.campus.netplix.kma.KmaLambertGridConverter;
import fast.campus.netplix.kma.KmaNearestReg;
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

        String raw = kmaShortRegHttpClient.fetchRaw(effectiveReg, tmfc);
        if (raw == null) {
            out.put("configured", false);
            out.put("message", "KMA_API_KEY 미설정이거나 기상청 호출에 실패했습니다.");
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
