package fast.campus.netplix.repository.movie;

import fast.campus.netplix.entity.movie.UserMovieLikeEntity;
import fast.campus.netplix.movie.LikeMoviePort;
import fast.campus.netplix.movie.UserMovieLike;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserMovieLikeRepository implements LikeMoviePort {

    private final UserMovieLikeJpaRepository userMovieLikeJpaRepository;

    @Override
    @Transactional
    public UserMovieLike save(UserMovieLike domain) {
        boolean exists = userMovieLikeJpaRepository.existsById(domain.getUserMovieLikeId());
        UserMovieLikeEntity entity = UserMovieLikeEntity.toEntity(domain, !exists);
        return userMovieLikeJpaRepository.save(entity).toDomain();
    }

    @Override
    @Transactional
    public Optional<UserMovieLike> findByUserIdAndMovieIdAndContentType(String userId, String movieId, String contentType) {
        return userMovieLikeJpaRepository.findByUserIdAndMovieIdAndContentType(userId, movieId, contentType)
                .map(UserMovieLikeEntity::toDomain);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findLikedMovieIdsByUserId(String userId) {
        return userMovieLikeJpaRepository.findLikedMovieIdsByUserId(userId);
    }
    
    @Override
    @Transactional(readOnly = true)
    public Long countLikesByMovieIdAndContentType(String movieId, String contentType) {
        return userMovieLikeJpaRepository.countLikesByMovieIdAndContentType(movieId, contentType);
    }
    
    @Override
    @Transactional(readOnly = true)
    public Long countUnlikesByMovieIdAndContentType(String movieId, String contentType) {
        return userMovieLikeJpaRepository.countUnlikesByMovieIdAndContentType(movieId, contentType);
    }

    @Override
    @Transactional(readOnly = true)
    public Long countMehsByMovieIdAndContentType(String movieId, String contentType) {
        return userMovieLikeJpaRepository.countMehsByMovieIdAndContentType(movieId, contentType);
    }

    @Override
    @Transactional
    public void deleteByUserIdAndMovieIdAndContentType(String userId, String movieId, String contentType) {
        userMovieLikeJpaRepository.deleteByUserIdAndMovieIdAndContentType(userId, movieId, contentType);
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findTopLikedMovieIdsSince(String contentType, LocalDateTime since, int limit) {
        return userMovieLikeJpaRepository.findTopLikedMovieIdsSince(contentType, since, PageRequest.of(0, limit));
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> findTopLikedMovieIdsSinceCombiningMovieAndDvd(LocalDateTime since, int limit) {
        return userMovieLikeJpaRepository.findTopLikedMovieIdsSinceCombiningMovieAndDvd(since, PageRequest.of(0, limit));
    }

    @Override
    @Transactional
    public int reassignUserMovieLikesToUser(String fromUserId, String toUserId) {
        if (fromUserId == null || toUserId == null || fromUserId.equals(toUserId)) {
            return 0;
        }
        userMovieLikeJpaRepository.deleteSourceLikesWhereTargetHasSameMovie(fromUserId, toUserId);
        return userMovieLikeJpaRepository.updateUserIdForAllLikes(fromUserId, toUserId);
    }
}
