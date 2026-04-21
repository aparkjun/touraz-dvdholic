package fast.campus.netplix.entity.cinetrip;

import fast.campus.netplix.cinetrip.MovieRegionMapping;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(
        name = "movie_region_mappings",
        uniqueConstraints = @UniqueConstraint(
                name = "UK_MOVIE_REGION",
                columnNames = {"MOVIE_NAME", "AREA_CODE", "MAPPING_TYPE"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MovieRegionMappingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "MOVIE_NAME", nullable = false, length = 255)
    private String movieName;

    @Column(name = "AREA_CODE", nullable = false, length = 20)
    private String areaCode;

    @Column(name = "REGION_NAME", length = 100)
    private String regionName;

    @Column(name = "MAPPING_TYPE", nullable = false, length = 20)
    private String mappingType;

    @Column(name = "EVIDENCE", length = 500)
    private String evidence;

    @Column(name = "CONFIDENCE")
    private Integer confidence;

    @Column(name = "TRENDING_SCORE")
    private Double trendingScore;

    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;

    public static MovieRegionMappingEntity fromDomain(MovieRegionMapping d) {
        LocalDateTime now = LocalDateTime.now();
        MovieRegionMappingEntity e = new MovieRegionMappingEntity();
        e.movieName = d.getMovieName();
        e.areaCode = d.getAreaCode();
        e.regionName = d.getRegionName();
        e.mappingType = d.getMappingType();
        e.evidence = d.getEvidence();
        e.confidence = d.getConfidence() == null ? 3 : d.getConfidence();
        e.trendingScore = d.getTrendingScore() == null ? 0.0 : d.getTrendingScore();
        e.createdAt = now;
        e.updatedAt = now;
        return e;
    }

    public void updateFrom(MovieRegionMapping d) {
        this.regionName = d.getRegionName();
        this.evidence = d.getEvidence();
        if (d.getConfidence() != null) this.confidence = d.getConfidence();
        if (d.getTrendingScore() != null) this.trendingScore = d.getTrendingScore();
        this.updatedAt = LocalDateTime.now();
    }

    public MovieRegionMapping toDomain() {
        return MovieRegionMapping.builder()
                .id(id)
                .movieName(movieName)
                .areaCode(areaCode)
                .regionName(regionName)
                .mappingType(mappingType)
                .evidence(evidence)
                .confidence(confidence)
                .trendingScore(trendingScore)
                .build();
    }
}
