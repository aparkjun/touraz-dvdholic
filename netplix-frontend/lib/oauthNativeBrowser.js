import {
  clearOAuthRedirectPending,
  isOAuthRedirectPending,
  markOAuthRedirectPending,
} from '@/lib/oauthPending';

export const OAUTH_BROWSER_CANCELLED = 'oauth-browser-cancelled';

/** [임시 진단] 화면 비표시 서버 비콘 (CapacitorHttp 영향 없는 Image ping) */
function diag(tag) {
  try {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.src = `/__diaglog?tag=${encodeURIComponent('nb-' + tag)}&t=${Date.now()}`;
  } catch (_) {}
}

function dispatchCancelled() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OAUTH_BROWSER_CANCELLED));
}

/** OAuth 인앱 브라우저 취소 — 로그인 페이지 오버레이·버튼 잠금 해제 */
export function releaseOAuthIfNotLoggedIn() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('token')) {
    clearOAuthRedirectPending();
    return false;
  }
  clearOAuthRedirectPending();
  dispatchCancelled();
  return true;
}

let nativeOAuthOpening = false;

export function resetNativeOAuthSession() {
  nativeOAuthOpening = false;
  releaseOAuthIfNotLoggedIn();
}

export function isNativeOAuthSessionActive() {
  return nativeOAuthOpening;
}

/**
 * iOS SFSafari / Android Custom Tabs 로 OAuth.
 * browserFinished 가 iOS에서 누락될 수 있어 appStateChange·resume 폴백 포함.
 */
export async function openNativeOAuthBrowser(oauthUrl) {
  diag('enter');
  if (nativeOAuthOpening) { diag('already-opening-RETURN'); return; }
  nativeOAuthOpening = true;
  markOAuthRedirectPending();

  const { Browser } = await import('@capacitor/browser');
  const { App } = await import('@capacitor/app');
  diag('plugins-loaded');

  let released = false;
  const handles = [];

  const cleanup = () => {
    handles.forEach((h) => {
      try {
        h.remove();
      } catch (_) {}
    });
    handles.length = 0;
    nativeOAuthOpening = false;
  };

  const release = () => {
    if (released) return;
    released = true;
    cleanup();
    releaseOAuthIfNotLoggedIn();
  };

  const scheduleReleaseIfStillPending = (delayMs = 350) => {
    window.setTimeout(() => {
      if (!isOAuthRedirectPending()) return;
      if (localStorage.getItem('token')) {
        clearOAuthRedirectPending();
        return;
      }
      release();
    }, delayMs);
  };

  handles.push(await Browser.addListener('browserFinished', release));

  handles.push(
    await App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive || !isOAuthRedirectPending()) return;
      if (localStorage.getItem('token')) return;
      scheduleReleaseIfStillPending();
    })
  );

  handles.push(
    await App.addListener('resume', () => {
      if (!isOAuthRedirectPending()) return;
      if (localStorage.getItem('token')) return;
      scheduleReleaseIfStillPending();
    })
  );

  document.cookie = 'X-App-Platform=native;path=/;max-age=300;SameSite=None;Secure';

  try {
    diag('browser-open-call');
    Browser.open({
      url: oauthUrl,
      presentationStyle: 'popover',
      toolbarColor: '#000000',
    }).then(() => diag('browser-open-resolved')).catch((err) => {
      diag('browser-open-CATCH:' + (err?.message || err));
      release();
    });
    // 모달 표시 직후 잠금 해제 — X 닫기 후 버튼·로그인 재시도 가능
    window.setTimeout(() => {
      nativeOAuthOpening = false;
    }, 0);
  } catch (e) {
    release();
    throw e;
  }
}
