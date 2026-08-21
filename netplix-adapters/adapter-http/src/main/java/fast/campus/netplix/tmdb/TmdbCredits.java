package fast.campus.netplix.tmdb;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import java.util.List;

@Getter
@JsonIgnoreProperties(ignoreUnknown = true)
public class TmdbCredits {
    private List<Cast> cast;
    private List<Crew> crew;
    
    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Cast {
        private String name;
        private String character;
        private Integer order;
    }
    
    @Getter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Crew {
        private String name;
        private String job;
        private String department;
    }
    
    public String getTopCast(int limit) {
        if (cast == null || cast.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        int count = 0;
        for (Cast actor : cast) {
            if (count >= limit) break;
            if (count > 0) sb.append(", ");
            sb.append(actor.getName());
            count++;
        }
        return sb.toString();
    }
    
    public String getDirector() {
        if (crew == null) {
            return null;
        }
        return crew.stream()
                .filter(c -> "Director".equals(c.getJob()))
                .map(Crew::getName)
                .findFirst()
                .orElse(null);
    }
}
