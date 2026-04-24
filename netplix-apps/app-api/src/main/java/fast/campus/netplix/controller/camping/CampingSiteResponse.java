package fast.campus.netplix.controller.camping;

import fast.campus.netplix.camping.CampingSite;

/**
 * 프론트엔드 전달용 야영장 DTO (GoCamping).
 * - 좌표는 double 로 내려 보내지도 마커 렌더에 바로 사용.
 * - 전화번호/이미지/홈페이지 는 null 허용 (UI 에서 "정보 없음" 처리).
 */
public record CampingSiteResponse(
        String id,
        String name,
        String address,
        String zipcode,
        Double latitude,
        Double longitude,
        String induty,
        String lctCl,
        String shortIntro,
        String longIntro,
        String imageUrl,
        String tel,
        String homepage,
        String direction,
        String doNm,
        String sigunguNm,
        Double distanceKm
) {
    public static CampingSiteResponse from(CampingSite s) {
        return new CampingSiteResponse(
                s.getId(),
                s.getName(),
                s.getAddress(),
                s.getZipcode(),
                s.getLatitude(),
                s.getLongitude(),
                s.getInduty(),
                s.getLctCl(),
                s.getShortIntro(),
                s.getLongIntro(),
                s.getImageUrl(),
                s.getTel(),
                s.getHomepage(),
                s.getDirection(),
                s.getDoNm(),
                s.getSigunguNm(),
                s.getDistanceKm()
        );
    }
}
