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
     * 4개 Operation(관광수요/경쟁력/문화자원수요/검색량) 을 하나의 DTO 로 흡수.
     * 각 Operation 별로 채워지는 필드가 다르므로 null 허용.
     */
    @Getter
    @Setter
    @ToString
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        // 공통
        private String baseYmd;       // YYYYMMDD
        private String baseYm;        // YYYYMM
        private String areaCode;      // 시도 코드
        private String signguCode;    // 시군구 코드
        private String areaName;      // 시도명
        private String signguName;    // 시군구명
        private String daesoName;     // 세부 분류명 (검색량 API 등)

        // 관광수요지수
        @JsonProperty("tAtrctDmIdx")
        private Double tourDemandIdx;

        // 관광경쟁력
        @JsonProperty("tCmpttIdx")
        private Double tourCompetitiveness;

        // 문화자원 수요
        @JsonProperty("cltreRsrceDmIdx")
        private Double culturalResourceDemand;

        // 관광서비스 수요
        @JsonProperty("tSrvcDmIdx")
        private Double tourServiceDemand;

        // 관광자원 수요
        @JsonProperty("tRsrceDmIdx")
        private Double tourResourceDemand;

        // 검색량 (정수)
        @JsonProperty("srchCnt")
        private Integer searchVolume;
    }
}
