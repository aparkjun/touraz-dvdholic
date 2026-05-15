package fast.campus.netplix.notification;

import java.util.List;

public interface NotificationUseCase {
    List<Notification> getNotifications(String userId);
    
    List<Notification> getUnreadNotifications(String userId);
    
    long getUnreadCount(String userId);
    
    void markAsRead(String notificationId);
    
    void markAllAsRead(String userId);
    
    void sendNewReleaseNotification(String movieName, String movieId);

    void sendRecommendationNotification(String userId, String movieName, String movieId);

    /**
     * 배치(영화/DVD 목록 업데이트) 완료 시 전체 사용자에게 시스템 알림 1건 발송.
     */
    void sendBatchUpdateNotification(String title, String message);

    void sendBatchUpdateNotification(String title, String message, String relatedData);

    void deleteAllNotifications();

    int deleteOldNotifications(int days);

    /**
     * 일반 회원(userId)과 소셜 전용 계정을 이메일로 매칭했을 때, 소셜 쪽 알림을 일반 계정으로 옮긴다.
     */
    int reassignNotificationsToUser(String fromUserId, String toUserId);

    /**
     * 당일(KST) DVD·영화 목록 배치가 이미 돌았다면, 그날 발송된 것과 동일한 시스템 알림을
     * 방금 생긴 계정(일반/소셜)에만 보충 발송한다. 기존 회원의 재로그인에는 호출하지 않는다.
     */
    void sendDailyBatchCatchupForNewUser(String userId);
}
