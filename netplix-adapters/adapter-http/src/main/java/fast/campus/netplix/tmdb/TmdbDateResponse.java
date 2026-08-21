package fast.campus.netplix.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;

@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbDateResponse {
    private String maximum;
    private String minimum;
}
