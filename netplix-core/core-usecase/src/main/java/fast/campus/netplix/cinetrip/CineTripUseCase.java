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

    /**
     * TMDB 에 이미 enrichment 된 영화 메타(title/overview/tagline 등)에서
     * 한국 광역시도명/영문명/주요 랜드마크를 regex 매칭해 AUTO 매핑을 자동 생성한다.
     *
     * <p>기존 MANUAL 시드(SHOT/BACKGROUND/THEME)가 있는 (movie, area) 조합은 스킵하여
     * 큐레이터가 넣은 데이터의 우선순위를 보존한다.
     *
     * @param maxPerMovie 한 영화당 최대 몇 개 지역까지 AUTO 매핑할지 상한 (기본 3 권장)
     * @return AUTO 매핑 생성 결과 요약
     */
    AutoMappingReport runAutoMapping(int maxPerMovie);

    /** {@link #runAutoMapping(int)} 결과 요약 DTO. */
    record AutoMappingReport(
            int scannedMovies,
            int moviesWithMatch,
            int generatedMappings,
            int skippedDueToManual,
            long totalMappingsAfter
    ) {}
}
