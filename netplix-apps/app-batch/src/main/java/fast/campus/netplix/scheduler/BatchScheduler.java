package fast.campus.netplix.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
public class BatchScheduler {

    private final JobLauncher jobLauncher;
    private final ApplicationContext applicationContext;

    /**
     * TMDB에서 최신 DVD 목록을 가져오는 배치
     * 매일 새벽 2시에 실행
     * cron: 초(0) 분(0) 시(2) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 0 2 * * *")
    public void runMigrateDvdBatch() {
        try {
            log.info("========================================");
            log.info("=== DVD 목록 업데이트 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("MigrateMoviesFromTmdbBatch", Job.class);
            
            // JobParameters에 현재 시간을 추가하여 매번 새로운 실행으로 인식되도록 함
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== DVD 목록 업데이트 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== DVD 목록 업데이트 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * TMDB에서 최신 영화 정보를 가져오는 배치
     * 매일 새벽 2시 30분에 실행
     * cron: 초(0) 분(30) 시(2) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 30 2 * * *")
    public void runMigrateMoviesBatch() {
        try {
            log.info("========================================");
            log.info("=== 영화 정보 업데이트 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("MigrateMoviesPlayingFromTmdbBatch", Job.class);
            
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== 영화 정보 업데이트 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== 영화 정보 업데이트 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * 구독 만료 처리 배치
     * 매일 자정에 실행
     * cron: 초(0) 분(0) 시(0) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void runSubscriptionOffBatch() {
        try {
            log.info("========================================");
            log.info("=== 구독 만료 처리 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("UserSubscriptionOffBatch", Job.class);
            
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== 구독 만료 처리 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== 구독 만료 처리 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * 한국관광공사 데이터랩 스냅샷 동기화 배치
     * 매일 새벽 3시 30분에 실행
     * cron: 초(0) 분(30) 시(3) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 30 3 * * *")
    public void runSyncTourIndexBatch() {
        try {
            log.info("========================================");
            log.info("=== 관광공사 데이터랩 동기화 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("SyncTourIndexBatch", Job.class);

            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== 관광공사 데이터랩 동기화 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== 관광공사 데이터랩 동기화 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * 트렌딩 지역 캐시 재계산 배치
     * 매일 새벽 4시에 실행
     * cron: 초(0) 분(0) 시(4) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 0 4 * * *")
    public void runComputeTrendingRegionsBatch() {
        try {
            log.info("========================================");
            log.info("=== 트렌딩 지역 재계산 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("ComputeTrendingRegionsBatch", Job.class);

            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== 트렌딩 지역 재계산 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== 트렌딩 지역 재계산 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * CineTrip trending_score 재계산 배치
     * 매일 새벽 4시 30분에 실행
     * cron: 초(0) 분(30) 시(4) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 30 4 * * *")
    public void runRecomputeCineTripScoreBatch() {
        try {
            log.info("========================================");
            log.info("=== CineTrip 스코어 재계산 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("RecomputeCineTripScoreBatch", Job.class);

            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== CineTrip 스코어 재계산 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== CineTrip 스코어 재계산 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * 영화-지역 자동 태깅 배치 (룰 + LLM)
     * 매일 새벽 5시에 실행 — RecomputeCineTripScoreBatch 이후 다음 주기에 score 가 채워지는 파이프라인.
     * cron: 초(0) 분(0) 시(5) 일(*) 월(*) 요일(*)
     */
    @Scheduled(cron = "0 0 5 * * *")
    public void runAutoTagCineTripMappingBatch() {
        try {
            log.info("========================================");
            log.info("=== CineTrip 자동 태깅 배치 시작 ===");
            log.info("=== 실행 시간: {} ===", LocalDateTime.now());
            log.info("========================================");

            Job job = applicationContext.getBean("AutoTagCineTripMappingBatch", Job.class);

            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();

            jobLauncher.run(job, jobParameters);

            log.info("========================================");
            log.info("=== CineTrip 자동 태깅 배치 완료 ===");
            log.info("========================================");

        } catch (Exception e) {
            log.error("========================================");
            log.error("=== CineTrip 자동 태깅 배치 실패 ===");
            log.error("=== 에러: {} ===", e.getMessage(), e);
            log.error("========================================");
        }
    }

    /**
     * 테스트용 - 매 5분마다 실행 (개발 환경용)
     * 실제 운영 환경에서는 주석 처리하거나 제거하세요
     */
    // @Scheduled(cron = "0 */5 * * * *")
    // public void runTestBatch() {
    //     log.info("========================================");
    //     log.info("=== 테스트 배치 실행 (5분마다) ===");
    //     log.info("=== 실행 시간: {} ===", LocalDateTime.now());
    //     log.info("========================================");
    //     runMigrateMoviesBatch();
    // }
}
