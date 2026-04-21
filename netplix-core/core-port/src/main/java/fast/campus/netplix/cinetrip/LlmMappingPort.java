package fast.campus.netplix.cinetrip;

import fast.campus.netplix.movie.NetplixMovie;

import java.util.List;

/**
 * LLM 기반 영화-지역 매핑 추출 포트.
 * 어댑터(OpenAiMappingAdapter) 는 DB 필드만으로 프롬프트를 구성한다 — TMDB 추가 호출 없음.
 */
public interface LlmMappingPort {

    /** API 키가 설정되어 있으면 true. */
    boolean isAvailable();

    /**
     * 영화 한 편에 대한 지역 매핑 후보 목록.
     * 연결이 모호하면 빈 리스트 반환.
     */
    List<MovieRegionSuggestion> suggest(NetplixMovie movie);
}
