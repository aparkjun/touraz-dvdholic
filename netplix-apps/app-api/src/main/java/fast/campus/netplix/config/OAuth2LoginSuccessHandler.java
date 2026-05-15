package fast.campus.netplix.config;

import fast.campus.netplix.auth.response.TokenResponse;
import fast.campus.netplix.oauth.OAuthLoginTokenIssuer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Map;

/**
 * 카카오·애플 OAuth2 로그인 성공 시 JWT 발급 후 /mypage 로 리다이렉트 (쿼리 파라미터로 토큰 전달).
 * 일반 회원(이메일)과 동일한 이메일이면 소셜 전용 행 없이 그 계정으로 토큰을 맞춘다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final OAuthLoginTokenIssuer oauthLoginTokenIssuer;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        OAuth2User oauth2User = (OAuth2User) authentication.getPrincipal();
        // Kakao: getName() = 카카오 회원번호 | Apple: getName() = sub (user unique id)
        String providerId = oauth2User.getName();
        String provider = authentication instanceof OAuth2AuthenticationToken
                ? ((OAuth2AuthenticationToken) authentication).getAuthorizedClientRegistrationId()
                : "kakao";
        String name = resolveName(oauth2User, provider);
        String oauthEmail = OAuthLoginTokenIssuer.resolveOAuthEmail(oauth2User, provider);

        TokenResponse tokens = oauthLoginTokenIssuer.issueTokenAfterOAuth(providerId, provider, name, oauthEmail);

        boolean isIOSApp = isNativeAppByCookie(request);

        if (isIOSApp) {
            String redirectUrl = UriComponentsBuilder.fromUriString("dvdholic://callback")
                    .queryParam("token", tokens.accessToken())
                    .queryParam("refresh_token", tokens.refreshToken() != null ? tokens.refreshToken() : "")
                    .build()
                    .toUriString();
            log.info("iOS app detected, redirecting to: {}", redirectUrl);
            getRedirectStrategy().sendRedirect(request, response, redirectUrl);
        } else {
            // 상대 경로 리다이렉트: Next.js 리버스 프록시 뒤에서 Host 헤더가
            // localhost:3001로 바뀌는 문제를 회피 (Apple form_post 콜백 등)
            String redirectUrl = UriComponentsBuilder.fromPath("/mypage")
                    .queryParam("token", tokens.accessToken())
                    .queryParam("refresh_token", tokens.refreshToken() != null ? tokens.refreshToken() : "")
                    .build()
                    .toUriString();
            log.info("Web browser detected, redirecting to: {}", redirectUrl);
            response.setStatus(HttpServletResponse.SC_FOUND);
            response.setHeader("Location", redirectUrl);
        }
    }

    private boolean isNativeAppByCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return false;
        for (jakarta.servlet.http.Cookie c : request.getCookies()) {
            if ("X-App-Platform".equals(c.getName()) && "native".equals(c.getValue())) {
                log.info("Native app detected via cookie");
                return true;
            }
        }
        return false;
    }

    private String resolveName(OAuth2User oauth2User, String provider) {
        if ("apple".equals(provider)) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> nameObj = (Map<String, Object>) oauth2User.getAttribute("name");
                if (nameObj != null) {
                    String first = (String) nameObj.get("firstName");
                    String last = (String) nameObj.get("lastName");
                    if (first != null || last != null) {
                        return ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
                    }
                }
            } catch (Exception e) {
                log.debug("Apple name resolve fallback", e);
            }
            return "Apple사용자";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> properties = (Map<String, Object>) oauth2User.getAttribute("properties");
            if (properties != null && properties.get("nickname") != null) {
                return String.valueOf(properties.get("nickname"));
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> kakaoAccount = (Map<String, Object>) oauth2User.getAttribute("kakao_account");
            if (kakaoAccount != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");
                if (profile != null && profile.get("nickname") != null) {
                    return String.valueOf(profile.get("nickname"));
                }
            }
        } catch (Exception e) {
            log.debug("OAuth2 name resolve fallback", e);
        }
        return "카카오사용자";
    }
}
