package fast.campus.netplix.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
public class RestTemplateConfig {
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplateBuilder()
                .setConnectTimeout(Duration.of(10, ChronoUnit.SECONDS))
                .setReadTimeout(Duration.of(30, ChronoUnit.SECONDS))
                .build();
    }

    /**
     * 기상청 API허브 격자·단기 병렬 호출 전용 — {@code ForkJoinPool.commonPool()} 만 쓰면
     * 1 vCPU(Heroku 등)에서 바깥 {@code join()} 과 안쪽 {@code supplyAsync} 가 스레드를 고갈시켜
     * 일부 지역만 격자 폴백이 빈 배열로 끝나는 경우가 생길 수 있다.
     */
    @Bean(destroyMethod = "shutdown")
    public ExecutorService kmaGridExecutor() {
        int n = Math.max(8, Math.min(24, Runtime.getRuntime().availableProcessors() * 4));
        AtomicInteger seq = new AtomicInteger();
        ThreadFactory tf = r -> {
            Thread t = new Thread(r, "kma-grid-" + seq.incrementAndGet());
            t.setDaemon(true);
            return t;
        };
        return Executors.newFixedThreadPool(n, tf);
    }
}
