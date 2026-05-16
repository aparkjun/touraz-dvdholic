package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.SafeTourismSpot;

public record SafeTourismSpotResponse(
        String id,
        String name,
        String areaName,
        String signguName,
        String address,
        String season,
        String theme,
        String intro,
        String detailUrl,
        String imageUrl,
        Double latitude,
        Double longitude
) {
    public static SafeTourismSpotResponse from(SafeTourismSpot s) {
        return new SafeTourismSpotResponse(
                s.getId(),
                s.getName(),
                s.getAreaName(),
                s.getSignguName(),
                s.getAddress(),
                s.getSeason(),
                s.getTheme(),
                s.getIntro(),
                s.getDetailUrl(),
                s.getImageUrl(),
                s.getLatitude(),
                s.getLongitude()
        );
    }
}
