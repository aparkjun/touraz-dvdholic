import { Capacitor, registerPlugin } from "@capacitor/core";

/** Play Console 일회성 제품 ID — 콘솔 값과 반드시 같아야 함 */
export const UNLOCK_PRODUCT_ID = "dvdholic_unlock";

const AppUnlock = registerPlugin("AppUnlock", {
  web: {
    async isUnlocked() {
      return { unlocked: true };
    },
    async restore() {
      return { unlocked: true };
    },
    async getProduct() {
      return { productId: UNLOCK_PRODUCT_ID, price: "₩1,000" };
    },
    async purchase() {
      return { unlocked: true };
    },
  },
});

export function isAndroidNative() {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export function hasUnlockPlugin() {
  try {
    return Capacitor.isPluginAvailable("AppUnlock");
  } catch {
    return false;
  }
}

/** 안드로이드 + 결제 플러그인이 있을 때만 잠근다. 웹·iOS·구버전 APK는 통과. */
export function shouldLockApp() {
  return isAndroidNative() && hasUnlockPlugin();
}

export async function queryUnlocked() {
  if (!shouldLockApp()) return true;
  try {
    const res = await AppUnlock.isUnlocked();
    return !!res?.unlocked;
  } catch {
    return false;
  }
}

export async function restoreUnlock() {
  const res = await AppUnlock.restore();
  return !!res?.unlocked;
}

export async function purchaseUnlock() {
  const res = await AppUnlock.purchase();
  return res || { unlocked: false };
}

export async function fetchUnlockProduct() {
  try {
    return await AppUnlock.getProduct();
  } catch {
    return { productId: UNLOCK_PRODUCT_ID, price: "₩1,000" };
  }
}
