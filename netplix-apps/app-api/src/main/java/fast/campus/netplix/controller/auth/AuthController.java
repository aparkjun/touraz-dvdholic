package fast.campus.netplix.controller.auth;

import fast.campus.netplix.admin.AdminDashboardUseCase;
import fast.campus.netplix.auth.FetchTokenUseCase;
import fast.campus.netplix.auth.UpdateTokenUseCase;
import fast.campus.netplix.auth.response.TokenResponse;
import fast.campus.netplix.controller.NetplixApiResponse;
import fast.campus.netplix.controller.auth.request.LoginRequest;
import fast.campus.netplix.exception.ErrorCode;
import fast.campus.netplix.notification.NotificationUseCase;
import fast.campus.netplix.oauth.OAuthLoginTokenIssuer;
import fast.campus.netplix.security.NetplixAuthUser;
import fast.campus.netplix.user.FetchUserUseCase;
import fast.campus.netplix.user.response.SocialUserResponse;
import io.micrometer.common.util.StringUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UpdateTokenUseCase updateTokenUseCase;
    private final FetchTokenUseCase fetchTokenUseCase;
    private final FetchUserUseCase fetchUserUseCase;
    private final AuthenticationManagerBuilder authenticationManagerBuilder;
    private final AdminDashboardUseCase adminDashboardUseCase;
    private final OAuthLoginTokenIssuer oauthLoginTokenIssuer;
    private final NotificationUseCase notificationUseCase;

    @PostMapping("/login")
    public NetplixApiResponse<TokenResponse> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                request.getEmail(), request.getPassword());

        Authentication authentication = authenticationManagerBuilder.getObject()
                .authenticate(authenticationToken);

        NetplixAuthUser principal = (NetplixAuthUser) authentication.getPrincipal();

        fetchUserUseCase.updateLastLoginAt(principal.getEmail());
        adminDashboardUseCase.logAccess(
                principal.getUserId(),
                httpRequest.getHeader("User-Agent"),
                httpRequest.getRemoteAddr()
        );
        TokenResponse tokenResponse = updateTokenUseCase.upsertToken(principal.getEmail());

        try {
            notificationUseCase.sendDailyBatchCatchupForNewUser(principal.getUserId());
        } catch (Exception e) {
            log.warn("[auth/login] 당일 배치 알림 캐치업 실패: {}", e.getMessage());
        }

        return NetplixApiResponse.ok(tokenResponse);
    }

    @PostMapping("/reissue")
    public NetplixApiResponse<TokenResponse> reissue(HttpServletRequest httpServletRequest) {
        String refreshToken = httpServletRequest.getHeader("refresh_token");
        String accessToken = httpServletRequest.getHeader("token");
        if (StringUtils.isBlank(refreshToken) || StringUtils.isBlank(accessToken)) {
            return NetplixApiResponse.fail(ErrorCode.DEFAULT_ERROR, "토큰이 없습니다.");
        }

        return NetplixApiResponse.ok(updateTokenUseCase.reissueToken(accessToken, refreshToken));
    }

    @PostMapping("/callback")
    public NetplixApiResponse<TokenResponse> kakaoCallback(@RequestBody Map<String, String> request) {
        String code = request.get("code");

        String tokenFromKakao = fetchTokenUseCase.getTokenFromKakao(code);
        SocialUserResponse kakaoUser = fetchUserUseCase.findKakaoUser(tokenFromKakao);

        TokenResponse tokenResponse = oauthLoginTokenIssuer.issueTokenAfterOAuth(
                kakaoUser.providerId(),
                kakaoUser.provider(),
                kakaoUser.name(),
                kakaoUser.oauthEmail());

        return NetplixApiResponse.ok(tokenResponse);
    }
}
