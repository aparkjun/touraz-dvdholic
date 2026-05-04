/**
 * API Base URL
 * - Capacitor 네이티브(특히 Android): WebView origin 이 https://localhost 등이라
 *   상대 경로 /api 가 기기 로컬로 가며 연결 실패하는 경우가 있음 → Heroku 절대 URL 고정.
 * - iOS도 동일 이슈(App Store 리젝 2.1a: OAuth/데모 로그인 등) 대응.
 */
import { Capacitor } from "@capacitor/core";

const HEROKU_API_URL = "https://touraz-dvdholic-2507bcb348dd.herokuapp.com";

function isNativeCapacitor() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

export function getApiBaseUrl() {
  if (typeof window === "undefined") {
    const env = process.env.NEXT_PUBLIC_API_URL;
    return env && env !== "" ? env : "";
  }
  const env = process.env.NEXT_PUBLIC_API_URL;
  if (env && env !== "") return env;

  // 1) Capacitor iOS/Android 공통: 네이티브 셸에서는 API 호스트를 항상 명시
  if (isNativeCapacitor()) return HEROKU_API_URL;

  const origin = (window.location?.origin || "").toLowerCase();
  // 2) capacitor://, ionic://, file:// 등 로컬 스킴 → Heroku 사용
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
