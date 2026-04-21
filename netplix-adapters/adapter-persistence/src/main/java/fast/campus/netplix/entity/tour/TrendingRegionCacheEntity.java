package fast.campus.netplix.entity.tour;

import fast.campus.netplix.tour.TrendingRegion;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(
        name = "trending_regions_cache",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_TRENDING_PERIOD_AREA",
                columnNames = {"PERIOD", "AREA_CODE"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TrendingRegionCacheEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "AREA_CODE", nullable = false, length = 20)
    private String areaCode;

    @Column(name = "REGION_NAME", length = 100)
    private String regionName;

    @Column(name = "PERIOD", nullable = false, length = 10)
    private String period;

    @Column(name = "RANK_NO", nullable = false)
    private Integer rankNo;

    @Column(name = "SCORE")
    private Double score;

    @Column(name = "COMPUTED_AT")
    private LocalDateTime computedAt;

    public static TrendingRegionCacheEntity fromDomain(TrendingRegion r) {
        TrendingRegionCacheEntity e = new TrendingRegionCacheEntity();
        e.areaCode = r.getAreaCode();
        e.regionName = r.getRegionName();
        e.period = r.getPeriod();
        e.rankNo = r.getRank();
        e.score = r.getScore();
        e.computedAt = LocalDateTime.now();
        return e;
    }

    public TrendingRegion toDomain() {
        return TrendingRegion.builder()
                .areaCode(areaCode)
                .regionName(regionName)
                .period(period)
                .rank(rankNo == null ? 0 : rankNo)
                .score(score == null ? 0.0 : score)
                .build();
    }
}
