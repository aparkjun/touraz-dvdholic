package fast.campus.netplix.entity.favorite;

import fast.campus.netplix.entity.audit.MutableBaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "user_favorite_shares")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class UserFavoriteShareEntity extends MutableBaseEntity implements Persistable<String> {

    @Id
    @Column(name = "SHARE_ID")
    private String shareId;

    @Transient
    private boolean isNewEntity = false;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "SHARE_TOKEN")
    private String shareToken;

    @Column(name = "PAYLOAD_JSON", columnDefinition = "MEDIUMTEXT")
    private String payloadJson;

    @Column(name = "EXPIRES_AT")
    private LocalDateTime expiresAt;

    @Override
    public String getId() {
        return shareId;
    }

    @Override
    public boolean isNew() {
        return isNewEntity;
    }

    public static UserFavoriteShareEntity createNew(
            String shareId, String userId, String token, String payloadJson, LocalDateTime expiresAt) {
        UserFavoriteShareEntity e = new UserFavoriteShareEntity(
                shareId, true, userId, token, payloadJson, expiresAt);
        e.isNewEntity = true;
        return e;
    }
}
