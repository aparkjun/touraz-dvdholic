package fast.campus.netplix.controller.batch;

import fast.campus.netplix.cinetrip.AutoTagCineTripMappingUseCase;
import fast.campus.netplix.cinetrip.RecomputeCineTripScoreUseCase;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.scheduler.MovieUpdateScheduler;
import fast.campus.netplix.tour.ComputeTrendingRegionsUseCase;
import fast.campus.netplix.tour.TourIndexUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.OwnerRecommendUseCase;
import fast.campus.netplix.movie.PersistenceMoviePort;
import fast.campus.netplix.notification.Notification;
import fast.campus.netplix.notification.NotificationUseCase;
import fast.campus.netplix.user.SearchUserPort;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/batch")
@RequiredArgsConstructor
public class BatchController {

    private final MovieUpdateScheduler movieUpdateScheduler;
    private final NotificationUseCase notificationUseCase;
    private final SearchUserPort searchUserPort;
    private final PersistenceMoviePort persistenceMoviePort;
    private final OwnerRecommendUseCase ownerRecommendUseCase;
    private final AutoTagCineTripMappingUseCase autoTagCineTripMappingUseCase;
    private final TourIndexUseCase tourIndexUseCase;
    private final ComputeTrendingRegionsUseCase computeTrendingRegionsUseCase;
    private final RecomputeCineTripScoreUseCase recomputeCineTripScoreUseCase;

    /**
     * 배치 스케줄·마지막 실행 시각 확인 (매일 새벽 배치가 도는지 검증용)
     */
    @GetMapping("/status")
    public NetplixApiResponse<Map<String, Object>> getBatchStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("batchRunning", movieUpdateScheduler.isBatchRunning());
        status.put("lastMovieBatchRun", MovieUpdateScheduler.getLastMovieBatchRun());
        status.put("lastMovieCount", MovieUpdateScheduler.getLastMovieCount());
        status.put("lastDvdBatchRun", MovieUpdateScheduler.getLastDvdBatchRun());
        status.put("lastDvdCount", MovieUpdateScheduler.getLastDvdCount());
        status.put("lastDvdStoreRefresh", MovieUpdateScheduler.getLastDvdStoreRefresh());
        status.put("lastDvdStoreCount", MovieUpdateScheduler.getLastDvdStoreCount());
        status.put("ownerTrendingReady", ownerRecommendUseCase.hasTrendingContext());
        status.put("schedule", Map.of(
            "movie", "매일 03:00 KST (UTC 18:00 전날)",
            "dvd", "매일 02:00 KST (UTC 17:00 전날)",
            "dvdStore", "매월 1일 09:00 KST (UTC 00:00)",
            "ownerTrending", "매주 월요일 04:00 KST (UTC 19:00 일요일)"
        ));
        return NetplixApiResponse.ok(status);
    }

    @PostMapping("/dvd")
    public NetplixApiResponse<String> runDvdBatch() {
        log.info("DVD 배치 수동 실행 요청");
        if (movieUpdateScheduler.isBatchRunning()) {
            return NetplixApiResponse.ok("다른 배치 실행 중입니다. 완료 후(약 5~10분) 다시 시도하세요.");
        }
        try {
            CompletableFuture.runAsync(movieUpdateScheduler::updateDvdList);
            return NetplixApiResponse.ok("DVD 목록 업데이트를 시작했습니다. 완료 후 영화 배치를 실행하세요.");
        } catch (Exception e) {
            log.error("DVD 배치 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("DVD 배치 실행 실패: " + e.getMessage());
        }
    }

    @GetMapping("/diag/notifications")
    public NetplixApiResponse<List<Notification>> diagNotifications() {
        List<String> userIds = searchUserPort.findAllUserIds();
        if (userIds.isEmpty()) return NetplixApiResponse.ok(List.of());
        String firstUserId = userIds.get(0);
        List<Notification> notifs = notificationUseCase.getNotifications(firstUserId);
        return NetplixApiResponse.ok(notifs.stream().limit(3).collect(Collectors.toList()));
    }

    @PostMapping("/reset-notifications")
    public NetplixApiResponse<String> resetNotifications() {
        notificationUseCase.deleteAllNotifications();
        String dateStr = LocalDateTime.now(ZoneId.of("Asia/Seoul"))
                .format(DateTimeFormatter.ofPattern("yy년 M월 d일(E)", Locale.KOREAN));

        List<NetplixMovie> dvds = fetchAllByType("dvd");
        if (!dvds.isEmpty()) {
            notificationUseCase.sendBatchUpdateNotification(
                    "DVD 목록 업데이트",
                    dateStr + " DVD " + dvds.size() + "편이 새로 추가되었습니다.",
                    buildJson(dvds));
        }

        List<NetplixMovie> movies = fetchAllByType("movie");
        if (!movies.isEmpty()) {
            notificationUseCase.sendBatchUpdateNotification(
                    "영화 목록 업데이트",
                    dateStr + " 영화 " + movies.size() + "편이 새로 추가되었습니다.",
                    buildJson(movies));
        }

        return NetplixApiResponse.ok("알림 초기화 완료. DVD " + dvds.size() + "편, 영화 " + movies.size() + "편.");
    }

    private List<NetplixMovie> fetchAllByType(String contentType) {
        List<NetplixMovie> all = new ArrayList<>();
        int p = 0;
        while (true) {
            List<NetplixMovie> batch = persistenceMoviePort.fetchByContentType(contentType, p, 50);
            if (batch.isEmpty()) break;
            all.addAll(batch);
            if (batch.size() < 50) break;
            p++;
        }
        return all;
    }

    private static String buildJson(List<NetplixMovie> movies) {
        String items = movies.stream()
                .map(m -> {
                    String poster = (m.getPosterPath() != null && !m.getPosterPath().isBlank())
                            ? m.getPosterPath() : "";
                    return "{\"name\":\"" + esc(m.getMovieName()) + "\",\"poster\":\"" + esc(poster) + "\"}";
                })
                .collect(Collectors.joining(","));
        return "[" + items + "]";
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    @PostMapping("/dvd-stores-refresh")
    public NetplixApiResponse<String> runDvdStoreRefresh() {
        log.info("DVD매장 공공데이터 수동 갱신 요청");
        if (movieUpdateScheduler.isBatchRunning()) {
            return NetplixApiResponse.ok("다른 배치 실행 중입니다. 완료 후 다시 시도하세요.");
        }
        try {
            CompletableFuture.runAsync(movieUpdateScheduler::refreshDvdStores);
            return NetplixApiResponse.ok("DVD매장 공공데이터 갱신을 시작했습니다.");
        } catch (Exception e) {
            log.error("DVD매장 갱신 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("DVD매장 갱신 실패: " + e.getMessage());
        }
    }

    @PostMapping("/owner-trending-refresh")
    public NetplixApiResponse<String> refreshOwnerTrending() {
        log.info("주인장추천 트렌딩 컨텍스트 수동 갱신 요청");
        try {
            ownerRecommendUseCase.refreshTrendingContext();
            return NetplixApiResponse.ok("트렌딩 컨텍스트 갱신 완료. hasTrendingContext=" + ownerRecommendUseCase.hasTrendingContext());
        } catch (Exception e) {
            log.error("트렌딩 갱신 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("트렌딩 갱신 실패: " + e.getMessage());
        }
    }

    @PostMapping("/movie")
    public NetplixApiResponse<String> runMovieBatch() {
        log.info("Movie 배치 수동 실행 요청");
        if (movieUpdateScheduler.isBatchRunning()) {
            return NetplixApiResponse.ok("다른 배치 실행 중입니다. 완료 후(약 5~10분) 다시 시도하세요.");
        }
        try {
            CompletableFuture.runAsync(movieUpdateScheduler::updateMovieList);
            return NetplixApiResponse.ok("영화 목록 업데이트를 시작했습니다.");
        } catch (Exception e) {
            log.error("Movie 배치 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("영화 배치 실행 실패: " + e.getMessage());
        }
    }

    /**
     * LLM + 룰 기반 영화-지역 자동 태깅 수동 트리거.
     * Heroku 는 web dyno 만 외부 노출이므로 app-batch 의 동명 엔드포인트를 여기로도 노출한다.
     * 자동 스케줄은 BatchScheduler#runAutoTagCineTripMappingBatch 가 매일 05:00 KST 에 실행한다.
     */
    @PostMapping("/cine-trip/auto-tag")
    public NetplixApiResponse<String> runAutoTagCineTripMapping() {
        log.info("CineTrip 자동 태깅 수동 실행 요청");
        try {
            CompletableFuture.runAsync(() -> {
                try {
                    AutoTagCineTripMappingUseCase.Result r = autoTagCineTripMappingUseCase.runAll();
                    log.info("[AUTOTAG-MANUAL] 완료 - 스캔 {} / 자동승인 {} / 대기 {} / 스킵 {}",
                            r.scanned, r.autoApproved, r.pending, r.skipped);
                } catch (Exception e) {
                    log.error("[AUTOTAG-MANUAL] 실패: {}", e.getMessage(), e);
                }
            });
            return NetplixApiResponse.ok("CineTrip 자동 태깅을 시작했습니다. 완료 후 /api/v1/admin/cine-trip/pending-mappings 로 결과를 확인하세요.");
        } catch (Exception e) {
            log.error("자동 태깅 배치 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("자동 태깅 배치 실행 실패: " + e.getMessage());
        }
    }

    /**
     * 관광공사 데이터랩 API 에서 지자체별 지표를 당겨와 tour_index_snapshots 에 upsert.
     * 자동 스케줄은 app-batch SyncTourIndexBatch 가 매일 03:30 KST 에 실행.
     *
     * @param baseDate yyyy-MM-dd 형식. 미지정 시 KST 기준 어제(데이터 지연 감안).
     *                 관광공사 API 가 과거 데이터만 제공하므로 미래/오늘 은 403/404 가 나서 의미 없음.
     */
    @PostMapping("/tour/sync")
    public NetplixApiResponse<String> runTourSync(
            @RequestParam(value = "baseDate", required = false) String baseDate) {
        log.info("Tour Sync 수동 실행 요청 baseDate={}", baseDate);
        final LocalDate target;
        try {
            if (baseDate != null && !baseDate.isBlank()) {
                target = LocalDate.parse(baseDate);
            } else {
                target = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(1);
            }
        } catch (Exception e) {
            return NetplixApiResponse.ok("baseDate 파싱 실패 (yyyy-MM-dd): " + e.getMessage());
        }
        try {
            CompletableFuture.runAsync(() -> {
                try {
                    int saved = tourIndexUseCase.syncFromApi(target);
                    log.info("[TOUR-SYNC-MANUAL] 완료 - baseDate={}, saved={}", target, saved);
                } catch (Exception e) {
                    log.error("[TOUR-SYNC-MANUAL] 실패: {}", e.getMessage(), e);
                }
            });
            return NetplixApiResponse.ok("Tour 지표 동기화를 시작했습니다. baseDate=" + target + ". 완료 후 /api/v1/tour/regions 로 확인하세요.");
        } catch (Exception e) {
            log.error("Tour Sync 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("Tour Sync 실행 실패: " + e.getMessage());
        }
    }

    /**
     * trending_regions_cache 3 period(today/week/month) 재계산.
     * 자동 스케줄은 app-batch ComputeTrendingRegionsBatch 가 매일 04:00 KST 에 실행.
     */
    @PostMapping("/tour/trending")
    public NetplixApiResponse<String> runTrendingRecompute() {
        log.info("Trending Regions 재계산 수동 실행 요청");
        try {
            CompletableFuture.runAsync(() -> {
                try {
                    int saved = computeTrendingRegionsUseCase.recomputeAll();
                    log.info("[TRENDING-MANUAL] 완료 - saved={}", saved);
                } catch (Exception e) {
                    log.error("[TRENDING-MANUAL] 실패: {}", e.getMessage(), e);
                }
            });
            return NetplixApiResponse.ok("Trending 재계산을 시작했습니다. 완료 후 /api/v1/tour/trending-regions?period=today 로 확인하세요.");
        } catch (Exception e) {
            log.error("Trending 재계산 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("Trending 재계산 실행 실패: " + e.getMessage());
        }
    }

    /**
     * movie_region_mappings 의 trending_score 재계산.
     * 자동 스케줄은 app-batch RecomputeCineTripScoreBatch 가 매일 04:30 KST 에 실행.
     */
    @PostMapping("/cine-trip/score")
    public NetplixApiResponse<String> runCineTripScoreRecompute() {
        log.info("CineTrip Score 재계산 수동 실행 요청");
        try {
            CompletableFuture.runAsync(() -> {
                try {
                    int saved = recomputeCineTripScoreUseCase.recomputeAll();
                    log.info("[CINETRIP-SCORE-MANUAL] 완료 - saved={}", saved);
                } catch (Exception e) {
                    log.error("[CINETRIP-SCORE-MANUAL] 실패: {}", e.getMessage(), e);
                }
            });
            return NetplixApiResponse.ok("CineTrip Score 재계산을 시작했습니다. 완료 후 /api/v1/cine-trip?limit=5 로 확인하세요.");
        } catch (Exception e) {
            log.error("CineTrip Score 재계산 실행 실패: {}", e.getMessage(), e);
            return NetplixApiResponse.ok("CineTrip Score 재계산 실행 실패: " + e.getMessage());
        }
    }
}
