package fast.campus.netplix.repository.dvdstore;

import fast.campus.netplix.entity.dvdstore.DvdStoreEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DvdStoreJpaRepository extends JpaRepository<DvdStoreEntity, Long> {

    @Query(value = """
            SELECT AREA_CODE AS areaCode,
                   COUNT(*) AS totalCount,
                   SUM(CASE WHEN STATUS_CODE = '01' THEN 1 ELSE 0 END) AS operatingCount,
                   SUM(CASE WHEN STATUS_CODE <> '01' THEN 1 ELSE 0 END) AS closedCount,
                   AVG(LATITUDE)  AS avgLatitude,
                   AVG(LONGITUDE) AS avgLongitude
              FROM dvd_stores
             WHERE AREA_CODE IS NOT NULL
             GROUP BY AREA_CODE
            """, nativeQuery = true)
    List<DvdStoreRegionStatRow> aggregateByRegion();


    List<DvdStoreEntity> findByStatusCode(String statusCode);

    @Query("SELECT e FROM DvdStoreEntity e WHERE " +
            "e.businessName LIKE %:kw% OR " +
            "e.roadAddress LIKE %:kw% OR " +
            "e.jibunAddress LIKE %:kw% OR " +
            "e.productInfo LIKE %:kw%")
    List<DvdStoreEntity> searchByKeyword(@Param("kw") String keyword);

    @Query(value = "SELECT *, " +
            "(6371 * ACOS(COS(RADIANS(:lat)) * COS(RADIANS(LATITUDE)) * COS(RADIANS(LONGITUDE) - RADIANS(:lon)) " +
            "+ SIN(RADIANS(:lat)) * SIN(RADIANS(LATITUDE)))) AS dist " +
            "FROM dvd_stores " +
            "WHERE LATITUDE IS NOT NULL AND LONGITUDE IS NOT NULL " +
            "AND STATUS_CODE = '01' " +
            "HAVING dist <= :radius " +
            "ORDER BY dist " +
            "LIMIT 50",
            nativeQuery = true)
    List<DvdStoreEntity> findNearby(@Param("lat") double lat,
                                     @Param("lon") double lon,
                                     @Param("radius") double radiusKm);
}
