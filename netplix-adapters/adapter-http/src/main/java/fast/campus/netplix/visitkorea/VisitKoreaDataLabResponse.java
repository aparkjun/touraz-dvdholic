package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.util.List;

/**
 * 공공데이터포털(관광공사 데이터랩) 표준 응답 래퍼.
 * 대부분의 Operation 이 response → body → items → item[] 구조를 따른다.
 */
@Getter
@Setter
@ToString
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaDataLabResponse {

    @JsonProperty("response")
    private Response response;

    @Getter
    @Setter
    @ToString
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Response {
        private Header header;
        private Body body;
    }

    @Getter
    @Setter
    @ToString
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Header {
        private String resultCode;
        private String resultMsg;
    }

    @Getter
    @Setter
    @ToString
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
    @ToString
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Items {
        /** 응답에 따라 item 이 단일 객체 또는 배열로 오므로, Jackson 의 ACCEPT_SINGLE_VALUE_AS_ARRAY 설정이나 List 바인딩 권장. */
        private List<Item> item;
    }

    /**
     * 여러 Operation 응답을 흡수하기 위한 너그러운 DTO.
     * - metcoRegnVisitrDDList (광역 방문자수): areaCode, areaNm, touNum, touDivCd/Nm, daywkDivCd/Nm, baseYmd
     * - locgoRegnVisitrDDList (기초 방문자수): signguCode, signguNm, touNum, touDivCd/Nm, daywkDivCd/Nm, baseYmd
     * - areaTarSvcDemList (관광서비스 수요 — Base URL 미확정)
     * - areaCulResDemList (문화자원 수요 — Base URL 미확정)
     *
     * 필드명은 KTO 응답의 실제 JSON 키에 맞춰 매핑. 미사용 필드는 null.
     */
    @Getter
    @Setter
    @ToString
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String baseYmd;
        private String baseYm;
        private String areaCode;
        private String signguCode;

        @JsonProperty("areaNm")
        private String areaName;

        @JsonProperty("signguNm")
        private String signguName;

        private String daesoName;

        @JsonProperty("daywkDivCd")
        private String dayOfWeekCode;

        @JsonProperty("daywkDivNm")
        private String dayOfWeekName;

        @JsonProperty("touDivCd")
        private String touristDivCode;

        @JsonProperty("touDivNm")
        private String touristDivName;

        @JsonProperty("touNum")
        private Double touristCount;

        @JsonProperty("tAtrctDmIdx")
        private Double tourDemandIdx;

        @JsonProperty("tCmpttIdx")
        private Double tourCompetitiveness;

        @JsonProperty("cltreRsrceDmIdx")
        private Double culturalResourceDemand;

        @JsonProperty("tSrvcDmIdx")
        private Double tourServiceDemand;

        @JsonProperty("tRsrceDmIdx")
        private Double tourResourceDemand;

        @JsonProperty("srchCnt")
        private Integer searchVolume;
    }
}
