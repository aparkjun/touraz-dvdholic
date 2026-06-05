'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
let Capacitor, Browser;
let capacitorReadyPromise = null;
function ensureCapacitorLoaded() {
  if (typeof window === "undefined") return Promise.resolve();
  if (Capacitor && Browser) return Promise.resolve();
  if (capacitorReadyPromise) return capacitorReadyPromise;
  capacitorReadyPromise = Promise.all([
    import("@capacitor/core").then(m => { Capacitor = m.Capacitor; }).catch(() => {}),
    import("@capacitor/browser").then(m => { Browser = m.Browser; }).catch(() => {}),
  ]).then(() => {});
  return capacitorReadyPromise;
}
if (typeof window !== "undefined") {
  ensureCapacitorLoaded();
}
import {
  clearOAuthRedirectPending,
  isOAuthRedirectPending,
  markOAuthRedirectPending,
} from "@/lib/oauthPending";
import {
  OAUTH_BROWSER_CANCELLED,
  openNativeOAuthBrowser,
  resetNativeOAuthSession,
} from "@/lib/oauthNativeBrowser";

/** 로그인 성공 후 현재 사이트(Next)의 마이페이지로 이동. getApiBaseUrl()은 API 호스트일 수 있어 그걸로 /mypage를 열면 백엔드 500이 난다. */
function redirectAfterLogin() {
  if (typeof window === "undefined") return;
  window.location.replace("/mypage");
}

function LoginContent() {
  const router = useRouter();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      clearOAuthRedirectPending();
      window.dispatchEvent(new CustomEvent('token-stored'));
      redirectAfterLogin();
      return;
    }
    // OAuth 창에서 로그인 없이 돌아온 경우 — 오버레이·pending 플래그 해제
    if (isOAuthRedirectPending()) {
      resetNativeOAuthSession();
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("error")) {
        resetNativeOAuthSession();
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      }
    }
    ensureCapacitorLoaded();
  }, []);

  /** 인앱 브라우저 모달(X) 닫기 — OAuth 세션·버튼 상태 복구 */
  useEffect(() => {
    const onOAuthCancelled = () => resetNativeOAuthSession();
    window.addEventListener(OAUTH_BROWSER_CANCELLED, onOAuthCancelled);
    return () => window.removeEventListener(OAUTH_BROWSER_CANCELLED, onOAuthCancelled);
  }, []);

  /** bfcache·OAuth 취소 후 복귀 */
  useEffect(() => {
    const releaseOAuthLoading = () => {
      if (localStorage.getItem("token")) {
        clearOAuthRedirectPending();
        return;
      }
      resetNativeOAuthSession();
    };

    const onPageShow = (event) => {
      if (event.persisted || isOAuthRedirectPending()) {
        releaseOAuthLoading();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        releaseOAuthLoading();
      }
    };

    const onFocus = () => releaseOAuthLoading();

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  /** Capacitor 앱 포그라운드 복귀 시 OAuth 잠금 해제 */
  useEffect(() => {
    let handle = null;
    let cancelled = false;
    (async () => {
      try {
        await ensureCapacitorLoaded();
        if (cancelled || !Capacitor?.isNativePlatform?.()) return;
        const { App } = await import("@capacitor/app");
        handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive && !localStorage.getItem("token")) {
            resetNativeOAuthSession();
          }
        });
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
      try {
        handle?.remove();
      } catch (_) {}
    };
  }, []);

  const handleBrowse = () => router.push('/dashboard');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoggingIn) return;

    const trimmedEmail = (email || "").trim();
    const trimmedPassword = (password || "").trim();

    if (!trimmedEmail && !trimmedPassword) {
      alert(t("login.enterEmailAndPassword"));
      return;
    }
    if (!trimmedEmail) {
      alert(t("login.enterEmail"));
      return;
    }
    if (!trimmedPassword) {
      alert(t("login.enterPassword"));
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await axios.post("/api/v1/auth/login", {
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (!response.data.success) {
        const msg = response.data.message || response.data.code || t("login.unknownError");
        alert(t("login.loginFailed") + msg);
      } else {
        localStorage.setItem("token", response.data.data.accessToken);
        localStorage.setItem("refresh_token", response.data.data.refreshToken);
        window.dispatchEvent(new CustomEvent('token-stored'));
        redirectAfterLogin();
      }
    } catch (error) {
      console.error("Login failed:", error);
      const serverMsg = error.response?.data?.message || error.response?.data?.code;
      const displayMsg = serverMsg
        ? t("login.loginFailed") + serverMsg
        : t("login.loginFailedCheck");
      alert(displayMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getApiBase = getApiBaseUrl;

  const startOAuth = async (provider) => {
    // OAuth URL 은 반드시 절대(https://...) 여야 한다.
    // getApiBase() 는 same-origin 최적화로 빈 문자열("")을 돌려줄 수 있는데,
    // 그러면 oauthUrl 이 상대경로("/oauth2/...")가 되어 Android Custom Tabs(Browser.open)가
    // "Unable to display URL" 로 실패한다(웹 location.href 와 달리 절대 URL 필요).
    const base =
      getApiBase() ||
      (typeof window !== "undefined" ? window.location.origin : "");
    const oauthUrl = `${base}/oauth2/authorization/${provider}`;

    try {
      await ensureCapacitorLoaded();
    } catch (_) {}

    const isNative = !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

    if (isNative && Browser && typeof Browser.open === 'function') {
      try {
        await openNativeOAuthBrowser(oauthUrl);
      } catch (e) {
        console.error('Native OAuth browser failed:', e);
        resetNativeOAuthSession();
        window.location.href = oauthUrl;
      }
      return;
    }

    markOAuthRedirectPending();
    document.cookie = "X-App-Platform=;path=/;max-age=0";
    window.location.href = oauthUrl;
  };

  const handleKakaoLogin = () => startOAuth('kakao');
  const handleAppleLogin = () => startOAuth('apple');

  const isDisabled = isLoggingIn;

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: '#09090b' }}>

      {/* Gradient Background — 순수 CSS 정적 배경(framer-motion 미사용).
          Android WebView 호환성/성능을 위해 무한 애니메이션·blur 레이어를 쓰지 않는다.
          장식 전용이라 터치를 가로채지 않도록 pointer-events 차단. */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          pointerEvents: 'none',
          zIndex: 0,
          background:
            'radial-gradient(circle at 15% 15%, rgba(236, 72, 153, 0.18) 0%, transparent 45%),' +
            'radial-gradient(circle at 85% 85%, rgba(59, 130, 246, 0.18) 0%, transparent 45%),' +
            'radial-gradient(circle at 45% 40%, rgba(168, 85, 247, 0.12) 0%, transparent 50%)',
        }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md" style={{ zIndex: 10 }}>
        <div
          className="relative rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(17, 19, 24, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Gradient Border Effect */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, transparent 50%, rgba(59, 130, 246, 0.15) 100%)',
            }}
          />

          <div className="relative" style={{ zIndex: 10 }}>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-3">
                <img
                  src="https://img.icons8.com/color/48/film-reel.png"
                  alt=""
                  style={{ width: 36, height: 36 }}
                />
                <span
                  className="text-2xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Touraz Holic
                </span>
              </div>
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                {t("login.heroDesc")}
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Input */}
              <div className="space-y-2">
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("login.email")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Mail
                      size={20}
                      style={{
                        color: emailFocused ? '#ec4899' : '#71717a',
                        transition: 'color 0.2s',
                      }}
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    className="w-full h-12 pl-12 pr-4 rounded-xl outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: emailFocused
                        ? '1px solid rgba(236, 72, 153, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f5f7ff',
                      boxShadow: emailFocused ? '0 0 20px rgba(236, 72, 153, 0.15)' : 'none',
                    }}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("login.password")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Lock
                      size={20}
                      style={{
                        color: passwordFocused ? '#3b82f6' : '#71717a',
                        transition: 'color 0.2s',
                      }}
                    />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="w-full h-12 pl-12 pr-12 rounded-xl outline-none transition-all duration-200"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: passwordFocused
                        ? '1px solid rgba(59, 130, 246, 0.5)'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f5f7ff',
                      boxShadow: passwordFocused ? '0 0 20px rgba(59, 130, 246, 0.15)' : 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isDisabled}
                className="w-full h-12 rounded-xl font-semibold transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                  boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                }}
              >
                {isLoggingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t("login.loggingIn")}
                  </span>
                ) : (
                  t("login.loginBtn")
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span style={{ background: '#111318', padding: '0 16px', color: '#71717a' }}>
                  {t("login.or")}
                </span>
              </div>
            </div>

            {/* Social Login Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Kakao Button */}
              <button
                type="button"
                onClick={handleKakaoLogin}
                disabled={isDisabled}
                className="h-12 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: '#FEE500',
                  color: '#1a1a1a',
                  border: 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.477 2 10.75c0 2.764 1.828 5.192 4.56 6.56l-1.172 4.297a.5.5 0 0 0 .748.56l5.05-3.364c.27.02.544.03.814.03 5.523 0 10-3.477 10-7.75S17.523 3 12 3z" />
                </svg>
                {t("login.kakao")}
              </button>

              {/* Apple Button */}
              <button
                type="button"
                onClick={handleAppleLogin}
                disabled={isDisabled}
                className="h-12 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: '#000',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.6 : 1,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Apple
              </button>
            </div>

            {/* Browse Without Login */}
            <div className="mt-4">
              <button
                type="button"
                onClick={handleBrowse}
                className="w-full h-12 rounded-xl font-semibold transition-all duration-300"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                }}
              >
                {t("login.browseWithoutLogin")}
              </button>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center" style={{ fontSize: '14px', color: '#71717a' }}>
              {t("login.noAccount")}{' '}
              <button
                type="button"
                onClick={() => router.push("/signup")}
                style={{
                  color: '#3b82f6',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t("login.signup")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return <LoginContent />;
}
