package fast.campus.netplix.kma;

/**
 * 단기예보(fct_shrt_reg) 호출 결과 — 실패 시 원인 추적용 필드만 채운다.
 */
public record KmaShortRegFetchResult(
        String raw,
        Integer lastHttpStatus,
        String lastNonJsonBodyPreview,
        String lastExceptionSummary,
        int attempts,
        int catalogTextResponsesSkipped) {}
