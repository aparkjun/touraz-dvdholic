package fast.campus.netplix.tour;

import java.util.List;

/**
 * trending_regions_cache 테이블용 포트.
 * ComputeTrendingRegionsBatch 가 주기적으로 갱신한 결과를 조회/저장한다.
 */
public interface TrendingRegionCachePort {

    /**
     * period(today|week|month) 단위로 캐시 전체를 교체한다.
     * 구현체는 period 내 기존 레코드를 삭제한 뒤 새 목록을 삽입해야 한다.
     */
    int replacePeriod(String period, List<TrendingRegion> regions);

    /** period 단위 랭킹 정렬 결과. */
    List<TrendingRegion> findByPeriod(String period, int limit);

    long count();
}
