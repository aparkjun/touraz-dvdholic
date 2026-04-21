package fast.campus.netplix.tour;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * 지자체 관광 지표 스냅샷 저장/조회 포트.
 */
public interface TourIndexRepositoryPort {

    void upsertAll(List<TourIndex> indices);

    List<TourIndex> findLatestPerRegion();

    Optional<TourIndex> findLatestByAreaCode(String areaCode);

    List<TourIndex> findByAreaCodeSince(String areaCode, LocalDate since);

    /**
     * 검색량 기준 상위 N 지자체 (최신 스냅샷 기준).
     */
    List<TourIndex> findTopBySearchVolume(int limit);

    long count();
}
