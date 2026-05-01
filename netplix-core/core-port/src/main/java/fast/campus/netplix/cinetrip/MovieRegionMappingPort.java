package fast.campus.netplix.cinetrip;

import java.util.List;

public interface MovieRegionMappingPort {

    /** Upsert by (movieName, areaCode, mappingType). */
    int upsertAll(List<MovieRegionMapping> mappings);

    List<MovieRegionMapping> findByMovieName(String movieName);

    List<MovieRegionMapping> findByAreaCode(String areaCode);

    /**
     * 지역 다양성을 섞은 큐레이션 시드(영화 단위). 가중치 = trendingScore.
     */
    List<MovieRegionMapping> findTopTrending(int limit);

    /** 트렌딩 정렬 전체 행 — limit 없이 큐레이션할 때 사용. */
    List<MovieRegionMapping> findAllOrderByTrending();

    List<MovieRegionMapping> findAll();

    long count();

    long countDistinctMovieNames();

    List<String> findDistinctMovieNamesOrdered();
}
