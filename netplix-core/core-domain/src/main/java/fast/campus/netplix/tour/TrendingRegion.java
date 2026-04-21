package fast.campus.netplix.tour;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 검색량 급등 지자체 엔트리. ComputeTrendingRegionsBatch 산출물.
 */
@Getter
@Builder
@AllArgsConstructor
public class TrendingRegion {
    private final String areaCode;
    private final String regionName;
    private final String period;        // today | week | month
    private final int rank;
    private final double score;         // 상승률(%) 또는 정규화 점수
    private final TourIndex latest;     // 최신 스냅샷(선택)
}
