package fast.campus.netplix.medical;

import java.util.List;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) 상세 조회 결과.
 *
 * <p>카드 클릭 시 detailCommon(개요/홈페이지) + detailMdclTursm(의료관광 특화 정보)을 합쳐
 * 외국인 환자가 의사결정에 필요한 정보를 제공한다.
 *
 * <p>필드 매핑(detailMdclTursm → 도메인):
 * <ul>
 *   <li>detailCommon.overview → overview (기관 소개/개요)</li>
 *   <li>hmpgInfo(또는 detailCommon.homepage) → homepage</li>
 *   <li>insttDevInfo → institutionType (종합병원/의원 등)</li>
 *   <li>mdclTursmDivInfo → divInfo (의료기관 구분)</li>
 *   <li>mainMdlcSubjInfo → specialties (주요 진료과목, 쉼표 분리)</li>
 *   <li>svcLangInfo → languages (지원 외국어, 쉼표 분리)</li>
 *   <li>onlineRsvtPsblYn(Y/N) → onlineReservation, gdsCnselCn → reservationUrl</li>
 *   <li>coorResidYn(Y/N) → coordinatorResident (외국인 코디네이터 상주)</li>
 *   <li>specProcMdlcInfo → specialProcedures (특화 시술)</li>
 *   <li>specFcltyInfo → specialFacilities (외국인 전용 시설/편의)</li>
 *   <li>histrCn → history (연혁)</li>
 *   <li>prSnsInfo → sns (홍보 SNS)</li>
 * </ul>
 */
public record MedicalTourismSpotDetail(
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
    public static MedicalTourismSpotDetail empty(String contentId) {
        return new MedicalTourismSpotDetail(
                contentId, null, null, null, null,
                List.of(), List.of(), false, null, false,
                null, null, null, null);
    }
}
