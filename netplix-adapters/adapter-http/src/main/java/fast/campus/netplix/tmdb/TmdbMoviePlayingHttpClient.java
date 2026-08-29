package fast.campus.netplix.tmdb;

import fast.campus.netplix.client.TmdbHttpClient;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.NetplixPageableMovies;
import fast.campus.netplix.movie.TmdbMoviePlayingPort;
import fast.campus.netplix.movie.NepaliScript;
import fast.campus.netplix.movie.PortugueseScript;
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
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class TmdbMoviePlayingHttpClient implements TmdbMoviePlayingPort {
    @Value("${tmdb.api.movie-lists.movie-playing}")
    private String moviePlaying;

    /** false = 빠른 모드(리스트만, 페이지당 1회 호출), true = Enrich(영화당 6회 호출) */
    @Value("${tmdb.batch.movie.enrich:true}")
    private boolean enrich;

    /** TMDB 일본어 줄거리가 비었을 때 한국어 원문을 AI(일본인 해설사 페르소나)로 번역해 채운다. */
    @Value("${tmdb.batch.ja-translate-fallback:true}")
    private boolean jaTranslateFallback;

    /** TMDB 중국어(간체) 줄거리가 비었을 때 한국어 원문을 AI(중국인 해설사 페르소나)로 번역해 채운다. */
    @Value("${tmdb.batch.zh-translate-fallback:true}")
    private boolean zhTranslateFallback;

    /** TMDB 네팔어 줄거리가 없거나 영어 폴백일 때 한국어 원문을 AI로 네팔어 번역해 채운다. */
    @Value("${tmdb.batch.ne-translate-fallback:true}")
    private boolean neTranslateFallback;

    /** TMDB pt-BR 줄거리가 없거나 영어 폴백일 때 한국어 원문을 AI(브라질 현지 페르소나)로 번역해 채운다. */
    @Value("${tmdb.batch.pt-translate-fallback:true}")
    private boolean ptTranslateFallback;

    /** TMDB에서 응답 지연/멈춤으로 배치가 걸리는 ID → Enrich 스킵 (enrich=true일 때만 사용) */
    private static final Set<Integer> SKIP_ENRICH_TMDB_IDS = Set.of(1476682, 1356587, 1597535);

    private final TmdbHttpClient tmdbHttpClient;
    private final TmdbMovieDetailsHttpClient tmdbMovieDetailsHttpClient;
    private final TextTranslationPort textTranslationPort;

    @Override
    public NetplixPageableMovies fetchPageable(int page) {
        // TMDB API는 page 1~500 (caller가 1-based 전달)
        String url = moviePlaying + "&language=ko-KR&page=" + page;
        String request = tmdbHttpClient.request(url, HttpMethod.GET, CollectionUtils.toMultiValueMap(Map.of()), Map.of());

        TmdbResponse object = ObjectMapperUtil.toObject(request, TmdbResponse.class);

        List<NetplixMovie> movies = enrich
                ? object.getResults().stream()
                        .map(tmdbMovie -> enrichMovieDetails(tmdbMovie.toDomain(), tmdbMovie.getTmdbId()))
                        .toList()
                : object.getResults().stream()
                        .map(tmdbMovie -> withContentType(tmdbMovie.toDomain(), "movie"))
                        .toList();

        return new NetplixPageableMovies(
                movies,
                Integer.parseInt(object.getPage()),
                (Integer.parseInt(object.getTotal_pages())) - page != 0
        );
    }

    @Override
    public NetplixMovie enrichMovieDetails(NetplixMovie movie, Integer tmdbId) {
        if (tmdbId != null && SKIP_ENRICH_TMDB_IDS.contains(tmdbId)) {
            log.info("→ Skipping enrich for tmdbId: {} (known slow/hang)", tmdbId);
            return movie;
        }
        log.info("→ Enriching movie: {} (tmdbId: {})", movie.getMovieName(), tmdbId);

        try {
            TmdbCredits credits = tmdbMovieDetailsHttpClient.fetchMovieCredits(tmdbId);
            TmdbMovieDetails details = tmdbMovieDetailsHttpClient.fetchMovieDetails(tmdbId);
            TmdbMovieDetails detailsEn = tmdbMovieDetailsHttpClient.fetchMovieDetailsEn(tmdbId);
            TmdbMovieDetails detailsJa = tmdbMovieDetailsHttpClient.fetchMovieDetailsJa(tmdbId);
            TmdbMovieDetails detailsZh = tmdbMovieDetailsHttpClient.fetchMovieDetailsZh(tmdbId);
            TmdbMovieDetails detailsNe = tmdbMovieDetailsHttpClient.fetchMovieDetailsNe(tmdbId);
            TmdbMovieDetails detailsPt = tmdbMovieDetailsHttpClient.fetchMovieDetailsPt(tmdbId);
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
                    .contentType("movie")
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
                    .movieNameNe(detailsNe != null ? detailsNe.getTitle() : null)
                    .overviewNe(resolveOverviewNe(detailsNe, movie.getOverview(),
                            detailsEn != null ? detailsEn.getOverview() : null))
                    .taglineNe(resolveNeText(
                            detailsNe != null ? detailsNe.getTagline() : null,
                            details != null ? details.getTagline() : null,
                            detailsEn != null ? detailsEn.getTagline() : null))
                    .posterPathNe(detailsNe != null ? detailsNe.getPosterPath() : null)
                    .backdropPathNe(detailsNe != null ? detailsNe.getBackdropPath() : null)
                    .movieNamePt(detailsPt != null ? detailsPt.getTitle() : null)
                    .overviewPt(resolveOverviewPt(detailsPt, movie.getOverview(),
                            detailsEn != null ? detailsEn.getOverview() : null))
                    .taglinePt(resolvePtText(
                            detailsPt != null ? detailsPt.getTagline() : null,
                            details != null ? details.getTagline() : null,
                            detailsEn != null ? detailsEn.getTagline() : null))
                    .posterPathPt(detailsPt != null ? detailsPt.pickPosterForLanguage("pt") : null)
                    .backdropPathPt(detailsPt != null ? detailsPt.pickBackdropForLanguage("pt") : null)
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

    /**
     * 네팔어 줄거리: TMDB ne-NP 에 데바나가리가 있으면 그대로, 없거나 영어 폴백이면
     * 한국어(없으면 영어) 원문을 AI로 번역. 실패 시 null → 프론트에서 한국어 폴백.
     */
    private String resolveOverviewNe(TmdbMovieDetails detailsNe, String koOverview, String enOverview) {
        return resolveNeText(detailsNe != null ? detailsNe.getOverview() : null, koOverview, enOverview);
    }

    private String resolveNeText(String tmdbNe, String koText, String enText) {
        if (NepaliScript.isUsable(tmdbNe)) {
            return tmdbNe;
        }
        String src = NepaliScript.firstTranslatable(koText, enText);
        if (!neTranslateFallback || src == null || !textTranslationPort.isAvailable()) {
            return null;
        }
        try {
            List<String> out = textTranslationPort.translate(List.of(src), "ne", "film");
            if (out != null && !out.isEmpty() && NepaliScript.isUsable(out.get(0))) {
                return out.get(0);
            }
        } catch (Exception e) {
            log.warn("✗ NE text translate fallback failed: {}", e.getMessage());
        }
        return null;
    }

    private String resolveOverviewPt(TmdbMovieDetails detailsPt, String koOverview, String enOverview) {
        return resolvePtText(detailsPt != null ? detailsPt.getOverview() : null, koOverview, enOverview);
    }

    private String resolvePtText(String tmdbPt, String koText, String enText) {
        if (PortugueseScript.isUsable(tmdbPt)) {
            return tmdbPt;
        }
        String src = PortugueseScript.firstTranslatable(koText, enText);
        if (!ptTranslateFallback || src == null || !textTranslationPort.isAvailable()) {
            return null;
        }
        try {
            List<String> out = textTranslationPort.translate(List.of(src), "pt", "film");
            if (out != null && !out.isEmpty() && PortugueseScript.isUsable(out.get(0))) {
                return out.get(0);
            }
        } catch (Exception e) {
            log.warn("✗ PT text translate fallback failed: {}", e.getMessage());
        }
        return null;
    }

    private static NetplixMovie withContentType(NetplixMovie m, String contentType) {
        return NetplixMovie.builder()
                .movieName(m.getMovieName())
                .isAdult(m.getIsAdult())
                .genre(m.getGenre())
                .overview(m.getOverview())
                .releasedAt(m.getReleasedAt())
                .posterPath(m.getPosterPath())
                .backdropPath(m.getBackdropPath())
                .voteAverage(m.getVoteAverage())
                .cast(m.getCast())
                .director(m.getDirector())
                .runtime(m.getRuntime())
                .releaseDate(m.getReleaseDate())
                .certification(m.getCertification())
                .budget(m.getBudget())
                .revenue(m.getRevenue())
                .contentType(contentType)
                .trailerUrl(m.getTrailerUrl())
                .ottProviders(m.getOttProviders())
                .collection(m.getCollection())
                .recommendations(m.getRecommendations())
                .topReview(m.getTopReview())
                .tagline(m.getTagline())
                .originalTitle(m.getOriginalTitle())
                .originalLanguage(m.getOriginalLanguage())
                .productionCountries(m.getProductionCountries())
                .productionCompanies(m.getProductionCompanies())
                .imdbId(m.getImdbId())
                .voteCount(m.getVoteCount())
                .spokenLanguages(m.getSpokenLanguages())
                .homepage(m.getHomepage())
                .movieNameEn(m.getMovieNameEn())
                .overviewEn(m.getOverviewEn())
                .taglineEn(m.getTaglineEn())
                .posterPathEn(m.getPosterPathEn())
                .backdropPathEn(m.getBackdropPathEn())
                .movieNameJa(m.getMovieNameJa())
                .overviewJa(m.getOverviewJa())
                .taglineJa(m.getTaglineJa())
                .posterPathJa(m.getPosterPathJa())
                .backdropPathJa(m.getBackdropPathJa())
                .movieNameZh(m.getMovieNameZh())
                .overviewZh(m.getOverviewZh())
                .taglineZh(m.getTaglineZh())
                .posterPathZh(m.getPosterPathZh())
                .backdropPathZh(m.getBackdropPathZh())
                .movieNameNe(m.getMovieNameNe())
                .overviewNe(m.getOverviewNe())
                .taglineNe(m.getTaglineNe())
                .posterPathNe(m.getPosterPathNe())
                .backdropPathNe(m.getBackdropPathNe())
                .movieNamePt(m.getMovieNamePt())
                .overviewPt(m.getOverviewPt())
                .taglinePt(m.getTaglinePt())
                .posterPathPt(m.getPosterPathPt())
                .backdropPathPt(m.getBackdropPathPt())
                .build();
    }
}
