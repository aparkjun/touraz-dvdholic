package fast.campus.netplix.cinetrip;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

/**
 * TMDB → 한국 지역 자동 매핑 작업의 진행 상태를 보관하는 인메모리 싱글톤.
 *
 * <p>Heroku H12 요청 타임아웃(30s)을 우회하기 위해 실제 스캔은 {@code @Async} 로 백그라운드에서
 * 돌리고, 클라이언트는 이 홀더의 상태를 {@code GET /auto-map/status} 로 폴링한다.
 *
 * <p>단일 인스턴스/단일 동시 실행을 가정하므로 복잡한 분산 락 없이 AtomicReference 로 충분하다.
 * 멀티 dyno 스케일 아웃 시점에는 외부 캐시(Redis)로 승격 필요.
 */
@Component
public class AutoMappingProgressHolder {

    public enum Phase { IDLE, RUNNING, COMPLETED, FAILED }

    public static final class Snapshot {
        public final Phase phase;
        public final int scannedMovies;
        public final int moviesWithMatch;
        public final int generatedMappings;
        public final int skippedDueToManual;
        public final long totalMappingsAfter;
        public final Instant startedAt;
        public final Instant finishedAt;
        public final String errorMessage;

        public Snapshot(Phase phase, int scanned, int matched, int generated, int skipped,
                        long total, Instant startedAt, Instant finishedAt, String errorMessage) {
            this.phase = phase;
            this.scannedMovies = scanned;
            this.moviesWithMatch = matched;
            this.generatedMappings = generated;
            this.skippedDueToManual = skipped;
            this.totalMappingsAfter = total;
            this.startedAt = startedAt;
            this.finishedAt = finishedAt;
            this.errorMessage = errorMessage;
        }

        public static Snapshot idle() {
            return new Snapshot(Phase.IDLE, 0, 0, 0, 0, 0, null, null, null);
        }
    }

    private final AtomicReference<Snapshot> state = new AtomicReference<>(Snapshot.idle());

    public Snapshot snapshot() {
        return state.get();
    }

    public boolean tryStart() {
        Snapshot cur = state.get();
        if (cur.phase == Phase.RUNNING) return false;
        Snapshot running = new Snapshot(Phase.RUNNING, 0, 0, 0, 0, 0, Instant.now(), null, null);
        return state.compareAndSet(cur, running);
    }

    /** 진행 중 중간 카운터 갱신(스캔 페이지 이후 호출). */
    public void updateProgress(int scanned, int matched, int generated, int skipped) {
        Snapshot cur = state.get();
        if (cur.phase != Phase.RUNNING) return;
        state.set(new Snapshot(Phase.RUNNING, scanned, matched, generated, skipped,
                cur.totalMappingsAfter, cur.startedAt, null, null));
    }

    public void markCompleted(int scanned, int matched, int generated, int skipped, long total) {
        Snapshot cur = state.get();
        state.set(new Snapshot(Phase.COMPLETED, scanned, matched, generated, skipped,
                total, cur.startedAt, Instant.now(), null));
    }

    public void markFailed(String message) {
        Snapshot cur = state.get();
        state.set(new Snapshot(Phase.FAILED,
                cur.scannedMovies, cur.moviesWithMatch, cur.generatedMappings, cur.skippedDueToManual,
                cur.totalMappingsAfter, cur.startedAt, Instant.now(), message));
    }
}
