/**
 * 앱 WebView 를 떠나지 않고 외부 URL 을 연다.
 * iOS Capacitor 에서 target=_blank / iframe 내 링크는 WKWebView 전체를
 * visitkorea 같은 외부 사이트로 바꿔 버려, 뒤로가기가 앱으로 돌아오지 못한다.
 */

export function isHttpUrl(raw) {
  if (!raw || typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function isSameAppOrigin(href) {
  if (typeof window === "undefined" || !href) return false;
  try {
    const u = new URL(href, window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function openExternalUrl(rawUrl) {
  const url = String(rawUrl || "").trim();
  if (!isHttpUrl(url)) return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform?.()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return true;
    }
  } catch {
    /* 웹·플러그인 실패 시 window.open 폴백 */
  }
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
  return false;
}

export async function isNativeCapacitor() {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Boolean(Capacitor.isNativePlatform?.());
  } catch {
    return false;
  }
}
