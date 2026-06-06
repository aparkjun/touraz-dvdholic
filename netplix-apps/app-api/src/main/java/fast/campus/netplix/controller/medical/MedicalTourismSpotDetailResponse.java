package fast.campus.netplix.controller.medical;

import fast.campus.netplix.medical.MedicalTourismSpotDetail;

import java.util.List;

/**
 * 의료관광 상세(detailCommon + detailMdclTursm) 프런트 응답 DTO.
 */
public record MedicalTourismSpotDetailResponse(
        String contentId,
        String overview,
        String homepage,
        String institutionType,
        String divInfo,
        List<String> specialties,
        List<String> languages,
        boolean onlineReservation,
        String reservationUrl,
        boolean coordinatorResident,
        String specialProcedures,
        String specialFacilities,
        String history,
        String sns
) {
    public static MedicalTourismSpotDetailResponse from(MedicalTourismSpotDetail d) {
        return new MedicalTourismSpotDetailResponse(
                d.contentId(),
                d.overview(),
                d.homepage(),
                d.institutionType(),
                d.divInfo(),
                d.specialties() == null ? List.of() : d.specialties(),
                d.languages() == null ? List.of() : d.languages(),
                d.onlineReservation(),
                d.reservationUrl(),
                d.coordinatorResident(),
                d.specialProcedures(),
                d.specialFacilities(),
                d.history(),
                d.sns()
        );
    }
}
