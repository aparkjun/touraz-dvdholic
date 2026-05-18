package fast.campus.netplix.entity.favorite;

import fast.campus.netplix.entity.audit.MutableBaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

@Getter
@Entity
@Table(name = "user_travel_favorites")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class UserTravelFavoriteEntity extends MutableBaseEntity implements Persistable<String> {

    @Id
    @Column(name = "TRAVEL_FAV_ID")
    private String travelFavId;

    @Transient
    private boolean isNewEntity = false;

    @Column(name = "USER_ID")
    private String userId;

    @Column(name = "ITEM_TYPE")
    private String itemType;

    @Column(name = "ITEM_ID")
    private String itemId;

    @Column(name = "SNAPSHOT_JSON", columnDefinition = "TEXT")
    private String snapshotJson;

    public void updateSnapshot(String snapshotJson) {
        this.snapshotJson = snapshotJson;
    }

    @Override
    public String getId() {
        return travelFavId;
    }

    @Override
    public boolean isNew() {
        return isNewEntity;
    }

    public static UserTravelFavoriteEntity createNew(
            String id, String userId, String itemType, String itemId, String snapshotJson) {
        UserTravelFavoriteEntity e = new UserTravelFavoriteEntity(id, true, userId, itemType, itemId, snapshotJson);
        e.isNewEntity = true;
        return e;
    }
}
