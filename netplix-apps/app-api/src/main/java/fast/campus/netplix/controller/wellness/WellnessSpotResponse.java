package fast.campus.netplix.controller.wellness;

import fast.campus.netplix.wellness.WellnessSpot;

/**
 * 프론트엔드 소비용 웰니스관광지 DTO.
 */
public record WellnessSpotResponse(
        String id,
        String name,
        String address,
        String zipcode,
        Double latitude,
        Double longitude,
        String imageUrl,
        String tel,
        String cat1,
        String cat2,
        String cat3,
        String areaCode,
        String sigunguCode,
        String contentTypeId,
        String homepage,
        Double distanceKm
) {
    public static WellnessSpotResponse from(WellnessSpot s) {
        return new WellnessSpotResponse(
                s.getId(),
                s.getName(),
                s.getAddress(),
                s.getZipcode(),
                s.getLatitude(),
                s.getLongitude(),
                s.getImageUrl(),
                s.getTel(),
                s.getCat1(),
                s.getCat2(),
                s.getCat3(),
                s.getAreaCode(),
                s.getSigunguCode(),
                s.getContentTypeId(),
                s.getHomepage(),
                s.getDistanceKm()
        );
    }
}
