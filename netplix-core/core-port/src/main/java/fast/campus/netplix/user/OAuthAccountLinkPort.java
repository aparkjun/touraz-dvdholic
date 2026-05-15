package fast.campus.netplix.user;

import java.util.Optional;

/**
 * OAuth (provider, provider_id)를 일반 회원(users.USER_ID)에 고정 매핑한다.
 * Apple은 재로그인 시 이메일이 id_token에 없을 수 있어, 이메일 매칭 대신 이 링크로 동일 계정을 찾는다.
 */
public interface OAuthAccountLinkPort {

    Optional<String> findUserIdByProviderAndProviderId(String provider, String providerId);

    void upsertLink(String userId, String provider, String providerId);
}
