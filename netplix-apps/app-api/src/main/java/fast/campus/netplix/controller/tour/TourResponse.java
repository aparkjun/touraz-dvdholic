package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TourIndex;

import java.time.LocalDate;

public record TourResponse(
        String areaCode,
        String regionName,
        LocalDate snapshotDate,
        Double tourDemandIdx,
        Double tourCompetitiveness,
        Double culturalResourceDemand,
        Double tourServiceDemand,
        Double tourResourceDemand,
        Integer searchVolume
) {
    public static TourResponse from(TourIndex d) {
        return new TourResponse(
                d.getAreaCode(),
                d.getRegionName(),
                d.getSnapshotDate(),
                d.getTourDemandIdx(),
                d.getTourCompetitiveness(),
                d.getCulturalResourceDemand(),
                d.getTourServiceDemand(),
                d.getTourResourceDemand(),
                d.getSearchVolume()
        );
    }
}
