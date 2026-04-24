package fast.campus.netplix.tour;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 관광지 집중률 예측 서비스.
 *
 * <p>KTO {@code tatsCnctrRatedList} 는 (areaCd, signguCd) 필수 파라미터를 요구하므로
 * 프론트가 KorService2 areaCode(1~8, 31~39) 만으로 조회 가능하도록 광역 → 대표 시군구
 * 매핑 큐레이션을 여기에 보관한다.
 *
 * <p>큐레이션 기준
 * <ul>
 *   <li>해당 광역에서 대표성 높은 관광지를 포함한 시군구 (예: 부산 해운대구, 경북 경주시)</li>
 *   <li>2026-04-22 라이브 호출로 실데이터 반환 검증 완료 (17개 광역 100% 커버)</li>
 *   <li>강원/전북은 특별자치도 전환 이후 코드(51, 52) 사용. 구 코드(42, 45)는 현재 빈 응답</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TourConcentrationService implements GetTourConcentrationUseCase {

    /**
     * KorService2 areaCode → 대표 (signguCode, signguName) 매핑.
     * 전국 17개 광역 모두 대응.
     */
    private static final Map<String, CuratedSigngu> CURATED = Map.ofEntries(
            Map.entry("1",  new CuratedSigngu("11110", "종로구")),        // 서울 → 경복궁 권역
            Map.entry("2",  new CuratedSigngu("28140", "중구")),          // 인천 → 신포/차이나타운
            Map.entry("3",  new CuratedSigngu("30200", "유성구")),        // 대전 → 엑스포 권역
            Map.entry("4",  new CuratedSigngu("27110", "중구")),          // 대구 → 중구 (서문시장 등)
            Map.entry("5",  new CuratedSigngu("29110", "동구")),          // 광주 → 5.18민주공원 권역
            Map.entry("6",  new CuratedSigngu("26140", "중구")),          // 부산 → 용두산공원(집중률 高)
            Map.entry("7",  new CuratedSigngu("31110", "중구")),          // 울산
            Map.entry("8",  new CuratedSigngu("36110", "세종시")),        // 세종
            Map.entry("31", new CuratedSigngu("41820", "가평군")),        // 경기 → 남이섬 권역
            Map.entry("32", new CuratedSigngu("51210", "속초시")),        // 강원특별자치도 → 속초
            Map.entry("33", new CuratedSigngu("43150", "제천시")),        // 충북 → 청풍호 권역
            Map.entry("34", new CuratedSigngu("44760", "부여군")),        // 충남 → 백제문화유적
            Map.entry("35", new CuratedSigngu("47130", "경주시")),        // 경북 → 불국사 권역
            Map.entry("36", new CuratedSigngu("48220", "통영시")),        // 경남 → 통영 케이블카 등
            Map.entry("37", new CuratedSigngu("52111", "전주시 완산구")),  // 전북특별자치도 → 한옥마을
            Map.entry("38", new CuratedSigngu("46130", "여수시")),        // 전남 → 여수 밤바다 권역
            Map.entry("39", new CuratedSigngu("50110", "제주시"))         // 제주 → 1100고지/한라산 북측
    );

    private final TourConcentrationPort tourConcentrationPort;

    @Override
    public List<TourConcentrationPrediction> byAreaCode(String areaCode) {
        if (areaCode == null || areaCode.isBlank()) return List.of();
        CuratedSigngu curated = CURATED.get(areaCode.trim());
        if (curated == null) {
            log.info("[CNCTR] 큐레이션 미정의 areaCode={} - 빈 결과 반환", areaCode);
            return List.of();
        }
        return tourConcentrationPort.fetchPredictions(areaCode, curated.signguCode(), null);
    }

    @Override
    public List<TourConcentrationPrediction> bySignguCode(String areaCode, String signguCode, String spotName) {
        if (areaCode == null || areaCode.isBlank() || signguCode == null || signguCode.isBlank()) {
            return List.of();
        }
        return tourConcentrationPort.fetchPredictions(areaCode.trim(), signguCode.trim(), spotName);
    }

    @Override
    public List<TourConcentrationPrediction> overview() {
        if (!tourConcentrationPort.isConfigured()) {
            log.info("[CNCTR] overview - 포트 미설정, 빈 결과 반환");
            return List.of();
        }

        // 광역별 병렬 호출. 어댑터 레벨 6h 캐시가 있어 첫 호출 이후에는 거의 즉시 반환.
        List<CompletableFuture<List<TourConcentrationPrediction>>> futures = CURATED.entrySet().stream()
                .map(e -> CompletableFuture.supplyAsync(() -> {
                    try {
                        return tourConcentrationPort.fetchPredictions(
                                e.getKey(),
                                e.getValue().signguCode(),
                                null);
                    } catch (Exception ex) {
                        log.warn("[CNCTR] overview 광역={} 실패: {}", e.getKey(), ex.getMessage());
                        return List.<TourConcentrationPrediction>of();
                    }
                }))
                .collect(Collectors.toList());

        List<TourConcentrationPrediction> merged = new ArrayList<>();
        for (CompletableFuture<List<TourConcentrationPrediction>> f : futures) {
            try {
                merged.addAll(f.get());
            } catch (Exception ex) {
                log.warn("[CNCTR] overview future 수집 실패: {}", ex.getMessage());
            }
        }

        merged.sort(Comparator
                .comparing(TourConcentrationPrediction::getBaseDate,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(TourConcentrationPrediction::getAreaCode,
                        Comparator.nullsLast(Comparator.naturalOrder())));
        log.info("[CNCTR] overview 수집 {}개 광역 → 총 {} 건", CURATED.size(), merged.size());
        return merged;
    }

    private record CuratedSigngu(String signguCode, String signguName) {
    }
}
