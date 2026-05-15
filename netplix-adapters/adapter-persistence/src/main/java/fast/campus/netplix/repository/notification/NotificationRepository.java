package fast.campus.netplix.repository.notification;

import fast.campus.netplix.entity.notification.NotificationEntity;
import fast.campus.netplix.notification.Notification;
import fast.campus.netplix.notification.NotificationPort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class NotificationRepository implements NotificationPort {

    private final NotificationJpaRepository notificationJpaRepository;

    @Override
    @Transactional
    public int deleteOlderThan(LocalDateTime cutoff) {
        return notificationJpaRepository.deleteOlderThan(cutoff);
    }

    @Override
    @Transactional
    public Notification save(Notification notification) {
        NotificationEntity entity = NotificationEntity.toEntity(notification);
        return notificationJpaRepository.save(entity).toDomain();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Notification> findByUserId(String userId) {
        return notificationJpaRepository.findByUserIdOrderBySentAtDesc(userId)
                .stream()
                .map(NotificationEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Notification> findUnreadByUserId(String userId) {
        return notificationJpaRepository.findByUserIdAndIsReadFalseOrderBySentAtDesc(userId)
                .stream()
                .map(NotificationEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countUnreadByUserId(String userId) {
        return notificationJpaRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Override
    @Transactional
    public void markAsRead(String notificationId) {
        notificationJpaRepository.markAsRead(notificationId);
    }

    @Override
    @Transactional
    public void markAllAsReadByUserId(String userId) {
        notificationJpaRepository.markAllAsReadByUserId(userId);
    }

    @Override
    @Transactional
    public void deleteByNotificationId(String notificationId) {
        notificationJpaRepository.deleteById(notificationId);
    }

    @Override
    @Transactional
    public void deleteAll() {
        notificationJpaRepository.deleteAllInBatch();
    }

    @Override
    @Transactional
    public int reassignUserId(String fromUserId, String toUserId) {
        if (fromUserId == null || toUserId == null || fromUserId.equals(toUserId)) {
            return 0;
        }
        return notificationJpaRepository.reassignUserId(fromUserId, toUserId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
            String userId, String title, String notificationType, LocalDateTime sentAtMin) {
        return notificationJpaRepository.existsByUserIdAndTitleAndNotificationTypeAndSentAtGreaterThanEqual(
                userId, title, notificationType, sentAtMin);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Notification> findLatestSystemNoticeSampleSince(
            String title, String notificationType, LocalDateTime sentAtMin) {
        return notificationJpaRepository
                .findLatestSystemNoticeCandidates(title, notificationType, sentAtMin, PageRequest.of(0, 1))
                .stream()
                .findFirst()
                .map(NotificationEntity::toDomain);
    }
}
