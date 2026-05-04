/**
 * API Base URL
 * - Capacitor 네이티브(특히 Android): WebView origin 이 https://localhost 등일 때
 *   상대 경로 /api 가 기기 로컬로 가며 실패 → Heroku 절대 URL 고정.
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
    const env = process.env.REACT_APP_API_URL;
    return env && env !== "" ? env : "";
  }
  const env = process.env.REACT_APP_API_URL;
  if (env && env !== "") return env;

  if (isNativeCapacitor()) return HEROKU_API_URL;

  const origin = (window.location?.origin || "").toLowerCase();
  if (
    origin.startsWith("capacitor://") ||
    origin.startsWith("ionic://") ||
    origin.startsWith("file://")
  ) {
    return HEROKU_API_URL;
  }
  if (!origin || origin === "null" || !origin.startsWith("http")) {
    if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return HEROKU_API_URL;
    }
  }

  return process.env.NODE_ENV === "production" ? "" : "http://localhost:8080";
}
