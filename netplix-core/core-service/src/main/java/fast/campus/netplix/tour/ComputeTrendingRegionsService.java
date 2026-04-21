package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 지자체 최신 스냅샷 기반으로 today/week/month 트렌딩 지역 캐시를 재생성한다.
 *
 * 스냅샷이 1시점만 존재하는 초기 환경에서도 동작하도록, period 별로 다른 가중치를 적용해
 * 같은 테이블에서 3개 관점(단기 검색 급등 / 중기 관광수요 / 장기 문화수요) 을 산출한다.
 * 실제 시계열이 쌓이면 구현체에서 기간별 이동평균으로 교체 가능.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ComputeTrendingRegionsService implements ComputeTrendingRegionsUseCase {

    private static final int DEFAULT_LIMIT = 10;
    private static final List<String> PERIODS = List.of("today", "week", "month");

    private final TourIndexRepositoryPort tourIndexRepositoryPort;
    private final TrendingRegionCachePort trendingRegionCachePort;

    @Override
    public int recomputeAll() {
        int total = 0;
        for (String period : PERIODS) {
            List<TrendingRegion> ranked = recomputePeriod(period, DEFAULT_LIMIT);
            total += ranked.size();
        }
        return total;
    }

    @Override
    public List<TrendingRegion> recomputePeriod(String period, int limit) {
        List<TourIndex> latest = tourIndexRepositoryPort.findLatestPerRegion();
        if (latest.isEmpty()) {
            log.warn("[TRENDING] 최신 스냅샷 0건 - period={} 스킵", period);
            trendingRegionCachePort.replacePeriod(period, List.of());
            return List.of();
        }

        Comparator<TourIndex> cmp = comparatorFor(period);
        int safeLimit = Math.max(1, Math.min(limit, 50));

        List<TourIndex> sorted = new ArrayList<>(latest);
        sorted.sort(cmp);

        List<TrendingRegion> out = new ArrayList<>();
        int rank = 1;
        for (TourIndex ti : sorted) {
            if (out.size() >= safeLimit) break;
            double score = scoreFor(period, ti);
            if (score <= 0) continue;
            out.add(TrendingRegion.builder()
                    .areaCode(ti.getAreaCode())
                    .regionName(ti.getRegionName())
                    .period(period)
                    .rank(rank++)
                    .score(round2(score))
                    .latest(ti)
                    .build());
        }

        int saved = trendingRegionCachePort.replacePeriod(period, out);
        log.info("[TRENDING] period={} ranked={} saved={}", period, out.size(), saved);
        return out;
    }

    private Comparator<TourIndex> comparatorFor(String period) {
        return (a, b) -> Double.compare(scoreFor(period, b), scoreFor(period, a));
    }

    /**
     * period 별 가중치.
     * - today : 검색량이 지배 (단기 급등 대리)
     * - week  : 관광수요지수 + 경쟁력
     * - month : 문화자원 수요 + 관광자원 수요
     */
    private double scoreFor(String period, TourIndex ti) {
        double sv = nz(ti.getSearchVolume());
        double demand = nz(ti.getTourDemandIdx());
        double competitive = nz(ti.getTourCompetitiveness());
        double cultural = nz(ti.getCulturalResourceDemand());
        double resource = nz(ti.getTourResourceDemand());
        return switch (period) {
            case "today" -> sv * 1.0 + demand * 0.2;
            case "week"  -> demand * 0.6 + competitive * 0.3 + sv * 0.01;
            case "month" -> cultural * 0.5 + resource * 0.4 + demand * 0.1;
            default       -> sv;
        };
    }

    private double nz(Number n) { return n == null ? 0.0 : n.doubleValue(); }
    private double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
