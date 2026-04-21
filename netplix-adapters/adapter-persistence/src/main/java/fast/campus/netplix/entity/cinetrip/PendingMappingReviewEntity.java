package fast.campus.netplix.entity.cinetrip;

import fast.campus.netplix.cinetrip.MovieRegionSuggestion;
import fast.campus.netplix.cinetrip.PendingMappingReview;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "pending_mapping_reviews")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PendingMappingReviewEntity {

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

    /** RULE | LLM */
    @Column(name = "SOURCE", nullable = false, length = 20)
    private String source;

    /** PENDING | APPROVED | REJECTED */
    @Column(name = "STATUS", nullable = false, length = 20)
    private String status;

    @Lob
    @Column(name = "RAW_RESPONSE", columnDefinition = "TEXT")
    private String rawResponse;

    @Column(name = "CREATED_AT", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "REVIEWED_AT")
    private LocalDateTime reviewedAt;

    public static PendingMappingReviewEntity fromSuggestion(MovieRegionSuggestion s) {
        PendingMappingReviewEntity e = new PendingMappingReviewEntity();
        e.movieName = s.getMovieName();
        e.areaCode = s.getAreaCode();
        e.regionName = s.getRegionName();
        e.mappingType = s.getMappingType();
        e.evidence = s.getEvidence();
        e.confidence = s.getConfidence();
        e.source = s.getSource();
        e.status = "PENDING";
        e.rawResponse = s.getRawResponse();
        e.createdAt = LocalDateTime.now();
        return e;
    }

    public void markApproved() {
        this.status = "APPROVED";
        this.reviewedAt = LocalDateTime.now();
    }

    public void markRejected() {
        this.status = "REJECTED";
        this.reviewedAt = LocalDateTime.now();
    }

    public PendingMappingReview toDomain() {
        return PendingMappingReview.builder()
                .id(id)
                .movieName(movieName)
                .areaCode(areaCode)
                .regionName(regionName)
                .mappingType(mappingType)
                .evidence(evidence)
                .confidence(confidence)
                .source(source)
                .status(status)
                .rawResponse(rawResponse)
                .createdAt(createdAt)
                .reviewedAt(reviewedAt)
                .build();
    }
}
