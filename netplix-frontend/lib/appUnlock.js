import { Capacitor, registerPlugin } from "@capacitor/core";

/** 스토어 일회성 제품 ID — Play/원스토어 콘솔 값과 반드시 같아야 함 */
export const UNLOCK_PRODUCT_ID = "dvdholic_unlock";

export const UNLOCK_PRICE_LABEL = "₩1,000";

const AppUnlock = registerPlugin("AppUnlock", {
  web: {
    async isUnlocked() {
      return { unlocked: false };
    },
    async restore() {
      return { unlocked: false };
    },
    async getProduct() {
      return { productId: UNLOCK_PRODUCT_ID, price: UNLOCK_PRICE_LABEL };
    },
    async purchase() {
      return { unlocked: false };
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

/** 브리지가 조금 늦게 붙는 WebView에서도 잠금 여부를 다시 확인한다. */
export function waitForAndroidNative(timeoutMs = 2000) {
  if (isAndroidNative()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isAndroidNative()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tick, 200);
    };
    setTimeout(tick, 200);
  });
}

export async function queryUnlocked() {
  if (!isAndroidNative()) return true;
  try {
    const res = await AppUnlock.isUnlocked();
    return res?.unlocked === true;
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
    return { productId: UNLOCK_PRODUCT_ID, price: UNLOCK_PRICE_LABEL };
  }
}
