"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * AmbientBackdrop — 페이지 전체에 깔리는 멋스러운 블러-도형 배경 레이어.
 *
 * 설계 의도
 *  - 로그인/회원가입/지원 페이지의 글래스모피즘 + 컬러 글로우 무드를 따라가되,
 *    똑같이 베끼지 않기 위해 "회전된 타원형 블러" 가 살짝씩 드리프트(부유) 하도록 구성.
 *  - 각 CTA 페이지마다 palette 만 바꿔주면 색감으로 페이지 정체성을 유지.
 *
 * 사용법
 *   <div style={{ position: "relative", isolation: "isolate", minHeight: "100vh" }}>
 *     <AmbientBackdrop palette={["#a855f7", "#ec4899", "#3b82f6", "#f59e0b"]} />
 *     <YourContent />
 *   </div>
 *
 *  - 컴포넌트는 position:fixed + z-index:-1 이라 부모가 만드는 스태킹 컨텍스트
 *    내부에서 콘텐츠보다 항상 뒤에 그려집니다. 부모에는 `isolation: isolate`
 *    (또는 transform 등 스태킹 컨텍스트를 만드는 속성) 을 꼭 부여해 주세요.
 *  - pointer-events:none 이라 클릭/스크롤 인터랙션을 가로막지 않습니다.
 *  - 살짝 패럴랙스 효과: 스크롤해도 도형은 뷰포트에 고정.
 */

const SHAPES = [
  { width: 620, height: 200, rotate: 12, x: "-12%", y: "6%", delay: 0.15, drift: 18, dur: 14 },
  { width: 540, height: 170, rotate: -18, x: "62%", y: "58%", delay: 0.35, drift: 22, dur: 16 },
  { width: 380, height: 130, rotate: -10, x: "4%", y: "70%", delay: 0.55, drift: 14, dur: 13 },
  { width: 300, height: 110, rotate: 22, x: "55%", y: "8%", delay: 0.75, drift: 18, dur: 15 },
  { width: 220, height: 90, rotate: -28, x: "78%", y: "32%", delay: 0.95, drift: 12, dur: 11 },
];

function ElegantShape({ shape, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -100, rotate: shape.rotate - 14 }}
      animate={{ opacity: 1, y: 0, rotate: shape.rotate }}
      transition={{
        duration: 2.2,
        delay: shape.delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      style={{
        position: "absolute",
        left: shape.x,
        top: shape.y,
        pointerEvents: "none",
        willChange: "transform",
      }}
    >
      <motion.div
        animate={{ y: [0, shape.drift, 0] }}
        transition={{ duration: shape.dur, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: shape.width,
          height: shape.height,
          borderRadius: "999px",
          background: `radial-gradient(closest-side, ${color}, transparent 72%)`,
          filter: "blur(56px)",
          opacity: 0.85,
        }}
      />
    </motion.div>
  );
}

/**
 * @param {Object} props
 * @param {string[]} props.palette  3~5 개 색상 (rgb/hex/hsl). 도형 색으로 사용.
 * @param {boolean} [props.topGlow=true]   상단 오로라 글로우 표시 여부
 * @param {boolean} [props.bottomFade=true] 하단 페이드 (콘텐츠 가독성 ↑) 표시 여부
 * @param {number}  [props.intensity=1]   전체 불투명도 (0.4 ~ 1.4)
 * @param {string}  [props.topGlowColor]  상단 글로우 색 (palette[0] 기본)
 * @param {boolean} [props.fixed=true]    true 면 fixed (패럴랙스), false 면 absolute (스크롤과 함께 이동)
 * @param {"dark"|"light"} [props.theme="dark"]  라이트 테마(밝은 배경) 페이지에서는 "light" 권장.
 *   - light 모드: 하단 페이드를 흰색 베일로 바꾸고 도형 blur 를 더 부드럽게.
 */
export default function AmbientBackdrop({
  palette = ["#a855f7", "#ec4899", "#3b82f6", "#f59e0b"],
  topGlow = true,
  bottomFade = true,
  intensity = 1,
  topGlowColor,
  fixed = true,
  theme = "dark",
}) {
  const colors = useMemo(() => {
    const padded = [...palette];
    while (padded.length < SHAPES.length) padded.push(palette[padded.length % palette.length]);
    return padded;
  }, [palette]);

  const glowColor = topGlowColor || palette[0] || "#a855f7";

  return (
    <div
      aria-hidden
      style={{
        position: fixed ? "fixed" : "absolute",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: intensity,
      }}
    >
      {topGlow && (
        <div
          style={{
            position: "absolute",
            top: -160,
            left: "5%",
            right: "5%",
            height: 460,
            background: `radial-gradient(50% 100% at 50% 0%, ${glowColor}55 0%, transparent 70%)`,
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />
      )}

      {SHAPES.map((shape, i) => (
        <ElegantShape key={i} shape={shape} color={colors[i % colors.length]} />
      ))}

      {bottomFade && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "32vh",
            background:
              theme === "light"
                ? "linear-gradient(0deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 40%, transparent 100%)"
                : "linear-gradient(0deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
