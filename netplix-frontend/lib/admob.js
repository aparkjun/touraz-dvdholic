import { Capacitor } from "@capacitor/core";

const BANNER_AD_IDS = {
  android: "ca-app-pub-8265488633224466/9832374167",
  ios: "ca-app-pub-8265488633224466/4375861916",
};

function getBannerAdId() {
  const platform = Capacitor?.getPlatform?.() ?? "web";
  return BANNER_AD_IDS[platform] ?? BANNER_AD_IDS.android;
}

let admobInitialized = false;
// 배너는 한 번 띄우면 네이티브 오버레이로 계속 떠 있다(페이지 전환에도 유지).
// 대시보드로 돌아올 때마다 showBanner 가 다시 호출되면 플러그인이 배너를 제거 후
// 재생성하며 한 번 깜빡이므로, 이미 표시 중이면 재표시하지 않는다.
let bannerShown = false;

export async function initAdMob() {
  if (admobInitialized) return;
  if (!Capacitor?.isNativePlatform?.()) return;

  try {
    const { AdMob } = await import("@capacitor-community/admob");

    const [trackingInfo] = await Promise.allSettled([
      AdMob.trackingAuthorizationStatus().catch(() => ({ status: "notDetermined" })),
    ]);
    const status = trackingInfo?.value?.status ?? "notDetermined";
    if (status === "notDetermined") {
      await AdMob.requestTrackingAuthorization().catch(() => {});
    }

    await AdMob.initialize({
      initializeForTesting: false,
    });
    admobInitialized = true;
  } catch (e) {
    console.warn("AdMob init failed:", e);
  }
}

export async function showBanner() {
  if (!Capacitor?.isNativePlatform?.()) return;
  if (bannerShown) return; // 이미 표시 중 — 재표시(깜빡임) 방지
  bannerShown = true; // 동시 호출 재진입 방지를 위해 먼저 설정

  try {
    await initAdMob();
    const { AdMob, BannerAdSize, BannerAdPosition } = await import(
      "@capacitor-community/admob"
    );
    await AdMob.showBanner({
      adId: getBannerAdId(),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: false,
    });
  } catch (e) {
    bannerShown = false; // 실패 시 다음 시도 허용
    console.warn("AdMob showBanner failed:", e);
  }
}

export async function getTrackingStatus() {
  if (!Capacitor?.isNativePlatform?.()) return "authorized";

  try {
    const { AdMob } = await import("@capacitor-community/admob");
    const info = await AdMob.trackingAuthorizationStatus();
    return info?.status ?? "notDetermined";
  } catch (e) {
    return "notDetermined";
  }
}

export async function hideBanner() {
  if (!Capacitor?.isNativePlatform?.()) return;

  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.hideBanner();
    bannerShown = false;
  } catch (e) {
    console.warn("AdMob hideBanner failed:", e);
  }
}
