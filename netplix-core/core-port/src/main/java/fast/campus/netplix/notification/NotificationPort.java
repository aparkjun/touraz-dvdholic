package fast.campus.netplix.notification;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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

    /**
     * 당일 배치로 이미 저장된 동일 제목의 시스템 알림 중 하나(신규 사용자 캐치업용 템플릿).
     */
    Optional<Notification> findLatestSystemNoticeSampleSince(
            String title, String notificationType, LocalDateTime sentAtMin);

    /**
     * 동일 제목·타입의 시스템 알림 중 가장 최근 1건 (날짜 하한 없음). 캐치업 최종 폴백.
     */
    Optional<Notification> findLatestSystemNoticeSample(String title, String notificationType);
}
