package fast.campus.netplix.config;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Apple Sign In용 OidcUserService. Apple은 user-info 엔드포인트가 없으므로
 * id_token에서만 사용자 정보를 구성합니다 (userInfo 호출 생략).
 */
@Service
public class AppleOidcUserService extends OidcUserService {

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
        // Apple은 user-info URI가 없어 표준 super.loadUser()가 실패함.
        // id_token만으로 OidcUser 생성 (userInfo = null)
        Set<GrantedAuthority> authorities = Stream.concat(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")).stream(),
                userRequest.getClientRegistration().getScopes().stream()
                        .map(s -> (GrantedAuthority) () -> "SCOPE_" + s)
        ).collect(Collectors.toSet());

        return new DefaultOidcUser(authorities, userRequest.getIdToken());
    }
}
