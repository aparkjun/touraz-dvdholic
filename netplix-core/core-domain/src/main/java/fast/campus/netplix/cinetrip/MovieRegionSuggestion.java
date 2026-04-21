package fast.campus.netplix.cinetrip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/**
 * AutoTagCineTripMappingBatch 의 중간 산출물.
 * confidence/source 에 따라 movie_region_mappings 로 확정되거나
 * pending_mapping_reviews 로 큐잉된다.
 */
@Getter
@Builder
@AllArgsConstructor
public class MovieRegionSuggestion {
    private final String movieName;
    private final String areaCode;
    private final String regionName;
    private final String mappingType;  // SHOT | BACKGROUND | THEME
    private final String evidence;
    private final Integer confidence;  // 1~5
    private final String source;       // RULE | LLM
    private final String rawResponse;  // LLM 원문 (디버깅용). RULE 은 null.
}
