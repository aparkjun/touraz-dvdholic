package fast.campus.netplix.camping;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 고캠핑(GoCamping) 기본/위치기반/키워드 검색 결과 항목.
 * 출처: /basedList, /locationBasedList, /searchList (모두 동일한 item 구조)
 */
@Getter
@Builder(toBuilder = true)
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

    /** 일반/자동차/글램핑/카라반/개인카라반 사이트 수, 덤프스테이션 수 */
    private final Integer gnrlSiteCo;
    private final Integer autoSiteCo;
    private final Integer glampSiteCo;
    private final Integer caravSiteCo;
    private final Integer indvdlCaravSiteCo;
    private final Integer sitedStncCo;

    /** 화장실·샤워실·개수대 개수 (미집계 시 null, sbrsCl 텍스트로 보완) */
    private final Integer toiletCo;
    private final Integer swrmCo;
    private final Integer wpcfcCo;

    /** 소화기·방화수·방화사·화재감지기 개수 */
    private final Integer extshrCo;
    private final Integer frprvtWrppCo;
    private final Integer frprvtSandCo;
    private final Integer fireSensorCo;

    /** 부대시설·기타·주변가능·테마환경·화로대·장비대여·반려동물 (쉼표 구분) */
    private final String sbrsCl;
    private final String sbrsEtc;
    private final String posblFcltyCl;
    private final String themaEnvrnCl;
    private final String brazierCl;
    private final String eqpmnLendCl;
    private final String animalCmgCl;
}
