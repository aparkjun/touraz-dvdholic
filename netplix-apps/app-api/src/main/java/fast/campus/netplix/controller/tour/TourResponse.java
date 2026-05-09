package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TourIndex;
import fast.campus.netplix.tour.TrendingRegion;

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
        Integer searchVolume,
        /** {@code /trending-regions} 가 캐시에서 채울 때만 설정 — 기간별 랭킹 순번 */
        Integer trendingRank,
        /** 기간(today/week/month)별 가중 점수 — 탭마다 달라야 정상 */
        Double trendingPeriodScore
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
                d.getSearchVolume(),
                null,
                null
        );
    }

    public static TourResponse fromWithTrending(TourIndex d, int rank, double periodScore) {
        return new TourResponse(
                d.getAreaCode(),
                d.getRegionName(),
                d.getSnapshotDate(),
                d.getTourDemandIdx(),
                d.getTourCompetitiveness(),
                d.getCulturalResourceDemand(),
                d.getTourServiceDemand(),
                d.getTourResourceDemand(),
                d.getSearchVolume(),
                rank,
                round2(periodScore)
        );
    }

    /** 스냅샷이 없을 때 캐시의 지역·순위·점수만 전달 */
    public static TourResponse fromTrendingMinimal(TrendingRegion r) {
        return new TourResponse(
                r.getAreaCode(),
                r.getRegionName(),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                r.getRank(),
                round2(r.getScore())
        );
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
