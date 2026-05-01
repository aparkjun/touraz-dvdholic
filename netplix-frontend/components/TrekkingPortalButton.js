'use client';

import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Footprints } from 'lucide-react';

/**
 * TrekkingPortalButton
 * --------------------
 * "코리아둘레길 · 두루누비" 걷기여행 전용 CTA 카드 버튼.
 *
 * 디자인 기반: 21st.dev Magic MCP Fresh Trekking CTA.
 *  - 회전하는 민트·버터옐로우·스카이·모스 conic-gradient 테두리
 *  - 하단 산능선 실루엣 + 위로 번지는 일출(sunrise) 글로우
 *  - 좌측 상단에 느리게 회전하는 태양 후광
 *  - 떠다니는 나뭇잎 두 장, 좌→우로 스스로 그려지는 점선 트레일
 *  - hover 시 카드 리프트 + 아이콘 바운스 + 발자국 좌우로 "걷는" 애니메이션
 *
 * API:
 *  - href, tag, title, desc, cta, fullWidth
 */

const PALETTE = {
  border: 'conic-gradient(from 0deg, #14b8a6, #fbbf24, #0ea5e9, #6ee7b7, #14b8a6)',
  iconBg: 'linear-gradient(135deg, #14b8a6 0%, #22c55e 55%, #0ea5e9 100%)',
  textGrad: 'linear-gradient(90deg, #6ee7b7 0%, #fde68a 50%, #7dd3fc 100%)',
  accentColor: '#6ee7b7',
  glow: '0 24px 64px -20px rgba(20, 184, 166, 0.55)',
  hoverGlow: '0 36px 80px -20px rgba(251, 191, 36, 0.6)',
  tagColor: '#a7f3d0',
};

function MountainSilhouette() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 140"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: 90,
        opacity: 0.42,
        pointerEvents: 'none',
      }}
    >
      <defs>
        <linearGradient id="tpb-trek-mountain" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="tpb-trek-ridge" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path
        d="M0,140 L0,95 L40,72 L80,90 L130,48 L180,74 L230,36 L280,82 L330,58 L380,86 L400,78 L400,140 Z"
        fill="url(#tpb-trek-mountain)"
      />
      <path
        d="M0,140 L0,118 L60,98 L110,112 L160,84 L220,106 L270,92 L330,110 L400,98 L400,140 Z"
        fill="url(#tpb-trek-ridge)"
      />
    </svg>
  );
}

function SunriseGlow({ uid }) {
  return (
    <div
      aria-hidden
      className={`${uid}-sunrise`}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: -48,
        transform: 'translateX(-50%)',
        width: 280,
        height: 160,
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(245,158,11,0.28) 35%, rgba(251,191,36,0) 70%)',
        filter: 'blur(18px)',
        opacity: 0.55,
        pointerEvents: 'none',
        transition: 'opacity 360ms ease, transform 360ms ease',
      }}
    />
  );
}

function FloatingLeaves({ uid }) {
  return (
    <>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`${uid}-leaf ${uid}-leaf-1`}
        style={{
          position: 'absolute',
          top: 18,
          right: 60,
          width: 18,
          height: 18,
          color: '#6ee7b7',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      >
        <path
          fill="currentColor"
          d="M17 8C8 10 5 16 3 21l1.5 1C6 17 10 13 17 11c0-1 0-2 0-3Z M22 3c-1 4-3 7-7 9 2 1 3 3 3 5 2-1 4-5 5-10 0-2 0-3-1-4Z"
        />
      </svg>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className={`${uid}-leaf ${uid}-leaf-2`}
        style={{
          position: 'absolute',
          top: 48,
          left: 18,
          width: 14,
          height: 14,
          color: '#14b8a6',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      >
        <path
          fill="currentColor"
          d="M17 8C8 10 5 16 3 21l1.5 1C6 17 10 13 17 11c0-1 0-2 0-3Z M22 3c-1 4-3 7-7 9 2 1 3 3 3 5 2-1 4-5 5-10 0-2 0-3-1-4Z"
        />
      </svg>
    </>
  );
}

function TrailPath({ uid }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 380 60"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 62,
        width: 'calc(100% - 32px)',
        height: 36,
        opacity: 0.55,
        pointerEvents: 'none',
      }}
    >
      <path
        className={`${uid}-trail`}
        d="M4,44 C50,10 110,52 160,30 S270,12 320,34 S370,28 376,22"
        fill="none"
        stroke="#fde68a"
        strokeWidth="2.4"
        strokeDasharray="3 7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunHalo({ uid }) {
  return (
    <div
      aria-hidden
      className={`${uid}-sun`}
      style={{
        position: 'absolute',
        top: 16,
        right: 18,
        width: 70,
        height: 70,
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 35% 35%, rgba(253,224,71,0.55) 0%, rgba(251,191,36,0.18) 50%, rgba(251,191,36,0) 75%)',
        filter: 'blur(4px)',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <rect
            key={i}
            x="48"
            y="6"
            width="4"
            height="14"
            rx="2"
            fill="#fde68a"
            opacity="0.55"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </svg>
    </div>
  );
}

export default function TrekkingPortalButton({
  href = '/trekking',
  tag = 'Durunubi · Korea Trails',
  title = '코스로 떠나는 걷기여행',
  desc = '코리아둘레길 284개 코스, 숲길·바닷길·마을길을 따라 산뜻하게 걸어봐요.',
  cta = '걷기여행 코스 둘러보기',
  fullWidth = true,
}) {
  const router = useRouter();
  const uidRef = useRef(`tkp-${Math.random().toString(36).slice(2, 9)}`);
  const uid = uidRef.current;

  const handleClick = (e) => {
    e.preventDefault();
    router.push(href);
  };

  return (
    <>
      <style>{`
        @keyframes ${uid}-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ${uid}-shimmer {
          0%   { transform: translateX(-120%) skewX(-16deg); }
          60%  { transform: translateX(260%)  skewX(-16deg); }
          100% { transform: translateX(260%)  skewX(-16deg); }
        }
        @keyframes ${uid}-draw {
          from { stroke-dashoffset: 420; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes ${uid}-leafFloat1 {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          50%      { transform: translate(-4px,-6px) rotate(8deg); }
        }
        @keyframes ${uid}-leafFloat2 {
          0%, 100% { transform: translate(0,0) rotate(0deg); }
          50%      { transform: translate(5px,4px) rotate(-10deg); }
        }
        @keyframes ${uid}-sunSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .${uid}-card {
          position: relative;
          display: block;
          border-radius: 22px;
          padding: 2px;
          overflow: hidden;
          text-decoration: none;
          isolation: isolate;
          cursor: pointer;
          box-shadow: ${PALETTE.glow};
          transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1);
          width: ${fullWidth ? '100%' : 'auto'};
        }
        .${uid}-card:hover {
          transform: translateY(-8px) scale(1.015);
          box-shadow: ${PALETTE.hoverGlow};
        }
        .${uid}-card:active { transform: translateY(-3px) scale(1.0); }
        .${uid}-border {
          position: absolute;
          inset: -40%;
          background: ${PALETTE.border};
          animation: ${uid}-spin 7s linear infinite;
          z-index: 0;
        }
        .${uid}-surface {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 22px 22px 20px;
          border-radius: 20px;
          background:
            radial-gradient(120% 150% at 50% 120%, rgba(253,224,71,0.08) 0%, transparent 55%),
            radial-gradient(120% 150% at 100% 0%, rgba(14,165,233,0.06) 0%, transparent 55%),
            linear-gradient(160deg, #0b1e20 0%, #0f2a2f 55%, #0a1b1f 100%);
          color: #f0fdf4;
          overflow: hidden;
          min-height: 178px;
          font-family: var(--font-app);
        }
        .${uid}-shine {
          position: absolute;
          top: -30%;
          left: 0;
          width: 40%;
          height: 160%;
          pointer-events: none;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255,255,255,0) 25%,
            rgba(255,255,255,0.14) 50%,
            rgba(255,255,255,0) 75%,
            transparent 100%
          );
          filter: blur(2px);
          animation: ${uid}-shimmer 4s ease-in-out infinite;
          z-index: 2;
        }
        .${uid}-sun {
          animation: ${uid}-sunSpin 22s linear infinite;
          z-index: 2;
        }
        .${uid}-leaf-1 { animation: ${uid}-leafFloat1 4.2s ease-in-out infinite; z-index: 2; }
        .${uid}-leaf-2 { animation: ${uid}-leafFloat2 5.4s ease-in-out infinite; z-index: 2; }
        .${uid}-trail {
          stroke-dasharray: 3 7;
          stroke-dashoffset: 420;
          animation: ${uid}-draw 2.4s ease-in-out 0.3s forwards;
        }
        .${uid}-card:hover .${uid}-sunrise { opacity: 0.85; transform: translateX(-50%) scale(1.08); }
        .${uid}-icon {
          position: relative;
          z-index: 3;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${PALETTE.iconBg};
          box-shadow: 0 12px 30px -8px rgba(0,0,0,0.55),
                      inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .${uid}-tag {
          position: relative;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${PALETTE.tagColor};
        }
        .${uid}-title {
          position: relative;
          z-index: 3;
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.15;
          background: ${PALETTE.textGrad};
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .${uid}-desc {
          position: relative;
          z-index: 3;
          margin: 0;
          font-size: 13px;
          color: rgba(220, 252, 231, 0.78);
          line-height: 1.5;
        }
        .${uid}-cta {
          position: relative;
          z-index: 3;
          margin-top: auto;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13.5px;
          font-weight: 800;
          background: ${PALETTE.textGrad};
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .${uid}-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          color: ${PALETTE.accentColor};
          background: ${PALETTE.accentColor}22;
          border: 1px solid ${PALETTE.accentColor}55;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
                      background 220ms ease;
        }
        .${uid}-card:hover .${uid}-arrow {
          transform: translateX(6px) rotate(-6deg);
          background: ${PALETTE.accentColor}3a;
        }
        @media (max-width: 480px) {
          .${uid}-surface { padding: 18px 18px 16px; min-height: 158px; }
          .${uid}-title   { font-size: 19px; }
          .${uid}-icon    { width: 48px; height: 48px; border-radius: 14px; }
        }
      `}</style>

      <motion.a
        href={href}
        onClick={handleClick}
        className={`${uid}-card`}
        aria-label={`${tag}: ${title}`}
        whileHover="hover"
        initial="rest"
        animate="rest"
      >
        <span className={`${uid}-border`} aria-hidden />
        <span className={`${uid}-surface`}>
          <span className={`${uid}-shine`} aria-hidden />
          <MountainSilhouette />
          <SunriseGlow uid={uid} />
          <FloatingLeaves uid={uid} />
          <TrailPath uid={uid} />
          <SunHalo uid={uid} />

          <motion.span
            className={`${uid}-icon`}
            variants={{
              rest: { y: 0, rotate: 0 },
              hover: {
                y: [0, -5, 0, -3, 0],
                rotate: [0, -6, 6, -4, 0],
                transition: { duration: 0.7, times: [0, 0.25, 0.5, 0.75, 1] },
              },
            }}
          >
            <Footprints size={26} color="#ffffff" strokeWidth={2.2} />
          </motion.span>

          <span className={`${uid}-tag`}>{tag}</span>
          <h3 className={`${uid}-title`}>{title}</h3>
          {desc ? <p className={`${uid}-desc`}>{desc}</p> : null}

          <motion.span
            className={`${uid}-cta`}
            variants={{
              rest: { x: 0 },
              hover: {
                x: 4,
                transition: { type: 'spring', stiffness: 400, damping: 12 },
              },
            }}
          >
            <span>{cta}</span>
            <span className={`${uid}-arrow`}>
              <ArrowRight size={14} strokeWidth={2.4} />
            </span>
          </motion.span>
        </span>
      </motion.a>
    </>
  );
}
