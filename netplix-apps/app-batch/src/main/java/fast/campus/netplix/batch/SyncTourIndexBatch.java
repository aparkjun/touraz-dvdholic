package fast.campus.netplix.batch;

import fast.campus.netplix.tour.TourIndexUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.batch.core.Job;
import org.springframework.batch.core.Step;
import org.springframework.batch.core.job.builder.JobBuilder;
import org.springframework.batch.core.launch.support.RunIdIncrementer;
import org.springframework.batch.core.repository.JobRepository;
import org.springframework.batch.core.step.builder.StepBuilder;
import org.springframework.batch.repeat.RepeatStatus;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.LocalDate;

/**
 * 매일 03:30 KST - 한국관광공사 데이터랩 스냅샷 동기화 배치.
 * baseDate = 실행일 -1일 (데이터 지연 감안).
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class SyncTourIndexBatch {

    private static final String BATCH_NAME = "SyncTourIndexBatch";

    private final TourIndexUseCase tourIndexUseCase;

    @Bean(name = BATCH_NAME)
    public Job job(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new JobBuilder(BATCH_NAME, jobRepository)
                .start(step(jobRepository, platformTransactionManager))
                .incrementer(new RunIdIncrementer())
                .build();
    }

    @Bean(name = "SyncTourIndexBatchStep")
    public Step step(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new StepBuilder("SyncTourIndexBatchStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    LocalDate baseDate = LocalDate.now().minusDays(1);
                    log.info("[SYNC-TOUR] baseDate={} 동기화 시작", baseDate);
                    int count = tourIndexUseCase.syncFromApi(baseDate);
                    log.info("[SYNC-TOUR] baseDate={} 동기화 완료 - {} 건", baseDate, count);
                    return RepeatStatus.FINISHED;
                }, platformTransactionManager)
                .build();
    }
}
