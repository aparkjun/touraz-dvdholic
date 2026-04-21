package fast.campus.netplix.repository.tour;

import fast.campus.netplix.entity.tour.TrendingRegionCacheEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TrendingRegionCacheJpaRepository extends JpaRepository<TrendingRegionCacheEntity, Long> {

    @Query("SELECT e FROM TrendingRegionCacheEntity e WHERE e.period = :period ORDER BY e.rankNo ASC")
    List<TrendingRegionCacheEntity> findByPeriodOrdered(@Param("period") String period, Pageable pageable);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM TrendingRegionCacheEntity e WHERE e.period = :period")
    int deleteByPeriod(@Param("period") String period);
}
