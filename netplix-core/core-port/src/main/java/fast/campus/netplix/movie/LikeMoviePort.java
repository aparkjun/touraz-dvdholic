package fast.campus.netplix.movie;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LikeMoviePort {
    UserMovieLike save(UserMovieLike domain);

    Optional<UserMovieLike> findByUserIdAndMovieIdAndContentType(String userId, String movieId, String contentType);

    void deleteByUserIdAndMovieIdAndContentType(String userId, String movieId, String contentType);

    List<String> findLikedMovieIdsByUserId(String userId);
    
    Long countLikesByMovieIdAndContentType(String movieId, String contentType);

    Long countUnlikesByMovieIdAndContentType(String movieId, String contentType);

    Long countMehsByMovieIdAndContentType(String movieId, String contentType);

    List<String> findTopLikedMovieIdsSince(String contentType, LocalDateTime since, int limit);

    /** movie + dvd 좋아요를 합산해 제목별 인기 순 (대시보드 '영화' 주/달·오늘 인기용) */
    List<String> findTopLikedMovieIdsSinceCombiningMovieAndDvd(LocalDateTime since, int limit);

    /**
     * {@code fromUserId} 계정의 찜·투표 행을 {@code toUserId}로 이전한다.
     * 동일 (movieId, contentType)이 양쪽에 있으면 {@code toUserId} 행을 유지하고 {@code fromUserId} 쪽만 삭제한다.
     *
     * @return USER_ID를 갱신한 행 수
     */
    int reassignUserMovieLikesToUser(String fromUserId, String toUserId);
}
