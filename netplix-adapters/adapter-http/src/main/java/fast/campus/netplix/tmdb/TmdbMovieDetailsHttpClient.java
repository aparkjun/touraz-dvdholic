package fast.campus.netplix.tmdb;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Slf4j
@Component
@RequiredArgsConstructor
public class TmdbMovieDetailsHttpClient {
    private final ObjectMapper objectMapper;

    @Value("${tmdb.api.movie-details}")
    private String movieDetailsUrl;

    @Value("${tmdb.api.movie-credits}")
    private String movieCreditsUrl;

    @Value("${tmdb.api.movie-release-dates}")
    private String movieReleaseDatesUrl;

    @Value("${tmdb.api.movie-videos}")
    private String movieVideosUrl;

    @Value("${tmdb.api.movie-providers}")
    private String movieProvidersUrl;

    @Value("${tmdb.api.movie-recommendations}")
    private String movieRecommendationsUrl;

    @Value("${tmdb.api.movie-reviews}")
    private String movieReviewsUrl;

    private RestClient createRestClientWithTimeout() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(30));
        
        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }

    public TmdbMovieDetails fetchMovieDetails(Integer movieId) {
        try {
            log.debug("→ Fetching details for movieId: {}", movieId);
            String url = movieDetailsUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            TmdbMovieDetails result = objectMapper.readValue(response, TmdbMovieDetails.class);
            log.debug("✓ Details fetched for movieId: {}", movieId);
            return result;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch details for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public TmdbMovieDetails fetchMovieDetailsEn(Integer movieId) {
        return fetchMovieDetailsForLanguage(movieId, "en-US", "EN");
    }

    public TmdbMovieDetails fetchMovieDetailsNe(Integer movieId) {
        return fetchMovieDetailsForLanguage(movieId, "ne-NP", "NE");
    }

    private TmdbMovieDetails fetchMovieDetailsForLanguage(Integer movieId, String languageTag, String logLabel) {
        try {
            log.debug("→ Fetching {} details for movieId: {}", logLabel, movieId);
            String url = movieDetailsUrl.replace("{movie_id}", String.valueOf(movieId))
                    .replace("language=ko-KR", "language=" + languageTag);
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            TmdbMovieDetails result = objectMapper.readValue(response, TmdbMovieDetails.class);
            log.debug("✓ {} details fetched for movieId: {}", logLabel, movieId);
            return result;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch {} details for movieId: {} - {}", logLabel, movieId, e.getMessage());
            return null;
        }
    }

    public TmdbMovieDetails fetchMovieDetailsJa(Integer movieId) {
        try {
            log.debug("→ Fetching JA details for movieId: {}", movieId);
            String url = movieDetailsUrl.replace("{movie_id}", String.valueOf(movieId))
                    .replace("language=ko-KR", "language=ja-JP");
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            TmdbMovieDetails result = objectMapper.readValue(response, TmdbMovieDetails.class);
            log.debug("✓ JA details fetched for movieId: {}", movieId);
            return result;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch JA details for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public TmdbMovieDetails fetchMovieDetailsZh(Integer movieId) {
        try {
            log.debug("→ Fetching ZH details for movieId: {}", movieId);
            String url = movieDetailsUrl.replace("{movie_id}", String.valueOf(movieId))
                    .replace("language=ko-KR", "language=zh-CN");
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            TmdbMovieDetails result = objectMapper.readValue(response, TmdbMovieDetails.class);
            log.debug("✓ ZH details fetched for movieId: {}", movieId);
            return result;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch ZH details for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public TmdbCredits fetchMovieCredits(Integer movieId) {
        try {
            log.debug("→ Fetching credits for movieId: {}", movieId);
            String url = movieCreditsUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            TmdbCredits result = objectMapper.readValue(response, TmdbCredits.class);
            log.debug("✓ Credits fetched for movieId: {}", movieId);
            return result;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch credits for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    // Certification API removed - too slow and causes batch to hang

    public String fetchMovieTrailer(Integer movieId) {
        try {
            log.debug("→ Fetching trailer for movieId: {}", movieId);
            String url = movieVideosUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            // Extract YouTube trailer key from response
            if (response != null && response.contains("\"key\":")) {
                String[] parts = response.split("\"key\":\"");
                if (parts.length > 1) {
                    String key = parts[1].split("\"")[0];
                    log.debug("✓ Trailer found for movieId: {}", movieId);
                    return "https://www.youtube.com/watch?v=" + key;
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch trailer for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public String fetchOttProviders(Integer movieId) {
        try {
            log.debug("→ Fetching OTT providers for movieId: {}", movieId);
            String url = movieProvidersUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            // Extract provider names for KR region
            if (response != null && response.contains("\"KR\"")) {
                StringBuilder providers = new StringBuilder();
                if (response.contains("\"provider_name\":\"Netflix\"")) providers.append("Netflix, ");
                if (response.contains("\"provider_name\":\"Disney Plus\"")) providers.append("Disney+, ");
                if (response.contains("\"provider_name\":\"Watcha\"")) providers.append("Watcha, ");
                if (response.contains("\"provider_name\":\"wavve\"")) providers.append("Wavve, ");
                if (response.contains("\"provider_name\":\"Apple TV Plus\"")) providers.append("Apple TV+, ");
                
                if (providers.length() > 0) {
                    providers.setLength(providers.length() - 2); // Remove trailing ", "
                    log.debug("✓ OTT providers found for movieId: {}", movieId);
                    return providers.toString();
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch OTT providers for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public String fetchRecommendations(Integer movieId) {
        try {
            log.debug("→ Fetching recommendations for movieId: {}", movieId);
            String url = movieRecommendationsUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            // Extract top 5 movie titles
            if (response != null && response.contains("\"title\":")) {
                String[] titles = response.split("\"title\":\"");
                StringBuilder recommendations = new StringBuilder();
                int count = 0;
                for (int i = 1; i < titles.length && count < 5; i++) {
                    String title = titles[i].split("\"")[0];
                    recommendations.append(title).append(", ");
                    count++;
                }
                
                if (recommendations.length() > 0) {
                    recommendations.setLength(recommendations.length() - 2); // Remove trailing ", "
                    log.debug("✓ Recommendations found for movieId: {}", movieId);
                    return recommendations.toString();
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch recommendations for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }

    public String fetchTopReview(Integer movieId) {
        try {
            log.debug("→ Fetching reviews for movieId: {}", movieId);
            String url = movieReviewsUrl.replace("{movie_id}", String.valueOf(movieId));
            String response = createRestClientWithTimeout()
                    .get()
                    .uri(url)
                    .retrieve()
                    .body(String.class);

            // Extract first review content
            if (response != null && response.contains("\"content\":\"")) {
                String[] parts = response.split("\"content\":\"");
                if (parts.length > 1) {
                    String content = parts[1].split("\"")[0];
                    // Limit to 200 characters
                    if (content.length() > 200) {
                        content = content.substring(0, 200) + "...";
                    }
                    log.debug("✓ Review found for movieId: {}", movieId);
                    return content;
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("✗ Failed to fetch reviews for movieId: {} - {}", movieId, e.getMessage());
            return null;
        }
    }
}
