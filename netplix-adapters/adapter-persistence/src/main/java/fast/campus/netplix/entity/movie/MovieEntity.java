package fast.campus.netplix.entity.movie;

import fast.campus.netplix.entity.audit.MutableBaseEntity;
import fast.campus.netplix.movie.NetplixMovie;
import io.micrometer.common.util.StringUtils;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Entity
@Table(name = "movies")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class MovieEntity extends MutableBaseEntity {
    @Id
    @Column(name = "MOVIE_ID")
    private String movieId;

    @Column(name = "MOVIE_NAME")
    private String movieName;

    @Column(name = "IS_ADULT")
    private Boolean isAdult;

    @Column(name = "GENRE")
    private String genre;

    @Column(name = "OVERVIEW")
    private String overview;

    @Column(name = "RELEASED_AT")
    private String releasedAt;

    @Column(name = "POSTER_PATH")
    private String posterPath;

    @Column(name = "BACKDROP_PATH")
    private String backdropPath;

    @Column(name = "VOTE_AVERAGE")
    private Double voteAverage;

    @Column(name = "CAST", length = 500)
    private String cast;

    @Column(name = "DIRECTOR")
    private String director;

    @Column(name = "RUNTIME")
    private Integer runtime;

    @Column(name = "RELEASE_DATE")
    private String releaseDate;

    @Column(name = "CERTIFICATION")
    private String certification;

    @Column(name = "BUDGET")
    private Long budget;

    @Column(name = "REVENUE")
    private Long revenue;

    @Column(name = "CONTENT_TYPE")
    private String contentType;

    @Column(name = "TRAILER_URL", length = 500)
    private String trailerUrl;

    @Column(name = "OTT_PROVIDERS", length = 500)
    private String ottProviders;

    @Column(name = "COLLECTION_NAME", length = 500)
    private String collectionName;

    @Column(name = "RECOMMENDATIONS", columnDefinition = "TEXT")
    private String recommendations;

    @Column(name = "TOP_REVIEW", columnDefinition = "TEXT")
    private String topReview;

    @Column(name = "TAGLINE", length = 500)
    private String tagline;

    @Column(name = "ORIGINAL_TITLE", length = 500)
    private String originalTitle;

    @Column(name = "ORIGINAL_LANGUAGE", length = 10)
    private String originalLanguage;

    @Column(name = "PRODUCTION_COUNTRIES", length = 255)
    private String productionCountries;

    @Column(name = "PRODUCTION_COMPANIES", length = 500)
    private String productionCompanies;

    @Column(name = "IMDB_ID", length = 20)
    private String imdbId;

    @Column(name = "VOTE_COUNT")
    private Integer voteCount;

    @Column(name = "SPOKEN_LANGUAGES", length = 255)
    private String spokenLanguages;

    @Column(name = "HOMEPAGE", length = 500)
    private String homepage;

    @Column(name = "MOVIE_NAME_EN", length = 500)
    private String movieNameEn;

    @Column(name = "OVERVIEW_EN", columnDefinition = "TEXT")
    private String overviewEn;

    @Column(name = "TAGLINE_EN", length = 500)
    private String taglineEn;

    @Column(name = "POSTER_PATH_EN", length = 500)
    private String posterPathEn;

    @Column(name = "BACKDROP_PATH_EN", length = 500)
    private String backdropPathEn;

    @Setter
    @Column(name = "FIRST_SEEN_AT")
    private LocalDateTime firstSeenAt;

    public NetplixMovie toDomain() {
        return NetplixMovie.builder()
                .movieName(this.movieName)
                .isAdult(this.isAdult)
                .genre(this.genre)
                .overview(this.overview)
                .releasedAt(this.releasedAt)
                .posterPath(this.posterPath)
                .backdropPath(this.backdropPath)
                .voteAverage(this.voteAverage)
                .cast(this.cast)
                .director(this.director)
                .runtime(this.runtime)
                .releaseDate(this.releaseDate)
                .certification(this.certification)
                .budget(this.budget)
                .revenue(this.revenue)
                .contentType(this.contentType)
                .trailerUrl(this.trailerUrl)
                .ottProviders(this.ottProviders)
                .collection(this.collectionName)
                .recommendations(this.recommendations)
                .topReview(this.topReview)
                .tagline(this.tagline)
                .originalTitle(this.originalTitle)
                .originalLanguage(this.originalLanguage)
                .productionCountries(this.productionCountries)
                .productionCompanies(this.productionCompanies)
                .imdbId(this.imdbId)
                .voteCount(this.voteCount)
                .spokenLanguages(this.spokenLanguages)
                .homepage(this.homepage)
                .movieNameEn(this.movieNameEn)
                .overviewEn(this.overviewEn)
                .taglineEn(this.taglineEn)
                .posterPathEn(this.posterPathEn)
                .backdropPathEn(this.backdropPathEn)
                .firstSeenAt(this.firstSeenAt)
                .build();
    }

    public static MovieEntity toEntity(NetplixMovie netplixMovie) {
        return new MovieEntity(
                UUID.randomUUID().toString(),
                netplixMovie.getMovieName(),
                netplixMovie.getIsAdult(),
                netplixMovie.getGenre(),
                getSubstrOverview(netplixMovie.getOverview()),
                netplixMovie.getReleasedAt(),
                netplixMovie.getPosterPath(),
                netplixMovie.getBackdropPath(),
                netplixMovie.getVoteAverage(),
                netplixMovie.getCast(),
                netplixMovie.getDirector(),
                netplixMovie.getRuntime(),
                netplixMovie.getReleaseDate(),
                netplixMovie.getCertification(),
                netplixMovie.getBudget(),
                netplixMovie.getRevenue(),
                netplixMovie.getContentType(),
                netplixMovie.getTrailerUrl(),
                netplixMovie.getOttProviders(),
                netplixMovie.getCollection(),
                netplixMovie.getRecommendations(),
                netplixMovie.getTopReview(),
                netplixMovie.getTagline(),
                netplixMovie.getOriginalTitle(),
                netplixMovie.getOriginalLanguage(),
                netplixMovie.getProductionCountries(),
                netplixMovie.getProductionCompanies(),
                netplixMovie.getImdbId(),
                netplixMovie.getVoteCount(),
                netplixMovie.getSpokenLanguages(),
                netplixMovie.getHomepage(),
                netplixMovie.getMovieNameEn(),
                truncateOrNull(netplixMovie.getOverviewEn()),
                netplixMovie.getTaglineEn(),
                netplixMovie.getPosterPathEn(),
                netplixMovie.getBackdropPathEn(),
                netplixMovie.getFirstSeenAt() != null ? netplixMovie.getFirstSeenAt() : LocalDateTime.now()
        );
    }

    private static String getSubstrOverview(String overview) {
        if (StringUtils.isBlank(overview)) {
            return "No description available.";
        }

        return overview.substring(0, Math.min(overview.length(), 200));
    }

    private static String truncateOrNull(String text) {
        if (StringUtils.isBlank(text)) return null;
        return text.length() > 500 ? text.substring(0, 500) : text;
    }

}
