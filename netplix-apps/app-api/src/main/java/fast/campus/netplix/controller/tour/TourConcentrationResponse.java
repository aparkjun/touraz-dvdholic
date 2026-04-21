package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.TourConcentrationPrediction;

import java.time.LocalDate;

/**
 * 관광지 집중률 예측 프론트 DTO. 1일치(1 row) 표현.
 * 프론트에서는 보통 (areaCode 기준) 7개 row 를 받아 주간 히트맵/바 차트로 그린다.
 */
public record TourConcentrationResponse(
        LocalDate baseDate,
        String areaCode,
        String areaName,
        String signguCode,
        String signguName,
        String spotName,
        Double concentrationRate
) {
    public static TourConcentrationResponse from(TourConcentrationPrediction p) {
        return new TourConcentrationResponse(
                p.getBaseDate(),
                p.getAreaCode(),
                p.getAreaName(),
                p.getSignguCode(),
                p.getSignguName(),
                p.getSpotName(),
                p.getConcentrationRate()
        );
    }
}
