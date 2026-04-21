package fast.campus.netplix.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.JobParameters;
import org.springframework.batch.core.JobParametersBuilder;
import org.springframework.batch.core.launch.JobLauncher;
import org.springframework.context.ApplicationContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/batch")
@RequiredArgsConstructor
public class BatchController {

    private final JobLauncher jobLauncher;
    private final ApplicationContext applicationContext;

    @PostMapping("/dvd")
    public ResponseEntity<String> runDvdBatch() {
        try {
            log.info("DVD 배치 수동 실행 요청");
            Job job = applicationContext.getBean("MigrateMoviesFromTmdbBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("DVD 배치가 시작되었습니다.");
        } catch (Exception e) {
            log.error("DVD 배치 실행 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("DVD 배치 실행 실패: " + e.getMessage());
        }
    }

    @PostMapping("/movie")
    public ResponseEntity<String> runMovieBatch() {
        try {
            log.info("Movie 배치 수동 실행 요청");
            Job job = applicationContext.getBean("MigrateMoviesPlayingFromTmdbBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("Movie 배치가 시작되었습니다.");
        } catch (Exception e) {
            log.error("Movie 배치 실행 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Movie 배치 실행 실패: " + e.getMessage());
        }
    }

    @PostMapping("/tour/sync")
    public ResponseEntity<String> runTourSyncBatch() {
        try {
            log.info("관광 지표 동기화 배치 수동 실행 요청");
            Job job = applicationContext.getBean("SyncTourIndexBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("SyncTourIndexBatch 시작됨");
        } catch (Exception e) {
            log.error("SyncTourIndexBatch 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("SyncTourIndexBatch 실패: " + e.getMessage());
        }
    }

    @PostMapping("/tour/trending")
    public ResponseEntity<String> runTrendingRegionsBatch() {
        try {
            log.info("트렌딩 지역 재계산 배치 수동 실행 요청");
            Job job = applicationContext.getBean("ComputeTrendingRegionsBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("ComputeTrendingRegionsBatch 시작됨");
        } catch (Exception e) {
            log.error("ComputeTrendingRegionsBatch 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("ComputeTrendingRegionsBatch 실패: " + e.getMessage());
        }
    }

    @PostMapping("/cine-trip/score")
    public ResponseEntity<String> runRecomputeCineTripScoreBatch() {
        try {
            log.info("CineTrip 스코어 재계산 배치 수동 실행 요청");
            Job job = applicationContext.getBean("RecomputeCineTripScoreBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("RecomputeCineTripScoreBatch 시작됨");
        } catch (Exception e) {
            log.error("RecomputeCineTripScoreBatch 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("RecomputeCineTripScoreBatch 실패: " + e.getMessage());
        }
    }

    @PostMapping("/cine-trip/auto-tag")
    public ResponseEntity<String> runAutoTagCineTripMappingBatch() {
        try {
            log.info("CineTrip 자동 태깅 배치 수동 실행 요청");
            Job job = applicationContext.getBean("AutoTagCineTripMappingBatch", Job.class);
            JobParameters jobParameters = new JobParametersBuilder()
                    .addLong("timestamp", System.currentTimeMillis())
                    .toJobParameters();
            jobLauncher.run(job, jobParameters);
            return ResponseEntity.ok("AutoTagCineTripMappingBatch 시작됨");
        } catch (Exception e) {
            log.error("AutoTagCineTripMappingBatch 실패: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("AutoTagCineTripMappingBatch 실패: " + e.getMessage());
        }
    }
}
