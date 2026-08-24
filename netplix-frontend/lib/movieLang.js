import i18n from "@/lib/i18n";

const lang = () => (i18n.language || "ko").slice(0, 2);
const isEn = () => lang() === "en";
const isJa = () => lang() === "ja";

// 언어별 우선순위: en → *_En, ja → *_Ja, 없으면 기본(한국어) 폴백.
const pick = (m, base, enKey, jaKey) => {
  if (isEn() && m?.[enKey]) return m[enKey];
  if (isJa() && m?.[jaKey]) return m[jaKey];
  return m?.[base];
};

export const getMovieTitle = (m) =>
  pick(m, "movieName", "movieNameEn", "movieNameJa");

export const getPosterPath = (m) =>
  pick(m, "posterPath", "posterPathEn", "posterPathJa");

export const getBackdropPath = (m) =>
  pick(m, "backdropPath", "backdropPathEn", "backdropPathJa");

export const getOverview = (m) =>
  pick(m, "overview", "overviewEn", "overviewJa");

export const getTagline = (m) =>
  pick(m, "tagline", "taglineEn", "taglineJa");
