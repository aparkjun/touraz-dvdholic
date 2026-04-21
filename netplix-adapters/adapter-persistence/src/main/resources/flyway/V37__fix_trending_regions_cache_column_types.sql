-- =====================================================================
-- V37: trending_regions_cache 컬럼 타입을 Hibernate 매핑(Integer/Double) 에 맞춤.
-- V35 의 movie_region_mappings 보정과 동일한 패턴.
-- =====================================================================

ALTER TABLE trending_regions_cache MODIFY COLUMN RANK_NO INT NOT NULL;
ALTER TABLE trending_regions_cache MODIFY COLUMN SCORE  DOUBLE;
