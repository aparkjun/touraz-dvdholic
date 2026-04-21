package fast.campus.netplix.visitkorea;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 관광공모전(사진) 수상작 API(PhokoAwrdService) 응답 포맷.
 * - /phokoAwrdList 와 /ldongCode 모두 동일한 response.body.items.item 구조.
 * - 데이터가 0 건일 때 items 는 객체가 아닌 빈 문자열("")로 내려올 수 있으므로 어댑터에서 사전 치환.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class VisitKoreaPhokoResponse {

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
     * 두 오퍼레이션 응답을 동시에 흡수하기 위해 필드를 느슨하게 매핑.
     * - phokoAwrdList: contentId, koTitle, enTitle, lDongRegnCd, koFilmst, enFilmst, filmDay,
     *                  koCmanNm, enCmanNm, koWnprzDiz, enWnprzDiz, koKeyWord, enKeyWord,
     *                  orgImage, thumbImage, cpyrhtDivCd, regDt, mdfcnDt
     * - ldongCode:     rnum, lDongRegnCd, lDongRegnNm
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Item {
        private String contentId;
        private String koTitle;
        private String enTitle;

        // Jackson Bean-convention 이 "lDong..." 을 "LDong..." 로 기대해 자동 매핑이 실패하는
        // 이슈가 있어 @JsonProperty 로 원본 JSON 키를 고정한다.
        @JsonProperty("lDongRegnCd")
        private String lDongRegnCd;

        @JsonProperty("lDongRegnNm")
        private String lDongRegnNm;

        private String koFilmst;
        private String enFilmst;
        private String filmDay;
        private String koCmanNm;
        private String enCmanNm;
        private String koWnprzDiz;
        private String enWnprzDiz;
        private String koKeyWord;
        private String enKeyWord;
        private String orgImage;
        private String thumbImage;
        private String cpyrhtDivCd;
        private String regDt;
        private String mdfcnDt;
    }
}
