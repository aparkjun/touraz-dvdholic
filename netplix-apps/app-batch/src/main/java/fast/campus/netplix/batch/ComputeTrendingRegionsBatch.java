package fast.campus.netplix.batch;

import fast.campus.netplix.tour.ComputeTrendingRegionsUseCase;
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
 * 매일 04:00 KST - 관광 지표 스냅샷 기반 today/week/month 트렌딩 지역 캐시 재계산.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class ComputeTrendingRegionsBatch {

    private static final String BATCH_NAME = "ComputeTrendingRegionsBatch";

    private final ComputeTrendingRegionsUseCase computeTrendingRegionsUseCase;

    @Bean(name = BATCH_NAME)
    public Job job(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new JobBuilder(BATCH_NAME, jobRepository)
                .start(step(jobRepository, platformTransactionManager))
                .incrementer(new RunIdIncrementer())
                .build();
    }

    @Bean(name = "ComputeTrendingRegionsBatchStep")
    public Step step(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new StepBuilder("ComputeTrendingRegionsBatchStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    log.info("[TRENDING-BATCH] 재계산 시작");
                    int total = computeTrendingRegionsUseCase.recomputeAll();
                    log.info("[TRENDING-BATCH] 재계산 완료 - 총 {} 건 캐시", total);
                    return RepeatStatus.FINISHED;
                }, platformTransactionManager)
                .build();
    }
}
