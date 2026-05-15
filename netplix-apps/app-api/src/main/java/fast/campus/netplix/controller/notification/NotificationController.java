package fast.campus.netplix.controller.notification;

import fast.campus.netplix.authentication.token.JwtTokenProvider;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.notification.Notification;
import fast.campus.netplix.notification.NotificationUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final JwtTokenProvider jwtTokenProvider;
    private final NotificationUseCase notificationUseCase;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<List<Notification>> getNotifications() {
        String userId = jwtTokenProvider.getUserId();
        // 배치 직후 로그인·다른 userId 통합 등으로 당일 시스템 알림이 비어 있을 수 있음. exists 가드로 중복 없이 보충.
        notificationUseCase.sendDailyBatchCatchupForNewUser(userId);
        List<Notification> list = notificationUseCase.getNotifications(userId);
        return NetplixApiResponse.ok(list);
    }

    @GetMapping("/unread")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<List<Notification>> getUnreadNotifications() {
        String userId = jwtTokenProvider.getUserId();
        return NetplixApiResponse.ok(notificationUseCase.getUnreadNotifications(userId));
    }

    @GetMapping("/unread/count")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<Map<String, Long>> getUnreadCount() {
        String userId = jwtTokenProvider.getUserId();
        long count = notificationUseCase.getUnreadCount(userId);
        return NetplixApiResponse.ok(Map.of("count", count));
    }

    @PostMapping("/{notificationId}/read")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<Void> markAsRead(@PathVariable String notificationId) {
        notificationUseCase.markAsRead(notificationId);
        return NetplixApiResponse.ok(null);
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAnyRole('ROLE_FREE', 'ROLE_BRONZE', 'ROLE_SILVER', 'ROLE_GOLD')")
    public NetplixApiResponse<Void> markAllAsRead() {
        String userId = jwtTokenProvider.getUserId();
        notificationUseCase.markAllAsRead(userId);
        return NetplixApiResponse.ok(null);
    }
}
