package fast.campus.netplix.repository.cinetrip;

import fast.campus.netplix.entity.cinetrip.PendingMappingReviewEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PendingMappingReviewJpaRepository extends JpaRepository<PendingMappingReviewEntity, Long> {

    @Query("SELECT e FROM PendingMappingReviewEntity e WHERE e.status = :status ORDER BY e.createdAt DESC")
    List<PendingMappingReviewEntity> findByStatusOrdered(@Param("status") String status, Pageable pageable);

    long countByStatus(String status);
}
