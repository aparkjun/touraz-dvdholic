package fast.campus.netplix.cinetrip;

import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.tour.TourIndex;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * CineTrip 카드 하나. 영화 + 매핑된 대표 지역 + 해당 지역의 최신 관광 스냅샷.
 */
@Getter
@Builder
@AllArgsConstructor
public class CineTripItem {
    private final NetplixMovie movie;
    private final List<MovieRegionMapping> mappings;
    private final List<TourIndex> regionIndices;
    private final Double trendingScore;
}
