package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 TarRlteTarService1 공통 응답 포맷.
 *
 * <p>다음 오퍼레이션이 동일한 {@code response.body.items.item} 구조를 공유한다:
 * <ul>
 *   <li>/areaBasedList1   : 지역기반 관광지별 연관 관광지 정보</li>
 *   <li>/searchKeyword1   : 키워드 검색 관광지별 연관 관광지 정보</li>
 * </ul>
 *
 * <p>totalCount=0 일 때 KTO 가 {@code items} 를 빈 문자열("")로 내려주는 관례에
 * 맞춰 클라이언트에서 사전 치환(""→null) 후 파싱한다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaRelatedSpotResponse {

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

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String areaCd;
        private String areaNm;
        private String signguCd;
        private String signguNm;

        // 두 번째 글자가 대문자라 Jackson 기본 BeanIntrospector 는 getTAtsNm → "TAtsNm" 으로 해석한다.
        // KTO 응답 JSON 키는 "tAtsNm" 이므로 명시적으로 매핑한다(불일치 시 null 로 깔끔히 떨어진다).
        @JsonProperty("tAtsNm")
        private String tAtsNm;

        private String rlteTatsNm;
        private String rlteRegnCd;
        private String rlteRegnNm;
        private String rlteSignguCd;
        private String rlteSignguNm;
        private String rlteCtgryLclsNm;
        private String rlteCtgryMclsNm;
        private String rlteCtgrySclsNm;
        private String rlteRank;
        private String hashtags;
    }
}
