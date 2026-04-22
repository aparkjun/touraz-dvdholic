package fast.campus.netplix.scheduler;

import fast.campus.netplix.tour.GetPetFriendlyPoiUseCase;
import fast.campus.netplix.tour.PetFriendlyPoi;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 한국관광공사 반려동물 동반여행(KorPetTourService) 어댑터 캐시 프리워밍.
 *
 * <p>어댑터 내부 6h TTL 캐시에 (areaCode, contentTypeId) 조합을 선행 로딩해 첫 요청
 * 응답 지연을 줄인다. 별도 DB 테이블은 생성하지 않는다.
 *
 * <p>- 기동 2분 후 1회, 매일 04:45 (Asia/Seoul) 재워밍.
 * <p>- 호출량: 17개 광역 × 6개 콘텐츠타입 = 102회 / 일. VisitKorea 일일 쿼터 내.
 * <p>- KorPetTourService 미설정 시 조용히 스킵.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PetFriendlyPoiWarmer {

    private static final List<String> AREA_CODES = List.of(
            "1", "2", "3", "4", "5", "6", "7", "8",
            "31", "32", "33", "34", "35", "36", "37", "38", "39"
    );
    /**
     * KorPetTourService 는 여행코스(25)/축제(15) 를 포함하지 않음.
     * 관광지(12)/문화시설(14)/레포츠(28)/숙박(32)/쇼핑(38)/음식점(39) 6종 워밍.
     */
    private static final List<String> CONTENT_TYPES = List.of("12", "14", "28", "32", "38", "39");

    private final GetPetFriendlyPoiUseCase useCase;

    @Value("${visitkorea.pet.warmer-enabled:true}")
    private boolean warmerEnabled;

    @PostConstruct
    void warmOnBoot() {
        if (!warmerEnabled) return;
        new Thread(this::runSilently, "pet-friendly-poi-warmer-boot").start();
    }

    /** 매일 새벽 4시 45분 캐시 재워밍 (무장애 워머와 시차 두어 QPS 완화). */
    @Scheduled(cron = "0 45 4 * * *")
    @Async
    public void warmDaily() {
        if (!warmerEnabled) return;
        log.info("[PET-WARM] 일일 반려동물 POI 캐시 재워밍 시작");
        runSilently();
    }

    private void runSilently() {
        if (!useCase.isConfigured()) {
            log.info("[PET-WARM] KorPetTourService 미설정 - 워밍 스킵");
            return;
        }
        int ok = 0;
        int emptyBuckets = 0;
        long t0 = System.currentTimeMillis();
        for (String area : AREA_CODES) {
            for (String type : CONTENT_TYPES) {
                try {
                    List<PetFriendlyPoi> pois = useCase.byArea(area, type, 30);
                    if (pois.isEmpty()) emptyBuckets++;
                    ok++;
                    Thread.sleep(100);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Exception ex) {
                    log.warn("[PET-WARM] 실패 area={} type={} err={}", area, type, ex.getMessage());
                }
            }
        }
        long ms = System.currentTimeMillis() - t0;
        log.info("[PET-WARM] 완료 totalOk={} emptyBuckets={} elapsedMs={}", ok, emptyBuckets, ms);
    }
}
