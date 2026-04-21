package fast.campus.netplix.rag;

import fast.campus.netplix.movie.GetMoviesForRagUseCase;
import fast.campus.netplix.movie.MovieRagPort;
import fast.campus.netplix.movie.NetplixMovie;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 앱 기동 후 RAG 벡터 저장소에 영화 문서를 비동기로 적재한다.
 * - 메인 스레드(bootRun)를 블록하지 않도록 별도 스레드에서 실행
 * - RDS/네트워크 일시 중단에도 부분 성공하도록 배치/재시도 처리
 * - OpenAI API 키가 설정된 경우에만 동작하며, 최대 MAX_MOVIES_FOR_RAG 편 적재
 */
@Slf4j
@Component
@Order(100)
@RequiredArgsConstructor
public class MovieRagLoader implements ApplicationRunner {

    private static final int MAX_MOVIES_FOR_RAG = 300;
    private static final long STARTUP_WAIT_MS = 5_000L;

    private final GetMoviesForRagUseCase getMoviesForRagUseCase;
    private final MovieRagPort movieRagPort;

    @Override
    public void run(ApplicationArguments args) {
        if (!movieRagPort.isAvailable()) {
            log.info("RAG 비활성 상태라 영화 문서 적재를 건너뜁니다. (OpenAI API 키 설정 시 활성화)");
            return;
        }
        CompletableFuture.runAsync(this::loadInBackground);
    }

    private void loadInBackground() {
        Thread.currentThread().setName("rag-loader");
        try {
            Thread.sleep(STARTUP_WAIT_MS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
            return;
        }
        int attempt = 0;
        int maxAttempts = 3;
        while (attempt < maxAttempts) {
            attempt++;
            try {
                log.info("[RAG-LOADER] 적재 시도 {}/{} - 대상 최대 {}편", attempt, maxAttempts, MAX_MOVIES_FOR_RAG);
                List<NetplixMovie> movies = getMoviesForRagUseCase.getMovies(MAX_MOVIES_FOR_RAG);
                if (movies.isEmpty()) {
                    log.info("[RAG-LOADER] 적재할 영화가 없습니다.");
                    return;
                }
                movieRagPort.addMovieDocuments(movies);
                return;
            } catch (Exception e) {
                log.warn("[RAG-LOADER] 적재 실패({}): {} — {}초 후 재시도",
                        attempt, e.getMessage(), 5 * attempt);
                try {
                    Thread.sleep(5_000L * attempt);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
        log.warn("[RAG-LOADER] 최대 재시도 횟수 초과. RAG 는 이후에도 빈 결과를 반환합니다.");
    }
}
