"use client";

/**
 * 공유 유틸. 카카오톡 우선, 실패 시 Web Share API → 클립보드 복사 순으로 폴백한다.
 *
 * NEXT_PUBLIC_KAKAO_JS_KEY 가 설정되어 있으면 Kakao JS SDK 로 "Feed 템플릿" 공유를,
 * 없으면 Web Share API 또는 URL 클립보드 복사로 동작한다.
 */

let kakaoLoadingPromise = null;

export async function ensureKakao() {
  if (typeof window === "undefined") return null;
  if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) {
    return window.Kakao;
  }
  const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!key) return null;

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

/**
 * 공유를 시도한다. 성공한 채널("kakao" | "web" | "clipboard")을 반환하거나,
 * 실패 시 null을 반환한다.
 */
export async function shareContent({ title, description, imageUrl, url }) {
  const pageUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  try {
    const Kakao = await ensureKakao();
    if (Kakao && Kakao.Share) {
      Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: title || "",
          description: description || "",
          imageUrl: imageUrl || "",
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

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text: description, url: pageUrl });
      return "web";
    }
  } catch (_e) {
    // fall through (user cancelled etc.)
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && pageUrl) {
      await navigator.clipboard.writeText(pageUrl);
      return "clipboard";
    }
  } catch (_e) {}

  return null;
}

/** 토스트 없이 "복사됨" 등의 안내 문구. 호출 측에서 UI로 렌더한다. */
export function shareResultMessage(channel) {
  if (channel === "kakao") return "카카오톡 공유창을 열었어요";
  if (channel === "web") return "공유했어요";
  if (channel === "clipboard") return "링크가 복사됐어요";
  return "공유에 실패했어요";
}
