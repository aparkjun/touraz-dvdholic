package fast.campus.netplix.cinetrip.autotag;

import fast.campus.netplix.cinetrip.MovieRegionMapping;
import fast.campus.netplix.cinetrip.MovieRegionMappingPort;
import fast.campus.netplix.cinetrip.PendingMappingReview;
import fast.campus.netplix.cinetrip.PendingMappingReviewPort;
import fast.campus.netplix.cinetrip.ReviewPendingMappingUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewPendingMappingService implements ReviewPendingMappingUseCase {

    private final PendingMappingReviewPort pendingMappingReviewPort;
    private final MovieRegionMappingPort movieRegionMappingPort;

    @Override
    public List<PendingMappingReview> findPending(int limit) {
        return pendingMappingReviewPort.findByStatus("PENDING", limit);
    }

    @Override
    public void approve(Long id) {
        PendingMappingReview r = pendingMappingReviewPort.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 리뷰: " + id));
        if (!"PENDING".equalsIgnoreCase(r.getStatus())) {
            log.warn("[REVIEW] 이미 처리된 건 - id={}, status={}", id, r.getStatus());
            return;
        }
        MovieRegionMapping mapping = MovieRegionMapping.builder()
                .movieName(r.getMovieName())
                .areaCode(r.getAreaCode())
                .regionName(r.getRegionName())
                .mappingType(r.getMappingType())
                .evidence(r.getEvidence())
                .confidence(r.getConfidence() == null ? 3 : r.getConfidence())
                .trendingScore(0.0)
                .build();
        movieRegionMappingPort.upsertAll(List.of(mapping));
        pendingMappingReviewPort.updateStatus(id, "APPROVED");
        log.info("[REVIEW] 승인 - id={}, movie={}, area={}", id, r.getMovieName(), r.getAreaCode());
    }

    @Override
    public void reject(Long id) {
        pendingMappingReviewPort.updateStatus(id, "REJECTED");
        log.info("[REVIEW] 반려 - id={}", id);
    }

    @Override
    public long countPending() {
        return pendingMappingReviewPort.countByStatus("PENDING");
    }
}
