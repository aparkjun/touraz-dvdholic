package fast.campus.netplix.odcloud;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Collections;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OdcloudSafeTourismResponse {

    private long page;
    private long perPage;
    private long totalCount;
    private long currentCount;
    private long matchCount;
    private List<OdcloudSafeTourismItem> data = Collections.emptyList();

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class OdcloudSafeTourismItem {

        @JsonProperty("콘텐츠아이디")
        private String contentId;

        @JsonProperty("관광지아이디")
        private String spotId;

        @JsonProperty("관광지명")
        private String spotName;

        @JsonProperty("콘텐츠명")
        private String contentName;

        @JsonProperty("정보명")
        private String infoName;

        @JsonProperty("지역명")
        private String areaName;

        @JsonProperty("지역")
        private String region;

        @JsonProperty("시도명")
        private String sidoName;

        @JsonProperty("시군구명")
        private String signguName;

        @JsonProperty("시군")
        private String signgu;

        @JsonProperty("주소")
        private String address;

        @JsonProperty("시즌")
        private String season;

        @JsonProperty("시즌구분")
        private String seasonType;

        @JsonProperty("테마")
        private String theme;

        @JsonProperty("테마환경")
        private String themeEnv;

        @JsonProperty("소개")
        private String intro;

        @JsonProperty("소개글")
        private String introText;

        @JsonProperty("상세URL")
        private String detailUrl;

        @JsonProperty("기사상세정보URL")
        private String articleDetailUrl;

        @JsonProperty("홈페이지")
        private String homepage;

        @JsonProperty("콘텐츠 URL")
        private String contentUrl;

        @JsonProperty("대표이미지 URL")
        private String imageUrl;

        @JsonProperty("이미지URL")
        private String imageUrlAlt;

        @JsonProperty("위도")
        private String latitude;

        @JsonProperty("경도")
        private String longitude;

        @JsonProperty("mapY")
        private String mapY;

        @JsonProperty("mapX")
        private String mapX;
    }
}
