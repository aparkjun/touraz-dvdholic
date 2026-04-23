/**
 * 한국관광공사 광역시도 areaCode ↔ 두루누비 sigun 광역 약칭 매핑.
 *
 * CineTrip 쪽은 관광공사 areaCode(1~39) 체계를 그대로 사용하고,
 * 두루누비 코스는 `sigun` 필드에 "부산 남구", "경남 창원시" 처럼
 * "광역 약칭 + 공백 + 시군구" 형태의 한글 문자열을 담아 내려준다.
 *
 * 이 유틸은 양쪽을 이어주는 가벼운 매핑 테이블 + 몇 개의 헬퍼만 노출한다.
 * 백엔드(VisitKoreaDurunubiHttpClient)에도 동일 매핑 테이블이 있어
 * 서버/클라이언트 어느 쪽에서도 일관되게 필터링이 가능하다.
 */

// areaCode → 광역 라벨 (UI 표시용)
export const AREA_CODE_TO_LABEL = {
  1: '서울', 2: '인천', 3: '대전', 4: '대구', 5: '광주',
  6: '부산', 7: '울산', 8: '세종',
  31: '경기', 32: '강원', 33: '충북', 34: '충남',
  35: '전북', 36: '전남', 37: '경북', 38: '경남', 39: '제주',
};

// areaCode → sigun 문자열 내에서 매칭할 광역 토큰 후보
const AREA_CODE_TO_SIGUN_PREFIXES = {
  1:  ['서울'],
  2:  ['인천'],
  3:  ['대전'],
  4:  ['대구'],
  5:  ['광주'],
  6:  ['부산'],
  7:  ['울산'],
  8:  ['세종'],
  31: ['경기'],
  32: ['강원'],
  33: ['충북', '충청북도'],
  34: ['충남', '충청남도'],
  35: ['전북', '전라북도'],
  36: ['전남', '전라남도'],
  37: ['경북', '경상북도'],
  38: ['경남', '경상남도'],
  39: ['제주'],
};

// 역방향: sigun 접두사 → areaCode
const SIGUN_PREFIX_TO_AREA_CODE = (() => {
  const map = new Map();
  for (const [code, prefixes] of Object.entries(AREA_CODE_TO_SIGUN_PREFIXES)) {
    for (const p of prefixes) map.set(p, Number(code));
  }
  return map;
})();

/**
 * 두루누비 sigun 문자열(예: "경남 창원시") → areaCode(38).
 * 매칭되지 않으면 null 반환.
 */
export function sigunToAreaCode(sigun) {
  if (!sigun || typeof sigun !== 'string') return null;
  const trimmed = sigun.trim();
  if (!trimmed) return null;
  // 1) 공백 첫 토큰 우선 매칭 (가장 일반적인 포맷)
  const firstToken = trimmed.split(/\s+/)[0];
  if (SIGUN_PREFIX_TO_AREA_CODE.has(firstToken)) {
    return SIGUN_PREFIX_TO_AREA_CODE.get(firstToken);
  }
  // 2) 느슨한 contains 매칭 (전라북도/충청남도 등 긴 표기 대응)
  for (const [prefix, code] of SIGUN_PREFIX_TO_AREA_CODE.entries()) {
    if (trimmed.startsWith(prefix) || trimmed.includes(prefix)) return code;
  }
  return null;
}

/** areaCode → 한글 광역 라벨 (없으면 빈 문자열) */
export function areaCodeToLabel(areaCode) {
  if (areaCode == null) return '';
  const key = typeof areaCode === 'string' ? Number(areaCode) : areaCode;
  return AREA_CODE_TO_LABEL[key] || '';
}
