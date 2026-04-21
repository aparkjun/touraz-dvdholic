package fast.campus.netplix.movie.response;

import fast.campus.netplix.movie.NetplixMovie;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class MovieWithRecommendReason {
    private final NetplixMovie movie;
    private final String reason;
    /**
     * AI 여행 모드(travelMode=true)에서 추천 영화와 연결된 지역 컨텍스트.
     * 기본 모드에서는 null.
     */
    private final RegionContext regionContext;

    public MovieWithRecommendReason(NetplixMovie movie, String reason) {
        this(movie, reason, null);
    }

    @Getter
    @AllArgsConstructor
    public static class RegionContext {
        private final String areaCode;
        private final String regionName;
        private final Double tourDemandIdx;
        private final Double culturalResourceDemand;
        private final Integer searchVolume;
        /** 사람이 읽기 좋은 배지 문구 (예: "🔥 검색 30,500 · 관광수요 76"). */
        private final String summary;
    }
}
