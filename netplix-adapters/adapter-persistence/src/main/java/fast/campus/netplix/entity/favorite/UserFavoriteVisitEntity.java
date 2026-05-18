package fast.campus.netplix.entity.favorite;

import fast.campus.netplix.entity.audit.MutableBaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "user_favorite_visits")
@IdClass(UserFavoriteVisitEntity.Pk.class)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class UserFavoriteVisitEntity extends MutableBaseEntity {

    @Id
    @Column(name = "USER_ID")
    private String userId;

    @Id
    @Column(name = "VISIT_KEY")
    private String visitKey;

    @Column(name = "VISITED_AT")
    private LocalDateTime visitedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Pk implements Serializable {
        private String userId;
        private String visitKey;
    }
}
