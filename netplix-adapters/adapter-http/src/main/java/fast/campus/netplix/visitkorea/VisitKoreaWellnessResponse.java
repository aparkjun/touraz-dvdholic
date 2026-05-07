package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 웰니스관광(WellnessTursmService) 공통 응답 스키마.
 *
 * <p>GoCamping 과 동일하게 response.body.items.item 구조를 사용하지만, item 필드명은
 * KTO 표준(contentid, mapx, firstimage 등)을 따른다(camping 은 facltNm/mapX 처럼 camelCase 혼재).
 * 0건 응답 시 items 가 빈 문자열("")로 내려오는 경우가 있어 어댑터에서 사전 치환.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaWellnessResponse {

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
     * WellnessTursmService /areaBasedList · /locationBasedList · /searchKeyword 공용 item.
     *
     * <p>주의: 웰니스 API 는 일반 KTO(VisitKorea) API와 달리 camelCase + KTO 내부 코드 체계를 사용한다.
     * 예) addr1/addr2 → baseAddr/detailAddr, firstimage → orgImage, mapx/mapy → mapX/mapY,
     *     areacode/sigungucode → lDongRegnCd/lDongSignguCd, cat1/cat2/cat3 → wellnessThemaCd(단일)
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String contentId;
        private String contentTypeId;
        private String title;
        private String baseAddr;
        private String detailAddr;
        private String zipCd;
        /** 목록 API에서 전화번호 필드명이 스펙/버전에 따라 달라질 수 있어 별칭 허용. */
        @JsonAlias({ "phone", "phoneno", "telNo", "contactTel", "officeTel" })
        private String tel;
        /** 일부 목록 항목에서만 내려올 수 있음(KTO wellness item 스키마에 있으면 수집). */
        @JsonAlias({ "homePage", "hmpgAddr", "url" })
        private String homepage;
        private String orgImage;
        private String thumbImage;
        private String mapX;          // 경도(longitude)
        private String mapY;          // 위도(latitude)
        /** 웰니스 테마 코드 (예: EX050100 뷰티스파, EX050200 한방체험). */
        private String wellnessThemaCd;
        /** 법정동 시도 코드. Lombok getter 가 getLDongRegnCd 로 생성되어 Jackson 기본 규칙과 케이스 불일치. */
        @JsonProperty("lDongRegnCd")
        private String lDongRegnCd;
        /** 법정동 시군구 코드. */
        @JsonProperty("lDongSignguCd")
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
