package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 무장애 여행정보(KorWithService2) 공통 응답 포맷.
 *
 * <p>다음 오퍼레이션들이 모두 동일한 {@code response.body.items.item} 구조를 공유:
 * <ul>
 *   <li>/areaBasedList2     : 지역기반 목록 (contentId/title/addr1/mapx/mapy/firstimage ...)</li>
 *   <li>/locationBasedList2 : 좌표 반경 목록 (+ dist)</li>
 *   <li>/searchKeyword2     : 키워드 검색</li>
 *   <li>/detailWithTour2    : 무장애 상세 정보 (휠체어·엘리베이터·점자블록·수유실 ...)</li>
 * </ul>
 *
 * <p>totalCount=0 일 때 items 가 빈 문자열("")로 내려오는 KTO 관례를
 * {@link VisitKoreaAccessibleHttpClient} 에서 {@code null} 로 사전 치환.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaAccessibleResponse {

    private Response response;

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        private Header header;
        private Body body;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Header {
        private String resultCode;
        private String resultMsg;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Body {
        private Items items;
        private Integer numOfRows;
        private Integer pageNo;
        private Integer totalCount;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Items {
        private List<Item> item;
    }

    /**
     * areaBased/locationBased/searchKeyword + detailWithTour 모든 필드를 느슨하게 수용.
     * 미존재 필드는 Jackson 이 null 로 둔다.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        // 공통
        private String contentid;
        private String contenttypeid;
        private String title;
        private String addr1;
        private String addr2;
        private String areacode;
        private String sigungucode;
        private String firstimage;
        private String firstimage2;
        private String tel;
        private String mapx;
        private String mapy;
        private String overview;

        // detailWithTour2 - 무장애 접근성 필드 (KTO 무장애 API 공식 필드명)
        private String parkingleisure;        // 주차장(장애인)
        private String restroom;              // 장애인 화장실
        private String wheelchair;            // 휠체어 대여
        private String elevator;              // 엘리베이터
        private String blindhandicapetc;      // 시각장애 편의
        private String hearinghandicapetc;    // 청각장애 편의
        private String auditorium;            // 강당/홀 접근성
        private String publictransport;       // 대중교통
        private String signguide;             // 수어/안내
        private String videoguide;            // 수어 비디오
        private String braileblock;           // 점자블록
        private String helpdog;               // 장애인 안내견
        private String stroller;              // 유모차 대여
        private String lactationroom;         // 수유실
        private String babysparechair;        // 유아동반 의자

        // detailInfo2 - 반복정보 (장애유형별 편의시설 리스트)
        private String serialnum;             // 행 번호
        private String infoname;              // 편의시설 라벨 (예: "휠체어 대여", "엘리베이터")
        private String infotext;              // 편의시설 상태/설명 (예: "가능", "설치")

        // detailCommon2 - 홈페이지 보강 필드
        private String homepage;
    }
}
