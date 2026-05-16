package fast.campus.netplix.tour;

import lombok.Builder;
import lombok.Getter;

/**
 * 한국관광공사 비대면 안심관광지 목록(api.odcloud.kr) 항목.
 */
@Getter
@Builder
public class SafeTourismSpot {

    private final String id;
    private final String name;
    private final String areaName;
    private final String signguName;
    private final String address;
    private final String season;
    private final String theme;
    private final String intro;
    private final String detailUrl;
    private final String imageUrl;
    private final Double latitude;
    private final Double longitude;
}
