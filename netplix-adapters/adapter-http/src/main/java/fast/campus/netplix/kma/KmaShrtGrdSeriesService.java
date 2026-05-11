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
 * 동네예보 단기 격자({@code nph-dfs_shrt_grd})로 3시간 간격 예보 시계열을 만든다.
 */
@Slf4j
@Component
public class KmaShrtGrdSeriesService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TMEF = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter FCST_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FCST_TIME = DateTimeFormatter.ofPattern("HHmm");

    /** 발표시각 탐색 상한 — 병렬 프로브라 동시 호출 수와 함께 조정 */
    private static final int MAX_TMFC_PROBE = 6;

    private final KmaShrtGrdHttpClient client;
    private final ObjectMapper objectMapper;
    private final Executor kmaGridExecutor;

    public KmaShrtGrdSeriesService(
            KmaShrtGrdHttpClient client,
            ObjectMapper objectMapper,
            @Qualifier("kmaGridExecutor") Executor kmaGridExecutor) {
        this.client = client;
        this.objectMapper = objectMapper;
        this.kmaGridExecutor = kmaGridExecutor;
    }

    /** @param maxSlots 3시간 간격 슬롯 수 (기본 4~16 권장) */
    public List<Map<String, Object>> fetchSeriesForLatLng(double lat, double lng, int maxSlots) {
        int[] grid = KmaLambertGridConverter.toGrid(lat, lng);
        return fetchSeriesForGrid(grid[0], grid[1], maxSlots);
    }

    public List<Map<String, Object>> fetchSeriesForGrid(int nx, int ny, int maxSlots) {
        long series0 = System.nanoTime();
        if (!client.isConfigured()) {
            return List.of();
        }
        int cap = Math.min(12, Math.max(4, maxSlots));
        Optional<String> tmfcOpt = resolveWorkingTmfc(nx, ny);
        if (tmfcOpt.isEmpty()) {
            long wallMs = (System.nanoTime() - series0) / 1_000_000L;
            log.warn(
                    "dfs_shrt_grd: 유효 tmfc 없음(모든 프로브 실패·upstream JSON·격자점 미포함 등) nx={} ny={} wallMs={}ms — 단기(reg) 실패 시 격자 폴백도 비게 됨",
                    nx,
                    ny,
                    wallMs);
            return List.of();
        }
        String tmfc = tmfcOpt.get();
        ZonedDateTime anchor = nextThreeHourlyFcst(ZonedDateTime.now(KST));

        List<CompletableFuture<Map<String, Object>>> slotFutures = new ArrayList<>();
        for (int i = 0; i < cap; i++) {
            final int idx = i;
            slotFutures.add(
                    CompletableFuture.supplyAsync(() -> fetchOneShrtSlot(tmfc, nx, ny, anchor, idx), kmaGridExecutor));
        }
        CompletableFuture.allOf(slotFutures.toArray(new CompletableFuture[0])).join();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (CompletableFuture<Map<String, Object>> f : slotFutures) {
            Map<String, Object> row = f.join();
            if (row != null && !row.isEmpty()) {
                rows.add(row);
            }
        }
        long wallMs = (System.nanoTime() - series0) / 1_000_000L;
        log.info(
                "KMA dfs_shrt_grd_series nx={} ny={} wallMs={}ms tmfc={} slots={} rows={}",
                nx,
                ny,
                wallMs,
                tmfc,
                cap,
                rows.size());
        return rows;
    }

    /** 한 슬롯(3시간 간격) — 실패 시 빈 맵 대신 null 과 동일 처리용 빈 맵 반환 가능 → 호출부에서 건너뜀 */
    private Map<String, Object> fetchOneShrtSlot(
            String tmfc, int nx, int ny, ZonedDateTime anchor, int slotIndex) {
        ZonedDateTime ft = anchor.plusHours(3L * slotIndex);
        String tmef = ft.format(TMEF);
        String raw = client.fetchRaw(tmfc, tmef, nx, ny, "T1H,POP,SKY,PTY");
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            raw = client.fetchRaw(tmfc, tmef, nx, ny, "T1H");
        }
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            return null;
        }
        Optional<KmaVsrtGrdResponseParser.DfsGridPoint> cell =
                KmaVsrtGrdResponseParser.extractGridPoint(raw, nx, ny, objectMapper);
        if (cell.isEmpty()) {
            return null;
        }
        KmaVsrtGrdResponseParser.DfsGridPoint c = cell.get();
        if (c.t1h() == null || c.t1h() < -80 || c.t1h() > 55) {
            return null;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("fcstDate", ft.format(FCST_DATE));
        row.put("fcstTime", ft.format(FCST_TIME));
        row.put("TMP", (int) Math.round(c.t1h()));
        if (c.pop() != null) {
            row.put("POP", c.pop());
        }
        if (c.sky() != null) {
            row.put("SKY", String.valueOf(c.sky()));
        }
        if (c.pty() != null) {
            row.put("PTY", String.valueOf(c.pty()));
        }
        return row;
    }

    /** 단기 예보 유효시각은 보통 3시간 배수 시각에 맞춘다. */
    static ZonedDateTime nextThreeHourlyFcst(ZonedDateTime nowKst) {
        ZonedDateTime t = nowKst.plusHours(1).truncatedTo(ChronoUnit.HOURS);
        int h = t.getHour();
        int rem = h % 3;
        if (rem != 0) {
            t = t.plusHours(3 - rem);
        }
        return t;
    }

    private Optional<String> resolveWorkingTmfc(int nx, int ny) {
        ZonedDateTime anchor = nextThreeHourlyFcst(ZonedDateTime.now(KST));
        String tmefProbe = anchor.format(TMEF);

        List<String> tries = new ArrayList<>(KmaShortRegIssuanceTime.candidatesNewestFirst());
        if (tries.isEmpty()) {
            tries.add(KmaShortRegIssuanceTime.conservativeFallbackTmfc());
        }
        String fallback = KmaShortRegIssuanceTime.conservativeFallbackTmfc();
        int nTry = Math.min(MAX_TMFC_PROBE, tries.size());
        List<String> probeOrder = new ArrayList<>(tries.subList(0, nTry));
        boolean extraFallback = !probeOrder.contains(fallback);
        if (extraFallback) {
            probeOrder.add(fallback);
        }
        List<CompletableFuture<Boolean>> probeFutures = new ArrayList<>();
        for (String tmfc : probeOrder) {
            final String t = tmfc;
            probeFutures.add(
                    CompletableFuture.supplyAsync(() -> shrtTmfcProbeOk(t, nx, ny, tmefProbe), kmaGridExecutor));
        }
        CompletableFuture.allOf(probeFutures.toArray(new CompletableFuture[0])).join();
        for (int i = 0; i < nTry; i++) {
            if (Boolean.TRUE.equals(probeFutures.get(i).join())) {
                return Optional.of(probeOrder.get(i));
            }
        }
        if (extraFallback) {
            int fi = nTry;
            if (Boolean.TRUE.equals(probeFutures.get(fi).join())) {
                return Optional.of(fallback);
            }
        }
        return Optional.empty();
    }

    private boolean shrtTmfcProbeOk(String tmfc, int nx, int ny, String tmefProbe) {
        String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H");
        if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
            return false;
        }
        Optional<KmaVsrtGrdResponseParser.DfsGridPoint> cell =
                KmaVsrtGrdResponseParser.extractGridPoint(raw, nx, ny, objectMapper);
        return cell.isPresent()
                && cell.get().t1h() != null
                && cell.get().t1h() > -80
                && cell.get().t1h() < 55;
    }
}
