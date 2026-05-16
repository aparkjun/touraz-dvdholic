package fast.campus.netplix.tour;

/**
 * 한국관광공사 여행기사목록(api.odcloud.kr) 조회 Port.
 */
public interface TravelArticlePort {

    boolean isConfigured();

    /**
     * @param page    1-based
     * @param perPage 최대 50 권장
     */
    TravelArticlePage fetchPage(int page, int perPage);
}
