package fast.campus.netplix.cinetrip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * 영화/DVD ↔ 지자체 매핑. CineTrip 큐레이션의 핵심 테이블.
 * 한 영화가 여러 지역과 매핑될 수 있고(촬영지 + 배경 + 테마), 동일 (movieName, areaCode, mappingType) 은 중복 불가.
 */
@Getter
@Builder
@AllArgsConstructor
public class MovieRegionMapping {
    private final Long id;
    private final String movieName;
    private final String areaCode;
    private final String regionName;

    /** SHOT | BACKGROUND | THEME */
    private final String mappingType;

    /** 근거 한 줄 ("〇〇 해변에서 촬영", "설정상 배경이 제주") */
    private final String evidence;

    /** 1~5. 3 기본. 관리자 수동 업로드 기준. */
    private final Integer confidence;

    /** 검색량·관광수요 누적 점수 (배치 산출). */
    private final Double trendingScore;
}
