package fast.campus.netplix.notification;

import fast.campus.netplix.user.SearchUserPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService implements NotificationUseCase {

    /** 앱 스케줄러의 DVD 목록 배치 알림 제목과 동일해야 캐치업이 동작한다. */
    public static final String TITLE_DVD_LIST_UPDATE = "DVD 목록 업데이트";
    /** 앱 스케줄러의 영화 목록 배치 알림 제목과 동일해야 한다. */
    public static final String TITLE_MOVIE_LIST_UPDATE = "영화 목록 업데이트";
    private static final String NOTIFICATION_TYPE_SYSTEM = "SYSTEM";

    private final NotificationPort notificationPort;
    private final SearchUserPort searchUserPort;

    /** KST 기준 당일 DVD·영화 목록 배치 시스템 알림 스냅샷(신규 가입자 캐치업). 서버 재기동 시 비어 있을 수 있음. */
    private final Object dailyBatchSnapLock = new Object();
    private volatile LocalDate dvdListSnapKstDate;
    private volatile String dvdListSnapTitle;
    private volatile String dvdListSnapMessage;
    private volatile String dvdListSnapRelated;
    private volatile LocalDate movieListSnapKstDate;
    private volatile String movieListSnapTitle;
    private volatile String movieListSnapMessage;
    private volatile String movieListSnapRelated;

    @Override
    public List<Notification> getNotifications(String userId) {
        return notificationPort.findByUserId(userId);
    }

    @Override
    public List<Notification> getUnreadNotifications(String userId) {
        return notificationPort.findUnreadByUserId(userId);
    }

    @Override
    public long getUnreadCount(String userId) {
        return notificationPort.countUnreadByUserId(userId);
    }

    @Override
    public void markAsRead(String notificationId) {
        notificationPort.markAsRead(notificationId);
    }

    @Override
    public void markAllAsRead(String userId) {
        notificationPort.markAllAsReadByUserId(userId);
    }

    @Override
    public void sendNewReleaseNotification(String movieName, String movieId) {
        List<String> allUserIds = searchUserPort.findAllUserIds();
        log.info("Sending new release notification for '{}' to {} users", movieName, allUserIds.size());
        
        for (String userId : allUserIds) {
            Notification notification = Notification.newRelease(
                    userId,
                    "새 DVD 출시!",
                    "'" + movieName + "'이(가) 새로 출시되었습니다. 지금 확인해 보세요!",
                    movieId
            );
            notificationPort.save(notification);
        }
    }

    @Override
    public void sendRecommendationNotification(String userId, String movieName, String movieId) {
        Notification notification = Notification.newRecommendation(
                userId,
                "추천 영화",
                "취향에 맞는 '" + movieName + "'을(를) 추천드려요!",
                movieId
        );
        notificationPort.save(notification);
    }

    @Override
    public void sendBatchUpdateNotification(String title, String message) {
        sendBatchUpdateNotification(title, message, null);
    }

    @Override
    public void sendBatchUpdateNotification(String title, String message, String relatedData) {
        List<String> allUserIds = searchUserPort.findAllUserIds();
        if (allUserIds.isEmpty()) {
            log.warn("[BATCH-NOTI] 알림 발송 대상 사용자 없음");
            return;
        }
        log.info("[BATCH-NOTI] 발송 시작: title='{}', message='{}', relatedData길이={}, 대상={}명",
                title, message, relatedData != null ? relatedData.length() : 0, allUserIds.size());
        int success = 0;
        for (String userId : allUserIds) {
            try {
                Notification notification = Notification.systemNotice(userId, title, message, relatedData);
                notificationPort.save(notification);
                success++;
            } catch (Exception e) {
                log.error("[BATCH-NOTI] userId={} 알림 저장 실패: {}", userId, e.getMessage());
            }
        }
        log.info("[BATCH-NOTI] 발송 완료: {}/{}명 성공", success, allUserIds.size());
        if (success > 0) {
            recordDailyListBatchSnapshotIfApplicable(title, message, relatedData);
        }
    }

    private void recordDailyListBatchSnapshotIfApplicable(String title, String message, String relatedData) {
        if (!TITLE_DVD_LIST_UPDATE.equals(title) && !TITLE_MOVIE_LIST_UPDATE.equals(title)) {
            return;
        }
        LocalDate kst = LocalDate.now(ZoneId.of("Asia/Seoul"));
        synchronized (dailyBatchSnapLock) {
            if (TITLE_DVD_LIST_UPDATE.equals(title)) {
                dvdListSnapKstDate = kst;
                dvdListSnapTitle = title;
                dvdListSnapMessage = message;
                dvdListSnapRelated = relatedData;
            } else {
                movieListSnapKstDate = kst;
                movieListSnapTitle = title;
                movieListSnapMessage = message;
                movieListSnapRelated = relatedData;
            }
        }
        log.info("[BATCH-NOTI-SNAPSHOT] KST {} 제목='{}' 저장", kst, title);
    }

    @Override
    public void deleteAllNotifications() {
        notificationPort.deleteAll();
    }

    @Override
    public int deleteOldNotifications(int days) {
        LocalDateTime cutoff = LocalDateTime.now(ZoneId.of("Asia/Seoul")).minusDays(days);
        int deleted = notificationPort.deleteOlderThan(cutoff);
        if (deleted > 0) {
            log.info("[NOTI-CLEANUP] {}일 지난 알림 {}건 삭제", days, deleted);
        }
        return deleted;
    }

    @Override
    public int reassignNotificationsToUser(String fromUserId, String toUserId) {
        int n = notificationPort.reassignUserId(fromUserId, toUserId);
        if (n > 0) {
            log.info("[NOTI-LINK] userId {} → {} 알림 {}건 이전", fromUserId, toUserId, n);
        }
        return n;
    }

    @Override
    public void sendDailyBatchCatchupForNewUser(String userId) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        LocalDate todayKst = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDateTime startOfKstDay = todayKst.atStartOfDay();

        LocalDate dvdD;
        String dvdT, dvdM, dvdR;
        LocalDate movieD;
        String movieT, movieM, movieR;
        synchronized (dailyBatchSnapLock) {
            dvdD = dvdListSnapKstDate;
            dvdT = dvdListSnapTitle;
            dvdM = dvdListSnapMessage;
            dvdR = dvdListSnapRelated;
            movieD = movieListSnapKstDate;
            movieT = movieListSnapTitle;
            movieM = movieListSnapMessage;
            movieR = movieListSnapRelated;
        }
        try {
            if (dvdD != null && dvdD.equals(todayKst) && dvdT != null && dvdM != null) {
                if (!notificationPort.existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
                        userId, dvdT, NOTIFICATION_TYPE_SYSTEM, startOfKstDay)) {
                    notificationPort.save(Notification.systemNotice(userId, dvdT, dvdM, dvdR));
                    log.info("[BATCH-NOTI-CATCHUP] userId={} DVD 목록 배치 알림 보충", userId);
                }
            }
            if (movieD != null && movieD.equals(todayKst) && movieT != null && movieM != null) {
                if (!notificationPort.existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
                        userId, movieT, NOTIFICATION_TYPE_SYSTEM, startOfKstDay)) {
                    notificationPort.save(Notification.systemNotice(userId, movieT, movieM, movieR));
                    log.info("[BATCH-NOTI-CATCHUP] userId={} 영화 목록 배치 알림 보충", userId);
                }
            }
        } catch (Exception e) {
            log.warn("[BATCH-NOTI-CATCHUP] userId={} 실패: {}", userId, e.getMessage());
        }
    }
}
