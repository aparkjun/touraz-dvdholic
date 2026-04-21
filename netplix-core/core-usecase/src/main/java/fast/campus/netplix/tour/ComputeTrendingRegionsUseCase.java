package fast.campus.netplix.tour;

import java.util.List;

/**
 * 매일 04:00 KST - 지자체 검색량·수요 스냅샷을 분석해 today/week/month 트렌딩 지역을 캐시한다.
 */
public interface ComputeTrendingRegionsUseCase {

    /**
     * 3개 period(today/week/month) 전체를 재계산·저장한다.
     * 반환값: 저장된 엔트리 총 개수.
     */
    int recomputeAll();

    /** 단일 period 만 재계산. */
    List<TrendingRegion> recomputePeriod(String period, int limit);
}
