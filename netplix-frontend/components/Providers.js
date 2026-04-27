'use client';
import '@/lib/i18n';
import { detectAndApplyLanguage } from '@/lib/i18n';
import { useEffect } from 'react';
import { initFastTap } from '@/lib/useFastTap';

export default function Providers({ children }) {
  useEffect(() => {
    detectAndApplyLanguage();
  }, []);

  useEffect(() => {
    const cleanup = initFastTap();
    return cleanup;
  }, []);

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
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
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
        CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);
      } catch (_) {}
    })();
  }, []);

  return <>{children}</>;
}
