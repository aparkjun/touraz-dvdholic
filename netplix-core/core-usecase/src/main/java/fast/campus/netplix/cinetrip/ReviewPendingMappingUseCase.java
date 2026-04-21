package fast.campus.netplix.cinetrip;

import java.util.List;

/**
 * 관리자용 — AutoTagCineTripMappingBatch 가 큐잉한 저신뢰도 제안을 검토/확정.
 */
public interface ReviewPendingMappingUseCase {

    /** 대기중 목록. */
    List<PendingMappingReview> findPending(int limit);

    /** 승인 → movie_region_mappings 로 upsert + 상태 APPROVED. */
    void approve(Long id);

    /** 반려 → 상태 REJECTED. */
    void reject(Long id);

    /** 대기 건수. */
    long countPending();
}
