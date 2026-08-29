import i18n from "@/lib/i18n";

const lang = () => (i18n.language || "ko").slice(0, 2);
const isEn = () => lang() === "en";
const isJa = () => lang() === "ja";
const isZh = () => lang() === "zh";
const isNe = () => lang() === "ne";
const isPt = () => lang() === "pt";

const hasNepali = (s) => typeof s === "string" && /[\u0900-\u097F]/.test(s);

const pick = (m, base, enKey, jaKey, zhKey, neKey, ptKey) => {
  if (isEn() && m?.[enKey]) return m[enKey];
  if (isJa() && m?.[jaKey]) return m[jaKey];
  if (isZh() && m?.[zhKey]) return m[zhKey];
  if (isPt() && m?.[ptKey]) return m[ptKey];
  if (isNe() && hasNepali(m?.[neKey])) return m[neKey];
  if (isNe() && (neKey === "overviewNe" || neKey === "taglineNe")) return m?.[base];
  if (isNe() && m?.[enKey]) return m[enKey];
  return m?.[base];
};

export const getMovieTitle = (m) =>
  pick(m, "movieName", "movieNameEn", "movieNameJa", "movieNameZh", "movieNameNe", "movieNamePt");

export const getPosterPath = (m) =>
  pick(m, "posterPath", "posterPathEn", "posterPathJa", "posterPathZh", "posterPathNe", "posterPathPt");

export const getBackdropPath = (m) =>
  pick(m, "backdropPath", "backdropPathEn", "backdropPathJa", "backdropPathZh", "backdropPathNe", "backdropPathPt");

export const getOverview = (m) =>
  pick(m, "overview", "overviewEn", "overviewJa", "overviewZh", "overviewNe", "overviewPt");

export const getTagline = (m) =>
  pick(m, "tagline", "taglineEn", "taglineJa", "taglineZh", "taglineNe", "taglinePt");
