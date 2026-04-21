package fast.campus.netplix.repository.tour;

import fast.campus.netplix.entity.tour.TourIndexSnapshotEntity;
import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TourIndexRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class TourIndexRepository implements TourIndexRepositoryPort {

    private final TourIndexJpaRepository jpaRepository;

    @Override
    @Transactional
    public void upsertAll(List<TourIndex> indices) {
        int batchSize = 200;
        for (int i = 0; i < indices.size(); i += batchSize) {
            int end = Math.min(i + batchSize, indices.size());
            for (TourIndex d : indices.subList(i, end)) {
                jpaRepository.findByAreaCodeAndSnapshotDate(d.getAreaCode(), d.getSnapshotDate())
                        .ifPresentOrElse(
                                existing -> existing.updateFrom(d),
                                () -> jpaRepository.save(TourIndexSnapshotEntity.fromDomain(d))
                        );
            }
            jpaRepository.flush();
        }
    }

    @Override
    public List<TourIndex> findLatestPerRegion() {
        return jpaRepository.findLatestPerRegion().stream()
                .map(TourIndexSnapshotEntity::toDomain)
                .toList();
    }

    @Override
    public Optional<TourIndex> findLatestByAreaCode(String areaCode) {
        return jpaRepository.findByAreaCodeAndSnapshotDateGreaterThanEqualOrderBySnapshotDateDesc(areaCode, LocalDate.now().minusDays(30))
                .stream().findFirst().map(TourIndexSnapshotEntity::toDomain);
    }

    @Override
    public List<TourIndex> findByAreaCodeSince(String areaCode, LocalDate since) {
        return jpaRepository.findByAreaCodeAndSnapshotDateGreaterThanEqualOrderBySnapshotDateDesc(areaCode, since).stream()
                .map(TourIndexSnapshotEntity::toDomain)
                .toList();
    }

    @Override
    public List<TourIndex> findTopBySearchVolume(int limit) {
        return jpaRepository.findTopBySearchVolume(PageRequest.of(0, limit)).stream()
                .map(TourIndexSnapshotEntity::toDomain)
                .toList();
    }

    @Override
    public long count() {
        return jpaRepository.count();
    }
}
