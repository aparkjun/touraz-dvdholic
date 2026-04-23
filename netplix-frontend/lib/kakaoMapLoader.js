// Kakao Maps JavaScript SDK 동적 로더
// - autoload=false 로 한 번만 주입하고, kakao.maps.load() 를 통해 초기화한다.
// - 여러 컴포넌트가 동시에 호출하더라도 단일 Promise 를 공유한다.
// - 키는 NEXT_PUBLIC_KAKAO_MAP_KEY 에서 읽는다.

let sdkPromise = null;

/**
 * Kakao Maps SDK 를 로드한 뒤 전역 `window.kakao` 객체를 resolve 한다.
 *
 * @param {object} [options]
 * @param {string[]} [options.libraries] - 추가 라이브러리 ex) ['services', 'clusterer']
 * @returns {Promise<any>} kakao 네임스페이스
 */
export function loadKakaoMapsSdk({ libraries = [] } = {}) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao Maps SDK는 브라우저에서만 로드할 수 있습니다.'));
  }

  // 이미 로드 완료된 경우 곧바로 반환
  if (window.kakao && window.kakao.maps && typeof window.kakao.maps.LatLng === 'function') {
    return Promise.resolve(window.kakao);
  }

  if (sdkPromise) return sdkPromise;

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  if (!appKey) {
    return Promise.reject(
      new Error(
        'Kakao Maps JavaScript 키가 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_KAKAO_MAP_KEY 를 지정해주세요.'
      )
    );
  }

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('kakao-maps-sdk');
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(() => resolve(window.kakao));
        } else {
          reject(new Error('Kakao Maps SDK 로드 실패'));
        }
      });
      existing.addEventListener('error', () =>
        reject(new Error('Kakao Maps SDK 스크립트를 불러올 수 없습니다.'))
      );
      return;
    }

    const params = new URLSearchParams({
      appkey: appKey,
      autoload: 'false',
    });
    if (libraries.length > 0) params.set('libraries', libraries.join(','));

    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?${params.toString()}`;
    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
      } else {
        reject(new Error('Kakao Maps SDK 로드 실패'));
      }
    };
    script.onerror = () =>
      reject(
        new Error(
          '카카오 지도 스크립트를 불러올 수 없습니다. 앱 키/도메인 허용 설정을 확인하세요.'
        )
      );
    document.head.appendChild(script);
  });

  return sdkPromise;
}
