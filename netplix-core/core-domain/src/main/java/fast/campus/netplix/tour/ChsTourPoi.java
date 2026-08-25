package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 중문(간체) 관광정보 서비스(ChsService2) POI.
 *
 * <p>출처: {@code https://apis.data.go.kr/B551011/ChsService2}
 *
 * <p>{@link EngTourPoi}/{@link JpnTourPoi} 와 동일한 필드 shape 을 가지며, 중국어(zh, 简体) 모드
 * 사용자가 한국의 촬영지·배경지를 간체 중국어 메타로 탐색할 때 사용한다.
 *
 * <p>areaCode / contentTypeId / contentId 는 KorService2 와 동일한 KTO 마스터 키를 공유하므로,
 * 같은 contentId 로 국/영/일/중문 메타를 스왑하는 다국어 렌더링이 가능하다.
 *
 * <p>contentTypeId 주의: 다국어 서비스(EngService2/JpnService2/ChsService2/…)는 국문(KorService2)과 다른
 * 공통 코드 체계(76/78/85/75/77/80/79/82)를 쓴다. 어댑터({@code VisitKoreaChsHttpClient}) 내부에서
 * 국문 코드가 들어오면 자동 치환되므로, 이 도메인을 소비하는 코드는 한 체계만 결정해 쓰면 된다.
 */
@Getter
@Builder(toBuilder = true)
public class ChsTourPoi {

    private final String contentId;
    private final String contentTypeId;

    /** 간체 중국어 명칭 (예: "景福宫"). */
    private final String title;

    /** 간체 중국어 주소 1차. */
    private final String addr1;

    /** 간체 중국어 주소 2차(상세). */
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

    /** 간체 중국어 overview. detailCommon2 호출 시에만 채워진다. */
    private final String overview;

    /** 간체 중국어 홈페이지(HTML anchor 포함 원문 가능). */
    private final String homepage;

    /** locationBasedList2 호출 시 거리(m). */
    private final String distance;
}
