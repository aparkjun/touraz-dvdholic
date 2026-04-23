'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

/**
 * TravelPortalButton
 * ------------------
 * "방에만 있다가 당장 떠나고 싶은" 느낌을 주는 프리미엄 여행 CTA 버튼.
 *
 * 디자인 기반: 21st.dev "Shiny Button" 패턴 (Magic MCP).
 *  - 회전하는 conic-gradient 테두리 (보딩패스/포털 느낌)
 *  - 내부 shimmer + 도트 패턴
 *  - hover 시 번쩍이는 호흡 글로우 + 아이콘 살짝 튀어오름
 *  - 화살표가 오른쪽으로 미끄러져 이동
 *
 * 두 가지 테마:
 *  - "cinema"   : 시네틱 바다 · 일몰(orange ↔ teal ↔ deep-blue)
 *  - "outdoor"  : 아침 햇살 · 숲 (gold ↔ teal ↔ emerald)
 *
 * 사용 예:
 *   <TravelPortalButton href="/cine-trip" theme="cinema" icon={Film} tag="CineTrip" label="영화로 떠나는 여행" />
 */
const THEMES = {
  cinema: {
    bg: '#0b1220',
    bgSubtle: '#142036',
    fg: '#f8fafc',
    highlight: '#38bdf8',
    highlightSoft: '#fb923c',
    ring: 'linear-gradient(135deg, #38bdf8 0%, #a78bfa 50%, #fb923c 100%)',
    tagColor: '#7dd3fc',
    subColor: 'rgba(226, 232, 240, 0.72)',
    glow: '0 20px 46px -18px rgba(56, 189, 248, 0.55), 0 0 0 1px rgba(56, 189, 248, 0.08) inset',
  },
  outdoor: {
    bg: '#06231f',
    bgSubtle: '#0e3a33',
    fg: '#f8fafc',
    highlight: '#2dd4bf',
    highlightSoft: '#fde047',
    ring: 'linear-gradient(135deg, #fde047 0%, #2dd4bf 50%, #0ea5e9 100%)',
    tagColor: '#a7f3d0',
    subColor: 'rgba(209, 250, 229, 0.78)',
    glow: '0 20px 46px -18px rgba(45, 212, 191, 0.55), 0 0 0 1px rgba(45, 212, 191, 0.08) inset',
  },
};

// CSS @property는 한 번만 선언.
let propertyRegistered = false;
function useRegisterGradientProperty() {
  useEffect(() => {
    if (propertyRegistered) return;
    if (typeof CSS === 'undefined' || !CSS.registerProperty) return;
    try {
      CSS.registerProperty({
        name: '--portal-angle',
        syntax: '<angle>',
        initialValue: '0deg',
        inherits: false,
      });
      propertyRegistered = true;
    } catch {
      /* 이미 등록된 경우 무시 */
    }
  }, []);
}

export default function TravelPortalButton({
  href,
  tag = 'Travel',
  label = 'Go adventure',
  sub = '',
  Icon,
  ArrowIcon,
  theme = 'cinema',
  fullWidth = false,
}) {
  useRegisterGradientProperty();
  const t = THEMES[theme] || THEMES.cinema;
  const [hovered, setHovered] = useState(false);
  const uidRef = useRef(`tpb-${Math.random().toString(36).slice(2, 9)}`);
  const uid = uidRef.current;

  return (
    <>
      <style>{`
        @keyframes ${uid}-spin {
          to { --portal-angle: 360deg; }
        }
        @keyframes ${uid}-breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          50%      { transform: translate(-50%, -50%) scale(1.25); opacity: 0.55; }
        }
        @keyframes ${uid}-shimmer {
          0%   { transform: translateX(-120%) skewX(-12deg); }
          60%  { transform: translateX(220%)  skewX(-12deg); }
          100% { transform: translateX(220%)  skewX(-12deg); }
        }
        @keyframes ${uid}-floaty {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        .${uid}-root {
          --portal-angle: 0deg;
          position: relative;
          display: inline-flex;
          align-items: stretch;
          text-decoration: none;
          isolation: isolate;
          border-radius: 18px;
          padding: 2px;
          background:
            linear-gradient(${t.bg}, ${t.bg}) padding-box,
            conic-gradient(from var(--portal-angle),
              transparent 0deg,
              ${t.highlight} 70deg,
              #ffffff 95deg,
              ${t.highlightSoft} 130deg,
              transparent 200deg,
              ${t.highlight} 280deg,
              transparent 360deg) border-box;
          border: 1px solid transparent;
          box-shadow: ${t.glow};
          animation: ${uid}-spin 6s linear infinite;
          transition: transform 220ms cubic-bezier(0.25, 1, 0.5, 1),
                      box-shadow 220ms cubic-bezier(0.25, 1, 0.5, 1);
        }
        .${uid}-root:hover {
          transform: translateY(-3px);
          box-shadow:
            0 26px 60px -16px ${t.highlight}66,
            0 0 0 1px ${t.highlight}33 inset;
        }
        .${uid}-root:active { transform: translateY(-1px); }

        .${uid}-surface {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 14px 20px 14px 16px;
          border-radius: 16px;
          background:
            radial-gradient(120% 180% at 0% 0%, ${t.highlight}22 0%, transparent 55%),
            radial-gradient(140% 180% at 100% 100%, ${t.highlightSoft}1f 0%, transparent 60%),
            linear-gradient(180deg, ${t.bgSubtle} 0%, ${t.bg} 100%);
          color: ${t.fg};
          overflow: hidden;
          width: ${fullWidth ? '100%' : 'auto'};
          min-width: 260px;
        }
        /* 도트 패턴 (은은하게) */
        .${uid}-dots {
          position: absolute;
          inset: 0;
          opacity: 0.18;
          pointer-events: none;
          background-image: radial-gradient(
            circle at 2px 2px, ${t.fg} 0.8px, transparent 1.1px
          );
          background-size: 14px 14px;
          mask-image: linear-gradient(to right, black, transparent 85%);
          -webkit-mask-image: linear-gradient(to right, black, transparent 85%);
        }
        /* 내부 대각선 Shimmer */
        .${uid}-shine {
          position: absolute;
          top: -20%;
          left: 0;
          width: 45%;
          height: 140%;
          pointer-events: none;
          background: linear-gradient(
            100deg,
            transparent 0%,
            ${t.fg}00 30%,
            ${t.fg}38 50%,
            ${t.fg}00 70%,
            transparent 100%
          );
          filter: blur(2px);
          animation: ${uid}-shimmer 3.6s ease-in-out infinite;
        }
        /* hover 시 중앙에서 번쩍이는 호흡 글로우 */
        .${uid}-breathe {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 70%;
          height: 240%;
          pointer-events: none;
          border-radius: 50%;
          background: radial-gradient(circle, ${t.highlight}55 0%, transparent 65%);
          opacity: 0;
        }
        .${uid}-root:hover .${uid}-breathe {
          animation: ${uid}-breathe 2.4s ease-in-out infinite;
        }
        .${uid}-iconwrap {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background:
            linear-gradient(135deg, ${t.highlight}2a 0%, ${t.highlightSoft}26 100%);
          border: 1px solid ${t.highlight}40;
          box-shadow: 0 6px 18px ${t.highlight}26, inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .${uid}-root:hover .${uid}-iconwrap {
          animation: ${uid}-floaty 1.6s ease-in-out infinite;
        }
        .${uid}-labelwrap {
          display: inline-flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .${uid}-tag {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${t.tagColor};
          opacity: 0.95;
        }
        .${uid}-label {
          font-size: 15.5px;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: ${t.fg};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .${uid}-sub {
          font-size: 11.5px;
          font-weight: 500;
          color: ${t.subColor};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .${uid}-arrow {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: ${t.fg}14;
          border: 1px solid ${t.fg}22;
          color: ${t.fg};
          transition: transform 260ms cubic-bezier(0.25, 1, 0.5, 1),
                      background 220ms ease, border-color 220ms ease;
          flex-shrink: 0;
        }
        .${uid}-root:hover .${uid}-arrow {
          transform: translateX(6px) rotate(-8deg);
          background: ${t.highlight}30;
          border-color: ${t.highlight}66;
        }
        @media (max-width: 520px) {
          .${uid}-surface { min-width: 0; width: 100%; gap: 10px; padding: 12px 14px; }
          .${uid}-iconwrap { width: 38px; height: 38px; border-radius: 10px; }
          .${uid}-label { font-size: 14px; }
          .${uid}-sub { display: none; }
          .${uid}-arrow { width: 30px; height: 30px; }
        }
      `}</style>

      <Link
        href={href}
        className={`${uid}-root`}
        aria-label={`${tag}: ${label}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: fullWidth ? '100%' : undefined }}
      >
        <span className={`${uid}-surface`}>
          <span className={`${uid}-dots`} aria-hidden />
          <span className={`${uid}-shine`} aria-hidden />
          <span className={`${uid}-breathe`} aria-hidden />

          <motion.span
            className={`${uid}-iconwrap`}
            animate={hovered ? { rotate: [0, -8, 8, 0] } : { rotate: 0 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          >
            {Icon ? <Icon size={20} color={t.fg} strokeWidth={2.1} /> : null}
          </motion.span>

          <span className={`${uid}-labelwrap`}>
            <span className={`${uid}-tag`}>{tag}</span>
            <span className={`${uid}-label`}>{label}</span>
            {sub ? <span className={`${uid}-sub`}>{sub}</span> : null}
          </span>

          <span className={`${uid}-arrow`}>
            {ArrowIcon ? (
              <ArrowIcon size={16} strokeWidth={2.2} />
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            )}
          </span>
        </span>
      </Link>
    </>
  );
}
