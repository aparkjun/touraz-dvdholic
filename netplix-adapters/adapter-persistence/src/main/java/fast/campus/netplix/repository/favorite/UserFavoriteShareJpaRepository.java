package fast.campus.netplix.repository.favorite;

import fast.campus.netplix.entity.favorite.UserFavoriteShareEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserFavoriteShareJpaRepository extends JpaRepository<UserFavoriteShareEntity, String> {
    Optional<UserFavoriteShareEntity> findByShareToken(String shareToken);
}
