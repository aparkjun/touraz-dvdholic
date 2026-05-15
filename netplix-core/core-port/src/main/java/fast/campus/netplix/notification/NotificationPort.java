package fast.campus.netplix.notification;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationPort {
    int deleteOlderThan(LocalDateTime cutoff);
    Notification save(Notification notification);
    
    List<Notification> findByUserId(String userId);
    
    List<Notification> findUnreadByUserId(String userId);
    
    long countUnreadByUserId(String userId);
    
    void markAsRead(String notificationId);
    
    void markAllAsReadByUserId(String userId);
    
    void deleteByNotificationId(String notificationId);

    void deleteAll();

    /**
     * 동일인 통합(소셜 → 일반 이메일 계정) 시 알림 소유 userId 를 옮긴다.
     * @return 갱신된 행 수
     */
    int reassignUserId(String fromUserId, String toUserId);

    boolean existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
            String userId, String title, String notificationType, LocalDateTime sentAtMin);
}
