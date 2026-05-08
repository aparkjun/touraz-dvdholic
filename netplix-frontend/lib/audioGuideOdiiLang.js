/**
 * 오디오 가이드(Odii) API 의 langCode(ko|en) — UI 언어와 무관하게 대본·검색 결과 언어를 맞출 때 사용.
 * sessionStorage 에 보존해 /audio-guide 와 NearbyAudioGuideStrip 이 동일 기준을 공유한다.
 */

const STORAGE_KEY = "audioGuide.odiiLang";
const CHANGE_EVENT = "audioGuideOdiiLangChange";

export function getAudioGuideOdiiLang(fallback = "ko") {
  if (typeof window === "undefined") return fallback === "en" ? "en" : "ko";
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (v === "en" || v === "ko") return v;
  } catch {
    /* noop */
  }
  return fallback === "en" ? "en" : "ko";
}

export function setAudioGuideOdiiLang(lang) {
  if (typeof window === "undefined") return;
  try {
    if (lang === "en" || lang === "ko") {
      window.sessionStorage.setItem(STORAGE_KEY, lang);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: lang }));
    }
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
