package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TourPhoto;

/**
 * 프론트엔드 전달용 사진 DTO. TourPhoto 도메인을 얇게 랩핑한다.
 * - 저작권 Type1 만 공개할 지 여부는 노출 시점에 판단 (현재는 전체 반환)
 */
public record TourPhotoResponse(
        String contentId,
        String title,
        String titleEn,
        String lDongRegnCd,
        String filmSite,
        String filmSiteEn,
        String filmDay,
        String photographer,
        String award,
        String keywords,
        String imageUrl,
        String thumbnailUrl,
        String copyrightType
) {
    public static TourPhotoResponse from(TourPhoto p) {
        return new TourPhotoResponse(
                p.getContentId(),
                p.getTitle(),
                p.getTitleEn(),
                p.getLDongRegnCd(),
                p.getFilmSite(),
                p.getFilmSiteEn(),
                p.getFilmDay(),
                p.getPhotographer(),
                p.getAward(),
                p.getKeywords(),
                p.getImageUrl(),
                p.getThumbnailUrl(),
                p.getCopyrightType()
        );
    }
}
