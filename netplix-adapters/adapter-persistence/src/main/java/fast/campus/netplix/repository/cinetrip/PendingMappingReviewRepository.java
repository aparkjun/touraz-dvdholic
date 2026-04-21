package fast.campus.netplix.repository.cinetrip;

import fast.campus.netplix.cinetrip.MovieRegionSuggestion;
import fast.campus.netplix.cinetrip.PendingMappingReview;
import fast.campus.netplix.cinetrip.PendingMappingReviewPort;
import fast.campus.netplix.entity.cinetrip.PendingMappingReviewEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class PendingMappingReviewRepository implements PendingMappingReviewPort {

    private final PendingMappingReviewJpaRepository jpa;

    @Override
    @Transactional
    public int saveAll(List<MovieRegionSuggestion> suggestions) {
        if (suggestions == null || suggestions.isEmpty()) return 0;
        List<PendingMappingReviewEntity> entities = new ArrayList<>(suggestions.size());
        for (MovieRegionSuggestion s : suggestions) {
            entities.add(PendingMappingReviewEntity.fromSuggestion(s));
        }
        jpa.saveAll(entities);
        return entities.size();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PendingMappingReview> findByStatus(String status, int limit) {
        int safe = Math.max(1, Math.min(limit, 200));
        return jpa.findByStatusOrdered(status, PageRequest.of(0, safe))
                .stream()
                .map(PendingMappingReviewEntity::toDomain)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<PendingMappingReview> findById(Long id) {
        return jpa.findById(id).map(PendingMappingReviewEntity::toDomain);
    }

    @Override
    @Transactional
    public void updateStatus(Long id, String newStatus) {
        jpa.findById(id).ifPresent(e -> {
            if ("APPROVED".equalsIgnoreCase(newStatus)) e.markApproved();
            else if ("REJECTED".equalsIgnoreCase(newStatus)) e.markRejected();
        });
    }

    @Override
    @Transactional(readOnly = true)
    public long countByStatus(String status) {
        return jpa.countByStatus(status);
    }
}
