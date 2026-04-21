package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * TatsCnctrRateService / tatsCnctrRatedList 응답 DTO.
 * 다른 KTO API와 동일하게 response.header + response.body.items.item 구조.
 * totalCount=0 인 경우 items 가 빈 문자열로 내려올 수 있으므로 어댑터에서 사전 치환한다.
 *
 * <p>샘플 item:
 * <pre>
 * {
 *   "baseYmd":"20260421",
 *   "areaCd":"11",
 *   "areaNm":"서울특별시",
 *   "signguCd":"11110",
 *   "signguNm":"종로구",
 *   "tAtsNm":"경복궁(?)",
 *   "cnctrRate":"80.65"
 * }
 * </pre>
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaConcentrationResponse {

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
        private String baseYmd;
        private String areaCd;
        private String areaNm;
        private String signguCd;
        private String signguNm;
        // Jackson bean-convention 이 "tAtsNm" 필드를 "TAtsNm" property 로 인식해 자동 매핑 실패하는
        // 케이스가 있어 VisitKoreaPhokoResponse#lDongRegnCd 와 동일한 방식으로 키를 고정.
        @JsonProperty("tAtsNm")
        private String tAtsNm;
        private String cnctrRate;
    }
}
