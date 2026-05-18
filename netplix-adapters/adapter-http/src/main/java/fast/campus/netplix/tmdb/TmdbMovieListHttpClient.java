package fast.campus.netplix.tmdb;

import fast.campus.netplix.client.TmdbHttpClient;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.NetplixPageableMovies;
import fast.campus.netplix.movie.TmdbMoviePort;
import fast.campus.netplix.util.ObjectMapperUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class TmdbMovieListHttpClient implements TmdbMoviePort {
    /** DVD 목록: TMDB 평점순(top_rated) - 상영중(now_playing)과 구분 */
    @Value("${tmdb.api.movie-lists.top-rated}")
    private String dvdListUrl;

    private final TmdbHttpClient tmdbHttpClient;
    private final TmdbMovieDetailsHttpClient tmdbMovieDetailsHttpClient;

    @Override
    public NetplixPageableMovies fetchPageable(int page) {
        // TMDB API는 page 1~500 (caller가 1-based 전달)
        String url = dvdListUrl + "&language=ko-KR&page=" + page;
        String request = tmdbHttpClient.request(url, HttpMethod.GET, CollectionUtils.toMultiValueMap(Map.of()), Map.of());

        TmdbResponse object = ObjectMapperUtil.toObject(request, TmdbResponse.class);

        // Enrich each movie with detailed information
        List<NetplixMovie> enrichedMovies = object.getResults().stream()
                .map(tmdbMovie -> {
                    NetplixMovie basicMovie = tmdbMovie.toDomain();
                    return enrichMovieDetails(basicMovie, tmdbMovie.getTmdbId());
                })
                .toList();

        return new NetplixPageableMovies(
                enrichedMovies,
                Integer.parseInt(object.getPage()),
                (Integer.parseInt(object.getTotal_pages())) - page != 0
        );
    }

    @Override
    public NetplixMovie buildFromTmdbId(int tmdbId, String preferredMovieName) {
        TmdbMovieDetails details = tmdbMovieDetailsHttpClient.fetchMovieDetails(tmdbId);
        if (details == null) {
            return null;
        }
        String name = preferredMovieName != null && !preferredMovieName.isBlank()
                ? preferredMovieName.trim()
                : details.getTitle();
        if (name == null || name.isBlank()) {
            return null;
        }
        NetplixMovie stub = NetplixMovie.builder()
                .movieName(name)
                .isAdult(false)
                .overview(details.getOverview())
                .releasedAt(details.getReleaseDate())
                .posterPath(details.getPosterPath())
                .backdropPath(details.getBackdropPath())
                .voteAverage(details.getVoteAverage())
                .releaseDate(details.getReleaseDate())
                .voteCount(details.getVoteCount())
                .originalTitle(details.getOriginalTitle())
                .originalLanguage(details.getOriginalLanguage())
                .build();
        return enrichMovieDetails(stub, tmdbId);
    }

    @Override
    public NetplixMovie enrichMovieDetails(NetplixMovie movie, Integer tmdbId) {
        log.info("→ Enriching movie: {} (tmdbId: {})", movie.getMovieName(), tmdbId);
        
        try {
            TmdbCredits credits = tmdbMovieDetailsHttpClient.fetchMovieCredits(tmdbId);
            TmdbMovieDetails details = tmdbMovieDetailsHttpClient.fetchMovieDetails(tmdbId);
            TmdbMovieDetails detailsEn = tmdbMovieDetailsHttpClient.fetchMovieDetailsEn(tmdbId);

            String trailerUrl = tmdbMovieDetailsHttpClient.fetchMovieTrailer(tmdbId);
            String ottProviders = tmdbMovieDetailsHttpClient.fetchOttProviders(tmdbId);
            String recommendations = tmdbMovieDetailsHttpClient.fetchRecommendations(tmdbId);
            String topReview = tmdbMovieDetailsHttpClient.fetchTopReview(tmdbId);
            String collection = details != null ? details.getCollectionName() : null;
            
            NetplixMovie enriched = NetplixMovie.builder()
                    .movieName(movie.getMovieName())
                    .isAdult(movie.getIsAdult())
                    .genre(movie.getGenre())
                    .overview(movie.getOverview())
                    .releasedAt(movie.getReleasedAt())
                    .posterPath(movie.getPosterPath())
                    .backdropPath(movie.getBackdropPath())
                    .voteAverage(movie.getVoteAverage())
                    .cast(credits != null ? credits.getTopCast(5) : null)
                    .director(credits != null ? credits.getDirector() : null)
                    .runtime(details != null ? details.getRuntime() : null)
                    .releaseDate(movie.getReleaseDate())
                    .certification(null)
                    .budget(details != null ? details.getBudget() : null)
                    .revenue(details != null ? details.getRevenue() : null)
                    .contentType("dvd")
                    .trailerUrl(trailerUrl)
                    .ottProviders(ottProviders)
                    .collection(collection)
                    .recommendations(recommendations)
                    .topReview(topReview)
                    .tagline(details != null ? details.getTagline() : null)
                    .originalTitle(details != null ? details.getOriginalTitle() : null)
                    .originalLanguage(details != null ? details.getOriginalLanguage() : null)
                    .productionCountries(details != null ? details.getProductionCountriesDisplay() : null)
                    .productionCompanies(details != null ? details.getProductionCompaniesDisplay() : null)
                    .imdbId(details != null ? details.getImdbId() : null)
                    .voteCount(details != null ? details.getVoteCount() : null)
                    .spokenLanguages(details != null ? details.getSpokenLanguagesDisplay() : null)
                    .homepage(details != null && details.getHomepage() != null && !details.getHomepage().isBlank() ? details.getHomepage() : null)
                    .movieNameEn(detailsEn != null ? detailsEn.getTitle() : null)
                    .overviewEn(detailsEn != null ? detailsEn.getOverview() : null)
                    .taglineEn(detailsEn != null ? detailsEn.getTagline() : null)
                    .posterPathEn(detailsEn != null ? detailsEn.getPosterPath() : null)
                    .backdropPathEn(detailsEn != null ? detailsEn.getBackdropPath() : null)
                    .build();
                    
            log.info("✓ Enriched movie: {}", movie.getMovieName());
            return enriched;
        } catch (Exception e) {
            log.error("✗ Failed to enrich movie: {} - {}", movie.getMovieName(), e.getMessage());
            return movie;
        }
    }
}
