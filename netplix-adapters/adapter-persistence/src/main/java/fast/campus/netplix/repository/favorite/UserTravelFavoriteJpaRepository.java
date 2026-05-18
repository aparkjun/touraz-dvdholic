package fast.campus.netplix.repository.favorite;

import fast.campus.netplix.entity.favorite.UserTravelFavoriteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserTravelFavoriteJpaRepository extends JpaRepository<UserTravelFavoriteEntity, String> {
    List<UserTravelFavoriteEntity> findByUserIdOrderByModifiedAtDesc(String userId);
    Optional<UserTravelFavoriteEntity> findByUserIdAndItemTypeAndItemId(String userId, String itemType, String itemId);
    void deleteByUserIdAndItemTypeAndItemId(String userId, String itemType, String itemId);
}
