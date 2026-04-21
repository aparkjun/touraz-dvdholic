package fast.campus.netplix.dvdstore;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 지역(AREA_CODE) 단위 DVD 대여점 집계.
 * 문화지도 히트맵·관리자 인사이트에서 사용.
 */
@Getter
@Builder
@AllArgsConstructor
public class DvdStoreRegionStat {
    private final String areaCode;
    private final long totalCount;
    private final long operatingCount;
    private final long closedCount;
    private final Double avgLatitude;
    private final Double avgLongitude;
}
