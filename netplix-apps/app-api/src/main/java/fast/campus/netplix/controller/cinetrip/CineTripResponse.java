package fast.campus.netplix.controller.cinetrip;

import fast.campus.netplix.cinetrip.CineTripItem;
import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.controller.tour.TourResponse;
import fast.campus.netplix.movie.NetplixMovie;

import java.util.List;

public record CineTripResponse(
        MovieSummary movie,
        List<RegionMapping> mappings,
        List<TourResponse> regionIndices,
        Double trendingScore
) {

    public static CineTripResponse from(CineTripItem item) {
        return new CineTripResponse(
                MovieSummary.from(item.getMovie()),
                item.getMappings() == null ? List.of()
                        : item.getMappings().stream().map(RegionMapping::from).toList(),
                item.getRegionIndices() == null ? List.of()
                        : item.getRegionIndices().stream().map(TourResponse::from).toList(),
                item.getTrendingScore()
        );
    }

    public record MovieSummary(
            String movieName,
            String movieNameEn,
            String posterPath,
            String backdropPath,
            String genre,
            String tagline,
            String overview,
            Double voteAverage,
            String contentType,
            String releasedAt
    ) {
        public static MovieSummary from(NetplixMovie m) {
            if (m == null) return null;
            return new MovieSummary(
                    m.getMovieName(),
                    m.getMovieNameEn(),
                    m.getPosterPath(),
                    m.getBackdropPath(),
                    m.getGenre(),
                    m.getTagline(),
                    m.getOverview(),
                    m.getVoteAverage(),
                    m.getContentType(),
                    m.getReleasedAt()
            );
        }
    }

    public record RegionMapping(
            String areaCode,
            String regionName,
            String mappingType,
            String evidence,
            Integer confidence,
            Double trendingScore
    ) {
        public static RegionMapping from(MovieRegionMapping m) {
            return new RegionMapping(
                    m.getAreaCode(),
                    m.getRegionName(),
                    m.getMappingType(),
                    m.getEvidence(),
                    m.getConfidence(),
                    m.getTrendingScore()
            );
        }
    }
}
