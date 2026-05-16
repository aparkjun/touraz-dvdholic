package fast.campus.netplix.odcloud;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Collections;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OdcloudTravelArticleResponse {

    private long page;
    private long perPage;
    private long totalCount;
    private long currentCount;
    private long matchCount;
    private List<OdcloudTravelArticleItem> data = Collections.emptyList();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OdcloudTravelArticleItem {
        @JsonProperty("콘텐츠아이디")
        private String contentId;

        @JsonProperty("콘텐츠분류명")
        private String categoryName;

        @JsonProperty("콘텐츠분류코드")
        private Integer categoryCode;

        @JsonProperty("콘텐츠명")
        private String title;

        @JsonProperty("지역명")
        private String areaName;

        @JsonProperty("광역코드")
        private Integer areaCode;

        @JsonProperty("시군구명")
        private String signguName;

        @JsonProperty("시군구코드")
        private Integer signguCode;

        @JsonProperty("대표이미지 URL")
        private String imageUrl;

        @JsonProperty("기사상세정보URL")
        private String detailUrl;
    }
}
