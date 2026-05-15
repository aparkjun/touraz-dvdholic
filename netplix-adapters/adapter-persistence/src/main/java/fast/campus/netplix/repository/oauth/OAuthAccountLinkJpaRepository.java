package fast.campus.netplix.repository.oauth;

import fast.campus.netplix.entity.oauth.OAuthAccountLinkEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OAuthAccountLinkJpaRepository extends JpaRepository<OAuthAccountLinkEntity, String> {

    Optional<OAuthAccountLinkEntity> findByProviderAndProviderId(String provider, String providerId);

    Optional<OAuthAccountLinkEntity> findByProviderIgnoreCaseAndProviderId(String provider, String providerId);
}
