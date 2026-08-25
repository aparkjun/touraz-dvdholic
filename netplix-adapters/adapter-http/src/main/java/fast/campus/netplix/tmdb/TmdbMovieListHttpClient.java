package fast.campus.netplix.tmdb;

import fast.campus.netplix.client.TmdbHttpClient;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.NetplixPageableMovies;
import fast.campus.netplix.movie.TmdbMoviePort;
import fast.campus.netplix.translation.TextTranslationPort;
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

    /** TMDB 일본어 줄거리가 비었을 때 한국어 원문을 AI(일본인 해설사 페르소나)로 번역해 채운다. */
    @Value("${tmdb.batch.ja-translate-fallback:true}")
    private boolean jaTranslateFallback;

    /** TMDB 중국어(간체) 줄거리가 비었을 때 한국어 원문을 AI(중국인 해설사 페르소나)로 번역해 채운다. */
    @Value("${tmdb.batch.zh-translate-fallback:true}")
    private boolean zhTranslateFallback;

    private final TmdbHttpClient tmdbHttpClient;
    private final TmdbMovieDetailsHttpClient tmdbMovieDetailsHttpClient;
    private final TextTranslationPort textTranslationPort;

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
            TmdbMovieDetails detailsJa = tmdbMovieDetailsHttpClient.fetchMovieDetailsJa(tmdbId);
            TmdbMovieDetails detailsZh = tmdbMovieDetailsHttpClient.fetchMovieDetailsZh(tmdbId);

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
                    .movieNameJa(detailsJa != null ? detailsJa.getTitle() : null)
                    .overviewJa(resolveOverviewJa(detailsJa, movie.getOverview()))
                    .taglineJa(detailsJa != null ? detailsJa.getTagline() : null)
                    .posterPathJa(detailsJa != null ? detailsJa.getPosterPath() : null)
                    .backdropPathJa(detailsJa != null ? detailsJa.getBackdropPath() : null)
                    .movieNameZh(detailsZh != null ? detailsZh.getTitle() : null)
                    .overviewZh(resolveOverviewZh(detailsZh, movie.getOverview()))
                    .taglineZh(detailsZh != null ? detailsZh.getTagline() : null)
                    .posterPathZh(detailsZh != null ? detailsZh.getPosterPath() : null)
                    .backdropPathZh(detailsZh != null ? detailsZh.getBackdropPath() : null)
                    .build();
                    
            log.info("✓ Enriched movie: {}", movie.getMovieName());
            return enriched;
        } catch (Exception e) {
            log.error("✗ Failed to enrich movie: {} - {}", movie.getMovieName(), e.getMessage());
            return movie;
        }
    }

    /**
     * 일본어 줄거리 결정: TMDB ja-JP 줄거리가 있으면 그대로, 없으면 한국어 원문을
     * AI(일본인 해설사 페르소나)로 번역. 번역 불가/실패 시 null → 프론트에서 한국어 폴백.
     */
    private String resolveOverviewJa(TmdbMovieDetails detailsJa, String koOverview) {
        String jaOverview = detailsJa != null ? detailsJa.getOverview() : null;
        if (jaOverview != null && !jaOverview.isBlank()) {
            return jaOverview;
        }
        if (!jaTranslateFallback || koOverview == null || koOverview.isBlank() || !textTranslationPort.isAvailable()) {
            return jaOverview;
        }
        try {
            List<String> out = textTranslationPort.translate(List.of(koOverview), "ja", "film");
            if (out != null && !out.isEmpty() && out.get(0) != null && !out.get(0).isBlank()) {
                return out.get(0);
            }
        } catch (Exception e) {
            log.warn("✗ JA overview translate fallback failed: {}", e.getMessage());
        }
        return jaOverview;
    }

    /**
     * 중국어(간체) 줄거리 결정: TMDB zh-CN 줄거리가 있으면 그대로, 없으면 한국어 원문을
     * AI(중국인 해설사 페르소나)로 번역. 번역 불가/실패 시 null → 프론트에서 한국어 폴백.
     */
    private String resolveOverviewZh(TmdbMovieDetails detailsZh, String koOverview) {
        String zhOverview = detailsZh != null ? detailsZh.getOverview() : null;
        if (zhOverview != null && !zhOverview.isBlank()) {
            return zhOverview;
        }
        if (!zhTranslateFallback || koOverview == null || koOverview.isBlank() || !textTranslationPort.isAvailable()) {
            return zhOverview;
        }
        try {
            List<String> out = textTranslationPort.translate(List.of(koOverview), "zh", "film");
            if (out != null && !out.isEmpty() && out.get(0) != null && !out.get(0).isBlank()) {
                return out.get(0);
            }
        } catch (Exception e) {
            log.warn("✗ ZH overview translate fallback failed: {}", e.getMessage());
        }
        return zhOverview;
    }
}
