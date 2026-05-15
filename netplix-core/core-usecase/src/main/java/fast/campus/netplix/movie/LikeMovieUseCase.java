package fast.campus.netplix.movie;

import java.util.List;

public interface LikeMovieUseCase {
    Boolean like(String userId, String movieId, String contentType);
    Boolean unlike(String userId, String movieId, String contentType);
    Boolean meh(String userId, String movieId, String contentType);
    Long getLikeCount(String movieId, String contentType);
    Long getUnlikeCount(String movieId, String contentType);
    Long getMehCount(String movieId, String contentType);
    /** @return "like", "unlike", "meh", or null if no vote */
    String getMyVote(String userId, String movieId, String contentType);

    List<NetplixMovie> getTodayPopular(String contentType, int limit);
    List<NetplixMovie> getPopular(String period, String contentType, int limit);

    /**
     * 소셜 전용 계정의 찜·투표를 일반(이메일) 계정으로 이전한다. 동일 작품은 일반 계정 쪽을 유지한다.
     *
     * @return USER_ID가 갱신된 행 수
     */
    int reassignUserMovieLikesToUser(String fromUserId, String toUserId);
}
