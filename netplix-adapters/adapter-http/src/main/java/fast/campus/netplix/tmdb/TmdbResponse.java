package fast.campus.netplix.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;

import java.util.List;

@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbResponse {
    private TmdbDateResponse dates;
    private String page;
    private String total_pages;
    private String total_results;
    private List<TmdbMovieNowPlaying> results;
}
