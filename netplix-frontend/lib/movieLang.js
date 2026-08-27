import i18n from "@/lib/i18n";

const lang = () => (i18n.language || "ko").slice(0, 2);
const isEn = () => lang() === "en";
const isJa = () => lang() === "ja";
const isZh = () => lang() === "zh";
const isNe = () => lang() === "ne";

// 언어별 우선순위: 해당 로케일 컬럼 → 네팔어는 영어 다음 한국어 폴백.
const pick = (m, base, enKey, jaKey, zhKey, neKey) => {
  if (isEn() && m?.[enKey]) return m[enKey];
  if (isJa() && m?.[jaKey]) return m[jaKey];
  if (isZh() && m?.[zhKey]) return m[zhKey];
  if (isNe() && m?.[neKey]) return m[neKey];
  if (isNe() && m?.[enKey]) return m[enKey];
  return m?.[base];
};

export const getMovieTitle = (m) =>
  pick(m, "movieName", "movieNameEn", "movieNameJa", "movieNameZh", "movieNameNe");

export const getPosterPath = (m) =>
  pick(m, "posterPath", "posterPathEn", "posterPathJa", "posterPathZh", "posterPathNe");

export const getBackdropPath = (m) =>
  pick(m, "backdropPath", "backdropPathEn", "backdropPathJa", "backdropPathZh", "backdropPathNe");

export const getOverview = (m) =>
  pick(m, "overview", "overviewEn", "overviewJa", "overviewZh", "overviewNe");

export const getTagline = (m) =>
  pick(m, "tagline", "taglineEn", "taglineJa", "taglineZh", "taglineNe");
