package fast.campus.netplix.repository.oauth;

import fast.campus.netplix.entity.oauth.OAuthAccountLinkEntity;
import fast.campus.netplix.user.OAuthAccountLinkPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Repository
@RequiredArgsConstructor
public class OAuthAccountLinkPersistenceAdapter implements OAuthAccountLinkPort {

    private final OAuthAccountLinkJpaRepository oauthAccountLinkJpaRepository;

    private static String normProvider(String provider) {
        return provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
    }

    private static String normProviderId(String providerId) {
        return providerId == null ? "" : providerId.trim();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findUserIdByProviderAndProviderId(String provider, String providerId) {
        String p = normProvider(provider);
        String id = normProviderId(providerId);
        if (p.isEmpty() || id.isEmpty()) {
            return Optional.empty();
        }
        return oauthAccountLinkJpaRepository.findByProviderIgnoreCaseAndProviderId(p, id)
                .map(OAuthAccountLinkEntity::getUserId);
    }

    @Override
    @Transactional
    public void upsertLink(String userId, String provider, String providerId) {
        String p = normProvider(provider);
        String id = normProviderId(providerId);
        if (userId == null || userId.isBlank() || p.isEmpty() || id.isEmpty()) {
            return;
        }
        oauthAccountLinkJpaRepository.findByProviderIgnoreCaseAndProviderId(p, id)
                .ifPresentOrElse(
                        entity -> {
                            if (!userId.equals(entity.getUserId())) {
                                entity.setUserId(userId);
                            }
                            oauthAccountLinkJpaRepository.save(entity);
                        },
                        () -> oauthAccountLinkJpaRepository.save(
                                new OAuthAccountLinkEntity(UUID.randomUUID().toString(), userId, p, id))
                );
    }
}
