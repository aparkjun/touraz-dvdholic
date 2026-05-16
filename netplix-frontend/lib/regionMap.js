import { resolveAreaCode } from '@/lib/regionAreaCode';

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
  1:  ['서울', '서울특별시'],
  2:  ['인천', '인천광역시'],
  3:  ['대전', '대전광역시'],
  4:  ['대구', '대구광역시'],
  5:  ['광주', '광주광역시'],
  6:  ['부산', '부산광역시'],
  7:  ['울산', '울산광역시'],
  8:  ['세종', '세종특별자치시'],
  31: ['경기', '경기도'],
  32: ['강원', '강원도', '강원특별자치도'],
  33: ['충북', '충청북도'],
  34: ['충남', '충청남도'],
  35: ['전북', '전라북도', '전북특별자치도'],
  36: ['전남', '전라남도'],
  37: ['경북', '경상북도'],
  38: ['경남', '경상남도'],
  39: ['제주', '제주도', '제주특별자치도'],
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
function normalizeAreaCode(code) {
  if (code == null || code === '') return null;
  const n = Number(code);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 두루누비 sigun 문자열(예: "경남 창원시") → areaCode(38).
 * 매칭되지 않으면 {@link resolveAreaCode} 로 한 번 더 시도.
 */
export function sigunToAreaCode(sigun) {
  if (!sigun || typeof sigun !== 'string') return null;
  const trimmed = sigun.trim();
  if (!trimmed) return null;
  const firstToken = trimmed.split(/\s+/)[0];
  if (SIGUN_PREFIX_TO_AREA_CODE.has(firstToken)) {
    return SIGUN_PREFIX_TO_AREA_CODE.get(firstToken);
  }
  for (const [prefix, code] of SIGUN_PREFIX_TO_AREA_CODE.entries()) {
    if (trimmed.startsWith(prefix) || trimmed.includes(prefix)) return code;
  }
  return normalizeAreaCode(resolveAreaCode(trimmed));
}

/** 해파랑·서해랑·남파랑 등 긴 코스에서 sigun 없을 때 지명·주소로 광역 추정 */
const LOCALITY_TO_AREA_CODE = {
  속초: 32, 고성: 32, 양양: 32, 강릉: 32, 동해: 32, 삼척: 32, 태백: 32, 정선: 32, 영월: 32, 원주: 32, 춘천: 32,
  포항: 37, 경주: 37, 울진: 37, 영덕: 37, 안동: 37, 구미: 37, 김천: 37, 상주: 37, 문경: 37, 영주: 37,
  울산: 7, 부산: 6, 해운대: 6, 기장: 6, 거제: 38, 통영: 38, 사천: 38, 남해: 38, 하동: 38, 진주: 38, 창원: 38, 김해: 38, 밀양: 38,
  목포: 36, 여수: 36, 순천: 36, 광양: 36, 완도: 36, 해남: 36, 강진: 36, 보성: 36, 고흥: 36, 나주: 36,
  군산: 35, 전주: 35, 익산: 35, 정읍: 35, 남원: 35, 무주: 35, 장수: 35,
  보령: 34, 서산: 34, 태안: 34, 당진: 34, 아산: 34, 천안: 34, 공주: 34, 논산: 34, 부여: 34, 서천: 34, 홍성: 34,
  인천: 2, 강화: 2, 옹진: 2, 평택: 31, 안산: 31, 시흥: 31, 화성: 31, 수원: 31, 용인: 31, 파주: 31, 김포: 31, 고양: 31,
  제주: 39, 서귀포: 39,
};

/** routeIdx 별 대표 광역 풀 — 코스별 지명 매칭 실패 시 crsIdx 해시로 분산 */
const ROUTE_IDX_AREA_POOL = {
  T_THEME_MNG0000011235: [32, 37, 7, 6, 38],
  T_ROUTE_MNG0000000001: [6, 38, 36, 39, 34, 35],
  T_ROUTE_MNG0000000043: [2, 31, 34, 35, 36, 38],
};

function stripHtml(s) {
  if (!s || typeof s !== 'string') return '';
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function localityToAreaCode(text) {
  if (!text || typeof text !== 'string') return null;
  const keys = Object.keys(LOCALITY_TO_AREA_CODE).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (text.includes(k)) return LOCALITY_TO_AREA_CODE[k];
  }
  return null;
}

function hashSeed(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 둘레길 routeIdx + 코스 식별자로 광역 코드 폴백 (해파랑·서해랑 등 지명 미기재 코스).
 */
export function routeIdxFallbackAreaCode(routeIdx, seed = '') {
  const pool = ROUTE_IDX_AREA_POOL[routeIdx];
  if (!pool?.length) return null;
  return pool[hashSeed(seed || routeIdx) % pool.length];
}

/**
 * 두루누비·큐레이션 코스 객체에서 광역 코드 추정.
 * sigun → 시·종점 주소 → 코스명·소개 → 지명 사전 → 지역 필터 순.
 * @param {{ forWeather?: boolean }} [opts] — true 면 routeIdx 풀·기본값까지 사용(날씨 아이콘 전용).
 */
export function resolveDurunubiCourseAreaCode(course, fallbackAreaCode = null, opts = {}) {
  const { forWeather = false } = opts;
  const fields = [
    course?.sigun,
    course?.cpnBgng,
    course?.cpnEnd,
    course?.crsKorNm,
    stripHtml(course?.crsTourInfo),
    stripHtml(course?.crsContents),
  ];
  for (const raw of fields) {
    if (raw == null || String(raw).trim() === '') continue;
    const text = String(raw).trim();
    const code =
      sigunToAreaCode(text) ??
      localityToAreaCode(text) ??
      normalizeAreaCode(resolveAreaCode(text));
    if (code != null) return code;
  }
  const fb = normalizeAreaCode(fallbackAreaCode);
  if (fb != null) return fb;
  if (!forWeather) return null;
  return (
    routeIdxFallbackAreaCode(course?.routeIdx, course?.crsIdx || course?.crsKorNm) ?? 32
  );
}

/** areaCode → 한글 광역 라벨 (없으면 빈 문자열) */
export function areaCodeToLabel(areaCode) {
  if (areaCode == null) return '';
  const key = typeof areaCode === 'string' ? Number(areaCode) : areaCode;
  return AREA_CODE_TO_LABEL[key] || '';
}
