"use client";
import { useEffect } from "react";

export default function useDragScrollAll(containerRef) {
  useEffect(() => {
    const container = containerRef?.current ?? document;
    if (!container) return;

    // 드래그 스크롤을 원하는 모든 영역은 아래 셀렉터 중 하나를 클래스로 사용.
    // (dashboard 레거시 호환 + 일반 목적의 .js-drag-scroll 클래스도 지원)
    const rows = container.querySelectorAll(
      ".dashboard-scroll-row, .cinetrip-scroll-row, .js-drag-scroll"
    );
    const cleanups = [];

    rows.forEach((el) => {
      if (el._dragBound) return;
      el._dragBound = true;

      const s = {
        isDown: false,
        dragging: false,
        startX: 0,
        scrollLeft: 0,
        velX: 0,
        prevX: 0,
        prevTime: 0,
        pointerId: null,
        rafId: null,
      };

      const stopMomentum = () => {
        if (s.rafId) {
          cancelAnimationFrame(s.rafId);
          s.rafId = null;
        }
      };

      const momentum = () => {
        if (Math.abs(s.velX) < 0.1) {
          s.rafId = null;
          return;
        }
        el.scrollLeft += s.velX;
        s.velX *= 0.96;
        s.rafId = requestAnimationFrame(momentum);
      };

      const onDown = (e) => {
        stopMomentum();
        s.isDown = true;
        s.dragging = false;
        s.startX = e.clientX;
        s.prevX = e.clientX;
        s.prevTime = Date.now();
        s.scrollLeft = el.scrollLeft;
        s.velX = 0;
        s.pointerId = e.pointerId;
      };

      const onMove = (e) => {
        if (!s.isDown) return;
        const dx = e.clientX - s.startX;

        if (!s.dragging && Math.abs(dx) > 6) {
          s.dragging = true;
          el.setPointerCapture(s.pointerId);
          el.style.cursor = "grabbing";
        }

        if (!s.dragging) return;

        const now = Date.now();
        const dt = now - s.prevTime || 1;
        const instantVel = (s.prevX - e.clientX) / dt * 16;
        s.velX = s.velX * 0.4 + instantVel * 0.6;
        s.prevX = e.clientX;
        s.prevTime = now;

        el.scrollLeft = s.scrollLeft - dx;
      };

      const onUp = (e) => {
        if (!s.isDown) return;
        const wasDragging = s.dragging;
        s.isDown = false;
        s.dragging = false;

        if (wasDragging) {
          try { el.releasePointerCapture(s.pointerId); } catch {}
          el.style.cursor = "grab";
          if (Math.abs(s.velX) > 0.3) {
            s.velX *= 1.8;
            const maxVel = 60;
            if (Math.abs(s.velX) > maxVel) s.velX = s.velX > 0 ? maxVel : -maxVel;
            s.rafId = requestAnimationFrame(momentum);
          }
        }
      };

      const onClick = (e) => {
        if (s.dragging) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      el.style.cursor = "grab";
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointerleave", onUp);
      el.addEventListener("click", onClick, true);

      cleanups.push(() => {
        stopMomentum();
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointerleave", onUp);
        el.removeEventListener("click", onClick, true);
        el._dragBound = false;
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}
