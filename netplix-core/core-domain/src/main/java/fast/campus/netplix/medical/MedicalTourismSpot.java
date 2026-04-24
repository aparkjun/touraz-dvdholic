package fast.campus.netplix.medical;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) 조회 결과 항목.
 * 출처: /areaBasedList, /locationBasedList, /searchKeyword (모두 공통 item 구조)
 *
 * <p>컨셉: "K-의료관광 · 외국인 환영".
 * 영화·DVD 를 통해 한국 문화를 경험하는 해외 여행객에게, 성형/한방/건강검진/재활/
 * 미용 등 K-의료관광 클러스터를 동일 앱에서 노출한다. langDivCd 기반 다국어 전환 지원(ko/en).
 *
 * <p>주요 필드 매핑(원문 → 도메인):
 * <ul>
 *   <li>contentId → id (콘텐츠 고유 ID)</li>
 *   <li>title → name</li>
 *   <li>baseAddr+detailAddr → address / zipCd → zipcode</li>
 *   <li>mapX/mapY → longitude/latitude (WGS84)</li>
 *   <li>orgImage (또는 thumbImage) → imageUrl</li>
 *   <li>tel → tel</li>
 *   <li>medClusterCd / mdclTursmThemaCd → category (클러스터/테마 코드)</li>
 *   <li>lDongRegnCd/lDongSignguCd → areaCode/sigunguCode</li>
 *   <li>contentTypeId → contentTypeId</li>
 *   <li>langDivCd → language (ko/en/...)</li>
 *   <li>dist(locationBased 응답의 m 단위) → distanceKm (Haversine 재계산)</li>
 * </ul>
 */
@Getter
@Builder
public class MedicalTourismSpot {

    private final String id;
    private final String name;
    private final String address;
    private final String zipcode;
    private final Double latitude;
    private final Double longitude;
    private final String imageUrl;
    private final String tel;
    /** 의료관광 클러스터/테마 코드 (뷰티·웰니스·전통의학·전문의료 등). */
    private final String category;
    private final String areaCode;
    private final String sigunguCode;
    private final String contentTypeId;
    /** 콘텐츠 언어 (ko, en 등). 다국어 전환 UI 에서 필터용. */
    private final String language;
    /** locationBased 호출 시 호출자 좌표 기준 반경 내 km 거리(Haversine). 전체/키워드 호출 시 null. */
    private final Double distanceKm;
}
