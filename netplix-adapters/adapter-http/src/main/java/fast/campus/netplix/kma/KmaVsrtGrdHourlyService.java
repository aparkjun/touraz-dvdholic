package fast.campus.netplix.kma;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
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
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * 초단기·실황 격자 API — 주소가 {@code vsrt_grd} 이면 시간대별 예보, {@code odam_grd} 이면 실황 1회 후 슬롯 복제.
 * 주소가 vsrt 인데 결과가 비면 선택 설정 {@code dfs-odam-grd}(실황)으로 한 번 더 시도한다.
 */
@Slf4j
@Component
public class KmaVsrtGrdHourlyService {

    /** tmfc 10분 후보 탐색 상한 — 병렬 프로브와 함께 조정 */
    private static final int TMFC_BACK_MAX = 8;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TMFC = DateTimeFormatter.ofPattern("yyyyMMddHHmm");
    private static final DateTimeFormatter TMEF = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter FCST_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FCST_TIME = DateTimeFormatter.ofPattern("HHmm");

    private final KmaVsrtGrdHttpClient client;
    private final ObjectMapper objectMapper;
    private final Executor kmaGridExecutor;

    public KmaVsrtGrdHourlyService(
            KmaVsrtGrdHttpClient client,
            ObjectMapper objectMapper,
            @Qualifier("kmaGridExecutor") Executor kmaGridExecutor) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.kmaGridExecutor = kmaGridExecutor;
    }

    /**
     * @param lookaheadHours 1..12 권장 (API 호출 수 = lookaheadHours)
     */
    public List<Map<String, Object>> fetchHourlyForLatLng(double lat, double lng, int lookaheadHours) {
        int[] grid = KmaLambertGridConverter.toGrid(lat, lng);
        return fetchHourlyForGrid(grid[0], grid[1], lookaheadHours);
    }

    public List<Map<String, Object>> fetchHourlyForGrid(int nx, int ny, int lookaheadHours) {
        List<Map<String, Object>> primary = fetchHourlyForGridInternal(nx, ny, lookaheadHours, false);
        if (!primary.isEmpty()) {
            return primary;
        }
        if (client.hasOdamFallback() && !client.primaryUrlIsOdam()) {
            log.debug("vsrt_grd: 초단기 격자 무결과 — 실황 odam 폴백 시도 nx={} ny={}", nx, ny);
            return fetchHourlyForGridInternal(nx, ny, lookaheadHours, true);
        }
        return primary;
    }

    private List<Map<String, Object>> fetchHourlyForGridInternal(
            int nx, int ny, int lookaheadHours, boolean odamFallback) {
        int cap = Math.min(12, Math.max(1, lookaheadHours));
        Optional<String> tmfcOpt = resolveWorkingTmfc(nx, ny, odamFallback);
        if (tmfcOpt.isEmpty()) {
            log.debug("vsrt_grd: 유효 tmfc 없음 nx={} ny={} odamFallback={}", nx, ny, odamFallback);
            return List.of();
        }
        String tmfc = tmfcOpt.get();
        ZonedDateTime now = ZonedDateTime.now(KST);

        if (client.isOdamEffective(odamFallback)) {
            return buildRowsFromOdamGrid(tmfc, nx, ny, cap, now, odamFallback);
        }

        List<CompletableFuture<Map<String, Object>>> hourFutures = new ArrayList<>();
        for (int h = 1; h <= cap; h++) {
            final int hourAhead = h;
            hourFutures.add(
                    CompletableFuture.supplyAsync(
                            () -> fetchOneVsrtHour(tmfc, nx, ny, now, hourAhead, odamFallback), kmaGridExecutor));
        }
        CompletableFuture.allOf(hourFutures.toArray(new CompletableFuture[0])).join();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CompletableFuture<Map<String, Object>> f : hourFutures) {
            Map<String, Object> row = f.join();
            if (row != null && !row.isEmpty()) {
                rows.add(row);
            }
        }
        return rows;
    }

    private Map<String, Object> fetchOneVsrtHour(
            String tmfc, int nx, int ny, ZonedDateTime nowKst, int hourAhead, boolean odamFallback) {
        ZonedDateTime ft = nowKst.plusHours(hourAhead).truncatedTo(ChronoUnit.HOURS);
        String tmef = ft.format(TMEF);
        String raw = client.fetchRaw(tmfc, tmef, nx, ny, "T1H,PTY", odamFallback);
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            raw = null;
        }
        Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = Optional.empty();
        if (raw != null) {
            cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
        }
        if (cell.isEmpty()) {
            String raw2 = client.fetchRaw(tmfc, tmef, nx, ny, "T1H", odamFallback);
            if (raw2 != null && !KmaVsrtGrdResponseParser.isUpstreamError(raw2, objectMapper)) {
                cell = KmaVsrtGrdResponseParser.extractCell(raw2, nx, ny, objectMapper);
            }
        }
        if (cell.isEmpty()) {
            return null;
        }
        KmaVsrtGrdResponseParser.VsrtCell c = cell.get();
        if (c.t1h() == null || c.t1h() < -80 || c.t1h() > 55) {
            return null;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("fcstDate", ft.format(FCST_DATE));
        row.put("fcstTime", ft.format(FCST_TIME));
        row.put("TMP", (int) Math.round(c.t1h()));
        if (c.pty() != null) {
            row.put("PTY", String.valueOf(c.pty()));
        }
        return row;
    }

    /**
     * 실황(odam_grd)은 허브 샘플처럼 tmfc·vars 만 요청하고, 응답 전역 격자에서 nx·ny 를 찾는다.
     * 시계열 슬롯은 API를 1회만 호출한 뒤 동일 관측값으로 채운다(실황은 시각별 예보가 아님).
     */
    private List<Map<String, Object>> buildRowsFromOdamGrid(
            String tmfc, int nx, int ny, int cap, ZonedDateTime nowKst, boolean odamFallback) {
        String raw = client.fetchRaw(tmfc, "", nx, ny, "T1H", odamFallback);
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
    private Optional<String> resolveWorkingTmfc(int nx, int ny, boolean odamFallback) {
        ZonedDateTime now = ZonedDateTime.now(KST);
        ZonedDateTime ft1 = now.plusHours(1).truncatedTo(ChronoUnit.HOURS);
        String tmefProbe = client.isOdamEffective(odamFallback) ? "" : ft1.format(TMEF);

        List<String> tmfcCandidates = new ArrayList<>();
        for (int back = 0; back < TMFC_BACK_MAX; back++) {
            ZonedDateTime cand = now.minusMinutes(35L + back * 10L);
            int min = (cand.getMinute() / 10) * 10;
            cand = cand.withSecond(0).withNano(0).withMinute(min);
            tmfcCandidates.add(cand.format(TMFC));
        }
        List<CompletableFuture<Boolean>> ok = new ArrayList<>();
        for (String tmfc : tmfcCandidates) {
            final String t = tmfc;
            ok.add(CompletableFuture.supplyAsync(
                    () -> vsrtTmfcProbeValid(t, nx, ny, tmefProbe, odamFallback), kmaGridExecutor));
        }
        CompletableFuture.allOf(ok.toArray(new CompletableFuture[0])).join();
        for (int back = 0; back < TMFC_BACK_MAX; back++) {
            if (Boolean.TRUE.equals(ok.get(back).join())) {
                return Optional.of(tmfcCandidates.get(back));
            }
        }
        return Optional.empty();
    }

    private boolean vsrtTmfcProbeValid(String tmfc, int nx, int ny, String tmefProbe, boolean odamFallback) {
        if (client.isOdamEffective(odamFallback)) {
            String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H", odamFallback);
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                return false;
            }
            Optional<KmaVsrtGrdResponseParser.VsrtCell> cell =
                    KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
            return cell.isPresent()
                    && cell.get().t1h() != null
                    && cell.get().t1h() > -80
                    && cell.get().t1h() < 55;
        }
        String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H,PTY", odamFallback);
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            raw = null;
        }
        Optional<KmaVsrtGrdResponseParser.VsrtCell> cell = Optional.empty();
        if (raw != null) {
            cell = KmaVsrtGrdResponseParser.extractCell(raw, nx, ny, objectMapper);
        }
        if (cell.isEmpty()) {
            String raw2 = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H", odamFallback);
            if (raw2 != null && !KmaVsrtGrdResponseParser.isUpstreamError(raw2, objectMapper)) {
                cell = KmaVsrtGrdResponseParser.extractCell(raw2, nx, ny, objectMapper);
            }
        }
        return cell.isPresent()
                && cell.get().t1h() != null
                && cell.get().t1h() > -80
                && cell.get().t1h() < 55;
    }
}
