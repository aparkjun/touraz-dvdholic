package fast.campus.netplix.cinetrip;

import java.util.List;

public interface CineTripUseCase {

    /** CineTrip 큐레이션 카드. trendingScore 내림차순. */
    List<CineTripItem> curate(int limit);

    /** 지역(areaCode) 기반 - 해당 지역이 매핑된 영화 중 최신/대표작. */
    List<CineTripItem> curateByRegion(String areaCode, int limit);

    /** 특정 영화에 연결된 지역 + 최신 관광 스냅샷. */
    List<CineTripItem> getByMovieName(String movieName);

    /** 매핑 업서트(관리자/배치용). */
    int upsertMappings(List<MovieRegionMapping> mappings);

    /** CSV 한 줄 파싱 + 업서트용 헬퍼. 반환: 성공 건수 */
    int importFromCsv(String csvText);

    long count();
}
