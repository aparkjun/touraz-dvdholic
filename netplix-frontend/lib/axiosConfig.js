import axios from "axios";
import { getApiBaseUrl } from "@/lib/apiConfig";

// i18next 현재 언어 감지 — 브라우저 환경에서만 동작.
// SSR/빌드타임에는 기본값 "ko" 를 사용해 백엔드와 합치(한국어 우선) 를 유지.
// Accept-Language 는 관광 POI(EngService2 vs KorService2) / TMDB(ko-KR vs en-US)
// 라우팅의 단일 진실 공급원(Single Source of Truth) 이 된다.
function getAcceptLanguage() {
  if (typeof window === "undefined") return "ko-KR,ko;q=0.9";
  const lang = (window.localStorage?.getItem("i18nextLng") || "ko").toLowerCase();
  // i18next 는 "en-US" 같은 full code 또는 "ko" 같은 short code 를 둘 다 쓴다.
  // HTTP Accept-Language 포맷으로 정규화.
  if (lang.startsWith("en")) return "en-US,en;q=0.9";
  return "ko-KR,ko;q=0.9";
}

function getAnonId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("anon_uid");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("anon_uid", id);
  }
  return id;
}

// 매 요청마다 baseURL 갱신 (Capacitor WebView 초기화 타이밍 이슈 회피)
axios.defaults.baseURL = getApiBaseUrl();

// Request Interceptor: baseURL 보장 + 토큰 추가 (단, 공개 API는 제외)
axios.interceptors.request.use(
  (config) => {
    config.baseURL = getApiBaseUrl();
    const path = config.url || "";
    const base = config.baseURL || "";
    const full = path.startsWith("http") ? path : (base + path);
    const isPublicReadOnly =
      full.includes("/api/v1/movie/search") || 
      full.includes("/api/v1/movie/playing/search") ||
      full.includes("/like-count") ||
      full.includes("/unlike-count") ||
      full.includes("/meh-count");
    if (isPublicReadOnly) {
      delete config.headers.Authorization;
    } else if (full.includes("/api/v1/admin/") && !full.includes("/api/v1/admin/login")) {
      const adminToken = localStorage.getItem("adminToken");
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    } else {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    const anonId = getAnonId();
    if (anonId) {
      config.headers["X-Anon-Id"] = anonId;
    }
    // i18next locale 기반 Accept-Language 자동 주입.
    // 백엔드 LocaleResolver / 영문 POI 컴포넌트가 이 헤더로 국·영문 분기한다.
    config.headers["Accept-Language"] = getAcceptLanguage();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: 401 에러 시 로그인 페이지로 리다이렉트 (단, 공개 API는 제외)
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || "";
      const noRedirectOn401 =
        url.includes("/api/v1/admin/") ||
        url.includes("/api/v1/movie/") ||
        url.includes("/like-count") ||
        url.includes("/unlike-count") ||
        url.includes("/meh-count") ||
        url.includes("/my-vote") ||
        url.includes("/like") ||
        url.includes("/unlike") ||
        url.includes("/meh");
      // OAuth 콜백 직후: URL을 비운 후에도 401 시 리다이렉트 방지 (5초간)
      const isOnDashboard = typeof window !== "undefined" && window.location.pathname === "/dashboard";
      const urlHasToken = typeof window !== "undefined" && window.location.search.includes("token=");
      const oauthTs = typeof sessionStorage !== "undefined" && sessionStorage.getItem("oauth_callback_ts");
      const oauthWindowMs = 10000;
      const isRecentOAuth = oauthTs && (Date.now() - parseInt(oauthTs, 10)) < oauthWindowMs;
      const isOAuthCallback = isOnDashboard && (urlHasToken || isRecentOAuth);
      if (!noRedirectOn401 && !isOAuthCallback) {
        console.error("인증 실패: 로그인이 필요합니다.");
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// 공개 목록 API 전용 인스턴스: 토큰을 절대 붙이지 않음 (카카오 로그인 후에도 목록 401 방지)
export const publicAxios = axios.create({
  baseURL: getApiBaseUrl(),
});
publicAxios.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  config.headers["Accept-Language"] = getAcceptLanguage();
  return config;
});

export default axios;
