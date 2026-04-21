package fast.campus.netplix.batch;

import fast.campus.netplix.cinetrip.RecomputeCineTripScoreUseCase;
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

/**
 * 매일 04:30 KST - MovieRegionMapping.trending_score 재계산 배치.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class RecomputeCineTripScoreBatch {

    private static final String BATCH_NAME = "RecomputeCineTripScoreBatch";

    private final RecomputeCineTripScoreUseCase recomputeCineTripScoreUseCase;

    @Bean(name = BATCH_NAME)
    public Job job(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new JobBuilder(BATCH_NAME, jobRepository)
                .start(step(jobRepository, platformTransactionManager))
                .incrementer(new RunIdIncrementer())
                .build();
    }

    @Bean(name = "RecomputeCineTripScoreBatchStep")
    public Step step(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new StepBuilder("RecomputeCineTripScoreBatchStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    log.info("[CINETRIP-SCORE-BATCH] 재계산 시작");
                    int count = recomputeCineTripScoreUseCase.recomputeAll();
                    log.info("[CINETRIP-SCORE-BATCH] 재계산 완료 - {} 건 upsert", count);
                    return RepeatStatus.FINISHED;
                }, platformTransactionManager)
                .build();
    }
}
