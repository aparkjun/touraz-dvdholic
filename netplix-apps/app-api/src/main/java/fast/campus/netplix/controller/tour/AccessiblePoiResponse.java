package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.AccessiblePoi;

import java.util.Collections;
import java.util.Map;

/**
 * 무장애 여행 POI 응답 DTO.
 * 프론트엔드 경량화를 위해 장애유형별 편의 플래그(hasPhysical/Visual/Hearing/Family) 를 함께 노출한다.
 */
public record AccessiblePoiResponse(
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
        // 접근성 원문 필드 (있을 때만)
        String parkingAccessible,
        String restroomAccessible,
        String wheelchairRental,
        String elevatorAccessible,
        String blindHandicapEtc,
        String hearingHandicapEtc,
        String publicTransport,
        String signGuide,
        String videoGuide,
        String brailleBlock,
        String helpDog,
        String strollerRental,
        String lactationRoom,
        // detailInfo2 에서 내려온 반복정보 (infoname → infotext 원문 맵)
        Map<String, String> accessibilityDetail,
        // 편의 플래그 (UI 칩)
        boolean physicalAccess,
        boolean visualAccess,
        boolean hearingAccess,
        boolean familyAccess
) {
    public static AccessiblePoiResponse from(AccessiblePoi p) {
        Map<String, String> detail = p.getAccessibilityDetail() == null
                ? Collections.emptyMap()
                : p.getAccessibilityDetail();
        return new AccessiblePoiResponse(
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
                p.getParkingAccessible(),
                p.getRestroomAccessible(),
                p.getWheelchairRental(),
                p.getElevatorAccessible(),
                p.getBlindHandicapEtc(),
                p.getHearingHandicapEtc(),
                p.getPublicTransport(),
                p.getSignGuide(),
                p.getVideoGuide(),
                p.getBrailleBlock(),
                p.getHelpDog(),
                p.getStrollerRental(),
                p.getLactationRoom(),
                detail,
                p.hasPhysicalAccess(),
                p.hasVisualAccess(),
                p.hasHearingAccess(),
                p.hasFamilyAccess()
        );
    }
}
