package fast.campus.netplix.repository.cinetrip;

import fast.campus.netplix.entity.cinetrip.MovieRegionMappingEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MovieRegionMappingJpaRepository extends JpaRepository<MovieRegionMappingEntity, Long> {

    List<MovieRegionMappingEntity> findByMovieName(String movieName);

    List<MovieRegionMappingEntity> findByAreaCode(String areaCode);

    Optional<MovieRegionMappingEntity> findByMovieNameAndAreaCodeAndMappingType(
            String movieName, String areaCode, String mappingType);

    @Query("""
            select m from MovieRegionMappingEntity m
            order by m.trendingScore desc, m.confidence desc, m.id asc
            """)
    List<MovieRegionMappingEntity> findTopTrending(Pageable pageable);

    /** {@link #findTopTrending(Pageable)} 과 동일 정렬, 페이징 없이 전체 (큐레이션 전량 로드용). */
    @Query("""
            select m from MovieRegionMappingEntity m
            order by m.trendingScore desc, m.confidence desc, m.id asc
            """)
    List<MovieRegionMappingEntity> findAllOrderByTrending();

    @Query("select count(distinct m.movieName) from MovieRegionMappingEntity m where m.movieName is not null and m.movieName <> ''")
    long countDistinctMovieNames();

    @Query("select distinct m.movieName from MovieRegionMappingEntity m where m.movieName is not null and m.movieName <> '' order by m.movieName asc")
    List<String> findDistinctMovieNamesOrdered();
}
