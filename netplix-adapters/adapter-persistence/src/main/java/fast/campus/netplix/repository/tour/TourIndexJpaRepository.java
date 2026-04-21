package fast.campus.netplix.repository.tour;

import fast.campus.netplix.entity.tour.TourIndexSnapshotEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TourIndexJpaRepository extends JpaRepository<TourIndexSnapshotEntity, Long> {

    Optional<TourIndexSnapshotEntity> findByAreaCodeAndSnapshotDate(String areaCode, LocalDate snapshotDate);

    List<TourIndexSnapshotEntity> findByAreaCodeAndSnapshotDateGreaterThanEqualOrderBySnapshotDateDesc(
            String areaCode, LocalDate since);

    @Query("""
           SELECT e FROM TourIndexSnapshotEntity e
           WHERE e.snapshotDate = (
               SELECT MAX(e2.snapshotDate) FROM TourIndexSnapshotEntity e2 WHERE e2.areaCode = e.areaCode
           )
           """)
    List<TourIndexSnapshotEntity> findLatestPerRegion();

    @Query("""
           SELECT e FROM TourIndexSnapshotEntity e
           WHERE e.snapshotDate = (
               SELECT MAX(e2.snapshotDate) FROM TourIndexSnapshotEntity e2 WHERE e2.areaCode = e.areaCode
           )
           AND e.searchVolume IS NOT NULL
           ORDER BY e.searchVolume DESC
           """)
    List<TourIndexSnapshotEntity> findTopBySearchVolume(Pageable pageable);
}
