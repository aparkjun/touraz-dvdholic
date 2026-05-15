package fast.campus.netplix.oauth;

import fast.campus.netplix.auth.UpdateTokenUseCase;
import fast.campus.netplix.auth.response.TokenResponse;
import fast.campus.netplix.movie.LikeMovieUseCase;
import fast.campus.netplix.notification.NotificationUseCase;
import fast.campus.netplix.user.FetchUserUseCase;
import fast.campus.netplix.user.OAuthAccountLinkPort;
import fast.campus.netplix.user.RegisterUserUseCase;
import fast.campus.netplix.user.command.SocialUserRegistrationCommand;
import fast.campus.netplix.user.response.UserResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;

import java.util.Map;
import java.util.Optional;

/**
 * 카카오·애플 OAuth 성공 후 JWT subject 결정.
 * <p>
 * 동일 이메일로 {@code users} 테이블에 가입한 일반 회원이 있으면, 소셜 전용 행을 새로 만들지 않고
 * 그 계정의 이메일을 토큰 키로 사용한다(비밀번호 로그인과 동일한 JWT·userId·알림함).
 * 기존 소셜 전용 계정이 따로 있었다면 알림·찜(영화/DVD 투표) 행을 일반 계정 userId 로 이전한다.
 * <p>
 * Apple은 재로그인 시 id_token에 이메일이 없을 수 있다. 이 경우에도 동일 계정을 쓰려면
 * {@code oauth_account_links}에 (provider, provider_id) → users.USER_ID 를 저장해 두고 조회한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuthLoginTokenIssuer {

    private final FetchUserUseCase fetchUserUseCase;
    private final RegisterUserUseCase registerUserUseCase;
    private final UpdateTokenUseCase updateTokenUseCase;
    private final NotificationUseCase notificationUseCase;
    private final LikeMovieUseCase likeMovieUseCase;
    private final OAuthAccountLinkPort oauthAccountLinkPort;

    public TokenResponse issueTokenAfterOAuth(String providerId, String provider, String displayName, String oauthEmail) {
        String normalizedEmail = normalizeEmail(oauthEmail);
        UserResponse emailUser = normalizedEmail != null ? fetchUserUseCase.findByEmail(normalizedEmail) : null;
        UserResponse socialUser = fetchUserUseCase.findByProviderId(providerId);

        if (emailUser == null) {
            Optional<String> linkedUserId = oauthAccountLinkPort.findUserIdByProviderAndProviderId(provider, providerId);
            if (linkedUserId.isPresent()) {
                emailUser = fetchUserUseCase.findUserByUserId(linkedUserId.get());
                if (emailUser != null) {
                    log.info("[oauth-link] provider={} 저장된 OAuth 링크로 일반 회원 userId={}", provider, linkedUserId.get());
                }
            }
        }

        String tokenSubject;
        if (emailUser != null) {
            if (socialUser != null && !emailUser.userId().equals(socialUser.userId())) {
                notificationUseCase.reassignNotificationsToUser(socialUser.userId(), emailUser.userId());
                likeMovieUseCase.reassignUserMovieLikesToUser(socialUser.userId(), emailUser.userId());
            }
            if (socialUser == null) {
                log.info("[oauth-link] provider={} → 기존 일반 회원과 이메일 매칭, 소셜 행 생성 생략", provider);
            } else {
                log.info("[oauth-link] provider={} 소셜+일반 이메일 매칭 → 일반 회원 토큰으로 통합", provider);
            }
            String subjectFromUser = normalizeEmail(emailUser.email());
            tokenSubject = subjectFromUser != null ? subjectFromUser : emailUser.email();
            oauthAccountLinkPort.upsertLink(emailUser.userId(), provider, providerId);
        } else {
            if (ObjectUtils.isEmpty(socialUser)) {
                registerUserUseCase.registerSocialUser(
                        new SocialUserRegistrationCommand(displayName, provider, providerId));
            }
            tokenSubject = providerId;
        }

        TokenResponse tokens = updateTokenUseCase.upsertToken(tokenSubject);

        UserResponse forCatchup = emailUser != null ? emailUser : fetchUserUseCase.findByProviderId(providerId);
        if (forCatchup != null) {
            try {
                notificationUseCase.sendDailyBatchCatchupForNewUser(forCatchup.userId());
            } catch (Exception e) {
                log.warn("[oauth] 당일 배치 알림 캐치업 실패: {}", e.getMessage());
            }
        }

        return tokens;
    }

    public static String normalizeEmail(String raw) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        return t.isEmpty() ? null : t.toLowerCase(java.util.Locale.ROOT);
    }

    /**
     * OAuth2User 속성에서 이메일 추출 (카카오·애플 동의 범위에 따라 없을 수 있음).
     */
    public static String resolveOAuthEmail(OAuth2User oauth2User, String provider) {
        if (oauth2User == null || provider == null) {
            return null;
        }
        try {
            if ("apple".equals(provider)) {
                Object e = oauth2User.getAttribute("email");
                return e != null ? String.valueOf(e).trim() : null;
            }
            if ("kakao".equals(provider)) {
                Object acc = oauth2User.getAttribute("kakao_account");
                if (acc instanceof Map<?, ?> m) {
                    Object email = m.get("email");
                    if (email instanceof String s && !s.isBlank()) {
                        return s.trim();
                    }
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }
}
