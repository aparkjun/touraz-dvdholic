package fast.campus.netplix.controller.favorite;

import fast.campus.netplix.authentication.token.JwtTokenProvider;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.favorite.UserFavoritesService;
import fast.campus.netplix.favorite.UserFavoritesService.*;
import fast.campus.netplix.movie.NetplixMovie;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class UserFavoritesController {

    private final UserFavoritesService favoritesService;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping("/api/v1/user/me/favorites/hub")
    public NetplixApiResponse<FavoritesHubResponse> hub(
            @RequestParam(defaultValue = "like") String vote,
            @RequestParam(defaultValue = "sortOrder") String sort) {
        String userId = jwtTokenProvider.getUserId();
        return NetplixApiResponse.ok(favoritesService.getHub(userId, vote, sort));
    }

    @PatchMapping("/api/v1/user/me/favorites/movies/{movieId}")
    public NetplixApiResponse<Void> updateMeta(
            @PathVariable String movieId,
            @RequestBody FavoriteMetaRequest body) {
        String userId = jwtTokenProvider.getUserId();
        String ct = body.contentType() != null ? body.contentType() : "dvd";
        favoritesService.updateMeta(
                userId, movieId, ct, body.memo(), body.plannedDate(),
                body.tags(), body.sortOrder(), Boolean.TRUE.equals(body.clearPlannedDate()));
        return NetplixApiResponse.ok(null);
    }

    @PutMapping("/api/v1/user/me/favorites/visits/{visitKey}")
    public NetplixApiResponse<Void> setVisit(
            @PathVariable String visitKey,
            @RequestParam(defaultValue = "true") boolean visited) {
        favoritesService.setVisited(jwtTokenProvider.getUserId(), visitKey, visited);
        return NetplixApiResponse.ok(null);
    }

    @PostMapping("/api/v1/user/me/favorites/travel/sync")
    public NetplixApiResponse<List<TravelFavoriteItem>> syncTravel(@RequestBody TravelSyncRequest body) {
        return NetplixApiResponse.ok(
                favoritesService.syncTravel(jwtTokenProvider.getUserId(), body.items()));
    }

    @PostMapping("/api/v1/user/me/favorites/share")
    public NetplixApiResponse<Map<String, String>> createShare() {
        String token = favoritesService.createShare(jwtTokenProvider.getUserId());
        return NetplixApiResponse.ok(Map.of("token", token));
    }

    @GetMapping("/api/v1/favorites/share/{token}")
    public NetplixApiResponse<FavoritesHubResponse> getShare(@PathVariable String token) {
        return NetplixApiResponse.ok(favoritesService.getShare(token));
    }

    @GetMapping("/api/v1/user/me/favorites/course")
    public NetplixApiResponse<CourseSuggestion> course(
            @RequestParam(required = false) List<String> movieNames) {
        return NetplixApiResponse.ok(
                favoritesService.suggestCourse(jwtTokenProvider.getUserId(), movieNames));
    }

    @GetMapping("/api/v1/user/me/favorites/recommendations")
    public NetplixApiResponse<List<NetplixMovie>> recommendations() {
        return NetplixApiResponse.ok(favoritesService.recommend(jwtTokenProvider.getUserId()));
    }

    @PostMapping("/api/v1/user/me/favorites/notifications/sync")
    public NetplixApiResponse<Map<String, Integer>> syncNotifications() {
        int sent = favoritesService.syncFavoriteNotifications(jwtTokenProvider.getUserId());
        return NetplixApiResponse.ok(Map.of("sent", sent));
    }

    public record FavoriteMetaRequest(
            String contentType,
            String memo,
            LocalDate plannedDate,
            Boolean clearPlannedDate,
            List<String> tags,
            Integer sortOrder
    ) {}

    public record TravelSyncRequest(List<TravelFavoriteItem> items) {}
}
