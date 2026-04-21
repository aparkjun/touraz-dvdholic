package fast.campus.netplix.tour;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

/**
 * 한국관광공사 데이터랩 지자체 지표 스냅샷 도메인 모델.
 * 동일 areaCode × snapshotDate 조합으로 유일. 배치가 일 1회 upsert.
 */
@Getter
@Builder
@AllArgsConstructor
public class TourIndex {
    private final Long id;
    private final String areaCode;          // 지자체 코드 (관광공사 표준)
    private final String regionName;        // "부산광역시 해운대구"
    private final LocalDate snapshotDate;   // 집계 기준일

    private final Double tourDemandIdx;              // 관광수요지수
    private final Double tourCompetitiveness;        // 관광경쟁력
    private final Double culturalResourceDemand;     // 문화자원 수요
    private final Double tourServiceDemand;          // 관광서비스 수요
    private final Double tourResourceDemand;         // 관광자원 수요
    private final Integer searchVolume;              // 검색량

    public boolean isDecliningRegion() {
        if (tourDemandIdx == null || tourCompetitiveness == null) return false;
        return tourDemandIdx < 40 && tourCompetitiveness < 40;
    }

    public boolean hasHighCulturalDemand() {
        return culturalResourceDemand != null && culturalResourceDemand >= 70;
    }
}
