"use client";
import { useEffect } from "react";

/**
 * containerRef 하위의 가로 스크롤 레일에 "마우스 드래그/터치 스와이프/휠"을 자동 바인딩.
 *
 * 대상 셀렉터:
 *   .dashboard-scroll-row (legacy), .cinetrip-scroll-row, .js-drag-scroll
 *
 * 동작:
 *  - 데스크톱(마우스): 포인터 드래그 + 관성
 *  - 휴대폰·태블릿(터치/펜): 네이티브 overflow 가로 스크롤만 사용(Netflix 느낌의 OS 관성).
 *    커스텀 드래그와 병행하면 iOS/WebView 에서 끊기거나 겹쳐 보일 수 있음.
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

    const coarsePointer =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;

    const bindRow = (el) => {
      if (!el || el._dragBound) return;
      el._dragBound = true;

      // 성능 최적화 힌트 (GPU 합성 레이어) — 마우스 드래그(데스크톱)에서만 의미가 있다.
      // 터치 기기에서는 아래 onDown 이 early-return 하여 드래그 엔진이 동작하지 않으므로
      // 이 힌트는 이득이 없고, 영구 will-change/translateZ 가 strip 마다 GPU 레이어를 만들어
      // Android WebView 에서 스크롤·리페인트 시 깜빡임을 유발한다 → 터치에서는 설정하지 않는다.
      if (!coarsePointer) {
        el.style.willChange = "scroll-position";
        el.style.transform = el.style.transform || "translateZ(0)";
      }

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
        // 터치·펜: 브라우저 네이티브 가로 스크롤(모멘텀)만 사용 — 커스텀 드래그와 이중 적용 방지
        if (e.pointerType === "touch" || e.pointerType === "pen") {
          return;
        }
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
      // 이 레일을 감싸는 "가장 가까운 세로 스크롤 조상"을 찾는다(없으면 문서). 한 번 찾으면 캐시.
      // 세로 휠을 여기로 직접 위임해, 가로 스트립이 휠 제스처를 래칭해 삼키는 현상을 우회한다.
      let vScroller; // undefined=미계산
      const resolveVScroller = () => {
        if (vScroller !== undefined) return vScroller;
        let n = el.parentElement;
        while (n && n !== document.body && n !== document.documentElement) {
          const st = window.getComputedStyle(n);
          const oy = st.overflowY;
          if (
            (oy === "auto" || oy === "scroll" || oy === "overlay") &&
            n.scrollHeight > n.clientHeight + 1
          ) {
            vScroller = n;
            return vScroller;
          }
          n = n.parentElement;
        }
        vScroller = document.scrollingElement || document.documentElement;
        return vScroller;
      };

      const onWheel = (e) => {
        const absX = Math.abs(e.deltaX);
        const absY = Math.abs(e.deltaY);

        // ── 세로 의도(세로 성분이 가로보다 우세) → 페이지로 직접 위임 ──
        // 가로 스트립(overflow-x:auto)은 Chromium/macOS 등에서 트랙패드·Magic Mouse 의
        // 연속 휠 제스처를 자신에게 '래칭'시켜 세로 스크롤을 통째로 삼킨다. 그 결과 스트립
        // 위에서는 페이지가 전혀 스크롤되지 않는다. 따라서 세로 우세 휠은 우리가 직접
        // 가장 가까운 세로 스크롤러를 움직이고 preventDefault 로 스트립의 가로 처리를 막는다.
        // (Shift+휠은 의도적 가로 스크롤이므로 아래 가로 분기로 보낸다.)
        if (!e.shiftKey && absY >= absX) {
          if (absY === 0) return;
          // deltaMode: 0=픽셀(트랙패드/Magic Mouse), 1=줄(휠 마우스), 2=페이지
          const step =
            e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
          const scroller = resolveVScroller();
          e.preventDefault();
          // 스크롤러에 scroll-behavior:smooth 가 걸려 있으면 scrollTop 누적이 매 휠마다
          // 부드러운 애니메이션을 새로 시작해 서로 상쇄되며 사실상 멈춘다(대시보드 먹통).
          // behavior:'instant' 로 강제 즉시 스크롤해 네이티브 휠과 동일하게 동작시킨다.
          scroller.scrollBy({ top: e.deltaY * step, behavior: "instant" });
          return;
        }

        // ── 가로 의도(Shift+휠 또는 가로 우세 스와이프) → 스트립 가로 스크롤(+관성) ──
        if (el.scrollWidth <= el.clientWidth + 1) return;
        const horizontalDelta = e.shiftKey ? e.deltaY : e.deltaX;
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
      /* 가로 레일: 수평은 네이티브·드래그, 세로는 페이지로 전달 (pan-x 만이면 모바일에서 위 스크롤 막힘) */
      el.style.touchAction = coarsePointer ? "pan-x pan-y" : "pan-x";

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
