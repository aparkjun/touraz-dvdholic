package fast.campus.netplix.repository.tour;

import fast.campus.netplix.entity.tour.TrendingRegionCacheEntity;
import fast.campus.netplix.tour.TrendingRegion;
import fast.campus.netplix.tour.TrendingRegionCachePort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class TrendingRegionCacheRepository implements TrendingRegionCachePort {

    private final TrendingRegionCacheJpaRepository jpa;

    @Override
    @Transactional
    public int replacePeriod(String period, List<TrendingRegion> regions) {
        if (period == null || period.isBlank()) return 0;
        jpa.deleteByPeriod(period);
        if (regions == null || regions.isEmpty()) return 0;
        List<TrendingRegionCacheEntity> entities = new ArrayList<>(regions.size());
        for (TrendingRegion r : regions) {
            entities.add(TrendingRegionCacheEntity.fromDomain(r));
        }
        jpa.saveAll(entities);
        return entities.size();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TrendingRegion> findByPeriod(String period, int limit) {
        int safe = Math.max(1, Math.min(limit, 100));
        return jpa.findByPeriodOrdered(period, PageRequest.of(0, safe))
                .stream()
                .map(TrendingRegionCacheEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long count() {
        return jpa.count();
    }
}
