'use client';
import '@/lib/i18n';
import { detectAndApplyLanguage } from '@/lib/i18n';
import { useEffect } from 'react';
import { clearOAuthRedirectPending } from '@/lib/oauthPending';
import { OAUTH_BROWSER_CANCELLED, resetNativeOAuthSession } from '@/lib/oauthNativeBrowser';
import useDragScrollAll from '@/lib/useDragScroll';

export default function Providers({ children }) {
  useEffect(() => {
    detectAndApplyLanguage();
  }, []);

  // 앱 전역에서 가로 스와이프 레일(.js-drag-scroll / .dashboard-scroll-row / .cinetrip-scroll-row)에
  // 대시보드와 동일한 드래그+관성+가로휠 엔진을 통일 적용. (containerRef 미지정 → document 전체 관찰)
  useDragScrollAll(undefined);

  // Android WebView(크로미움)는 backdrop-filter/대형 blur 무한 애니메이션을 스크롤·전환 시
  // 매 프레임 다시 래스터라이즈하며 화면이 깜빡인다(iOS WebKit은 정상). 네이티브 Android 에서만
  // 무거운 합성 효과를 끄도록 <html> 에 플래그 클래스를 부여한다.
  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.getPlatform?.() === 'android') {
          document.documentElement.classList.add('is-cap-android');
        }
      } catch (_) {}
    })();
  }, []);

  // NOTE: 과거 initFastTap (touchend → manual click) 폴리필을 사용했으나,
  // 모던 모바일 WebView (iOS WKWebView / Android WebView)에서는 globals.css 의
  // `touch-action: manipulation` 만으로도 300ms 지연이 제거된다.
  // 폴리필이 합성 click 을 추가로 발생시켜 한 번의 탭이 두 번의 click 으로
  // 처리되는 더블탭/토글 무반응 버그가 발생하므로 제거함.

  useEffect(() => {
    const EDGE_PX = 30;
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    };
    const onTouchMove = (e) => {
      if (!e.touches.length) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      const isEdge = startX < EDGE_PX || startX > window.innerWidth - EDGE_PX;
      if (isEdge && dx > dy) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  useEffect(() => {
    const hasHorizontalScrollAncestor = (target) => {
      let el = target instanceof Element ? target : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const ox = style.overflowX;
        const canScrollX =
          (ox === 'auto' || ox === 'scroll' || ox === 'overlay') &&
          el.scrollWidth > el.clientWidth + 1;
        if (canScrollX) return true;
        el = el.parentElement;
      }
      return false;
    };

    const STRIP_SELECTOR =
      '.dashboard-scroll-row, .cinetrip-scroll-row, .js-drag-scroll';

    // 세로 휠을 받아 페이지를 '직접' 스크롤한다.
    // 배경: 일부 macOS Safari(Magic Mouse)에서 네이티브 휠→스크롤 변환이 동작하지 않는다
    // (휠 이벤트는 도달하고 누구도 preventDefault 하지 않으며 스크롤러는 html 인데도 scrollTop 불변,
    //  반면 키보드 스크롤은 정상). WebKit 휠 제스처 처리 이슈로 보이며, 네이티브에 의존하지 않고
    // 우리가 직접 scrollTop 을 갱신하면 모든 브라우저에서 일관되게 동작한다.
    const scrollPageByWheel = (e) => {
      // 가로 스트립(.dashboard-scroll-row 등)은 전용 드래그/휠 엔진이 처리 → 위임
      if (e.target?.closest?.(STRIP_SELECTOR)) return false;
      // 내부에 실제 세로 스크롤이 가능한 컨테이너(모달/리스트 등)가 있으면 그쪽에 맡긴다
      let n = e.target instanceof Element ? e.target : null;
      while (n && n !== document.body && n !== document.documentElement) {
        const s = window.getComputedStyle(n);
        if (
          (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          n.scrollHeight > n.clientHeight + 1
        ) {
          return false;
        }
        n = n.parentElement;
      }
      const se = document.scrollingElement || document.documentElement;
      if (!se || se.scrollHeight <= se.clientHeight + 1) return false;
      const step =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      const prev = se.style.scrollBehavior;
      se.style.scrollBehavior = 'auto'; // CSS scroll-behavior:smooth 와의 상쇄 방지(즉시 스크롤)
      se.scrollTop += e.deltaY * step;
      se.style.scrollBehavior = prev;
      return true;
    };

    const onWheel = (e) => {
      // 다른 핸들러(가로 스트립 휠, 지도 줌 등)가 이미 처리했으면 개입하지 않는다
      if (e.defaultPrevented) return;
      if (e.ctrlKey) return; // 핀치 줌(트랙패드)
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      // 세로 우세 → 페이지 직접 스크롤(네이티브 휠 미동작 Safari 우회)
      if (absY > absX) {
        if (scrollPageByWheel(e)) e.preventDefault();
        return;
      }

      // 명확한 수평 제스처(가로가 세로보다 확실히 우세)만 차단(뒤로가기 제스처 방지).
      if (absX <= absY * 1.5 || absX < 4) return;
      if (hasHorizontalScrollAncestor(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handles = [];

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform() || cancelled) return;
        const { App: CapacitorApp } = await import('@capacitor/app');
        const { Browser } = await import('@capacitor/browser');

        const handleAppUrlOpen = async (event) => {
          try {
            const urlObj = new URL(event.url);
            if (urlObj.protocol === 'dvdholic:' && urlObj.hostname === 'oauth-cancelled') {
              resetNativeOAuthSession();
              try { await Browser.close(); } catch (_) {}
              return;
            }
            const token = urlObj.searchParams.get('token');
            const refreshToken = urlObj.searchParams.get('refresh_token');
            if (token) {
              clearOAuthRedirectPending();
              localStorage.setItem('token', token);
              if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
              sessionStorage.setItem('oauth_callback_ts', Date.now().toString());
              window.dispatchEvent(new CustomEvent('token-stored'));
              try { await Browser.close(); } catch (_) {}
              window.location.replace('/mypage');
            }
          } catch (e) {
            console.error('[App] Error handling deep link:', e);
          }
        };

        /** Android 하드웨어 뒤로: 오버레이(모달) 등이 먼저 닫히도록 DOM 이벤트로 위임 */
        const handleHardwareBack = async (ev) => {
          const e = new CustomEvent('touraz-app-back', { cancelable: true, detail: { canGoBack: ev.canGoBack } });
          window.dispatchEvent(e);
          if (e.defaultPrevented) return;
          if (ev.canGoBack) {
            window.history.back();
          } else {
            try {
              await CapacitorApp.minimizeApp();
            } catch (_) {}
          }
        };

        const h1 = await CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);
        if (cancelled) {
          try {
            h1.remove();
          } catch (_) {}
          return;
        }
        handles.push(h1);

        const h2 = await CapacitorApp.addListener('backButton', handleHardwareBack);
        if (cancelled) {
          try {
            h2.remove();
          } catch (_) {}
          return;
        }
        handles.push(h2);

        const handleBrowserFinished = () => {
          if (localStorage.getItem('token')) {
            clearOAuthRedirectPending();
            return;
          }
          resetNativeOAuthSession();
        };
        const h3 = await Browser.addListener('browserFinished', handleBrowserFinished);
        if (cancelled) {
          try { h3.remove(); } catch (_) {}
          return;
        }
        handles.push(h3);
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => {
        try {
          h.remove();
        } catch (_) {}
      });
    };
  }, []);

  return <>{children}</>;
}
