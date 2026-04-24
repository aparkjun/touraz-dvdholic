package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 한국관광공사 고캠핑(GoCamping) 공통 응답 스키마.
 * - /basedList, /locationBasedList, /searchList, /imageList 모두 동일하게
 *   response.body.items.item 구조를 사용한다.
 * - 0건 응답 시 items 가 빈 문자열("")로 내려오는 경우가 있어 어댑터에서 사전 치환.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class GoCampingResponse {

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
     * GoCamping 공식 필드 일부 (1차 MVP 범위).
     * 필드명은 API 문서 원문 camelCase 유지. 미사용 필드는 JsonIgnoreProperties 로 무시.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String contentId;
        private String facltNm;
        private String addr1;
        private String addr2;
        private String zipcode;
        private String mapX;          // 경도(longitude) — 문자열 응답
        private String mapY;          // 위도(latitude)  — 문자열 응답
        private String induty;        // 업종 (일반야영장,자동차야영장,글램핑 등)
        private String lctCl;         // 입지 구분 (산/숲속/계곡/해변/도심)
        private String lineIntro;     // 한줄 소개
        private String intro;         // 긴 소개
        private String firstImageUrl; // 대표 이미지 URL
        private String tel;
        private String homepage;
        private String direction;
        private String doNm;
        private String sigunguNm;
        private String createdtime;
        private String modifiedtime;
    }
}
