package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.DurunubiCourse;

/**
 * 두루누비 코스 응답 DTO. 프론트엔드 편의를 위해 난이도 라벨/소요시간 라벨/km 숫자를 함께 노출.
 */
public record DurunubiCourseResponse(
        String crsIdx,
        String routeIdx,
        String crsKorNm,
        String crsDstnc,
        Double distanceKm,
        String crsLevel,
        String levelLabel,
        String crsTotlRqrmHour,
        String estimatedTimeLabel,
        String crsCycle,
        String crsContents,
        String crsTourInfo,
        String crsTravelerinfo,
        String sigun,
        String cpnBgng,
        String cpnEnd,
        String gpxpath,
        String brdDiv,
        String brdNm
) {
    public static DurunubiCourseResponse from(DurunubiCourse c) {
        return new DurunubiCourseResponse(
                c.getCrsIdx(),
                c.getRouteIdx(),
                c.getCrsKorNm(),
                c.getCrsDstnc(),
                c.distanceKm(),
                c.getCrsLevel(),
                c.levelLabel(),
                c.getCrsTotlRqrmHour(),
                c.estimatedTimeLabel(),
                c.getCrsCycle(),
                c.getCrsContents(),
                c.getCrsTourInfo(),
                c.getCrsTravelerinfo(),
                c.getSigun(),
                c.getCpnBgng(),
                c.getCpnEnd(),
                c.getGpxpath(),
                c.getBrdDiv(),
                c.getBrdNm()
        );
    }
}
