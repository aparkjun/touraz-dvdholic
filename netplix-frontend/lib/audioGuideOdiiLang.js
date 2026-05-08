/**
 * 오디오 가이드(Odii) API 의 langCode(ko|en|zh|ja) — UI i18n 과 별도로 대본·검색 언어를 맞출 때 사용.
 * sessionStorage 에 보존해 /audio-guide 와 NearbyAudioGuideStrip 이 동일 기준을 공유한다.
 */

const STORAGE_KEY = "audioGuide.odiiLang";
const CHANGE_EVENT = "audioGuideOdiiLangChange";

export const ODII_LANG_CODES = ["ko", "en", "zh", "ja"];

export function isValidOdiiLang(v) {
  return typeof v === "string" && ODII_LANG_CODES.includes(v);
}

/** react-i18next language → 저장/요청용 Odii 기본값 */
export function defaultOdiiLangFromUiLang(uiLang) {
  const l = (uiLang || "ko").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("ja")) return "ja";
  return "ko";
}

export function getAudioGuideOdiiLang(fallback = "ko") {
  const fb = isValidOdiiLang(fallback) ? fallback : "ko";
  if (typeof window === "undefined") return fb;
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (isValidOdiiLang(v)) return v;
  } catch {
    /* noop */
  }
  return fb;
}

export function setAudioGuideOdiiLang(lang) {
  if (typeof window === "undefined" || !isValidOdiiLang(lang)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, lang);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: lang }));
  } catch {
    /* noop */
  }
}

export function subscribeAudioGuideOdiiLang(callback) {
  if (typeof window === "undefined") return () => {};
  const fn = () => callback();
  window.addEventListener(CHANGE_EVENT, fn);
  return () => window.removeEventListener(CHANGE_EVENT, fn);
}
