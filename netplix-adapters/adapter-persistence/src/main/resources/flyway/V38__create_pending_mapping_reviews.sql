-- =====================================================================
-- V38: AI 자동 태깅(AutoTagCineTripMappingBatch) 산출 중 신뢰도가 낮은
-- 영화-지역 매핑 제안을 저장하는 큐 테이블.
--   confidence >= 3 : 바로 movie_region_mappings 에 upsert
--   confidence <= 2 : 이 테이블에 저장되어 관리자 승인 대기
-- =====================================================================

CREATE TABLE IF NOT EXISTS pending_mapping_reviews (
    ID            BIGINT AUTO_INCREMENT PRIMARY KEY,
    MOVIE_NAME    VARCHAR(255) NOT NULL,
    AREA_CODE     VARCHAR(20)  NOT NULL,
    REGION_NAME   VARCHAR(100),
    MAPPING_TYPE  VARCHAR(20)  NOT NULL,
    EVIDENCE      VARCHAR(500),
    CONFIDENCE    INT,
    SOURCE        VARCHAR(20)  NOT NULL,           -- 'RULE' | 'LLM'
    STATUS        VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED
    RAW_RESPONSE  TEXT,
    CREATED_AT    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    REVIEWED_AT   DATETIME,
    INDEX IDX_PMR_STATUS (STATUS),
    INDEX IDX_PMR_MOVIE  (MOVIE_NAME)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
