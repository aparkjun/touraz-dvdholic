package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 영문 관광정보 서비스(EngService2) 공통 응답 포맷.
 *
 * <p>다음 오퍼레이션이 동일한 {@code response.body.items.item} 구조를 공유한다.
 * <ul>
 *   <li>/areaBasedList2     : 지역기반 목록</li>
 *   <li>/locationBasedList2 : 좌표 반경 목록 (+ dist)</li>
 *   <li>/searchKeyword2     : 키워드 검색</li>
 *   <li>/detailCommon2      : 공통 상세(overview, homepage 등)</li>
 * </ul>
 *
 * <p>KTO 관례로 totalCount=0 일 때 items 가 빈 문자열("")로 내려오는 케이스는
 * {@link VisitKoreaEngHttpClient} 에서 {@code null} 로 사전 치환한다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaEngResponse {

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
     * areaBasedList2 / locationBasedList2 / searchKeyword2 / detailCommon2 의 필드를 느슨하게 수용.
     * 국문 KorService2 와 필드명이 동일하므로 (title/addr1/overview/...), Jackson 파싱 규약을 공유한다.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
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
        private String homepage;
        /** locationBasedList2 에서만 내려오는 거리(m). */
        private String dist;
    }
}
