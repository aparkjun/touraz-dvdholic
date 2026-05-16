package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 여행기사목록(공공데이터 15121757, api.odcloud.kr).
 */
@Getter
@Builder
public class TravelArticle {

    private final String contentId;
    private final String categoryName;
    private final Integer categoryCode;
    private final String title;
    private final String areaName;
    private final Integer areaCode;
    private final String signguName;
    private final Integer signguCode;
    private final String imageUrl;
    private final String detailUrl;
}
