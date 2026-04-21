package fast.campus.netplix.cinetrip;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

/**
 * 기동 시 classpath 의 cine-trip-seed.csv 를 읽어 매핑 테이블이 비어 있으면 자동 적재한다.
 * 공모전 데모용 시드. 실제 운영에서는 관리자 /import 엔드포인트로 대체.
 */
@Slf4j
@Component
@Order(110)
@RequiredArgsConstructor
public class CineTripSeedLoader implements ApplicationRunner {

    private static final String SEED_PATH = "cine-trip-seed.csv";

    private final CineTripUseCase cineTripUseCase;

    @Override
    public void run(ApplicationArguments args) {
        try {
            long existing = cineTripUseCase.count();
            if (existing > 0) {
                log.info("[CINE-TRIP-SEED] 이미 {}건 존재 — 시드 생략", existing);
                return;
            }
            ClassPathResource resource = new ClassPathResource(SEED_PATH);
            if (!resource.exists()) {
                log.info("[CINE-TRIP-SEED] {} 없음 — 생략", SEED_PATH);
                return;
            }
            String csv;
            try (var is = resource.getInputStream()) {
                csv = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            }
            int imported = cineTripUseCase.importFromCsv(csv);
            log.info("[CINE-TRIP-SEED] 초기 시드 {}건 적재 완료", imported);
        } catch (Exception e) {
            log.warn("[CINE-TRIP-SEED] 시드 적재 실패(무시): {}", e.getMessage());
        }
    }
}
