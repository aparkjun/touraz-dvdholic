package fast.campus.netplix.repository.notification;

import fast.campus.netplix.entity.notification.NotificationEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

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

    @Query("SELECT n FROM NotificationEntity n WHERE n.title = :title AND n.notificationType = :notificationType "
            + "AND n.sentAt >= :minSentAt ORDER BY n.sentAt DESC")
    List<NotificationEntity> findLatestSystemNoticeCandidates(
            @Param("title") String title,
            @Param("notificationType") String notificationType,
            @Param("minSentAt") LocalDateTime minSentAt,
            Pageable pageable);

    @Query("SELECT n FROM NotificationEntity n WHERE n.title = :title AND n.notificationType = :notificationType "
            + "ORDER BY n.sentAt DESC")
    List<NotificationEntity> findLatestSystemNoticeCandidatesAnyTime(
            @Param("title") String title,
            @Param("notificationType") String notificationType,
            Pageable pageable);
}
