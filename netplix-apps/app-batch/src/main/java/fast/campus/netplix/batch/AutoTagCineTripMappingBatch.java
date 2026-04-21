package fast.campus.netplix.batch;

import fast.campus.netplix.cinetrip.AutoTagCineTripMappingUseCase;
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
 * 매일 05:00 KST - 새 영화에 대해 룰 기반 + LLM 기반 지역 매핑을 자동 추론.
 * RecomputeCineTripScoreBatch(04:30) 이후에 돌아서, 매핑이 생긴 다음 배치 주기에 trending_score 가 채워진다.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class AutoTagCineTripMappingBatch {

    private static final String BATCH_NAME = "AutoTagCineTripMappingBatch";

    private final AutoTagCineTripMappingUseCase autoTagCineTripMappingUseCase;

    @Bean(name = BATCH_NAME)
    public Job job(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new JobBuilder(BATCH_NAME, jobRepository)
                .start(step(jobRepository, platformTransactionManager))
                .incrementer(new RunIdIncrementer())
                .build();
    }

    @Bean(name = "AutoTagCineTripMappingBatchStep")
    public Step step(JobRepository jobRepository, PlatformTransactionManager platformTransactionManager) {
        return new StepBuilder("AutoTagCineTripMappingBatchStep", jobRepository)
                .tasklet((contribution, chunkContext) -> {
                    log.info("[AUTOTAG-BATCH] 실행 시작");
                    AutoTagCineTripMappingUseCase.Result r = autoTagCineTripMappingUseCase.runAll();
                    log.info("[AUTOTAG-BATCH] 완료 - 스캔 {} / 자동승인 {} / 대기 {} / 스킵 {}",
                            r.scanned, r.autoApproved, r.pending, r.skipped);
                    return RepeatStatus.FINISHED;
                }, platformTransactionManager)
                .build();
    }
}
