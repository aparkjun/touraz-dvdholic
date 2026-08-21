package fast.campus.netplix.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbMovieDetails {
    private Integer id;
    private String title;
    private Integer runtime;
    private Long budget;
    private Long revenue;

    @JsonProperty("vote_average")
    private Double voteAverage;

    @JsonProperty("vote_count")
    private Integer voteCount;

    @JsonProperty("release_date")
    private String releaseDate;

    private String tagline;

    @JsonProperty("original_title")
    private String originalTitle;

    @JsonProperty("original_language")
    private String originalLanguage;

    @JsonProperty("imdb_id")
    private String imdbId;

    @JsonProperty("belongs_to_collection")
    private Map<String, Object> belongsToCollection;

    @JsonProperty("production_countries")
    private List<Map<String, String>> productionCountries;

    @JsonProperty("production_companies")
    private List<Map<String, Object>> productionCompanies;

    @JsonProperty("spoken_languages")
    private List<Map<String, String>> spokenLanguages;

    private String overview;

    @JsonProperty("poster_path")
    private String posterPath;

    @JsonProperty("backdrop_path")
    private String backdropPath;

    private String homepage;

    public String getCollectionName() {
        if (belongsToCollection != null && belongsToCollection.get("name") != null) {
            return (String) belongsToCollection.get("name");
        }
        return null;
    }

    public String getProductionCountriesDisplay() {
        if (productionCountries == null || productionCountries.isEmpty()) return null;
        return productionCountries.stream()
                .map(c -> c != null ? c.get("name") : null)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));
    }

    public String getProductionCompaniesDisplay() {
        if (productionCompanies == null || productionCompanies.isEmpty()) return null;
        return productionCompanies.stream()
                .map(c -> c != null && c.get("name") != null ? (String) c.get("name") : null)
                .filter(Objects::nonNull)
                .limit(5)
                .collect(Collectors.joining(", "));
    }

    public String getSpokenLanguagesDisplay() {
        if (spokenLanguages == null || spokenLanguages.isEmpty()) return null;
        return spokenLanguages.stream()
                .map(l -> l != null ? (l.get("english_name") != null ? l.get("english_name") : l.get("name")) : null)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(", "));
    }
}
