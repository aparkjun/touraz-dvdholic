-- V33 에서 DECIMAL(8,2) 로 만든 관광지표 컬럼을
-- JPA 엔티티(Double) 와 Hibernate 스키마 검증(DOUBLE=float(53)) 에 맞춰 DOUBLE 로 변경.
-- movie_region_mappings / trending_regions_cache 의 DECIMAL 컬럼은 엔티티 추가 전이라 유지.

ALTER TABLE tour_index_snapshots
    MODIFY COLUMN TOUR_DEMAND_IDX          DOUBLE,
    MODIFY COLUMN TOUR_COMPETITIVENESS     DOUBLE,
    MODIFY COLUMN CULTURAL_RESOURCE_DEMAND DOUBLE,
    MODIFY COLUMN TOUR_SERVICE_DEMAND      DOUBLE,
    MODIFY COLUMN TOUR_RESOURCE_DEMAND     DOUBLE;
