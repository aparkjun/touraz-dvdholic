package fast.campus.netplix.wellness;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) 조회 결과 항목.
 * 출처: /areaBasedList, /locationBasedList, /searchKeyword (모두 공통 item 구조)
 *
 * <p>컨셉: "정주행 번아웃 · 내 주변 힐링 스팟".
 * 영화/드라마 정주행 후 쌓인 눈·어깨·멘탈 피로를 해소할 수 있는 온천/스파/힐링숲/
 * 템플스테이/명상/요가/마사지 등의 웰니스 관광지 POI 를 통합 노출한다.
 *
 * <p>주요 필드 매핑(원문 → 도메인):
 * <ul>
 *   <li>contentid → id (관광지 고유 콘텐츠 ID)</li>
 *   <li>title → name</li>
 *   <li>addr1+addr2 → address / zipcode → zipcode</li>
 *   <li>mapx/mapy → longitude/latitude (지도 마커용 WGS84)</li>
 *   <li>firstimage (또는 firstimage2) → imageUrl (리스트 썸네일; 없으면 null)</li>
 *   <li>tel → tel</li>
 *   <li>cat1/cat2/cat3 → cat1/cat2/cat3 (분류 코드, 카드 배지 매핑에 사용)</li>
 *   <li>areacode/sigungucode → areaCode/sigunguCode</li>
 *   <li>contenttypeid → contentTypeId ("28" 레저, "39" 음식점, "14" 문화시설 등)</li>
 *   <li>dist(locationBased 응답의 m 단위) → distanceKm (어댑터에서 Haversine 재계산)</li>
 *   <li>homepage (목록에 있으면) → homepage — 없으면 null. 상세 전용 API 연동 시 보강 가능.</li>
 * </ul>
 *
 * <p>웰니스 관광정보는 공식 분류 카테고리(cat1="A02", cat2="A0206", cat3="A02061200" 웰니스관광)에
 * 묶여 있지만, 본 API 는 해당 테마에 이미 필터된 데이터를 제공하므로 추가 필터가 불필요하다.
 */
@Getter
@Builder
public class WellnessSpot {

    private final String id;
    private final String name;
    private final String address;
    private final String zipcode;
    private final Double latitude;
    private final Double longitude;
    private final String imageUrl;
    private final String tel;
    private final String cat1;
    private final String cat2;
    private final String cat3;
    private final String areaCode;
    private final String sigunguCode;
    private final String contentTypeId;
    /** 목록 API에 있으면 수집. 많은 항목은 비어 있음(상세 API 미연동). */
    private final String homepage;
    /** locationBased 호출 시 호출자 좌표 기준 반경 내 km 거리(Haversine). 전체/키워드 호출 시 null. */
    private final Double distanceKm;
}
