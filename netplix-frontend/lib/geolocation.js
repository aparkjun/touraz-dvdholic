import { Capacitor } from "@capacitor/core";

/**
 * 기기의 실제 위치(GPS)를 가져온다.
 *
 * - 네이티브(Capacitor Android/iOS): @capacitor/geolocation 플러그인으로 런타임 권한을
 *   요청하고 OS GPS 좌표를 반환한다. (WebView 의 navigator.geolocation 은 권한 브리지가
 *   없으면 실패하므로 네이티브에서는 플러그인을 직접 사용한다.)
 * - 웹: 표준 navigator.geolocation 사용.
 *
 * 성공 시 { lat, lon, source: 'gps' } 를 반환하고, 권한 거부/실패 시 throw 한다.
 * IP 기반 추정 위치는 통신사 게이트웨이(예: 대전)로 잡혀 "가까운 매장" 결과가
 * 크게 틀어지므로, 호출부에서 GPS 실패 시에만 최후의 폴백으로 사용해야 한다.
 */
export async function getDeviceLocation({ timeout = 10000, maximumAge = 60000 } = {}) {
  if (Capacitor?.isNativePlatform?.()) {
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

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout,
      maximumAge,
    });
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      source: "gps",
    };
  }

  // 웹 브라우저
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("no-geolocation"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          source: "gps",
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout, maximumAge }
    );
  });
}
