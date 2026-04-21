package fast.campus.netplix.entity.tour;

import fast.campus.netplix.tour.TourIndex;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(
        name = "tour_index_snapshots",
        uniqueConstraints = @UniqueConstraint(name = "UK_TOUR_INDEX_AREA_DATE", columnNames = {"AREA_CODE", "SNAPSHOT_DATE"})
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TourIndexSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "AREA_CODE", nullable = false, length = 20)
    private String areaCode;

    @Column(name = "REGION_NAME", length = 100)
    private String regionName;

    @Column(name = "SNAPSHOT_DATE", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "TOUR_DEMAND_IDX")
    private Double tourDemandIdx;

    @Column(name = "TOUR_COMPETITIVENESS")
    private Double tourCompetitiveness;

    @Column(name = "CULTURAL_RESOURCE_DEMAND")
    private Double culturalResourceDemand;

    @Column(name = "TOUR_SERVICE_DEMAND")
    private Double tourServiceDemand;

    @Column(name = "TOUR_RESOURCE_DEMAND")
    private Double tourResourceDemand;

    @Column(name = "SEARCH_VOLUME")
    private Integer searchVolume;

    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;

    public static TourIndexSnapshotEntity fromDomain(TourIndex d) {
        LocalDateTime now = LocalDateTime.now();
        TourIndexSnapshotEntity e = new TourIndexSnapshotEntity();
        e.areaCode = d.getAreaCode();
        e.regionName = d.getRegionName();
        e.snapshotDate = d.getSnapshotDate();
        e.tourDemandIdx = d.getTourDemandIdx();
        e.tourCompetitiveness = d.getTourCompetitiveness();
        e.culturalResourceDemand = d.getCulturalResourceDemand();
        e.tourServiceDemand = d.getTourServiceDemand();
        e.tourResourceDemand = d.getTourResourceDemand();
        e.searchVolume = d.getSearchVolume();
        e.createdAt = now;
        e.updatedAt = now;
        return e;
    }

    public void updateFrom(TourIndex d) {
        this.regionName = d.getRegionName();
        if (d.getTourDemandIdx() != null) this.tourDemandIdx = d.getTourDemandIdx();
        if (d.getTourCompetitiveness() != null) this.tourCompetitiveness = d.getTourCompetitiveness();
        if (d.getCulturalResourceDemand() != null) this.culturalResourceDemand = d.getCulturalResourceDemand();
        if (d.getTourServiceDemand() != null) this.tourServiceDemand = d.getTourServiceDemand();
        if (d.getTourResourceDemand() != null) this.tourResourceDemand = d.getTourResourceDemand();
        if (d.getSearchVolume() != null) this.searchVolume = d.getSearchVolume();
        this.updatedAt = LocalDateTime.now();
    }

    public TourIndex toDomain() {
        return TourIndex.builder()
                .id(id)
                .areaCode(areaCode)
                .regionName(regionName)
                .snapshotDate(snapshotDate)
                .tourDemandIdx(tourDemandIdx)
                .tourCompetitiveness(tourCompetitiveness)
                .culturalResourceDemand(culturalResourceDemand)
                .tourServiceDemand(tourServiceDemand)
                .tourResourceDemand(tourResourceDemand)
                .searchVolume(searchVolume)
                .build();
    }
}
