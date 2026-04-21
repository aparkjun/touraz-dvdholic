package fast.campus.netplix.cinetrip;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * pending_mapping_reviews 테이블 도메인 모델.
 * 관리자 승인 대기/이력 관리.
 */
@Getter
@Builder
@AllArgsConstructor
public class PendingMappingReview {
    private final Long id;
    private final String movieName;
    private final String areaCode;
    private final String regionName;
    private final String mappingType;
    private final String evidence;
    private final Integer confidence;
    private final String source;       // RULE | LLM
    private final String status;       // PENDING | APPROVED | REJECTED
    private final String rawResponse;
    private final LocalDateTime createdAt;
    private final LocalDateTime reviewedAt;
}
