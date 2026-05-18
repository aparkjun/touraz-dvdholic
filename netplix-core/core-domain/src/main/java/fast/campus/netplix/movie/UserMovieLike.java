package fast.campus.netplix.movie;

import lombok.Builder;
import lombok.Getter;

import java.util.UUID;

@Getter
@Builder
public class UserMovieLike {
    public static final String VOTE_LIKE = "like";
    public static final String VOTE_UNLIKE = "unlike";
    public static final String VOTE_MEH = "meh";

    private final String userMovieLikeId;
    private final String userId;
    private final String movieId;
    private final String contentType; // "movie" 또는 "dvd"
    private Boolean likeYn; // 하위 호환용 (voteType과 동기화)
    private String voteType; // "like" | "unlike" | "meh"
    private String memo;
    private java.time.LocalDate plannedDate;
    private String tagsJson;
    private Integer sortOrder;

    public void like() {
        this.likeYn = true;
        this.voteType = VOTE_LIKE;
    }

    public void unlike() {
        this.likeYn = false;
        this.voteType = VOTE_UNLIKE;
    }

    public void meh() {
        this.likeYn = false;
        this.voteType = VOTE_MEH;
    }

    /** voteType 우선, 없으면 likeYn으로 변환 */
    public String getVoteType() {
        if (voteType != null) return voteType;
        return Boolean.TRUE.equals(likeYn) ? VOTE_LIKE : VOTE_UNLIKE;
    }

    public static UserMovieLike newLike(String userId, String movieId, String contentType) {
        return UserMovieLike.builder()
                .userMovieLikeId(UUID.randomUUID().toString())
                .userId(userId)
                .movieId(movieId)
                .contentType(contentType)
                .likeYn(true)
                .voteType(VOTE_LIKE)
                .build();
    }

    public static UserMovieLike newUnlike(String userId, String movieId, String contentType) {
        return UserMovieLike.builder()
                .userMovieLikeId(UUID.randomUUID().toString())
                .userId(userId)
                .movieId(movieId)
                .contentType(contentType)
                .likeYn(false)
                .voteType(VOTE_UNLIKE)
                .build();
    }

    public static UserMovieLike newMeh(String userId, String movieId, String contentType) {
        return UserMovieLike.builder()
                .userMovieLikeId(UUID.randomUUID().toString())
                .userId(userId)
                .movieId(movieId)
                .contentType(contentType)
                .likeYn(false)
                .voteType(VOTE_MEH)
                .build();
    }
}
