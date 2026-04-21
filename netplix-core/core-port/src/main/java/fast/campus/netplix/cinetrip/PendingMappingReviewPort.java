package fast.campus.netplix.cinetrip;

import java.util.List;
import java.util.Optional;

public interface PendingMappingReviewPort {

    /** 저신뢰도 제안들을 PENDING 상태로 저장. */
    int saveAll(List<MovieRegionSuggestion> suggestions);

    List<PendingMappingReview> findByStatus(String status, int limit);

    Optional<PendingMappingReview> findById(Long id);

    /** 상태 전환 (APPROVED | REJECTED). */
    void updateStatus(Long id, String newStatus);

    long countByStatus(String status);
}
