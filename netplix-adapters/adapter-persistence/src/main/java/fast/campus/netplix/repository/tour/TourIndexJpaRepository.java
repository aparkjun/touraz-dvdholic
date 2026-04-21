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

    /**
     * 주어진 areaCode 기준 가장 최근 스냅샷. KTO DataLab 은 신규 데이터 공개까지 1~2개월
     * 시차가 있으므로 날짜 창을 두지 않고 전체 기간에서 최신 1건을 반환한다.
     */
    Optional<TourIndexSnapshotEntity> findFirstByAreaCodeOrderBySnapshotDateDesc(String areaCode);

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
