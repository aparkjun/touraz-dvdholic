package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 초단기 격자 API로 예보 시각별 기온(및 가능 시 강수형태) 시계열을 만든다.
 * tmfc 는 최근 10분 단위 후보를 탐색해 유효한 값을 찾는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaVsrtGrdHourlyService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TMFC = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final DateTimeFormatter TMEF = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter FCST_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FCST_TIME = DateTimeFormatter.ofPattern("HHmm");

    private final KmaVsrtGrdHttpClient client;
    private final ObjectMapper objectMapper;

    /**
     * @param lookaheadHours 1..12 권장 (API 호출 수 = lookaheadHours)
     */
    public List<Map<String, Object>> fetchHourlyForLatLng(double lat, double lng, int lookaheadHours) {
        int[] grid = KmaLambertGridConverter.toGrid(lat, lng);
        return fetchHourlyForGrid(grid[0], grid[1], lookaheadHours);
    }

    public List<Map<String, Object>> fetchHourlyForGrid(int nx, int ny, int lookaheadHours) {
        int cap = Math.min(12, Math.max(1, lookaheadHours));
        Optional<String> tmfcOpt = resolveWorkingTmfc(nx, ny);
        if (tmfcOpt.isEmpty()) {
            log.debug("vsrt_grd: 유효 tmfc 없음 nx={} ny={}", nx, ny);
            return List.of();
        }
        String tmfc = tmfcOpt.get();
        ZonedDateTime now = ZonedDateTime.now(KST);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int h = 1; h <= cap; h++) {
            ZonedDateTime ft = now.plusHours(h).truncatedTo(ChronoUnit.HOURS);
            String tmef = ft.format(TMEF);
            String raw = client.fetchRaw(tmfc, tmef, "T1H,PTY");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
            if (cell.isEmpty()) {
                String raw2 = client.fetchRaw(tmfc, tmef, "T1H");
                if (raw2 != null && !KmaVsrtGrdResponseParser.isUpstreamError(raw2, objectMapper)) {
                    cell = KmaVsrtGrdResponseParser.extractCell(raw2, nx, ny, objectMapper);
                }
            }
            if (cell.isEmpty()) {
                continue;
            }
            KmaVsrtGrdResponseParser.VsrtCell c = cell.get();
            if (c.t1h() == null || c.t1h() < -80 || c.t1h() > 55) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("fcstDate", ft.format(FCST_DATE));
            row.put("fcstTime", ft.format(FCST_TIME));
            row.put("TMP", (int) Math.round(c.t1h()));
            if (c.pty() != null) {
                row.put("PTY", String.valueOf(c.pty()));
            }
            rows.add(row);
        }
        return rows;
    }

    /** 최근 후보 tmfc 중 실제 응답이 성공하고 격자값이 유효한 첫 시각 */
    private Optional<String> resolveWorkingTmfc(int nx, int ny) {
        ZonedDateTime now = ZonedDateTime.now(KST);
        ZonedDateTime ft1 = now.plusHours(1).truncatedTo(ChronoUnit.HOURS);
        String tmefProbe = ft1.format(TMEF);

        for (int back = 0; back < 20; back++) {
            ZonedDateTime cand = now.minusMinutes(35L + back * 10L);
            int min = (cand.getMinute() / 10) * 10;
            cand = cand.withSecond(0).withNano(0).withMinute(min);
            String tmfc = cand.format(TMFC);
            String raw = client.fetchRaw(tmfc, tmefProbe, "T1H,PTY");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
            if (cell.isEmpty()) {
                String raw2 = client.fetchRaw(tmfc, tmefProbe, "T1H");
                if (raw2 != null && !KmaVsrtGrdResponseParser.isUpstreamError(raw2, objectMapper)) {
                    cell = KmaVsrtGrdResponseParser.extractCell(raw2, nx, ny, objectMapper);
                }
            }
            if (cell.isPresent() && cell.get().t1h() != null && cell.get().t1h() > -80 && cell.get().t1h() < 55) {
                return Optional.of(tmfc);
            }
        }
        return Optional.empty();
    }
}
