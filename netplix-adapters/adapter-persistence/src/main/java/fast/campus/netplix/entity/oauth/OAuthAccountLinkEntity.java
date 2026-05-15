package fast.campus.netplix.entity.oauth;

import fast.campus.netplix.entity.audit.MutableBaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
        name = "oauth_account_links",
        uniqueConstraints = @UniqueConstraint(name = "UK_OAUTH_PROVIDER", columnNames = {"PROVIDER", "PROVIDER_ID"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OAuthAccountLinkEntity extends MutableBaseEntity {

    @Id
    @Column(name = "LINK_ID")
    private String linkId;

    @Column(name = "USER_ID", nullable = false)
    private String userId;

    @Column(name = "PROVIDER", nullable = false, length = 64)
    private String provider;

    @Column(name = "PROVIDER_ID", nullable = false)
    private String providerId;

    public OAuthAccountLinkEntity(String linkId, String userId, String provider, String providerId) {
        this.linkId = linkId;
        this.userId = userId;
        this.provider = provider;
        this.providerId = providerId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}
