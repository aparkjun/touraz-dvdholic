"use client";

import { useEffect, useState } from "react";

/**
 * 휠 스크롤 진단용 임시 오버레이.
 * 활성 조건: URL 에 `?wheeldebug=1` 이 있거나 localStorage.wheeldebug==='1'.
 * 일반 사용자에게는 렌더되지 않는다(조건 미충족 시 null).
 *
 * 표시 내용:
 *  - 휠 이벤트 누적 횟수 / 마지막 deltaX,deltaY,deltaMode
 *  - 마지막 이벤트의 defaultPrevented 여부 (누군가 preventDefault 했는지)
 *  - 현재 페이지 scrollTop (실시간) — 휠을 굴릴 때 값이 변하는지 확인
 *  - 이벤트 타깃 태그/클래스
 */
export default function WheelDebugOverlay() {
  const [on, setOn] = useState(false);
  const [info, setInfo] = useState({
    count: 0,
    dx: 0,
    dy: 0,
    mode: 0,
    prevented: false,
    scrollTop: 0,
    maxScroll: 0,
    target: "",
    se: "",
    nativeDelta: 0,
    scroller: "",
    scrollerCanScroll: false,
  });

  useEffect(() => {
    let active = false;
    try {
      const q = new URLSearchParams(window.location.search);
      active = q.get("wheeldebug") === "1" || localStorage.getItem("wheeldebug") === "1";
      if (q.get("wheeldebug") === "1") localStorage.setItem("wheeldebug", "1");
      if (q.get("wheeldebug") === "0") {
        localStorage.removeItem("wheeldebug");
        active = false;
      }
    } catch (_) {}
    if (!active) return;
    setOn(true);

    const se = () => document.scrollingElement || document.documentElement;
    const desc = (n) =>
      n && n.nodeType === 1
        ? `${n.tagName.toLowerCase()}.${(n.className || "").toString().slice(0, 24)}`
        : String(n);

    // 휠 타깃에서 위로 올라가며 '세로로 스크롤 가능한 가장 가까운 컨테이너'를 찾는다.
    // (Safari 가 휠을 래칭시키는 후보. overflow-y 가 hidden 이어도 스크롤 컨테이너가 될 수 있어 포함)
    const nearestVScroller = (t) => {
      let n = t && t.nodeType === 1 ? t : null;
      while (n && n !== document.body && n !== document.documentElement) {
        const s = getComputedStyle(n);
        const oy = s.overflowY;
        if (
          (oy === "auto" || oy === "scroll" || oy === "overlay" || oy === "hidden") &&
          n.scrollHeight > n.clientHeight + 1
        ) {
          return { el: n, canScroll: oy !== "hidden" };
        }
        n = n.parentElement;
      }
      const root = se();
      return { el: root, canScroll: root.scrollHeight > root.clientHeight + 1 };
    };

    let beforeTop = 0;

    // 캡처 단계(가장 먼저) — 델타·타깃·스크롤러 기록
    const onCapture = (e) => {
      const sc = se();
      beforeTop = sc.scrollTop;
      const vs = nearestVScroller(e.target);
      setInfo((p) => ({
        ...p,
        count: p.count + 1,
        dx: Math.round(e.deltaX * 100) / 100,
        dy: Math.round(e.deltaY * 100) / 100,
        mode: e.deltaMode,
        target: desc(e.target),
        scrollTop: Math.round(sc.scrollTop),
        maxScroll: Math.round(sc.scrollHeight - sc.clientHeight),
        se: sc.tagName,
        scroller: desc(vs.el),
        scrollerCanScroll: vs.canScroll,
      }));
    };

    // 버블 단계(가장 나중) — preventDefault 여부 + 네이티브 스크롤이 실제로 일어났는지(Δ)
    const onBubble = (e) => {
      setInfo((p) => ({ ...p, prevented: e.defaultPrevented }));
      requestAnimationFrame(() => {
        const sc = se();
        setInfo((p) => ({
          ...p,
          scrollTop: Math.round(sc.scrollTop),
          nativeDelta: Math.round(sc.scrollTop - beforeTop),
        }));
      });
    };

    window.addEventListener("wheel", onCapture, { capture: true, passive: true });
    window.addEventListener("wheel", onBubble, { passive: true });
    return () => {
      window.removeEventListener("wheel", onCapture, { capture: true });
      window.removeEventListener("wheel", onBubble);
    };
  }, []);

  if (!on) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        font: "12px/1.5 monospace",
        padding: "8px 10px",
        borderRadius: 8,
        pointerEvents: "none",
        whiteSpace: "pre",
        maxWidth: "90vw",
      }}
    >
      {`WHEEL DEBUG (?wheeldebug=0 으로 끄기)
events : ${info.count}
deltaX : ${info.dx}   deltaY : ${info.dy}   mode : ${info.mode}
prevented : ${info.prevented}
scroller(se) : ${info.se}
scrollTop : ${info.scrollTop} / max ${info.maxScroll}
nativeΔ(휠후 변화) : ${info.nativeDelta}
latch대상 : ${info.scroller}
  ↳ canScroll : ${info.scrollerCanScroll}
target : ${info.target}`}
    </div>
  );
}
