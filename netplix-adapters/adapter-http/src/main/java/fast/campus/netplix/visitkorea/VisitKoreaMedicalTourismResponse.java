package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 의료관광정보(MdclTursmService) 공통 응답 스키마.
 *
 * <p>WellnessTursmService 와 동일한 신규 KTO API 패밀리(B551011 + *TursmService)로 추정되며
 * camelCase 필드네이밍(contentId/baseAddr/orgImage/mapX/lDongRegnCd/...)을 사용한다.
 * 다만 테마 코드명(medClusterCd/mdclTursmThemaCd)은 서비스마다 다를 수 있어
 * {@link JsonAlias} 로 다중 후보를 허용하여 방어적으로 파싱한다.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaMedicalTourismResponse {

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
     * MdclTursmService /areaBasedList · /locationBasedList · /searchKeyword 공용 item.
     *
     * <p>웰니스 API 와 동일한 camelCase + KTO 내부 코드 체계로 추정하되, 실제 필드명이 다를 수 있어
     * 안전하게 다중 JsonAlias 를 지정한다(lowercase 표준 KTO 호환 + camelCase 신규 스키마 동시 수용).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        @JsonAlias({"contentid"})
        private String contentId;

        @JsonAlias({"contenttypeid"})
        private String contentTypeId;

        private String title;

        @JsonAlias({"addr1"})
        private String baseAddr;

        @JsonAlias({"addr2"})
        private String detailAddr;

        @JsonAlias({"zipcode"})
        private String zipCd;

        private String tel;

        @JsonAlias({"firstimage"})
        private String orgImage;

        @JsonAlias({"firstimage2"})
        private String thumbImage;

        @JsonAlias({"mapx"})
        private String mapX;

        @JsonAlias({"mapy"})
        private String mapY;

        /** 의료관광 클러스터/테마 코드 후보군. 실제 스펙 공개 전까지 유연 수용. */
        @JsonAlias({"mdclTursmThemaCd", "mdclTursmClusterCd", "medClusterCd", "cat1", "cat3"})
        private String medClusterCd;

        /** 법정동 시도 코드. Lombok getter 케이스 이슈로 @JsonProperty 명시. */
        @JsonProperty("lDongRegnCd")
        @JsonAlias({"areacode"})
        private String lDongRegnCd;

        @JsonProperty("lDongSignguCd")
        @JsonAlias({"sigungucode"})
        private String lDongSignguCd;

        private String langDivCd;

        /** locationBasedList 에서 내려주는 거리(m). */
        private String dist;
        private String regDt;
        private String mdfcnDt;
        private String cpyrhtDivCd;
        private String mlevel;
    }
}
