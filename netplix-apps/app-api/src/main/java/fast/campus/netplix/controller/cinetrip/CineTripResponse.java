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
            String movieNameJa,
            String movieNameZh,
            String movieNameNe,
            String posterPath,
            String posterPathEn,
            String posterPathJa,
            String posterPathZh,
            String posterPathNe,
            String backdropPath,
            String backdropPathEn,
            String backdropPathJa,
            String backdropPathZh,
            String backdropPathNe,
            String genre,
            String tagline,
            String taglineEn,
            String taglineJa,
            String taglineZh,
            String taglineNe,
            String overview,
            String overviewEn,
            String overviewJa,
            String overviewZh,
            String overviewNe,
            Double voteAverage,
            String contentType,
            String releasedAt
    ) {
        public static MovieSummary from(NetplixMovie m) {
            if (m == null) return null;
            return new MovieSummary(
                    m.getMovieName(),
                    m.getMovieNameEn(),
                    m.getMovieNameJa(),
                    m.getMovieNameZh(),
                    m.getMovieNameNe(),
                    m.getPosterPath(),
                    m.getPosterPathEn(),
                    m.getPosterPathJa(),
                    m.getPosterPathZh(),
                    m.getPosterPathNe(),
                    m.getBackdropPath(),
                    m.getBackdropPathEn(),
                    m.getBackdropPathJa(),
                    m.getBackdropPathZh(),
                    m.getBackdropPathNe(),
                    m.getGenre(),
                    m.getTagline(),
                    m.getTaglineEn(),
                    m.getTaglineJa(),
                    m.getTaglineZh(),
                    m.getTaglineNe(),
                    m.getOverview(),
                    m.getOverviewEn(),
                    m.getOverviewJa(),
                    m.getOverviewZh(),
                    m.getOverviewNe(),
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
