"use client";
import { useEffect } from "react";

/**
 * containerRef 하위의 가로 스크롤 레일에 "마우스 드래그/터치 스와이프/휠"을 자동 바인딩.
 *
 * 대상 셀렉터:
 *   .dashboard-scroll-row (legacy), .cinetrip-scroll-row, .js-drag-scroll
 *
 * 동작:
 *  - 왼쪽 마우스 버튼 / 터치 / 펜 으로 좌우 드래그 → 관성 스크롤 포함
 *  - 6px 이상 이동해야 드래그로 인식(→ 가벼운 클릭은 버튼/링크로 전달)
 *  - 명시적 수평 휠(Shift+wheel 또는 트랙패드 수평 제스처 |deltaX|>|deltaY|)만
 *    수평 스크롤로 매핑(관성/스무딩 포함). 일반 수직 휠은 페이지의 기본
 *    세로 스크롤을 방해하지 않도록 통과시킴.
 *  - pointermove 이벤트는 rAF 로 스로틀하여 고주사율 디스플레이에서 지터 제거
 *
 * 동적 마운트 대응:
 *  - MutationObserver 로 containerRef 하위에 새로 추가되는 레일도 즉시 바인딩
 */
const SELECTOR = ".dashboard-scroll-row, .cinetrip-scroll-row, .js-drag-scroll";

// 엔진 튜닝 파라미터(감각은 체감 기반)
const DRAG_THRESHOLD_PX = 6;
/** 포인터 이동 1px당 스크롤 거리 배율(>1이면 같은 제스처로 더 빨리 넘김) */
const DRAG_SCROLL_MULTIPLIER = 1.45;
const MOMENTUM_DECAY = 0.945;         // 관성 감속(1에 가까울수록 멀리 미끄러짐)
const MOMENTUM_CUTOFF = 0.4;          // 관성 종료 임계 속도(px/frame)
const RELEASE_VELOCITY_BOOST = 1.28;  // 손 뗄 때 관성 시작 속도
const MAX_VELOCITY_PX_PER_FRAME = 72; // 관성 상한(px/frame)
const WHEEL_HORIZONTAL_RATIO = 1.25; // 트랙패드/Shift휠 수평 스크롤 강도
const WHEEL_MOMENTUM_DECAY = 0.9;     // 휠 이후 관성 감속

export default function useDragScrollAll(containerRef) {
  useEffect(() => {
    const container =
      containerRef?.current ?? (typeof document !== "undefined" ? document : null);
    if (!container) return;

    const cleanups = [];

    const bindRow = (el) => {
      if (!el || el._dragBound) return;
      el._dragBound = true;

      // 성능 최적화 힌트 (GPU 합성 레이어)
      el.style.willChange = "scroll-position";
      el.style.transform = el.style.transform || "translateZ(0)";

      const s = {
        isDown: false,
        dragging: false,
        startX: 0,
        startScrollLeft: 0,
        currentX: 0,
        prevX: 0,
        prevTime: 0,
        velX: 0,
        pointerId: null,
        rafId: null,
        pendingTarget: null, // rAF 에서 반영할 목표 scrollLeft
      };

      // 스와이프 중 자식 hover 이벤트를 막아 리페인트 폭주 방지용 클래스 토글
      const setScrolling = (on) => {
        if (on) el.classList.add("is-scrolling");
        else el.classList.remove("is-scrolling");
      };

      const stopMomentum = () => {
        if (s.rafId) {
          cancelAnimationFrame(s.rafId);
          s.rafId = null;
        }
        setScrolling(false);
      };

      // rAF 에서 pendingTarget 이 있으면 실제 scrollLeft 반영
      const flushPending = () => {
        if (s.pendingTarget != null) {
          el.scrollLeft = s.pendingTarget;
          s.pendingTarget = null;
        }
        s.rafId = null;
        // 드래그 중이면 다음 프레임도 예약
        if (s.dragging) {
          s.rafId = requestAnimationFrame(flushPending);
        }
      };

      // 관성 감속
      const momentum = () => {
        if (Math.abs(s.velX) < MOMENTUM_CUTOFF) {
          s.rafId = null;
          setScrolling(false);
          return;
        }
        el.scrollLeft += s.velX;
        s.velX *= MOMENTUM_DECAY;
        s.rafId = requestAnimationFrame(momentum);
      };

      const onDown = (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;

        // 터치(pen 포함)에서는 pointerdown 에 preventDefault 를 걸지 않는다.
        // - 일부 WebView 에서 자식 버튼/카드의 click 합성을 방해해
        //   "한 번 탭이 안 먹는" 현상을 일으킨다.
        // - 가로 스와이프 차단은 CSS `touch-action: pan-y` 가 처리한다.
        // - 텍스트 선택 방지는 CSS `user-select: none` 가 처리한다.
        // 마우스 드래그에서는 텍스트 선택을 막기 위해 그대로 preventDefault 한다.
        if (e.pointerType === "mouse" && e.cancelable) {
          try { e.preventDefault(); } catch {}
        }

        stopMomentum();
        s.isDown = true;
        s.dragging = false;
        s.startX = e.clientX;
        s.currentX = e.clientX;
        s.prevX = e.clientX;
        s.prevTime = performance.now();
        s.startScrollLeft = el.scrollLeft;
        s.velX = 0;
        s.pointerId = e.pointerId;
      };

      const onMove = (e) => {
        if (!s.isDown) return;
        const dx = e.clientX - s.startX;

        if (!s.dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
          s.dragging = true;
          try { el.setPointerCapture(s.pointerId); } catch {}
          el.style.cursor = "grabbing";
          setScrolling(true);
          // 드래그 시작 시 rAF 플러싱 루프 가동
          if (!s.rafId) s.rafId = requestAnimationFrame(flushPending);
        }
        if (!s.dragging) return;

        // 속도 측정 (지수 이동평균으로 지터 완화)
        const now = performance.now();
        const dt = Math.max(now - s.prevTime, 1);
        const instantVel =
          ((s.prevX - e.clientX) / dt) * 16 * DRAG_SCROLL_MULTIPLIER; // 관성이 화면 속도와 맞도록 동일 배율
        s.velX = s.velX * 0.5 + instantVel * 0.5;
        s.prevX = e.clientX;
        s.prevTime = now;
        s.currentX = e.clientX;

        // 목표 scrollLeft 만 갱신 — 실제 반영은 rAF 에서 한 번에
        s.pendingTarget = s.startScrollLeft - dx * DRAG_SCROLL_MULTIPLIER;
      };

      const onUp = () => {
        if (!s.isDown) return;
        const wasDragging = s.dragging;
        s.isDown = false;
        s.dragging = false;

        // 드래그 중 남은 pendingTarget 즉시 반영
        if (s.pendingTarget != null) {
          el.scrollLeft = s.pendingTarget;
          s.pendingTarget = null;
        }
        stopMomentum();

        if (wasDragging) {
          try { el.releasePointerCapture(s.pointerId); } catch {}
          el.style.cursor = "grab";
          if (Math.abs(s.velX) > 0.5) {
            s.velX *= RELEASE_VELOCITY_BOOST;
            if (Math.abs(s.velX) > MAX_VELOCITY_PX_PER_FRAME) {
              s.velX = s.velX > 0 ? MAX_VELOCITY_PX_PER_FRAME : -MAX_VELOCITY_PX_PER_FRAME;
            }
            // 관성 구간 동안도 .is-scrolling 유지(자식 hover 차단)
            setScrolling(true);
            s.rafId = requestAnimationFrame(momentum);
          } else {
            setScrolling(false);
          }
        }
      };

      const onClick = (e) => {
        // 드래그가 발생한 직후의 click 은 버블 차단(버튼 누름 방지)
        if (Math.abs(s.currentX - s.startX) > DRAG_THRESHOLD_PX && s.isDown === false) {
          // onUp 이후 즉시 들어오는 click 방어
          e.preventDefault();
          e.stopPropagation();
        }
      };

      const onDragStart = (e) => { e.preventDefault(); };

      // ─── 마우스 휠 → 수평 스크롤 (관성 포함) ────────────────────────
      let wheelVelX = 0;
      let wheelRaf = null;
      const wheelTick = () => {
        if (Math.abs(wheelVelX) < MOMENTUM_CUTOFF) {
          wheelRaf = null;
          setScrolling(false);
          return;
        }
        el.scrollLeft += wheelVelX;
        wheelVelX *= WHEEL_MOMENTUM_DECAY;
        wheelRaf = requestAnimationFrame(wheelTick);
      };
      const onWheel = (e) => {
        // 컨테이너가 실제로 가로 스크롤 가능한지 먼저 확인
        if (el.scrollWidth <= el.clientWidth + 1) return;

        // 명시적 수평 제스처만 가로 스크롤로 매핑:
        //  - Shift+휠 (데스크탑 휠 마우스에서 의도적 수평 스크롤)
        //  - 트랙패드 수평 스와이프 (|deltaX| > |deltaY|)
        // 일반 수직 휠(마우스 트랙볼 위/아래)은 페이지 세로 스크롤을
        // 방해하지 않도록 통과시킴.
        const horizontalDelta = e.shiftKey
          ? e.deltaY
          : Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : 0;
        if (horizontalDelta === 0) return;

        e.preventDefault();
        setScrolling(true);
        wheelVelX =
          wheelVelX * 0.6 + horizontalDelta * WHEEL_HORIZONTAL_RATIO * 0.4;
        if (Math.abs(wheelVelX) > MAX_VELOCITY_PX_PER_FRAME) {
          wheelVelX =
            wheelVelX > 0 ? MAX_VELOCITY_PX_PER_FRAME : -MAX_VELOCITY_PX_PER_FRAME;
        }
        el.scrollLeft += horizontalDelta * WHEEL_HORIZONTAL_RATIO * 0.5;
        if (!wheelRaf) wheelRaf = requestAnimationFrame(wheelTick);
      };

      el.style.cursor = "grab";
      el.style.touchAction = "pan-y";

      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
      el.addEventListener("pointerleave", onUp);
      el.addEventListener("click", onClick, true);
      el.addEventListener("dragstart", onDragStart);
      el.addEventListener("wheel", onWheel, { passive: false });

      cleanups.push(() => {
        stopMomentum();
        if (wheelRaf) cancelAnimationFrame(wheelRaf);
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        el.removeEventListener("pointerleave", onUp);
        el.removeEventListener("click", onClick, true);
        el.removeEventListener("dragstart", onDragStart);
        el.removeEventListener("wheel", onWheel);
        el._dragBound = false;
      });
    };

    const queryRoot = (root) => {
      if (root.nodeType !== 1 && root !== document) return;
      if (root.matches && root.matches(SELECTOR)) bindRow(root);
      const list = root.querySelectorAll ? root.querySelectorAll(SELECTOR) : [];
      list.forEach(bindRow);
    };

    queryRoot(container);

    let observer = null;
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          m.addedNodes.forEach((node) => queryRoot(node));
        }
      });
      observer.observe(container, { childList: true, subtree: true });
    }

    return () => {
      if (observer) observer.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [containerRef]);
}
