import i18n from "@/lib/i18n";

const lang = () => (i18n.language || "ko").slice(0, 2);
const isEn = () => lang() === "en";
const isJa = () => lang() === "ja";
const isZh = () => lang() === "zh";
const isNe = () => lang() === "ne";

const hasNepali = (s) => typeof s === "string" && /[\u0900-\u097F]/.test(s);

// 언어별 우선순위: 해당 로케일 컬럼. 네팔어 줄거리·태그라인은 데바나가리가 있을 때만 쓰고,
// TMDB가 영어를 네팔어 칸에 넣은 경우는 한국어로 둔다(영어 줄거리로 보이지 않게).
const pick = (m, base, enKey, jaKey, zhKey, neKey) => {
  if (isEn() && m?.[enKey]) return m[enKey];
  if (isJa() && m?.[jaKey]) return m[jaKey];
  if (isZh() && m?.[zhKey]) return m[zhKey];
  if (isNe() && hasNepali(m?.[neKey])) return m[neKey];
  if (isNe() && (neKey === "overviewNe" || neKey === "taglineNe")) return m?.[base];
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
