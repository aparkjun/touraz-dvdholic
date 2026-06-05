import { Capacitor } from "@capacitor/core";

const BANNER_AD_IDS = {
  android: "ca-app-pub-8265488633224466/9832374167",
  ios: "ca-app-pub-8265488633224466/4375861916",
};

// 구글 공식 테스트 광고 단위(항상 채워짐) — 슬롯/연동 확인용.
const TEST_BANNER_AD_IDS = {
  android: "ca-app-pub-3940256099942544/6300978111",
  ios: "ca-app-pub-3940256099942544/2934735716",
};

// true 면 하단 사각형 광고를 "테스트 광고"로 띄워 렌더링 여부를 확실히 확인한다.
// 확인 후 false 로 되돌려 실제 광고를 송출한다.
const FOOTER_AD_TEST = false;

function getBannerAdId() {
  const platform = Capacitor?.getPlatform?.() ?? "web";
  return BANNER_AD_IDS[platform] ?? BANNER_AD_IDS.android;
}

function getFooterRectAdId() {
  const platform = Capacitor?.getPlatform?.() ?? "web";
  if (FOOTER_AD_TEST) {
    return TEST_BANNER_AD_IDS[platform] ?? TEST_BANNER_AD_IDS.android;
  }
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

/**
 * 대시보드 하단 전용 — 얇은 배너 대신 300×250 중간 직사각형(MREC)을 화면 하단 중앙에 고정.
 * WebView 특성상 콘텐츠 흐름(footer 바로 위)에 인라인으로 넣을 수 없어 하단 고정 오버레이로 띄운다.
 * 대시보드를 벗어날 때는 호출부(useEffect cleanup)에서 hideBanner 로 내려 다른 페이지를 가리지 않게 한다.
 */
export async function showFooterRectangle() {
  if (!Capacitor?.isNativePlatform?.()) return;
  if (bannerShown) return;
  bannerShown = true;

  try {
    await initAdMob();
    const { AdMob, BannerAdSize, BannerAdPosition } = await import(
      "@capacitor-community/admob"
    );
    await AdMob.showBanner({
      adId: getFooterRectAdId(),
      adSize: BannerAdSize.MEDIUM_RECTANGLE,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: FOOTER_AD_TEST,
    });
  } catch (e) {
    bannerShown = false;
    console.warn("AdMob showFooterRectangle failed:", e);
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
