/**
 * 카드/목록용 이미지 URL 변환.
 *
 * 외부 KTO·TMDB 원본 JPEG 를 그리드에 그대로 쓰면 장당 수백 KB~수 MB 가 동시에
 * 내려와 첫 페인트가 십수 초까지 늘어난다. 목록은 항상 저용량 URL 을 쓰고,
 * 라이트박스·히어로만 원본을 요청한다.
 */

export function httpsImageUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  if (s.startsWith("http://")) return `https://${s.slice(7)}`;
  return s;
}

/**
 * KTO tong CMS: `..._image2_1.jpg`(원본급) → `..._image3_1.jpg`(썸네일).
 * 패턴이 없으면 HTTPS 승격만 한다.
 */
export function ktoThumbUrl(url) {
  const s = httpsImageUrl(url);
  if (!s) return "";
  if (s.includes("_image2_")) return s.replace(/_image2_/g, "_image3_");
  if (s.includes("/image2/")) return s.replace("/image2/", "/image3/");
  return s;
}

/** 히어로·라이트박스용. KTO 썸네일(image3)이면 원본급(image2)으로 되돌린다. */
export function ktoFullUrl(url) {
  const s = httpsImageUrl(url);
  if (!s) return "";
  if (s.includes("_image3_")) return s.replace(/_image3_/g, "_image2_");
  if (s.includes("/image3/")) return s.replace("/image3/", "/image2/");
  return s;
}

const TMDB_SIZE_RE = /\/t\/p\/(?:original|w\d+)\//;

export function tmdbSizedUrl(url, size = "w342") {
  const s = httpsImageUrl(url);
  if (!s) return "";
  if (!s.includes("image.tmdb.org")) return s;
  if (TMDB_SIZE_RE.test(s)) return s.replace(TMDB_SIZE_RE, `/t/p/${size}/`);
  return s;
}

/** 카드·스트립·그리드용. TMDB 는 지정 폭, KTO 는 image3 썸네일. */
export function cardImageUrl(url, { tmdbSize = "w342" } = {}) {
  const s = httpsImageUrl(url);
  if (!s) return "";
  if (s.includes("image.tmdb.org")) return tmdbSizedUrl(s, tmdbSize);
  return ktoThumbUrl(s);
}

/** 라이트박스·히어로용 원본(HTTPS 만 승격). */
export function fullImageUrl(url) {
  return httpsImageUrl(url);
}
