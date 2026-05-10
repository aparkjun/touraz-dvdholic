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
 * 초단기·실황 격자 API — URL 이 {@code odam_grd}(실황)이면 허브 샘플대로 tmfc·vars 만 요청({@code vars=T1H})하고,
 * 그 외(vsrt 등)는 tmef·nx·ny 를 포함한다. tmfc 는 10분 단위 후보로 유효 시각을 찾는다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaVsrtGrdHourlyService {

    /** Heroku HTTP 제한 등을 고려해 tmfc 10분 후보 탐색 상한 (기존 20 → 축소). */
    private static final int TMFC_BACK_MAX = 10;

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

        if (client.isOdamGrdProduct()) {
            return buildRowsFromOdamGrid(tmfc, nx, ny, cap, now);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int h = 1; h <= cap; h++) {
            ZonedDateTime ft = now.plusHours(h).truncatedTo(ChronoUnit.HOURS);
            String tmef = ft.format(TMEF);
            String raw = client.fetchRaw(tmfc, tmef, nx, ny, "T1H,PTY");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
            if (cell.isEmpty()) {
                String raw2 = client.fetchRaw(tmfc, tmef, nx, ny, "T1H");
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

    /**
     * 실황(odam_grd)은 허브 샘플처럼 tmfc·vars 만 요청하고, 응답 전역 격자에서 nx·ny 를 찾는다.
     * 시계열 슬롯은 API를 1회만 호출한 뒤 동일 관측값으로 채운다(실황은 시각별 예보가 아님).
     */
    private List<Map<String, Object>> buildRowsFromOdamGrid(
            String tmfc, int nx, int ny, int cap, ZonedDateTime nowKst) {
        // 허브 실황 샘플은 vars=T1H 만 사용. T1H,PTY 는 미지원이면 전 구간 실패할 수 있음.
        String raw = client.fetchRaw(tmfc, "", nx, ny, "T1H");
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            return List.of();
        }
        Optional<KmaVsrtGrdResponseParser.VsrtCell> cellOpt =
                KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
        if (cellOpt.isEmpty()) {
            return List.of();
        }
        KmaVsrtGrdResponseParser.VsrtCell c = cellOpt.get();
        if (c.t1h() == null || c.t1h() < -80 || c.t1h() > 55) {
            return List.of();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int h = 1; h <= cap; h++) {
            ZonedDateTime ft = nowKst.plusHours(h).truncatedTo(ChronoUnit.HOURS);
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
        String tmefProbe = client.isOdamGrdProduct() ? "" : ft1.format(TMEF);

        for (int back = 0; back < TMFC_BACK_MAX; back++) {
            ZonedDateTime cand = now.minusMinutes(35L + back * 10L);
            int min = (cand.getMinute() / 10) * 10;
            cand = cand.withSecond(0).withNano(0).withMinute(min);
            String tmfc = cand.format(TMFC);
            if (client.isOdamGrdProduct()) {
                String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H");
                if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                    continue;
                }
                Optional<KmaVsrtGrdResponseParser.VsrtCell> cell =
                        KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
                if (cell.isPresent()
                        && cell.get().t1h() != null
                        && cell.get().t1h() > -80
                        && cell.get().t1h() < 55) {
                    return Optional.of(tmfc);
                }
                continue;
            }
            String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H,PTY");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
            if (cell.isEmpty()) {
                String raw2 = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H");
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
