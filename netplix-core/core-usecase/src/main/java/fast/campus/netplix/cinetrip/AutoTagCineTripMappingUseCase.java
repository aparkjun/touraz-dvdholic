package fast.campus.netplix.cinetrip;

/**
 * 매일 05:00 KST - 새 영화/DVD 에 대해 룰 기반 + LLM 기반 지역 매핑을 자동 추론한다.
 *
 * 흐름:
 *  1. 영화 카탈로그 전체 페이징 스캔
 *  2. 이미 movie_region_mappings 에 매핑이 있으면 스킵 (증분)
 *  3. 룰 기반 사전 매칭 시도 (confidence=4)
 *  4. 매칭이 없고 한국영화면 LLM 추론 (confidence=1~5 LLM 자체 신뢰도)
 *  5. confidence >= 3 → movie_region_mappings 바로 upsert
 *     confidence <= 2 → pending_mapping_reviews 에 큐잉
 */
public interface AutoTagCineTripMappingUseCase {

    class Result {
        public final int scanned;
        public final int autoApproved;
        public final int pending;
        public final int skipped;
        public Result(int scanned, int autoApproved, int pending, int skipped) {
            this.scanned = scanned;
            this.autoApproved = autoApproved;
            this.pending = pending;
            this.skipped = skipped;
        }
    }

    /** 전체 카탈로그 배치 실행. */
    Result runAll();

    /** 단일 영화(관리자 단건 재시도 등). */
    Result runOne(String movieName);
}
