package fast.campus.netplix.tour;

/**
 * 여행기사 목록 조회 유스케이스.
 */
public interface GetTravelArticlesUseCase {

    TravelArticlePage list(int page, int perPage, String areaCode, String keyword);
}
