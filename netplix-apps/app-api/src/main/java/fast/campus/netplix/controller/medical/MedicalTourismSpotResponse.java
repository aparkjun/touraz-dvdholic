package fast.campus.netplix.controller.medical;

import fast.campus.netplix.medical.MedicalTourismSpot;

/**
 * 프론트엔드 소비용 의료관광 스팟 DTO.
 * 외국인 방문객 타깃으로 language 필드(ko/en) 를 함께 노출한다.
 */
public record MedicalTourismSpotResponse(
        String id,
        String name,
        String address,
        String zipcode,
        Double latitude,
        Double longitude,
        String imageUrl,
        String tel,
        String category,
        String areaCode,
        String sigunguCode,
        String contentTypeId,
        String language,
        Double distanceKm
) {
    public static MedicalTourismSpotResponse from(MedicalTourismSpot s) {
        return new MedicalTourismSpotResponse(
                s.getId(),
                s.getName(),
                s.getAddress(),
                s.getZipcode(),
                s.getLatitude(),
                s.getLongitude(),
                s.getImageUrl(),
                s.getTel(),
                s.getCategory(),
                s.getAreaCode(),
                s.getSigunguCode(),
                s.getContentTypeId(),
                s.getLanguage(),
                s.getDistanceKm()
        );
    }
}
