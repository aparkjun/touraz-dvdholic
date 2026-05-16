package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TravelArticle;

public record TravelArticleResponse(
        String contentId,
        String categoryName,
        Integer categoryCode,
        String title,
        String areaName,
        Integer areaCode,
        String signguName,
        Integer signguCode,
        String imageUrl,
        String detailUrl
) {
    public static TravelArticleResponse from(TravelArticle a) {
        return new TravelArticleResponse(
                a.getContentId(),
                a.getCategoryName(),
                a.getCategoryCode(),
                a.getTitle(),
                a.getAreaName(),
                a.getAreaCode(),
                a.getSignguName(),
                a.getSignguCode(),
                a.getImageUrl(),
                a.getDetailUrl()
        );
    }
}
