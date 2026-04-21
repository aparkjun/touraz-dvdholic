package fast.campus.netplix.cinetrip;

/**
 * 매일 04:30 KST - 영화×지역 매핑의 trending_score 를 최신 관광 지표 기준으로 재계산한다.
 */
public interface RecomputeCineTripScoreUseCase {

    /**
     * 모든 매핑의 trending_score 를 재계산·저장한다.
     * 반환값: upsert 된 행 수.
     */
    int recomputeAll();
}
