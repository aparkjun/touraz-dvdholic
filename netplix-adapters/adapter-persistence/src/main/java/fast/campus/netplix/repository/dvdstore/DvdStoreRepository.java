package fast.campus.netplix.repository.dvdstore;

import fast.campus.netplix.dvdstore.DvdStore;
import fast.campus.netplix.dvdstore.DvdStorePort;
import fast.campus.netplix.dvdstore.DvdStoreRegionStat;
import fast.campus.netplix.entity.dvdstore.DvdStoreEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class DvdStoreRepository implements DvdStorePort {

    private final DvdStoreJpaRepository jpaRepository;

    @Override
    @Transactional
    public void saveAll(List<DvdStore> stores) {
        int batchSize = 200;
        for (int i = 0; i < stores.size(); i += batchSize) {
            int end = Math.min(i + batchSize, stores.size());
            List<DvdStoreEntity> batch = stores.subList(i, end).stream()
                    .map(DvdStoreEntity::fromDomain)
                    .toList();
            jpaRepository.saveAll(batch);
            jpaRepository.flush();
        }
    }

    @Override
    @Transactional
    public void deleteAll() {
        jpaRepository.deleteAllInBatch();
    }

    @Override
    public List<DvdStore> findAll() {
        return jpaRepository.findAll().stream()
                .map(DvdStoreEntity::toDomain)
                .toList();
    }

    @Override
    public List<DvdStore> findByStatusCode(String statusCode) {
        return jpaRepository.findByStatusCode(statusCode).stream()
                .map(DvdStoreEntity::toDomain)
                .toList();
    }

    @Override
    public List<DvdStore> searchByKeyword(String keyword) {
        return jpaRepository.searchByKeyword(keyword).stream()
                .map(DvdStoreEntity::toDomain)
                .toList();
    }

    @Override
    public List<DvdStore> findNearby(double lat, double lon, double radiusKm) {
        return jpaRepository.findNearby(lat, lon, radiusKm).stream()
                .map(DvdStoreEntity::toDomain)
                .toList();
    }

    @Override
    public long count() {
        return jpaRepository.count();
    }

    @Override
    public List<DvdStoreRegionStat> aggregateByRegion() {
        return jpaRepository.aggregateByRegion().stream()
                .map(r -> DvdStoreRegionStat.builder()
                        .areaCode(r.getAreaCode())
                        .totalCount(r.getTotalCount() == null ? 0 : r.getTotalCount())
                        .operatingCount(r.getOperatingCount() == null ? 0 : r.getOperatingCount())
                        .closedCount(r.getClosedCount() == null ? 0 : r.getClosedCount())
                        .avgLatitude(r.getAvgLatitude())
                        .avgLongitude(r.getAvgLongitude())
                        .build())
                .toList();
    }
}
