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
 * 동네예보 단기 격자({@code nph-dfs_shrt_grd})로 3시간 간격 예보 시계열을 만든다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KmaShrtGrdSeriesService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter TMEF = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final DateTimeFormatter FCST_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter FCST_TIME = DateTimeFormatter.ofPattern("HHmm");

    private final KmaShrtGrdHttpClient client;
    private final ObjectMapper objectMapper;

    /** @param maxSlots 3시간 간격 슬롯 수 (기본 4~16 권장) */
    public List<Map<String, Object>> fetchSeriesForLatLng(double lat, double lng, int maxSlots) {
        int[] grid = KmaLambertGridConverter.toGrid(lat, lng);
        return fetchSeriesForGrid(grid[0], grid[1], maxSlots);
    }

    /** Heroku 등 게이트웨이 타임아웃 내에 맞추기 위해 슬롯·발표시각 탐색을 제한한다. */
    private static final int MAX_TMFC_PROBE = 6;

    public List<Map<String, Object>> fetchSeriesForGrid(int nx, int ny, int maxSlots) {
        if (!client.isConfigured()) {
            return List.of();
        }
        int cap = Math.min(12, Math.max(4, maxSlots));
        Optional<String> tmfcOpt = resolveWorkingTmfc(nx, ny);
        if (tmfcOpt.isEmpty()) {
            log.debug("dfs_shrt_grd: 유효 tmfc 없음 nx={} ny={}", nx, ny);
            return List.of();
        }
        String tmfc = tmfcOpt.get();
        ZonedDateTime anchor = nextThreeHourlyFcst(ZonedDateTime.now(KST));

        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < cap; i++) {
            ZonedDateTime ft = anchor.plusHours(3L * i);
            String tmef = ft.format(TMEF);
            // 슬롯당 1회 호출(T1H) — 응답·게이트웨이 시간 단축. POP/SKY 는 허브가 내려주면 파서가 채움.
            String raw = client.fetchRaw(tmfc, tmef, nx, ny, "T1H,POP,SKY,PTY");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.DfsGridPoint> cell =
                    KmaVsrtGrdResponseParser.extractGridPoint(raw, nx, ny, objectMapper);
            if (cell.isEmpty()) {
                continue;
            }
            KmaVsrtGrdResponseParser.DfsGridPoint c = cell.get();
            if (c.t1h() == null || c.t1h() < -80 || c.t1h() > 55) {
                continue;
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
            rows.add(row);
        }
        return rows;
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
        for (int i = 0; i < nTry; i++) {
            String tmfc = tries.get(i);
            String raw = client.fetchRaw(tmfc, tmefProbe, nx, ny, "T1H");
            if (raw == null || KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                continue;
            }
            Optional<KmaVsrtGrdResponseParser.DfsGridPoint> cell =
                    KmaVsrtGrdResponseParser.extractGridPoint(raw, nx, ny, objectMapper);
            if (cell.isPresent()
                    && cell.get().t1h() != null
                    && cell.get().t1h() > -80
                    && cell.get().t1h() < 55) {
                return Optional.of(tmfc);
            }
        }
        if (!tries.subList(0, nTry).contains(fallback)) {
            String raw = client.fetchRaw(fallback, tmefProbe, nx, ny, "T1H");
            if (raw != null && !KmaVsrtGrdResponseParser.isUpstreamError(raw, objectMapper)) {
                Optional<KmaVsrtGrdResponseParser.DfsGridPoint> cell =
                        KmaVsrtGrdResponseParser.extractGridPoint(raw, nx, ny, objectMapper);
                if (cell.isPresent()
                        && cell.get().t1h() != null
                        && cell.get().t1h() > -80
                        && cell.get().t1h() < 55) {
                    return Optional.of(fallback);
                }
            }
        }
        return Optional.empty();
    }
}
