import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import zh from "@/locales/zh.json";
import ne from "@/locales/ne.json";
import pt from "@/locales/pt.json";

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
    zh: { translation: zh },
    ne: { translation: ne },
    pt: { translation: pt },
  },
  lng: "ko",
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
});

export const SUPPORTED_LANGS = ["ko", "en", "ja", "zh", "ne", "pt"];

export function detectAndApplyLanguage() {
  if (typeof window === "undefined") return;
  const userChoice = localStorage.getItem("user_lang");
  if (userChoice && SUPPORTED_LANGS.includes(userChoice)) {
    // axiosConfig 의 Accept-Language(관광 POI·TMDB 라우팅)는 i18nextLng 를 읽으므로 함께 동기화한다.
    localStorage.setItem("i18nextLng", userChoice);
    i18n.changeLanguage(userChoice);
  }
}

export function setUserLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  localStorage.setItem("user_lang", lang);
  // user_lang 과 i18nextLng 불일치로 UI 언어와 Accept-Language 가 어긋나던 버그 방지.
  localStorage.setItem("i18nextLng", lang);
  i18n.changeLanguage(lang);
}

export default i18n;
