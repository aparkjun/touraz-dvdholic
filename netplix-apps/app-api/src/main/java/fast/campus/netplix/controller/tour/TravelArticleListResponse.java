package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TravelArticlePage;

import java.util.List;

public record TravelArticleListResponse(
        List<TravelArticleResponse> items,
        int page,
        int perPage,
        long totalCount
) {
    public static TravelArticleListResponse from(TravelArticlePage page) {
        return new TravelArticleListResponse(
                page.getItems().stream().map(TravelArticleResponse::from).toList(),
                page.getPage(),
                page.getPerPage(),
                page.getTotalCount()
        );
    }
}
