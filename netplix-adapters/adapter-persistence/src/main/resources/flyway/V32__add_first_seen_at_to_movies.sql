-- 영화/DVD 최초 등장 시점 추적 컬럼 추가 (NEW 뱃지 노출 기준)
ALTER TABLE movies ADD COLUMN FIRST_SEEN_AT TIMESTAMP NULL;

-- 기존 데이터는 충분히 과거로 백필 (초기 노출 시 아무것도 NEW 처리되지 않도록)
UPDATE movies SET FIRST_SEEN_AT = NOW() - INTERVAL 7 DAY WHERE FIRST_SEEN_AT IS NULL;

-- 최근 추가 영화 조회용 인덱스
CREATE INDEX IDX_MOVIES_FIRST_SEEN_AT ON movies (FIRST_SEEN_AT);
