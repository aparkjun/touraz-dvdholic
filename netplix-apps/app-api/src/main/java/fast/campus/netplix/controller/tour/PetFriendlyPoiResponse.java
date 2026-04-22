package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.PetFriendlyPoi;

import java.util.Collections;
import java.util.Map;

/**
 * 반려동물 동반여행 POI 응답 DTO. 프론트엔드 편의를 위해 동반 가능 여부 플래그와
 * 요약 라벨을 함께 노출한다.
 */
public record PetFriendlyPoiResponse(
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
        // detailPetTour2 반려동물 정책 세부 (라벨 → 값)
        Map<String, String> petAcceptance,
        // 원본 동반 구분 코드 (1/2/3)
        String acmpyTypeCd,
        // UI 칩용 플래그
        boolean fullyAllowed,
        boolean limitedAllowed,
        boolean notAllowed,
        // 한글 라벨 요약 — 프론트 뱃지에 즉시 사용
        String acceptanceLabel
) {
    public static PetFriendlyPoiResponse from(PetFriendlyPoi p) {
        Map<String, String> detail = p.getPetAcceptance() == null
                ? Collections.emptyMap()
                : p.getPetAcceptance();
        return new PetFriendlyPoiResponse(
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
                detail,
                p.getAcmpyTypeCd(),
                p.isFullyAllowed(),
                p.isLimitedAllowed(),
                p.isNotAllowed(),
                p.acceptanceLabel()
        );
    }
}
