/**
 * API Base URL
 * - Capacitor 네이티브(특히 Android): WebView origin 이 https://localhost 등이라
 *   상대 경로 /api 가 기기 로컬로 가며 연결 실패하는 경우가 있음 → Heroku 절대 URL 고정.
 * - iOS도 동일 이슈(App Store 리젝 2.1a: OAuth/데모 로그인 등) 대응.
 *
 * 단, capacitor.config 의 server.url 로 외부 도메인(Heroku) 자체를 띄우는
 * 모드(iOS 빌드 현 구성)에서는 page origin === HEROKU_API_URL 이라 same-origin 이다.
 * 이때 절대 URL 을 강제하면 CapacitorHttp(iOS native HTTP 가로채기)가
 * "외부 출처 요청"으로 인식해 별도 경로로 처리되며, 큰 JSON 응답에서 처리 지연·
 * 부분 수신·헤더 누락 등 모바일에서만 재현되는 실패가 보고됐다. 따라서 page
 * origin 이 동일한 Heroku 호스트인 경우 상대 경로를 사용해 same-origin XHR 로
 * 보내, 웹 빌드와 동일한 경로를 타도록 한다.
 */
import { Capacitor } from "@capacitor/core";

const HEROKU_API_URL = "https://touraz-dvdholic-2507bcb348dd.herokuapp.com";
const HEROKU_API_HOST = "touraz-dvdholic-2507bcb348dd.herokuapp.com";

function isNativeCapacitor() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function pageOriginHostMatchesHeroku() {
  if (typeof window === "undefined") return false;
  const host = (window.location?.host || "").toLowerCase();
  return host === HEROKU_API_HOST;
}

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    const env = process.env.NEXT_PUBLIC_API_URL;
    return env && env !== "" ? env : "";
  }
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && env !== "") return env;

  // 1) Capacitor 네이티브이지만 server.url 로 Heroku 페이지 자체를 띄운 경우 →
  //    page origin === HEROKU_API_URL 이므로 상대 경로(same-origin XHR)가 가장 안정.
  //    웹 빌드와 동일한 응답 경로를 타게 되어 모바일에서만 깨지는 케이스를 줄인다.
  if (isNativeCapacitor() && pageOriginHostMatchesHeroku()) {
    return "";
  }

  // 2) Capacitor 네이티브에서 page origin 이 capacitor://, file:// 등 로컬 스킴 →
  //    상대 경로가 기기 로컬로 가서 실패하므로 Heroku 절대 URL.
  if (isNativeCapacitor()) return HEROKU_API_URL;

  const origin = (window.location?.origin || "").toLowerCase();
  if (
    origin.startsWith("capacitor://") ||
    origin.startsWith("ionic://") ||
    origin.startsWith("file://")
  ) {
    return HEROKU_API_URL;
  }
  // 3) 비-Capacitor WKWebView 등에서 origin 이 비정상인 경우(모바일 Safari 등)
  if (!origin || origin === "null" || !origin.startsWith("http")) {
    if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return HEROKU_API_URL;
    }
  }

  return process.env.NODE_ENV === "production" ? "" : "http://localhost:8080";
}
