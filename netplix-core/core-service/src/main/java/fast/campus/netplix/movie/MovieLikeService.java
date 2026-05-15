package fast.campus.netplix.movie;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MovieLikeService implements LikeMovieUseCase {

    private final LikeMoviePort likeMoviePort;
    private final PersistenceMoviePort persistenceMoviePort;

    @Override
    public Boolean like(String userId, String movieId, String contentType) {
        log.info("좋아요 요청 - userId: {}, movieId: {}, contentType: {}", userId, movieId, contentType);

        Optional<UserMovieLike> existing = likeMoviePort.findByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
        if (existing.isPresent() && UserMovieLike.VOTE_LIKE.equals(existing.get().getVoteType())) {
            likeMoviePort.deleteByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
            log.info("좋아요 토글 취소");
            return true;
        }

        if (existing.isPresent()) {
            UserMovieLike record = existing.get();
            record.like();
            likeMoviePort.save(record);
        } else {
            likeMoviePort.save(UserMovieLike.newLike(userId, movieId, contentType));
        }
        log.info("좋아요 저장 완료");
        return true;
    }

    @Override
    public Boolean unlike(String userId, String movieId, String contentType) {
        log.info("싫어요 요청 - userId: {}, movieId: {}, contentType: {}", userId, movieId, contentType);

        Optional<UserMovieLike> existing = likeMoviePort.findByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
        if (existing.isPresent() && UserMovieLike.VOTE_UNLIKE.equals(existing.get().getVoteType())) {
            likeMoviePort.deleteByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
            log.info("싫어요 토글 취소");
            return true;
        }

        if (existing.isPresent()) {
            UserMovieLike record = existing.get();
            record.unlike();
            likeMoviePort.save(record);
        } else {
            likeMoviePort.save(UserMovieLike.newUnlike(userId, movieId, contentType));
        }
        log.info("싫어요 저장 완료");
        return true;
    }

    @Override
    public Boolean meh(String userId, String movieId, String contentType) {
        log.info("꿀꿀해 요청 - userId: {}, movieId: {}, contentType: {}", userId, movieId, contentType);

        Optional<UserMovieLike> existing = likeMoviePort.findByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
        if (existing.isPresent() && UserMovieLike.VOTE_MEH.equals(existing.get().getVoteType())) {
            likeMoviePort.deleteByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
            log.info("꿀꿀해 토글 취소");
            return true;
        }

        if (existing.isPresent()) {
            UserMovieLike record = existing.get();
            record.meh();
            likeMoviePort.save(record);
        } else {
            likeMoviePort.save(UserMovieLike.newMeh(userId, movieId, contentType));
        }
        log.info("꿀꿀해 저장 완료");
        return true;
    }
    
    @Override
    public Long getLikeCount(String movieId, String contentType) {
        Long count = likeMoviePort.countLikesByMovieIdAndContentType(movieId, contentType);
        log.info("좋아요 카운트 조회 - movieId: {}, contentType: {}, count: {}", movieId, contentType, count);
        return count;
    }
    
    @Override
    public Long getUnlikeCount(String movieId, String contentType) {
        Long count = likeMoviePort.countUnlikesByMovieIdAndContentType(movieId, contentType);
        log.info("싫어요 카운트 조회 - movieId: {}, contentType: {}, count: {}", movieId, contentType, count);
        return count;
    }

    @Override
    public Long getMehCount(String movieId, String contentType) {
        Long count = likeMoviePort.countMehsByMovieIdAndContentType(movieId, contentType);
        log.info("꿀꿀해 카운트 조회 - movieId: {}, contentType: {}, count: {}", movieId, contentType, count);
        return count;
    }

    @Override
    public String getMyVote(String userId, String movieId, String contentType) {
        return likeMoviePort.findByUserIdAndMovieIdAndContentType(userId, movieId, contentType)
                .map(UserMovieLike::getVoteType)
                .orElse(null);
    }

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Override
    public List<NetplixMovie> getTodayPopular(String contentType, int limit) {
        return getPopular("today", contentType, limit);
    }

    @Override
    public List<NetplixMovie> getPopular(String period, String contentType, int limit) {
        LocalDate today = LocalDate.now(KST);
        LocalDate since;
        switch (period == null ? "today" : period) {
            case "week":
                since = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                break;
            case "month":
                since = today.withDayOfMonth(1);
                break;
            default:
                since = today;
                break;
        }
        LocalDateTime sinceUtc = since.atStartOfDay(KST)
                .withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        List<String> movieIds = "movie".equalsIgnoreCase(contentType == null ? "" : contentType)
                ? likeMoviePort.findTopLikedMovieIdsSinceCombiningMovieAndDvd(sinceUtc, limit)
                : likeMoviePort.findTopLikedMovieIdsSince(contentType, sinceUtc, limit);
        if (movieIds == null || movieIds.isEmpty()) return List.of();
        List<NetplixMovie> movies = persistenceMoviePort.fetchByMovieNames(movieIds);
        return movieIds.stream()
                .flatMap(id -> movies.stream().filter(m -> id.equals(m.getMovieName())).limit(1))
                .toList();
    }

    @Override
    public int reassignUserMovieLikesToUser(String fromUserId, String toUserId) {
        int n = likeMoviePort.reassignUserMovieLikesToUser(fromUserId, toUserId);
        if (n > 0) {
            log.info("찜·투표 이전 완료 fromUserId={} → toUserId={} (갱신 행: {})", fromUserId, toUserId, n);
        }
        return n;
    }
}
