package fast.campus.netplix.repository.favorite;

import fast.campus.netplix.entity.favorite.UserFavoriteVisitEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserFavoriteVisitJpaRepository extends JpaRepository<UserFavoriteVisitEntity, UserFavoriteVisitEntity.Pk> {
    List<UserFavoriteVisitEntity> findByUserId(String userId);
    void deleteByUserIdAndVisitKey(String userId, String visitKey);
}
