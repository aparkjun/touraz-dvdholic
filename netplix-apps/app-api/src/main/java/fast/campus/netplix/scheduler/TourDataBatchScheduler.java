package fast.campus.netplix.scheduler;

import fast.campus.netplix.tour.ComputeTrendingRegionsUseCase;
import fast.campus.netplix.tour.TourIndexUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * Heroku 등에서 {@code app-batch} 프로세스를 띄우지 않을 때, web dyno({@code app-api})에서
 * 관광공사 데이터랩 동기화 및 인기 지역 캐시를 갱신한다.
 * 시각은 {@code app-batch.BatchScheduler} 와 동일(KST).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TourDataBatchScheduler {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private final TourIndexUseCase tourIndexUseCase;
    private final ComputeTrendingRegionsUseCase computeTrendingRegionsUseCase;

    /**
     * 관광공사 데이터랩 → {@code tour_index_snapshots}. app-batch {@code SyncTourIndexBatch} 와 동일 03:30 KST.
     * {@code baseDate} 는 수동 배치와 같이 KST 기준 2개월 전(공개 시차).
     */
    @Scheduled(cron = "0 30 3 * * *", zone = "Asia/Seoul")
    public void scheduledSyncTourIndex() {
        LocalDate baseDate = LocalDate.now(KST).minusMonths(2);
        try {
            log.info("[TOUR-SYNC-SCHED] 시작 baseDate={}", baseDate);
            int saved = tourIndexUseCase.syncFromApi(baseDate);
            log.info("[TOUR-SYNC-SCHED] 완료 saved={}", saved);
        } catch (Exception e) {
            log.error("[TOUR-SYNC-SCHED] 실패: {}", e.getMessage(), e);
        }
    }

    /**
     * {@code trending_regions_cache} today/week/month 재계산. app-batch {@code ComputeTrendingRegionsBatch} 와 동일 04:00 KST.
     */
    @Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
    public void scheduledComputeTrendingRegions() {
        try {
            log.info("[TRENDING-SCHED] 시작");
            int total = computeTrendingRegionsUseCase.recomputeAll();
            log.info("[TRENDING-SCHED] 완료 캐시 행 합={}", total);
        } catch (Exception e) {
            log.error("[TRENDING-SCHED] 실패: {}", e.getMessage(), e);
        }
    }
}
