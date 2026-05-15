package fast.campus.netplix.notification;

import fast.campus.netplix.user.SearchUserPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

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

    /** KST 기준 당일 DVD·영화 목록 배치 시스템 알림 스냅샷(캐치업 1차). 재기동 시 비면 DB 샘플로 폴백한다. */
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
        LocalDateTime startOfKstDay = todayKst.atStartOfDay(ZoneId.of("Asia/Seoul")).toLocalDateTime();

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
            catchupDailyListNoticeIfMissing(
                    userId, todayKst, startOfKstDay,
                    TITLE_DVD_LIST_UPDATE, dvdD, dvdT, dvdM, dvdR);
            catchupDailyListNoticeIfMissing(
                    userId, todayKst, startOfKstDay,
                    TITLE_MOVIE_LIST_UPDATE, movieD, movieT, movieM, movieR);
        } catch (Exception e) {
            log.warn("[BATCH-NOTI-CATCHUP] userId={} 실패: {}", userId, e.getMessage());
        }
    }

    /**
     * 당일(KST) DVD·영화 목록 배치 알림이 없으면, 메모리 스냅샷 또는 DB에 이미 저장된 동일 제목 알림으로 보충한다.
     */
    private void catchupDailyListNoticeIfMissing(
            String userId,
            LocalDate todayKst,
            LocalDateTime startOfKstDay,
            String listTitle,
            LocalDate snapKstDate,
            String snapTitle,
            String snapMessage,
            String snapRelated) {
        if (notificationPort.existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
                userId, listTitle, NOTIFICATION_TYPE_SYSTEM, startOfKstDay)) {
            return;
        }
        Optional<String> messageOpt = Optional.empty();
        Optional<String> relatedOpt = Optional.empty();
        if (snapKstDate != null
                && snapKstDate.equals(todayKst)
                && listTitle.equals(snapTitle)
                && snapMessage != null
                && !snapMessage.isBlank()) {
            messageOpt = Optional.of(snapMessage);
            relatedOpt = Optional.ofNullable(snapRelated);
        }
        if (messageOpt.isEmpty()) {
            Optional<Notification> sample =
                    notificationPort.findLatestSystemNoticeSampleSince(listTitle, NOTIFICATION_TYPE_SYSTEM, startOfKstDay);
            if (sample.isEmpty()) {
                LocalDateTime weekAgo = startOfKstDay.minusDays(7);
                sample = notificationPort.findLatestSystemNoticeSampleSince(
                        listTitle, NOTIFICATION_TYPE_SYSTEM, weekAgo);
                if (sample.isPresent()) {
                    log.info("[BATCH-NOTI-CATCHUP] '{}' 당일(KST) 샘플 없음 → 최근 7일 내 템플릿 사용", listTitle);
                }
            }
            if (sample.isEmpty()) {
                sample = notificationPort.findLatestSystemNoticeSample(listTitle, NOTIFICATION_TYPE_SYSTEM);
                if (sample.isPresent()) {
                    log.info("[BATCH-NOTI-CATCHUP] '{}' 7일 내 샘플 없음 → DB 최신 템플릿 사용", listTitle);
                }
            }
            if (sample.isEmpty()) {
                log.warn("[BATCH-NOTI-CATCHUP] userId={} '{}' 템플릿 없음 (sentAt>={}, KST일={})", userId, listTitle, startOfKstDay, todayKst);
                return;
            }
            Notification s = sample.get();
            messageOpt = Optional.ofNullable(s.getMessage()).filter(m -> !m.isBlank());
            relatedOpt = Optional.ofNullable(s.getRelatedId());
            if (messageOpt.isEmpty()) {
                return;
            }
        }
        notificationPort.save(
                Notification.systemNotice(userId, listTitle, messageOpt.get(), relatedOpt.orElse(null)));
        log.info("[BATCH-NOTI-CATCHUP] userId={} '{}' 알림 보충 (스냅샷 또는 DB 샘플)", userId, listTitle);
    }
}
