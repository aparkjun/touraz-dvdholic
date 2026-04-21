package fast.campus.netplix.controller.tour;

import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexUseCase;
import fast.campus.netplix.tour.TrendingRegion;
import fast.campus.netplix.tour.TrendingRegionCachePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * 한국관광공사 데이터랩 지자체 지표 조회 API.
 * - 최신 스냅샷 전체 / 검색량 Top-N / 단일 지자체 조회
 * - 관리자 전용 sync-now 수동 트리거 (개발/운영 보강용)
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/tour")
@RequiredArgsConstructor
public class TourController {

    private final TourIndexUseCase tourIndexUseCase;
    private final TrendingRegionCachePort trendingRegionCachePort;

    @GetMapping("/regions")
    public NetplixApiResponse<List<TourResponse>> regions() {
        List<TourResponse> body = tourIndexUseCase.getLatestPerRegion().stream()
                .map(TourResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @GetMapping("/regions/{areaCode}")
    public NetplixApiResponse<TourResponse> region(@PathVariable String areaCode) {
        return tourIndexUseCase.getLatestByAreaCode(areaCode)
                .map(TourResponse::from)
                .map(NetplixApiResponse::ok)
                .orElseGet(() -> NetplixApiResponse.ok(null));
    }

    /**
     * 트렌딩 지역 목록.
     * - period 쿼리(today|week|month)가 있으면 ComputeTrendingRegionsBatch 결과 캐시(trending_regions_cache)를 우선 사용
     * - 캐시가 비었거나 period 미지정이면 최신 스냅샷 기준 검색량 Top-N 으로 fallback
     */
    @GetMapping("/trending-regions")
    public NetplixApiResponse<List<TourResponse>> trendingRegions(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String period) {

        if (period != null && !period.isBlank()) {
            List<TrendingRegion> cached = trendingRegionCachePort.findByPeriod(period, limit);
            if (!cached.isEmpty()) {
                List<TourResponse> body = cached.stream()
                        .map(r -> tourIndexUseCase.getLatestByAreaCode(r.getAreaCode())
                                .map(TourResponse::from)
                                .orElseGet(() -> TourResponse.from(
                                        TourIndex.builder()
                                                .areaCode(r.getAreaCode())
                                                .regionName(r.getRegionName())
                                                .build())))
                        .toList();
                return NetplixApiResponse.ok(body);
            }
        }

        List<TourResponse> body = tourIndexUseCase.getTopBySearchVolume(limit).stream()
                .map(TourResponse::from)
                .toList();
        return NetplixApiResponse.ok(body);
    }

    @PostMapping("/sync-now")
    public NetplixApiResponse<Integer> syncNow(
            @RequestParam(required = false) String baseDate) {
        LocalDate target = baseDate == null ? LocalDate.now().minusDays(1) : LocalDate.parse(baseDate);
        int count = tourIndexUseCase.syncFromApi(target);
        return NetplixApiResponse.ok(count);
    }
}
