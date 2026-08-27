/**
 * 서브페이지 뒤로가기. iframe/외부 사이트 히스토리에 갇히면 history.back() 이
 * 앱 밖으로 빠지므로, 같은 출처가 아닐 때는 fallback 경로로 교체한다.
 */
export function navigateBack(router, fallback = "/dashboard") {
  const dest = fallback && String(fallback).startsWith("/") ? fallback : "/dashboard";
  if (typeof window === "undefined") {
    router.push(dest);
    return;
  }
  let sameOriginReferrer = false;
  try {
    if (document.referrer) {
      sameOriginReferrer = new URL(document.referrer).origin === window.location.origin;
    }
  } catch {
    sameOriginReferrer = false;
  }
  if (window.history.length > 1 && sameOriginReferrer) {
    router.back();
    return;
  }
  router.push(dest);
}
