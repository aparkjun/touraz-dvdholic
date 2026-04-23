package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 영문 관광정보 서비스(EngService2) POI.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/EngService2}
 *
 * <p>국문 {@link AccessiblePoi} 와 달리 편의시설(무장애) 정보는 포함하지 않으며,
 * 외국인 사용자(영어 모드)가 한국의 촬영지·배경지를 영문 메타로 탐색할 때 사용한다.
 *
 * <p>areaCode / contentTypeId / contentId 는 KorService2 와 동일한 KTO 마스터 키를
 * 공유하므로, 같은 contentId 로 국/영문 메타를 스왑하는 2-locale 렌더링이 가능하다.
 *
 * <p>contentTypeId 주의: KorService2 와 EngService2 는 동일한 의미에 다른 코드를 쓴다.
 * 어댑터({@code VisitKoreaEngHttpClient}) 내부에서 국문 코드가 들어오면 영문 코드로 자동 치환되므로,
 * 이 도메인을 소비하는 코드는 어떤 체계든 한 번만 결정해 사용하면 된다.
 *
 * <table>
 *   <tr><th>의미</th><th>KorService2</th><th>EngService2</th></tr>
 *   <tr><td>Tourist Attractions</td><td>12</td><td>76</td></tr>
 *   <tr><td>Cultural Facilities</td><td>14</td><td>78</td></tr>
 *   <tr><td>Festivals &amp; Events</td><td>15</td><td>85</td></tr>
 *   <tr><td>Travel Courses</td><td>25</td><td>75</td></tr>
 *   <tr><td>Leisure &amp; Sports</td><td>28</td><td>77</td></tr>
 *   <tr><td>Accommodations</td><td>32</td><td>80</td></tr>
 *   <tr><td>Shopping</td><td>38</td><td>79</td></tr>
 *   <tr><td>Restaurants</td><td>39</td><td>82</td></tr>
 * </table>
 */
@Getter
@Builder(toBuilder = true)
public class EngTourPoi {

    private final String contentId;
    private final String contentTypeId;

    /** 영문 명칭 (예: "Gyeongbokgung Palace"). */
    private final String title;

    /** 영문 주소 1차. */
    private final String addr1;

    /** 영문 주소 2차(상세). */
    private final String addr2;

    /** 광역 areaCode (1~8, 31~39). */
    private final String areaCode;

    /** 시군구 코드. */
    private final String sigunguCode;

    private final String firstImage;
    private final String firstImageThumb;

    private final String tel;

    /** Longitude (WGS84). */
    private final Double mapX;

    /** Latitude (WGS84). */
    private final Double mapY;

    /** 영문 overview. detailCommon2 호출 시에만 채워진다. */
    private final String overview;

    /** 영문 홈페이지(HTML anchor 포함 원문 가능). */
    private final String homepage;

    /** locationBasedList2 호출 시 거리(m). */
    private final String distance;
}
