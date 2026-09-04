"use client";

import { Capacitor } from "@capacitor/core";

/**
 * 공유 유틸. 앱(WebView·TWA)에서는 시스템 공유 시트를 먼저 쓰고,
 * 카카오 JS SDK 는 일반 브라우저에서만 시도한다.
 *
 * Kakao.Share.sendDefault 는 앱 키/도메인이 안 맞으면 sharer.kakao.com 에서
 * "잘못된 요청으로 인증에 실패하였습니다" 페이지만 연다. 그 호출은 예외를 안 던져
 * 폴백(Web Share·클립보드)까지 가지 못한다.
 */

let kakaoLoadingPromise = null;

const DEFAULT_SHARE_IMAGE =
  "https://touraz-dvdholic-2194adc70fa6.herokuapp.com/AppIcon-touraz-holic-1024.png";

function isInAppBrowser() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  try {
    if (Capacitor?.isNativePlatform?.() === true) return true;
  } catch (_e) {
    /* ignore */
  }
  if (window.Capacitor?.isNativePlatform?.() === true) return true;
  if (/; wv\)|WebView/i.test(ua)) return true;
  const proto = window.location?.protocol || "";
  if (proto.startsWith("capacitor") || proto.startsWith("ionic") || proto === "file:") {
    return true;
  }
  return false;
}

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

function looksLikeKakaoJsKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed === "YOUR_KAKAO_APP_KEY") return false;
  return trimmed.length >= 10;
}

function httpsImage(url) {
  if (url && /^https:\/\//i.test(url)) return url;
  return DEFAULT_SHARE_IMAGE;
}

export async function ensureKakao() {
  if (typeof window === "undefined") return null;
  if (isInAppBrowser()) return null;
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!looksLikeKakaoJsKey(key)) return null;

  if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
    return window.Kakao;
  }

  if (!kakaoLoadingPromise) {
    kakaoLoadingPromise = new Promise((resolve, reject) => {
      if (window.Kakao) {
        resolve(window.Kakao);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://developers.kakao.com/sdk/js/kakao.js";
      s.async = true;
      s.onload = () => resolve(window.Kakao || null);
      s.onerror = () => reject(new Error("Kakao SDK 로드 실패"));
      document.head.appendChild(s);
    });
  }
  try {
    const Kakao = await kakaoLoadingPromise;
    if (Kakao && !Kakao.isInitialized()) {
      Kakao.init(key);
    }
    return Kakao;
  } catch (_e) {
    return null;
  }
}

async function shareViaWebApi({ title, description, pageUrl }) {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({
      title: title || "",
      text: description || "",
      url: pageUrl,
    });
    return true;
  } catch (e) {
    if (e && e.name === "AbortError") return true;
    return false;
  }
}

async function shareViaClipboard(pageUrl) {
  if (typeof navigator === "undefined" || !navigator.clipboard || !pageUrl) return false;
  try {
    await navigator.clipboard.writeText(pageUrl);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * 공유를 시도한다. 성공한 채널("kakao" | "web" | "clipboard")을 반환하거나,
 * 실패 시 null을 반환한다.
 */
export async function shareContent({ title, description, imageUrl, url }) {
  const pageUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const payload = { title, description, pageUrl };

  if (isInAppBrowser() || isMobileUa()) {
    if (await shareViaWebApi(payload)) return "web";
    if (await shareViaClipboard(pageUrl)) return "clipboard";
    return null;
  }

  try {
    const Kakao = await ensureKakao();
    if (Kakao && Kakao.Share) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: title || "",
          description: description || "",
          imageUrl: httpsImage(imageUrl),
          link: {
            mobileWebUrl: pageUrl,
            webUrl: pageUrl,
          },
        },
        buttons: [
          {
            title: "앱에서 열기",
            link: { mobileWebUrl: pageUrl, webUrl: pageUrl },
          },
        ],
      });
      return "kakao";
    }
  } catch (_e) {
    // fall through
  }

  if (await shareViaWebApi(payload)) return "web";
  if (await shareViaClipboard(pageUrl)) return "clipboard";
  return null;
}

/** 토스트 없이 "복사됨" 등의 안내 문구. 호출 측에서 UI로 렌더한다. */
export function shareResultMessage(channel) {
  if (channel === "kakao") return "카카오톡 공유창을 열었어요";
  if (channel === "web") return "공유했어요";
  if (channel === "clipboard") return "링크가 복사됐어요";
  return "공유에 실패했어요";
}
