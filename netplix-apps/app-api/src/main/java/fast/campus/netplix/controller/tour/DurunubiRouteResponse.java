package fast.campus.netplix.controller.tour;

import fast.campus.netplix.tour.DurunubiRoute;

/**
 * 두루누비 길(route) 응답 DTO.
 */
public record DurunubiRouteResponse(
        String routeIdx,
        String brdDiv,
        String brdNm,
        String themeNm,
        String lnm,
        String lnkgCourse,
        String cpnBgng,
        String cpnEnd,
        String displayName
) {
    public static DurunubiRouteResponse from(DurunubiRoute r) {
        return new DurunubiRouteResponse(
                r.getRouteIdx(),
                r.getBrdDiv(),
                r.getBrdNm(),
                r.getThemeNm(),
                r.getLnm(),
                r.getLnkgCourse(),
                r.getCpnBgng(),
                r.getCpnEnd(),
                r.displayName()
        );
    }
}
