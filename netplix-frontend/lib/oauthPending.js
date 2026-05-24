/** 카카오/애플 OAuth 창으로 나갔다가 로그인 없이 돌아온 경우를 감지 */
const OAUTH_PENDING_KEY = 'oauth_redirect_pending';
const OAUTH_PENDING_MAX_MS = 5 * 60 * 1000;

export function markOAuthRedirectPending() {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()));
  } catch {}
}

export function clearOAuthRedirectPending() {
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {}
}

export function isOAuthRedirectPending() {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (!Number.isFinite(ts) || Date.now() - ts > OAUTH_PENDING_MAX_MS) {
      clearOAuthRedirectPending();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
