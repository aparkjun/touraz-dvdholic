-- =====================================================================
-- V35: movie_region_mappings 컬럼 타입 보정
-- - CONFIDENCE: TINYINT -> INT (Integer → Types#INTEGER)
-- - TRENDING_SCORE: DECIMAL(8,2) -> DOUBLE (Double → Types#FLOAT)
-- =====================================================================

ALTER TABLE movie_region_mappings
    MODIFY COLUMN CONFIDENCE     INT    DEFAULT 3,
    MODIFY COLUMN TRENDING_SCORE DOUBLE DEFAULT 0;
