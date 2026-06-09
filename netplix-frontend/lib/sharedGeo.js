/**
 * 앱 내에서 한 번 확보한 GPS 좌표를 메모리로 공유한다.
 *
 * 대시보드 네비의 날씨 위젯이 위치를 잡으면 여기에 발행(setSharedGeo)하고,
 * 가스 사인 등 다른 컴포넌트는 별도 GPS 호출 없이 그 좌표를 재사용한다.
 * (iOS 에서 동시에 여러 getCurrentPosition 이 뜨면 한쪽이 실패하는 문제 회피)
 */

let current = null;
const subscribers = new Set();

export function setSharedGeo(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
  current = { lat: la, lon: lo };
  for (const fn of subscribers) {
    try {
      fn(current);
    } catch (_) {
      /* 구독자 오류 무시 */
    }
  }
}

export function getSharedGeo() {
  return current;
}

/** 좌표 발행을 구독. 구독 시점에 이미 좌표가 있으면 즉시 한 번 호출한다. 해제 함수 반환. */
export function subscribeSharedGeo(fn) {
  subscribers.add(fn);
  if (current) {
    try {
      fn(current);
    } catch (_) {
      /* 무시 */
    }
  }
  return () => subscribers.delete(fn);
}
