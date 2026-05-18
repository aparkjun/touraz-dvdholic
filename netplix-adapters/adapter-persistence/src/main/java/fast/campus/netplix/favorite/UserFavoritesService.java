package fast.campus.netplix.favorite;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.entity.favorite.UserFavoriteShareEntity;
import fast.campus.netplix.entity.favorite.UserFavoriteVisitEntity;
import fast.campus.netplix.entity.favorite.UserTravelFavoriteEntity;
import fast.campus.netplix.entity.movie.UserMovieLikeEntity;
import fast.campus.netplix.movie.NetplixMovie;
import fast.campus.netplix.movie.PersistenceMoviePort;
import fast.campus.netplix.movie.UserMovieLike;
import fast.campus.netplix.notification.NotificationUseCase;
import fast.campus.netplix.repository.favorite.UserFavoriteShareJpaRepository;
import fast.campus.netplix.repository.favorite.UserFavoriteVisitJpaRepository;
import fast.campus.netplix.repository.favorite.UserTravelFavoriteJpaRepository;
import fast.campus.netplix.repository.movie.UserMovieLikeJpaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserFavoritesService {

    private static final int SHARE_TTL_DAYS = 30;
    private static final int RECOMMEND_LIMIT = 12;

    private final UserMovieLikeJpaRepository likeJpa;
    private final UserFavoriteVisitJpaRepository visitJpa;
    private final UserFavoriteShareJpaRepository shareJpa;
    private final UserTravelFavoriteJpaRepository travelJpa;
    private final PersistenceMoviePort moviePort;
    private final MovieRegionMappingPort mappingPort;
    private final NotificationUseCase notificationUseCase;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public FavoritesHubResponse getHub(String userId, String voteFilter, String sort) {
        List<UserMovieLikeEntity> rows = likeJpa.findByUserIdOrderBySortOrderAscModifiedAtDesc(userId);
        rows = filterByVote(rows, voteFilter);
        rows = sortRows(rows, sort);

        Set<String> visited = visitJpa.findByUserId(userId).stream()
                .map(UserFavoriteVisitEntity::getVisitKey)
                .collect(Collectors.toSet());

        List<FavoriteMovieCard> cards = new ArrayList<>();
        int totalRegions = 0;
        Map<String, Integer> regionCounts = new HashMap<>();

        for (UserMovieLikeEntity row : rows) {
            NetplixMovie movie = moviePort.findBy(row.getMovieId());
            if (movie == null) continue;
            List<MovieRegionMapping> mappings = mappingPort.findByMovieName(row.getMovieId());
            int regionCount = mappings != null ? mappings.size() : 0;
            totalRegions += regionCount;
            if (mappings != null) {
                for (MovieRegionMapping m : mappings) {
                    if (m.getRegionName() != null) {
                        regionCounts.merge(m.getRegionName(), 1, Integer::sum);
                    }
                }
            }
            List<RegionSpot> spots = buildSpots(row.getMovieId(), row.getContentType(), mappings, visited);
            int visitedCount = (int) spots.stream().filter(RegionSpot::visited).count();

            cards.add(new FavoriteMovieCard(
                    movie,
                    row.getContentType(),
                    row.getVoteType() != null ? row.getVoteType()
                            : (Boolean.TRUE.equals(row.getLikeYn()) ? UserMovieLike.VOTE_LIKE : UserMovieLike.VOTE_UNLIKE),
                    row.getMemo(),
                    row.getPlannedDate() != null ? row.getPlannedDate().toString() : null,
                    parseTags(row.getTagsJson()),
                    row.getSortOrder() != null ? row.getSortOrder() : 0,
                    regionCount,
                    visitedCount,
                    spots
            ));
        }

        List<TravelFavoriteItem> travelItems = travelJpa.findByUserIdOrderByModifiedAtDesc(userId).stream()
                .map(t -> new TravelFavoriteItem(t.getItemType(), t.getItemId(), t.getSnapshotJson()))
                .toList();

        return new FavoritesHubResponse(
                cards,
                travelItems,
                new FavoritesStats(cards.size(), totalRegions, regionCounts, visited.size()),
                visited
        );
    }

    @Transactional
    public void updateMeta(String userId, String movieId, String contentType, String memo,
                           LocalDate plannedDate, List<String> tags, Integer sortOrder, boolean clearPlannedDate) {
        UserMovieLikeEntity entity = likeJpa
                .findByUserIdAndMovieIdAndContentType(userId, movieId, contentType)
                .orElseThrow(() -> new IllegalArgumentException("vote not found"));
        if (clearPlannedDate) {
            entity.updateMeta(memo, null, tags != null ? writeTags(tags) : null, sortOrder);
        } else {
            entity.updateMeta(memo, plannedDate, tags != null ? writeTags(tags) : null, sortOrder);
        }
        likeJpa.save(entity);
    }

    @Transactional
    public void setVisited(String userId, String visitKey, boolean visited) {
        if (visited) {
            if (visitJpa.findById(new UserFavoriteVisitEntity.Pk(userId, visitKey)).isEmpty()) {
                visitJpa.save(new UserFavoriteVisitEntity(userId, visitKey, LocalDateTime.now()));
            }
        } else {
            visitJpa.deleteByUserIdAndVisitKey(userId, visitKey);
        }
    }

    @Transactional
    public List<TravelFavoriteItem> syncTravel(String userId, List<TravelFavoriteItem> items) {
        if (items == null) return List.of();
        for (TravelFavoriteItem item : items) {
            if (item.itemType() == null || item.itemId() == null) continue;
            travelJpa.findByUserIdAndItemTypeAndItemId(userId, item.itemType(), item.itemId())
                    .ifPresentOrElse(
                            e -> {
                                if (item.snapshotJson() != null) {
                                    e.updateSnapshot(item.snapshotJson());
                                    travelJpa.save(e);
                                }
                            },
                            () -> travelJpa.save(UserTravelFavoriteEntity.createNew(
                                    UUID.randomUUID().toString(), userId, item.itemType(), item.itemId(), item.snapshotJson()))
                    );
        }
        return travelJpa.findByUserIdOrderByModifiedAtDesc(userId).stream()
                .map(t -> new TravelFavoriteItem(t.getItemType(), t.getItemId(), t.getSnapshotJson()))
                .toList();
    }

    @Transactional
    public String createShare(String userId) {
        FavoritesHubResponse hub = getHub(userId, "like", "sortOrder");
        try {
            String payload = objectMapper.writeValueAsString(hub);
            String token = randomToken();
            shareJpa.save(UserFavoriteShareEntity.createNew(
                    UUID.randomUUID().toString(),
                    userId,
                    token,
                    payload,
                    LocalDateTime.now().plusDays(SHARE_TTL_DAYS)));
            return token;
        } catch (Exception e) {
            throw new IllegalStateException("share failed", e);
        }
    }

    @Transactional(readOnly = true)
    public FavoritesHubResponse getShare(String token) {
        UserFavoriteShareEntity share = shareJpa.findByShareToken(token)
                .orElseThrow(() -> new IllegalArgumentException("share not found"));
        if (share.getExpiresAt() != null && share.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("share expired");
        }
        try {
            return objectMapper.readValue(share.getPayloadJson(), FavoritesHubResponse.class);
        } catch (Exception e) {
            throw new IllegalStateException("invalid share payload", e);
        }
    }

    @Transactional(readOnly = true)
    public CourseSuggestion suggestCourse(String userId, List<String> movieNames) {
        List<String> names = movieNames != null && !movieNames.isEmpty()
                ? movieNames
                : likeJpa.findLikedMovieIdsByUserId(userId);
        if (names.isEmpty()) {
            return new CourseSuggestion(List.of(), "찜한 영화가 없습니다.");
        }

        LinkedHashMap<String, CourseStop> stopsByRegion = new LinkedHashMap<>();
        for (String name : names.stream().limit(5).toList()) {
            List<MovieRegionMapping> mappings = mappingPort.findByMovieName(name);
            if (mappings == null) continue;
            for (MovieRegionMapping m : mappings) {
                String key = m.getAreaCode() + "|" + m.getRegionName();
                stopsByRegion.putIfAbsent(key, new CourseStop(
                        m.getRegionName(), m.getAreaCode(), m.getMappingType(), name, m.getEvidence()));
            }
        }
        List<CourseStop> stops = new ArrayList<>(stopsByRegion.values());
        if (stops.size() > 8) stops = stops.subList(0, 8);
        String summary = stops.isEmpty()
                ? "매핑된 촬영지가 없어 코스를 만들 수 없어요."
                : String.format("%d개 지역 · %d편 영화 기반 당일~1박2일 코스 초안", stops.size(), Math.min(names.size(), 5));
        return new CourseSuggestion(stops, summary);
    }

    @Transactional(readOnly = true)
    public List<NetplixMovie> recommend(String userId) {
        List<String> likedIds = likeJpa.findLikedMovieIdsByUserId(userId);
        if (likedIds.isEmpty()) return List.of();

        Set<String> genres = new LinkedHashSet<>();
        for (String id : likedIds) {
            NetplixMovie m = moviePort.findBy(id);
            if (m != null && m.getGenre() != null) {
                for (String g : m.getGenre().split("[,/|]")) {
                    String t = g.trim();
                    if (!t.isEmpty()) genres.add(t);
                }
            }
        }
        if (genres.isEmpty()) {
            return moviePort.fetchByContentType("movie", 0, RECOMMEND_LIMIT);
        }
        List<NetplixMovie> out = new ArrayList<>();
        for (String genre : genres) {
            if (out.size() >= RECOMMEND_LIMIT) break;
            out.addAll(moviePort.fetchByGenresExcludingMovieNames(
                    "movie", List.of(genre), likedIds, RECOMMEND_LIMIT - out.size()));
        }
        return out.stream().limit(RECOMMEND_LIMIT).toList();
    }

    @Transactional
    public int syncFavoriteNotifications(String userId) {
        int sent = 0;
        for (NetplixMovie m : recommend(userId).stream().limit(3).toList()) {
            try {
                notificationUseCase.sendRecommendationNotification(userId, m.getMovieName(), m.getMovieName());
                sent++;
            } catch (Exception e) {
                log.debug("recommendation notification skip: {}", e.getMessage());
            }
        }
        return sent;
    }

    public static String visitKey(String contentType, String movieName, String areaCode) {
        return "movie:" + contentType + ":" + movieName + ":" + areaCode;
    }

    private List<RegionSpot> buildSpots(String movieName, String contentType,
                                        List<MovieRegionMapping> mappings, Set<String> visited) {
        if (mappings == null) return List.of();
        List<RegionSpot> spots = new ArrayList<>();
        for (MovieRegionMapping m : mappings) {
            String key = visitKey(contentType, movieName, m.getAreaCode());
            spots.add(new RegionSpot(
                    m.getRegionName(), m.getAreaCode(), m.getMappingType(), m.getEvidence(), key, visited.contains(key)));
        }
        return spots;
    }

    private List<UserMovieLikeEntity> filterByVote(List<UserMovieLikeEntity> rows, String voteFilter) {
        if (voteFilter == null || voteFilter.isBlank() || "all".equalsIgnoreCase(voteFilter)) {
            return rows;
        }
        return rows.stream().filter(r -> voteFilter.equalsIgnoreCase(
                r.getVoteType() != null ? r.getVoteType()
                        : (Boolean.TRUE.equals(r.getLikeYn()) ? UserMovieLike.VOTE_LIKE : UserMovieLike.VOTE_UNLIKE)
        )).toList();
    }

    private List<UserMovieLikeEntity> sortRows(List<UserMovieLikeEntity> rows, String sort) {
        if ("title".equalsIgnoreCase(sort)) {
            return rows.stream()
                    .sorted(Comparator.comparing(UserMovieLikeEntity::getMovieId, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        }
        if ("regions".equalsIgnoreCase(sort)) {
            return rows.stream().sorted((a, b) -> Integer.compare(
                    mappingPort.findByMovieName(b.getMovieId()).size(),
                    mappingPort.findByMovieName(a.getMovieId()).size()
            )).toList();
        }
        return rows;
    }

    private List<String> parseTags(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String writeTags(List<String> tags) {
        try {
            return objectMapper.writeValueAsString(tags != null ? tags : List.of());
        } catch (Exception e) {
            return "[]";
        }
    }

    private static String randomToken() {
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public record FavoriteMovieCard(
            NetplixMovie movie, String contentType, String voteType, String memo, String plannedDate,
            List<String> tags, int sortOrder, int regionCount, int visitedCount, List<RegionSpot> spots) {}

    public record RegionSpot(
            String regionName, String areaCode, String mappingType, String evidence, String visitKey, boolean visited) {}

    public record TravelFavoriteItem(String itemType, String itemId, String snapshotJson) {}

    public record FavoritesStats(int movieCount, int totalRegions, Map<String, Integer> regionCounts, int visitedCount) {}

    public record FavoritesHubResponse(
            List<FavoriteMovieCard> movies, List<TravelFavoriteItem> travel,
            FavoritesStats stats, Set<String> visitKeys) {}

    public record CourseStop(String regionName, String areaCode, String mappingType, String movieName, String evidence) {}

    public record CourseSuggestion(List<CourseStop> stops, String summary) {}
}
