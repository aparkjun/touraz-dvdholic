package fast.campus.netplix.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 관리자 "문화×관광 인사이트" 탭에서 사용하는 1행.
 * DVD 매장 통계 + 관광공사 지자체 지표를 결합한 뷰 모델이다.
 */
@Getter
@Builder
@AllArgsConstructor
public class CultureVsTourRow {
    private final String areaCode;
    private final String regionName;
    private final long totalStores;
    private final long operatingStores;
    private final long closedStores;
    /** 폐업률 (0.0 ~ 1.0), totalStores==0이면 null. */
    private final Double closureRate;
    private final Double tourDemandIdx;
    private final Double tourCompetitiveness;
    private final Double culturalResourceDemand;
    private final Integer searchVolume;
}
