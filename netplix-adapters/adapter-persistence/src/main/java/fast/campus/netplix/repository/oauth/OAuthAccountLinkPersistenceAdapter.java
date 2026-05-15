package fast.campus.netplix.repository.oauth;

import fast.campus.netplix.entity.oauth.OAuthAccountLinkEntity;
import fast.campus.netplix.user.OAuthAccountLinkPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class OAuthAccountLinkPersistenceAdapter implements OAuthAccountLinkPort {

    private final OAuthAccountLinkJpaRepository oauthAccountLinkJpaRepository;

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findUserIdByProviderAndProviderId(String provider, String providerId) {
        return oauthAccountLinkJpaRepository.findByProviderAndProviderId(provider, providerId)
                .map(OAuthAccountLinkEntity::getUserId);
    }

    @Override
    @Transactional
    public void upsertLink(String userId, String provider, String providerId) {
        oauthAccountLinkJpaRepository.findByProviderAndProviderId(provider, providerId)
                .ifPresentOrElse(
                        entity -> {
                            if (!userId.equals(entity.getUserId())) {
                                entity.setUserId(userId);
                            }
                            oauthAccountLinkJpaRepository.save(entity);
                        },
                        () -> oauthAccountLinkJpaRepository.save(
                                new OAuthAccountLinkEntity(UUID.randomUUID().toString(), userId, provider, providerId))
                );
    }
}
