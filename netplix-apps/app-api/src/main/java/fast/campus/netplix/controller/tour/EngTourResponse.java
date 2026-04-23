package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.EngTourPoi;

/**
 * 영문 관광 POI(EngService2) 응답 DTO.
 *
 * <p>프론트엔드(영어 모드 K-Content Pilgrimage / Around This Film 섹션) 에서
 * 국문 {@link AccessiblePoiResponse} 와 동일한 필드 이름을 공유하도록 설계하여,
 * locale 토글 한 번으로 UI 컴포넌트를 재사용할 수 있게 한다.
 */
public record EngTourResponse(
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
    public static EngTourResponse from(EngTourPoi p) {
        return new EngTourResponse(
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
