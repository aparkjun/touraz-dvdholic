package fast.campus.netplix.scheduler;

import fast.campus.netplix.dvdstore.DvdStoreUseCase;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.NetplixPageableMovies;
import fast.campus.netplix.movie.OwnerRecommendUseCase;
import fast.campus.netplix.movie.PersistenceMoviePort;
import fast.campus.netplix.movie.TmdbMoviePlayingPort;
import fast.campus.netplix.movie.TmdbMoviePort;
import fast.campus.netplix.notification.NotificationUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class MovieUpdateScheduler {

    private static final AtomicBoolean batchInProgress = new AtomicBoolean(false);
    private static volatile String lastDvdBatchRun;
    private static volatile String lastMovieBatchRun;
    private static volatile Integer lastDvdCount;
    private static volatile Integer lastMovieCount;
    private static volatile String lastDvdStoreRefresh;
    private static volatile Integer lastDvdStoreCount;

    private final TmdbMoviePort tmdbMoviePort;
    private final TmdbMoviePlayingPort tmdbMoviePlayingPort;
    private final PersistenceMoviePort persistenceMoviePort;
    private final NotificationUseCase notificationUseCase;
    private final DvdStoreUseCase dvdStoreUseCase;
    private final OwnerRecommendUseCase ownerRecommendUseCase;

    public boolean isBatchRunning() {
        return batchInProgress.get();
    }

    public static String getLastDvdBatchRun() { return lastDvdBatchRun; }
    public static String getLastMovieBatchRun() { return lastMovieBatchRun; }
    public static Integer getLastDvdCount() { return lastDvdCount; }
    public static Integer getLastMovieCount() { return lastMovieCount; }
    public static String getLastDvdStoreRefresh() { return lastDvdStoreRefresh; }
    public static Integer getLastDvdStoreCount() { return lastDvdStoreCount; }

    /**
     * DVD매장(비디오물배급업) 공공데이터 자동 갱신 - 매월 1일 09:00 (KST) = UTC 00:00
     * localdata.go.kr API에서 최신 데이터를 가져와 DB 교체
     */
    @Scheduled(cron = "0 0 0 1 * *")
    public void refreshDvdStores() {
        if (!batchInProgress.compareAndSet(false, true)) {
            log.warn("=== 다른 배치 실행 중. DVD매장 갱신 스킵 ===");
            return;
        }
        try {
            log.info("=== DVD매장 공공데이터 갱신 시작 ({}) ===", LocalDateTime.now());
            int count = dvdStoreUseCase.refreshFromApi();
            lastDvdStoreRefresh = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            lastDvdStoreCount = count;

            if (count > 0) {
                try {
                    String dateStr = formatKstDate();
                    notificationUseCase.sendBatchUpdateNotification(
                            "DVD매장 데이터 갱신",
                            dateStr + " 전국 비디오물배급업 현황이 갱신되었습니다. (총 " + count + "곳)");
                } catch (Exception ex) {
                    log.warn("[DVD-STORE] 알림 발송 실패: {}", ex.getMessage());
                }
            }
            log.info("=== DVD매장 갱신 완료: {}곳 ===", count);
        } catch (Exception e) {
            log.error("=== DVD매장 갱신 실패: {} ===", e.getMessage(), e);
        } finally {
            batchInProgress.set(false);
        }
    }

    /**
     * 7일 지난 알림 자동 삭제 - 매일 새벽 1시 50분 (KST) = UTC 16:50 (전날)
     */
    @Scheduled(cron = "0 50 16 * * *")
    public void cleanupOldNotifications() {
        try {
            int deleted = notificationUseCase.deleteOldNotifications(7);
            log.info("=== 오래된 알림 정리 완료: {}건 삭제 ===", deleted);
        } catch (Exception e) {
            log.error("=== 오래된 알림 정리 실패: {} ===", e.getMessage());
        }
    }

    /**
     * DVD 목록 업데이트 - 매일 새벽 2시 (KST) = UTC 17:00 (전날)
     * 안전 패턴: 새 데이터를 먼저 가져온 후, 성공 시에만 기존 데이터 삭제
     */
    @Scheduled(cron = "0 0 17 * * *")
    public void updateDvdList() {
        if (!batchInProgress.compareAndSet(false, true)) {
            log.warn("=== 다른 배치 실행 중. DVD 배치 스킵 ===");
            return;
        }
        try {
            log.info("=== DVD 목록 업데이트 시작 ({}) ===", LocalDateTime.now());

            Map<String, LocalDateTime> oldFirstSeen = collectExistingFirstSeen("dvd");
            Set<String> oldNames = oldFirstSeen.keySet();
            LocalDateTime runAt = LocalDateTime.now();

            List<NetplixMovie> allMovies = new ArrayList<>();
            for (int page = 1; page <= 80; page++) {
                try {
                    NetplixPageableMovies movies = tmdbMoviePort.fetchPageable(page);
                    if (movies.getNetplixMovies().isEmpty()) break;
                    movies.getNetplixMovies().forEach(movie -> {
                        LocalDateTime firstSeen = oldFirstSeen.getOrDefault(movie.getMovieName(), runAt);
                        allMovies.add(withContentTypeAndFirstSeen(movie, "dvd", firstSeen));
                    });
                    log.info("=== DVD 페이지 {} (누적 {}편) ===", page, allMovies.size());
                    if (!movies.isHasNext()) break;
                } catch (Exception pageEx) {
                    log.warn("=== DVD 페이지 {} 실패: {} ===", page, pageEx.getMessage());
                }
            }

            if (allMovies.isEmpty()) {
                log.error("=== TMDB에서 DVD를 가져오지 못함. 기존 데이터 유지 ===");
                return;
            }

            persistenceMoviePort.deleteByContentType("dvd");
            allMovies.forEach(persistenceMoviePort::insert);

            lastDvdBatchRun = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            lastDvdCount = allMovies.size();

            List<NetplixMovie> newMovies = allMovies.stream()
                    .filter(m -> !oldNames.contains(m.getMovieName()))
                    .collect(Collectors.toList());
            log.info("=== DVD 완료: 총 {}편, 신규 {}편 ===", allMovies.size(), newMovies.size());

            try {
                String dateStr = formatKstDate();
                if (!newMovies.isEmpty()) {
                    notificationUseCase.sendBatchUpdateNotification(
                            "DVD 목록 업데이트",
                            dateStr + " DVD " + newMovies.size() + "편이 새로 추가되었습니다.",
                            buildMovieJson(newMovies));
                } else {
                    notificationUseCase.sendBatchUpdateNotification(
                            "DVD 목록 업데이트",
                            dateStr + " DVD 목록이 최신 정보로 갱신되었습니다. (총 " + allMovies.size() + "편)");
                }
            } catch (Exception ex) {
                log.error("[DVD-BATCH] 알림 발송 실패: {}", ex.getMessage(), ex);
            }
            log.info("========================================");
        } catch (Exception e) {
            log.error("=== DVD 목록 업데이트 실패: {} ===", e.getMessage(), e);
        } finally {
            batchInProgress.set(false);
        }
    }

    /**
     * 영화 목록 업데이트 - 매일 새벽 3시 (KST) = UTC 18:00 (전날), DVD와 1시간 간격
     * 안전 패턴: 새 데이터를 먼저 가져온 후, 성공 시에만 기존 데이터 삭제
     */
    @Scheduled(cron = "0 0 18 * * *")
    public void updateMovieList() {
        if (!batchInProgress.compareAndSet(false, true)) {
            log.warn("=== 다른 배치 실행 중. 영화 배치 스킵 ===");
            return;
        }
        try {
            log.info("=== 영화 목록 업데이트 시작 ({}) ===", LocalDateTime.now());

            Map<String, LocalDateTime> oldFirstSeen = collectExistingFirstSeen("movie");
            Set<String> oldNames = oldFirstSeen.keySet();
            LocalDateTime runAt = LocalDateTime.now();

            List<NetplixMovie> allMovies = new ArrayList<>();
            for (int page = 1; page <= 80; page++) {
                try {
                    NetplixPageableMovies movies = tmdbMoviePlayingPort.fetchPageable(page);
                    if (movies.getNetplixMovies().isEmpty()) break;
                    movies.getNetplixMovies().forEach(movie -> {
                        LocalDateTime firstSeen = oldFirstSeen.getOrDefault(movie.getMovieName(), runAt);
                        allMovies.add(withContentTypeAndFirstSeen(movie, "movie", firstSeen));
                    });
                    log.info("=== 영화 페이지 {} (누적 {}편) ===", page, allMovies.size());
                    if (!movies.isHasNext()) break;
                } catch (Exception pageEx) {
                    log.warn("=== 영화 페이지 {} 실패: {} ===", page, pageEx.getMessage());
                }
            }

            if (allMovies.isEmpty()) {
                log.error("=== TMDB에서 영화를 가져오지 못함. 기존 데이터 유지 ===");
                return;
            }

            persistenceMoviePort.deleteByContentType("movie");
            allMovies.forEach(persistenceMoviePort::insert);

            lastMovieBatchRun = LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            lastMovieCount = allMovies.size();

            List<NetplixMovie> newMovies = allMovies.stream()
                    .filter(m -> !oldNames.contains(m.getMovieName()))
                    .collect(Collectors.toList());
            log.info("=== 영화 완료: 총 {}편, 신규 {}편 ===", allMovies.size(), newMovies.size());

            try {
                String dateStr = formatKstDate();
                if (!newMovies.isEmpty()) {
                    notificationUseCase.sendBatchUpdateNotification(
                            "영화 목록 업데이트",
                            dateStr + " 영화 " + newMovies.size() + "편이 새로 추가되었습니다.",
                            buildMovieJson(newMovies));
                } else {
                    notificationUseCase.sendBatchUpdateNotification(
                            "영화 목록 업데이트",
                            dateStr + " 영화 목록이 최신 정보로 갱신되었습니다. (총 " + allMovies.size() + "편)");
                }
            } catch (Exception ex) {
                log.warn("영화 알림 발송 실패: {}", ex.getMessage());
            }
            log.info("========================================");
        } catch (Exception e) {
            log.error("=== 영화 목록 업데이트 실패: {} ===", e.getMessage(), e);
        } finally {
            batchInProgress.set(false);
        }
    }

    /**
     * 주인장추천 트렌딩 컨텍스트 갱신 - 매주 월요일 04:00 (KST) = UTC 19:00 (일요일)
     */
    @Scheduled(cron = "0 0 19 * * SUN")
    public void refreshOwnerTrendingContext() {
        try {
            log.info("=== 주인장추천 트렌딩 컨텍스트 갱신 시작 ===");
            ownerRecommendUseCase.refreshTrendingContext();
            log.info("=== 주인장추천 트렌딩 컨텍스트 갱신 완료 ===");
        } catch (Exception e) {
            log.warn("=== 주인장추천 트렌딩 갱신 실패: {} ===", e.getMessage());
        }
    }

    /**
     * 앱 기동 후 주인장추천 트렌딩 컨텍스트 초기 로딩 (비동기).
     */
    @jakarta.annotation.PostConstruct
    public void initOwnerTrending() {
        new Thread(() -> {
            try {
                Thread.sleep(10_000);
                if (!ownerRecommendUseCase.hasTrendingContext()) {
                    log.info("[주인장추천] 앱 시작 시 트렌딩 컨텍스트 초기 로딩");
                    ownerRecommendUseCase.refreshTrendingContext();
                }
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                log.warn("[주인장추천] 초기 트렌딩 로딩 실패: {}", e.getMessage());
            }
        }, "owner-trending-init").start();
    }

    private Set<String> collectExistingNames(String contentType) {
        return collectExistingFirstSeen(contentType).keySet();
    }

    /** 기존 DB에서 영화명 → FIRST_SEEN_AT 맵을 만든다 (배치 재삽입 시 기존 값 보존용). */
    private Map<String, LocalDateTime> collectExistingFirstSeen(String contentType) {
        Map<String, LocalDateTime> map = new HashMap<>();
        int p = 0;
        while (true) {
            List<NetplixMovie> batch = persistenceMoviePort.fetchByContentType(contentType, p, 50);
            if (batch.isEmpty()) break;
            batch.forEach(m -> map.put(m.getMovieName(), m.getFirstSeenAt()));
            if (batch.size() < 50) break;
            p++;
        }
        return map;
    }

    private static String formatKstDate() {
        LocalDateTime kst = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yy년 M월 d일(E)", Locale.KOREAN);
        return kst.format(fmt);
    }

    /** 알림 본문의 N편과 썸네일 목록 개수를 맞추기 위해 신규 전체를 저장한다(포스터 없음은 빈 문자열). */
    private static String buildMovieJson(List<NetplixMovie> movies) {
        String items = movies.stream()
                .map(m -> {
                    String poster = (m.getPosterPath() != null && !m.getPosterPath().isBlank())
                            ? m.getPosterPath() : "";
                    return "{\"name\":\"" + escapeJson(m.getMovieName()) + "\",\"poster\":\"" + escapeJson(poster) + "\"}";
                })
                .collect(Collectors.joining(","));
        return "[" + items + "]";
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private NetplixMovie withContentType(NetplixMovie movie, String contentType) {
        return withContentTypeAndFirstSeen(movie, contentType, null);
    }

    private NetplixMovie withContentTypeAndFirstSeen(NetplixMovie movie, String contentType, LocalDateTime firstSeenAt) {
        return NetplixMovie.builder()
                .movieName(movie.getMovieName())
                .isAdult(movie.getIsAdult())
                .genre(movie.getGenre())
                .overview(movie.getOverview())
                .releasedAt(movie.getReleasedAt())
                .posterPath(movie.getPosterPath())
                .backdropPath(movie.getBackdropPath())
                .voteAverage(movie.getVoteAverage())
                .cast(movie.getCast())
                .director(movie.getDirector())
                .runtime(movie.getRuntime())
                .releaseDate(movie.getReleaseDate())
                .certification(movie.getCertification())
                .budget(movie.getBudget())
                .revenue(movie.getRevenue())
                .contentType(contentType)
                .trailerUrl(movie.getTrailerUrl())
                .ottProviders(movie.getOttProviders())
                .collection(movie.getCollection())
                .recommendations(movie.getRecommendations())
                .topReview(movie.getTopReview())
                .tagline(movie.getTagline())
                .originalTitle(movie.getOriginalTitle())
                .originalLanguage(movie.getOriginalLanguage())
                .productionCountries(movie.getProductionCountries())
                .productionCompanies(movie.getProductionCompanies())
                .imdbId(movie.getImdbId())
                .voteCount(movie.getVoteCount())
                .spokenLanguages(movie.getSpokenLanguages())
                .homepage(movie.getHomepage())
                .movieNameEn(movie.getMovieNameEn())
                .overviewEn(movie.getOverviewEn())
                .taglineEn(movie.getTaglineEn())
                .posterPathEn(movie.getPosterPathEn())
                .backdropPathEn(movie.getBackdropPathEn())
                .firstSeenAt(firstSeenAt)
                .build();
    }
}
