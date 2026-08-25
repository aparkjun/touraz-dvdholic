package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.ChsTourPoi;

/**
 * 중문(간체) 관광 POI(ChsService2) 응답 DTO.
 *
 * <p>{@link EngTourResponse}/{@link JpnTourResponse} 와 동일한 필드 이름을 공유하도록 설계하여,
 * 프론트엔드가 locale(en→eng, ja→jpn, zh→chs) 에 따라 엔드포인트만 바꿔 동일 UI 컴포넌트를
 * 재사용할 수 있게 한다.
 */
public record ChsTourResponse(
        String contentId,
        String contentTypeId,
        String title,
        String addr1,
        String addr2,
        String areaCode,
        String sigunguCode,
        String firstImage,
        String firstImageThumb,
        String tel,
        Double mapX,
        Double mapY,
        String overview,
        String homepage,
        String distance
) {
    public static ChsTourResponse from(ChsTourPoi p) {
        return new ChsTourResponse(
                p.getContentId(),
                p.getContentTypeId(),
                p.getTitle(),
                p.getAddr1(),
                p.getAddr2(),
                p.getAreaCode(),
                p.getSigunguCode(),
                p.getFirstImage(),
                p.getFirstImageThumb(),
                p.getTel(),
                p.getMapX(),
                p.getMapY(),
                p.getOverview(),
                p.getHomepage(),
                p.getDistance()
        );
    }
}
