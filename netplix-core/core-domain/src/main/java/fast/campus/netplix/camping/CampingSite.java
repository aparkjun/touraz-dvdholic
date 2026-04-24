package fast.campus.netplix.camping;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 고캠핑(GoCamping) 기본/위치기반/키워드 검색 결과 항목.
 * 출처: /basedList, /locationBasedList, /searchList (모두 동일한 item 구조)
 *
 * <p>주요 필드 매핑(원문 → 도메인):
 * <ul>
 *   <li>contentId → id (야영장 고유 콘텐츠 ID)</li>
 *   <li>facltNm → name (야영장 이름)</li>
 *   <li>addr1+addr2 → address / zipcode → zipcode</li>
 *   <li>mapX/mapY → longitude/latitude (지도 마커용 WGS84)</li>
 *   <li>induty → induty (일반야영장/자동차야영장/글램핑/카라반 등 중복 가능 문자열)</li>
 *   <li>lctCl → lctCl (산/숲속/계곡/해변/도심 등 입지)</li>
 *   <li>lineIntro → shortIntro / intro → longIntro</li>
 *   <li>firstImageUrl → imageUrl (리스트 썸네일 겸용; 이미지 없는 경우 null)</li>
 *   <li>tel → tel (전화번호. 없으면 null 로 전달되며 UI 에서 "전화번호 없음" 처리)</li>
 *   <li>homepage → homepage (상세 링크)</li>
 *   <li>direction → direction (찾아오는 길)</li>
 *   <li>doNm+sigunguNm → doNm/sigunguNm (광역/기초 지자체명)</li>
 *   <li>distance → distanceKm (locationBasedList 응답이 아닌, 어댑터에서 재계산한 Haversine 거리)</li>
 * </ul>
 *
 * <p>API 응답에는 추가 편의시설 필드(gnrlSiteCo, autoSiteCo, glampSiteCo 등)가 있으나
 * 1차 MVP 범위에서는 카드/상세 렌더에 필요한 최소 세트만 노출. 추후 필요시 확장.
 */
@Getter
@Builder
public class CampingSite {

    private final String id;
    private final String name;
    private final String address;
    private final String zipcode;
    private final Double latitude;
    private final Double longitude;
    private final String induty;
    private final String lctCl;
    private final String shortIntro;
    private final String longIntro;
    private final String imageUrl;
    private final String tel;
    private final String homepage;
    private final String direction;
    private final String doNm;
    private final String sigunguNm;
    /** locationBased 호출 시 호출자 좌표 기준 반경 내 km 거리(Haversine). 전체/키워드 호출 시 null. */
    private final Double distanceKm;
}
