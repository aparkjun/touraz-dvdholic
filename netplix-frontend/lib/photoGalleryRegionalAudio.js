/**
 * 관광사진 갤러리 × 오디오 가이드(Odii) 연결.
 *
 * - Odii 후보 중 audioUrl 이 있는 항목만 재생.
 * - 기본: **사진(title·촬영지·검색키워드) ↔ Odii(title·audioTitle·주소·카테고리)** 유사도로 최적 1건 선택 (RAG 불필요).
 * - 유사도가 전부 0이면 결정적 폴백: 해시(지역|사진텍스트) + 그리드 인덱스 (난수 아님).
 */

export function djb2Hash(str) {
  let h = 5381;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) + h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function filterPlayableAudioGuides(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.filter((x) => x && typeof x.audioUrl === "string" && x.audioUrl.trim());
}

/** id 기준 정렬로 Odii 응답 순서 흔들림에 덜 민감하게 */
export function sortAudioGuidesStable(items) {
  return [...items].sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? "")));
}

/**
 * @param {Array} playable audioUrl 있는 항목만, 이미 정렬된 배열 권장
 * @param {string} regionKey 지역 검색어 (서울, 부산 …)
 * @param {number} photoIndex 갤러리 카드 인덱스
 */
export function pickRegionalAudioTrackIndex(playable, regionKey, photoIndex = 0) {
  if (!playable.length) return -1;
  const base = djb2Hash(regionKey) % playable.length;
  const off = Math.abs(parseInt(photoIndex, 10) || 0);
  return (base + off) % playable.length;
}

const MATCH_STOPWORDS = new Set([
  "관광",
  "전경",
  "풍경",
  "사진",
  "야경",
  "한국",
  "아름다운",
  "아름다움",
  "경치",
]);

function normalizeMatchText(s) {
  return String(s || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function galleryMatchCorpus(item) {
  return [item?.title, item?.photoLocation, item?.searchKeyword]
    .filter(Boolean)
    .join(" ");
}

/**
 * Odii 검색에 쓸 쿼리 목록.
 * - 페이지에 지역/검색어가 있으면 그걸 우선.
 * - 전국 최신(키워드 없음)이면 열린 사진의 촬영지·제목·키워드에서 추론.
 */
/** 사진 1장당 Odii search 호출 상한(순차 호출 시 10초+ 지연 방지). */
export const MAX_ODII_GALLERY_SEARCH_QUERIES = 5;

export function inferOdiiQueriesFromGalleryItem(galleryItem, pageRegionKeyword = "") {
  const pageKw = String(pageRegionKeyword || "").trim();
  if (pageKw) {
    return buildOdiiSearchFallbackQueries(pageKw).slice(0, MAX_ODII_GALLERY_SEARCH_QUERIES);
  }
  if (!galleryItem) return [];

  const out = [];
  const add = (q) => {
    const v = String(q || "").trim();
    if (v && !out.includes(v) && out.length < MAX_ODII_GALLERY_SEARCH_QUERIES) {
      out.push(v);
    }
  };

  const loc = String(galleryItem?.photoLocation || "").trim();
  const title = String(galleryItem?.title || "").trim();
  const searchKw = String(galleryItem?.searchKeyword || "").trim();

  // 시설명·제목이 가장 정확 — 대가야국악당 등
  add(title);
  for (const q of buildOdiiSearchFallbackQueries(loc)) {
    if (q !== loc) add(q);
  }
  if (loc) add(loc);
  if (searchKw && searchKw !== title) add(searchKw);

  return out;
}

/** 유사도·표시용 대표 검색어(페이지 키워드 없을 때 사진 메타에서 추론). */
export function resolveGallerySoundMatchKeyword(galleryItem, pageRegionKeyword = "") {
  const pageKw = String(pageRegionKeyword || "").trim();
  if (pageKw) return pageKw;
  const queries = inferOdiiQueriesFromGalleryItem(galleryItem, "");
  if (queries.length) return queries[0];
  return String(galleryItem?.photoLocation || galleryItem?.title || "").trim();
}

function odiiMatchCorpus(o) {
  return [o?.title, o?.audioTitle, o?.address, o?.themeCategory]
    .filter(Boolean)
    .join(" ");
}

/** 제목·주소 등에서 2글자 이상 토큰 추출 */
export function tokenizeForMatch(text) {
  const s = normalizeMatchText(text);
  if (!s) return [];
  const parts = s.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);
  return [...new Set(parts)].filter((t) => !MATCH_STOPWORDS.has(t));
}

/**
 * 사진 한 건과 Odii 한 건의 정렬적 유사도 (0 이상 정수).
 * @param {string} regionKeyword 검색어(지역 토큰 과가중 방지에 사용)
 */
export function scoreGalleryOdiiPair(galleryItem, odiiItem, regionKeyword = "") {
  const gAll = normalizeMatchText(galleryMatchCorpus(galleryItem));
  const oAll = normalizeMatchText(odiiMatchCorpus(odiiItem));
  if (!gAll || !oAll) return 0;

  const regionToks = new Set(tokenizeForMatch(regionKeyword));

  let score = 0;
  const gTitle = normalizeMatchText(galleryItem?.title || "");
  const oTitle = normalizeMatchText(odiiItem?.title || "");
  const oAudioTitle = normalizeMatchText(odiiItem?.audioTitle || "");

  if (gTitle.length >= 2) {
    if (gTitle === oTitle || gTitle === oAudioTitle) score += 520;
    if (oTitle && (oTitle.includes(gTitle) || gTitle.includes(oTitle))) score += 340;
    if (oAudioTitle && (oAudioTitle.includes(gTitle) || gTitle.includes(oAudioTitle))) score += 320;
  }

  const gToks = tokenizeForMatch(galleryMatchCorpus(galleryItem));
  for (const tok of gToks) {
    if (!oAll.includes(tok)) continue;
    let w;
    if (regionToks.has(tok)) w = Math.min(10 + tok.length * 4, 36);
    else if (tok.length <= 2) w = 14;
    else w = Math.min(tok.length * 10, 96);
    score += w;
  }

  const loc = normalizeMatchText(galleryItem?.photoLocation || "");
  const addr = normalizeMatchText(odiiItem?.address || "");
  if (loc.length >= 4 && addr.length >= 4) {
    for (const tok of tokenizeForMatch(loc)) {
      if (tok.length >= 3 && addr.includes(tok)) {
        score += regionToks.has(tok) ? 12 : 44;
      }
    }
  }

  return score;
}

/**
 * 재생 가능 Odii 목록에서 현재 사진과 가장 잘 맞는 1건.
 * @param {object|null} galleryItem TourGallery 아이템
 * @param {object[]} playableOdiiItems audioUrl 있는 Odii 목록
 */
export function pickBestOdiiForGalleryPhoto(
  galleryItem,
  playableOdiiItems,
  regionKeyword,
  photoIndex = 0
) {
  const list = Array.isArray(playableOdiiItems) ? playableOdiiItems : [];
  if (!list.length) return null;

  const rk = String(regionKeyword || "").trim();
  const stable = sortAudioGuidesStable(list);
  let best = stable[0];
  let bestScore = scoreGalleryOdiiPair(galleryItem, best, rk);

  for (let i = 1; i < stable.length; i += 1) {
    const odii = stable[i];
    const s = scoreGalleryOdiiPair(galleryItem, odii, rk);
    if (s > bestScore) {
      bestScore = s;
      best = odii;
    }
  }

  if (bestScore <= 0) {
    const corpus = galleryMatchCorpus(galleryItem || {});
    const fbKey = `${rk}|${corpus}`;
    const idx = pickRegionalAudioTrackIndex(stable, fbKey, photoIndex);
    return stable[idx] ?? best;
  }

  return best;
}

/** 관광사진 검색어·시설명에 자주 붙는 시·도 문자열 (긴 것부터 매칭) */
const ODII_REGION_SEARCH_TOKENS = [
  "경상북도",
  "경상남도",
  "전라북도",
  "전라남도",
  "충청북도",
  "충청남도",
  "제주특별자치도",
  "서울",
  "부산",
  "인천",
  "대구",
  "광주",
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];

/**
 * Odii 검색용 폴백 쿼리 목록: 원문 키워드 + 문자열에 포함된 지역 토큰.
 * 예: "대구경북디자인센터" → ["대구경북디자인센터", "경북", "대구"]
 */
export function buildOdiiSearchFallbackQueries(primaryKeyword) {
  const k = String(primaryKeyword || "").trim();
  if (!k) return [];
  const out = [];
  const push = (s) => {
    const v = String(s || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  push(k);
  const sorted = [...ODII_REGION_SEARCH_TOKENS].sort(
    (a, b) => b.length - a.length
  );
  for (const tok of sorted) {
    if (k.includes(tok)) push(tok);
  }
  return out;
}

/** id 기준으로 오디오 가이드 항목 병합 (중복 제거) */
export function mergeAudioGuideItemsById(existing, incoming) {
  const map = new Map();
  for (const x of existing || []) {
    if (x != null && x.id != null) map.set(String(x.id), x);
  }
  for (const x of incoming || []) {
    if (x != null && x.id != null && !map.has(String(x.id))) {
      map.set(String(x.id), x);
    }
  }
  return [...map.values()];
}
