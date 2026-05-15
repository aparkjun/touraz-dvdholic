package fast.campus.netplix.user;

import fast.campus.netplix.auth.NetplixUser;
import fast.campus.netplix.exception.UserException;
import fast.campus.netplix.notification.NotificationUseCase;
import fast.campus.netplix.user.command.SocialUserRegistrationCommand;
import fast.campus.netplix.user.command.UserRegistrationCommand;
import fast.campus.netplix.user.response.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService implements RegisterUserUseCase, FetchUserUseCase, DeleteUserUseCase {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\(\\+\\d{1,3}\\)\\d{10}$");

    private final SearchUserPort searchUserPort;
    private final InsertUserPort insertUserPort;
    private final DeleteUserPort deleteUserPort;
    private final KakaoUserPort kakaoUserPort;
    private final NotificationUseCase notificationUseCase;

    @Override
    public UserRegistrationResponse register(UserRegistrationCommand request) {
        String username = request.username();
        if (username == null || username.trim().length() < 2) {
            throw new UserException.InvalidUsernameException();
        }

        String email = request.email();
        if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new UserException.InvalidEmailFormatException();
        }

        Optional<NetplixUser> byEmail = searchUserPort.findByEmail(email);
        if (byEmail.isPresent()) {
            throw new UserException.UserAlreadyExistException();
        }

        String phone = request.phone();
        if (phone != null && !phone.isBlank() && !PHONE_PATTERN.matcher(phone).matches()) {
            throw new UserException.InvalidPhoneFormatException();
        }

        NetplixUser netplixUser = insertUserPort.create(
                CreateUser.builder()
                        .username(request.username())
                        .encryptedPassword(request.encryptedPassword())
                        .email(request.email())
                        .phone(request.phone())
                        .build()
        );
        runDailyBatchCatchupForNewUser(netplixUser.getUserId());
        return new UserRegistrationResponse(netplixUser.getUsername(), netplixUser.getEmail(), netplixUser.getPhone());
    }

    @Override
    public UserRegistrationResponse registerSocialUser(SocialUserRegistrationCommand request) {
        Optional<NetplixUser> byProviderId = searchUserPort.findByProviderId(request.providerId());
        if (byProviderId.isPresent()) {
            return null;
        }

        NetplixUser socialUser = insertUserPort.createSocialUser(request.username(), request.provider(), request.providerId());
        runDailyBatchCatchupForNewUser(socialUser.getUserId());
        return new UserRegistrationResponse(socialUser.getUsername(), null, null);
    }

    @Override
    public SimpleUserResponse findSimpleUserByEmail(String email) {
        Optional<NetplixUser> byEmail = searchUserPort.findByEmail(email);
        if (byEmail.isEmpty()) {
            throw new UserException.UserDoesNotExistException();
        }
        NetplixUser netplixUser = byEmail.get();

        return new SimpleUserResponse(netplixUser.getUsername(), netplixUser.getEmail(), netplixUser.getPhone());
    }

    @Override
    public DetailUserResponse findDetailUserByEmail(String email) {
        Optional<NetplixUser> byEmail = searchUserPort.findByEmail(email);
        if (byEmail.isEmpty()) {
            throw new UserException.UserDoesNotExistException();
        }
        NetplixUser netplixUser = byEmail.get();

        return DetailUserResponse
                .builder()
                .userId(netplixUser.getUserId())
                .username(netplixUser.getUsername())
                .email(netplixUser.getEmail())
                .password(netplixUser.getEncryptedPassword())
                .phone(netplixUser.getPhone())
                .role(netplixUser.getRole())
                .build();
    }

    @Override
    public UserResponse findByProviderId(String providerId) {
        return searchUserPort.findByProviderId(providerId)
                .map(UserResponse::toUserResponse)
                .orElse(null);
    }

    @Override
    public UserResponse findByEmail(String email) {
        return searchUserPort.findByEmail(email)
                .map(UserResponse::toUserResponse)
                .orElse(null);
    }

    @Override
    public SocialUserResponse findKakaoUser(String accessToken) {
        NetplixUser userFromKakao = kakaoUserPort.findUserFromKakao(accessToken);
        return new SocialUserResponse(
                userFromKakao.getUsername(),
                "kakao",
                userFromKakao.getProviderId(),
                userFromKakao.getEmail()
        );
    }

    @Override
    public void updateLastLoginAt(String email) {
        searchUserPort.updateLastLoginAt(email);
    }

    @Override
    public void deleteByUserId(String userId) {
        deleteUserPort.deleteByUserId(userId);
    }

    private void runDailyBatchCatchupForNewUser(String userId) {
        try {
            notificationUseCase.sendDailyBatchCatchupForNewUser(userId);
        } catch (Exception e) {
            log.warn("[user-register] 당일 배치 알림 캐치업 실패 userId={}: {}", userId, e.getMessage());
        }
    }
}
