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
  } catch (e) {
    console.warn("AdMob hideBanner failed:", e);
  }
}
