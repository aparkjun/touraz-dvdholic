'use client';
import '@/lib/i18n';
import { detectAndApplyLanguage } from '@/lib/i18n';
import { useEffect } from 'react';

export default function Providers({ children }) {
  useEffect(() => {
    detectAndApplyLanguage();
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

    const onWheel = (e) => {
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      if (absX <= absY || absX < 1) return;
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
            const token = urlObj.searchParams.get('token');
            const refreshToken = urlObj.searchParams.get('refresh_token');
            if (token) {
              localStorage.setItem('token', token);
              if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
              sessionStorage.setItem('oauth_callback_ts', Date.now().toString());
              window.dispatchEvent(new CustomEvent('token-stored'));
              try { await Browser.close(); } catch (_) {}
              window.location.replace('/dashboard');
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
