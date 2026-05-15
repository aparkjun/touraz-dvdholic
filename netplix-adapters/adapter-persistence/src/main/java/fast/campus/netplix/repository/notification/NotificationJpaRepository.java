package fast.campus.netplix.repository.notification;

import fast.campus.netplix.entity.notification.NotificationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface NotificationJpaRepository extends JpaRepository<NotificationEntity, String> {

    @Modifying
    @Query("DELETE FROM NotificationEntity n WHERE n.sentAt < :cutoff")
    int deleteOlderThan(@Param("cutoff") LocalDateTime cutoff);
    
    List<NotificationEntity> findByUserIdOrderBySentAtDesc(String userId);
    
    List<NotificationEntity> findByUserIdAndIsReadFalseOrderBySentAtDesc(String userId);
    
    long countByUserIdAndIsReadFalse(String userId);
    
    @Modifying
    @Query("UPDATE NotificationEntity n SET n.isRead = true WHERE n.notificationId = :notificationId")
    void markAsRead(@Param("notificationId") String notificationId);
    
    @Modifying
    @Query("UPDATE NotificationEntity n SET n.isRead = true WHERE n.userId = :userId")
    void markAllAsReadByUserId(@Param("userId") String userId);

    @Modifying
    @Query("UPDATE NotificationEntity n SET n.userId = :toUserId WHERE n.userId = :fromUserId")
    int reassignUserId(@Param("fromUserId") String fromUserId, @Param("toUserId") String toUserId);

    boolean existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
            String userId, String title, String notificationType, LocalDateTime sentAtMin);

    Optional<NotificationEntity> findFirstByTitleAndNotificationTypeAndSentAtGreaterThanEqualOrderBySentAtDesc(
            String title, String notificationType, LocalDateTime sentAtMin);
}
