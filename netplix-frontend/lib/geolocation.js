import { Capacitor } from "@capacitor/core";
import { setSharedGeo, getSharedGeo } from "@/lib/sharedGeo";

/**
 * 기기의 실제 위치(GPS/네트워크)를 가져온다.
 *
 * - 네이티브(Capacitor Android/iOS): @capacitor/geolocation 플러그인으로 런타임 권한을
 *   요청하고 OS 위치 좌표를 반환한다.
 * - 웹: 표준 navigator.geolocation 사용.
 *
 * 중요(실내 타임아웃 대응):
 *   enableHighAccuracy=true 는 위성 GPS 를 기다리느라 실내에서 수십 초가 걸리거나
 *   타임아웃 나기 쉽다. 그러면 호출부가 IP 위치(통신사 게이트웨이=대전/청주 등)로
 *   폴백해 "가까운 매장" 결과가 엉뚱해진다. 따라서 먼저 빠른 네트워크 기반(저정확도)
 *   위치를 시도하고(수 초, 도시/동 단위면 nearby 검색엔 충분), 실패할 때만 고정밀로
 *   재시도한다.
 *
 * 성공 시 { lat, lon, accuracy, source:'gps' } 반환, 권한 거부/실패 시 throw.
 */
async function nativePosition(options) {
  const { Geolocation } = await import("@capacitor/geolocation");

  let perm;
  try {
    perm = await Geolocation.checkPermissions();
  } catch (_) {
    perm = null;
  }
  const granted = (p) =>
    p && (p.location === "granted" || p.coarseLocation === "granted");

  if (!granted(perm)) {
    const req = await Geolocation.requestPermissions({
      permissions: ["location", "coarseLocation"],
    });
    if (!granted(req)) {
      const err = new Error("location-permission-denied");
      err.code = "PERMISSION_DENIED";
      throw err;
    }
  }
  return Geolocation.getCurrentPosition(options);
}

function toResult(pos) {
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    source: "gps",
  };
}

export async function getDeviceLocation({ timeout = 15000, maximumAge = 120000 } = {}) {
  if (Capacitor?.isNativePlatform?.()) {
    // 1) 빠른 네트워크(저정확도) 위치 — 실내에서도 수 초 내 확보.
    try {
      return toResult(
        await nativePosition({ enableHighAccuracy: false, timeout, maximumAge })
      );
    } catch (e) {
      if (e?.code === "PERMISSION_DENIED") throw e;
      // 2) 고정밀 재시도 (야외/위성 가능 시 더 정확)
      return toResult(
        await nativePosition({ enableHighAccuracy: true, timeout, maximumAge })
      );
    }
  }

  // 웹 브라우저: 저정확도 먼저, 실패 시 고정밀 재시도
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("no-geolocation"));
      return;
    }
    const ok = (pos) => resolve(toResult(pos));
    navigator.geolocation.getCurrentPosition(
      ok,
      () =>
        navigator.geolocation.getCurrentPosition(ok, (err) => reject(err), {
          enableHighAccuracy: true,
          timeout,
          maximumAge,
        }),
      { enableHighAccuracy: false, timeout, maximumAge }
    );
  });
}

/**
 * 위치를 한 번 확보해 앱 공유 저장소(sharedGeo)에 발행한다. 실패해도 throw 하지 않고 null.
 *
 * - Capacitor 네이티브(iOS/Android)에서는 플러그인 경로를 사용 → iOS WKWebView 에서
 *   navigator.geolocation 이 막혀 있어도 좌표를 받을 수 있다.
 * - 플러그인/네트워크가 콜백을 안 줘도 벽시계 상한(maxMs)으로 반드시 종료(무한 대기 방지).
 *
 * @returns {Promise<{lat:number, lon:number}|null>}
 */
export async function ensureSharedLocation({ maxMs = 12000 } = {}) {
  const existing = getSharedGeo();
  if (existing) return existing;

  const capped = await Promise.race([
    getDeviceLocation({ timeout: maxMs }).catch(() => null),
    new Promise((r) => setTimeout(() => r(null), maxMs + 2000)),
  ]);

  if (capped && Number.isFinite(capped.lat) && Number.isFinite(capped.lon)) {
    setSharedGeo(capped.lat, capped.lon);
    return { lat: capped.lat, lon: capped.lon };
  }
  return null;
}
