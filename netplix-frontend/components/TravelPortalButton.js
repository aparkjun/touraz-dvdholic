'use client';

import React, { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/**
 * TravelPortalButton (Card variant)
 * ---------------------------------
 * "방에만 있다가 당장 떠나고 싶은" 느낌을 주는 프리미엄 여행 CTA 카드 버튼.
 *
 * 디자인 기반: 21st.dev Magic MCP Premium CTA pair.
 *  - 회전하는 3-color conic-gradient 테두리 (보딩패스/텔레포트 포털)
 *  - 가로 shimmer 스트라이프
 *  - hover 시 카드 리프트 + 아이콘 흔들림/스케일 + 화살표 슬라이드
 *  - 테마별 보조 장식 (CineTrip: 보딩패스 라인 / Pet Travel: 자연 원형 패턴)
 *
 * 테마:
 *  - cinema   : 시네틱 스카이 (teal ↔ violet ↔ sunset-orange)
 *  - outdoor  : 아침 햇살 야외 (amber ↔ teal ↔ ocean-blue)
 */
const THEMES = {
  cinema: {
    gradient: 'conic-gradient(from 0deg, #14b8a6, #8b5cf6, #f97316, #14b8a6)',
    iconBg: 'linear-gradient(135deg, #14b8a6 0%, #8b5cf6 55%, #f97316 100%)',
    textGrad: 'linear-gradient(90deg, #5eead4 0%, #c4b5fd 50%, #fdba74 100%)',
    accentColor: '#5eead4',
    glow: '0 24px 64px -20px rgba(139, 92, 246, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(20, 184, 166, 0.65)',
    tagColor: '#99f6e4',
  },
  outdoor: {
    gradient: 'conic-gradient(from 0deg, #f59e0b, #14b8a6, #0ea5e9, #f59e0b)',
    iconBg: 'linear-gradient(135deg, #f59e0b 0%, #14b8a6 55%, #0ea5e9 100%)',
    textGrad: 'linear-gradient(90deg, #fcd34d 0%, #5eead4 50%, #7dd3fc 100%)',
    accentColor: '#fcd34d',
    glow: '0 24px 64px -20px rgba(14, 165, 233, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(245, 158, 11, 0.6)',
    tagColor: '#fde68a',
  },
  // 관광사진 갤러리 전용 — "폴라로이드/필름 · 사진첩" 무드: 로즈 → 앰버 → 라벤더
  gallery: {
    gradient: 'conic-gradient(from 0deg, #f472b6, #f59e0b, #a78bfa, #fb923c, #f472b6)',
    iconBg: 'linear-gradient(135deg, #f472b6 0%, #f59e0b 55%, #a78bfa 100%)',
    textGrad: 'linear-gradient(90deg, #fda4af 0%, #fcd34d 50%, #c4b5fd 100%)',
    accentColor: '#fcd34d',
    glow: '0 24px 64px -20px rgba(244, 114, 182, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(167, 139, 250, 0.6)',
    tagColor: '#fbcfe8',
  },
  // 고캠핑 전용 — "숲속 캠프파이어/밤하늘" 무드: 그린(숲) → 앰버(모닥불) → 블루(밤하늘)
  camping: {
    gradient: 'conic-gradient(from 0deg, #16a34a, #f59e0b, #0ea5e9, #22c55e, #16a34a)',
    iconBg: 'linear-gradient(135deg, #16a34a 0%, #f59e0b 55%, #0ea5e9 100%)',
    textGrad: 'linear-gradient(90deg, #86efac 0%, #fde68a 50%, #bae6fd 100%)',
    accentColor: '#86efac',
    glow: '0 24px 64px -20px rgba(34, 197, 94, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(14, 165, 233, 0.6)',
    tagColor: '#bbf7d0',
  },
  // 웰니스관광 전용 — "정주행 번아웃 · 힐링" 무드: 민트(차) → 라벤더(명상) → 핑크(휴식)
  wellness: {
    gradient: 'conic-gradient(from 0deg, #10b981, #8b5cf6, #f472b6, #34d399, #10b981)',
    iconBg: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 55%, #f472b6 100%)',
    textGrad: 'linear-gradient(90deg, #6ee7b7 0%, #c4b5fd 50%, #fbcfe8 100%)',
    accentColor: '#6ee7b7',
    glow: '0 24px 64px -20px rgba(139, 92, 246, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(244, 114, 182, 0.6)',
    tagColor: '#a7f3d0',
  },
  // K-의료관광 전용 — "Global · Trusted" 무드: 스카이블루(신뢰) → 인디고(전문) → 레드(K-의료)
  medical: {
    gradient: 'conic-gradient(from 0deg, #0ea5e9, #6366f1, #ef4444, #38bdf8, #0ea5e9)',
    iconBg: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #ef4444 100%)',
    textGrad: 'linear-gradient(90deg, #7dd3fc 0%, #a5b4fc 50%, #fca5a5 100%)',
    accentColor: '#7dd3fc',
    glow: '0 24px 64px -20px rgba(99, 102, 241, 0.55)',
    hoverGlow: '0 36px 80px -20px rgba(239, 68, 68, 0.55)',
    tagColor: '#bae6fd',
  },
  // 오디오 가이드(Odii) 전용 — "Cine Audio Trail" 무드: 퍼플(스튜디오) → 앰버(따뜻한 내레이션) → 핑크(필름)
  audio: {
    gradient: 'conic-gradient(from 0deg, #a78bfa, #f59e0b, #ec4899, #c4b5fd, #a78bfa)',
    iconBg: 'linear-gradient(135deg, #a78bfa 0%, #f59e0b 55%, #ec4899 100%)',
    textGrad: 'linear-gradient(90deg, #c4b5fd 0%, #fde68a 50%, #f9a8d4 100%)',
    accentColor: '#c4b5fd',
    glow: '0 24px 64px -20px rgba(167, 139, 250, 0.6)',
    hoverGlow: '0 36px 80px -20px rgba(245, 158, 11, 0.6)',
    tagColor: '#ddd6fe',
  },
};

/** CineTrip용 보딩패스 사이드 라인 장식. */
function BoardingPassLines({ color = '#ffffff' }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        bottom: 14,
        width: 56,
        opacity: 0.12,
        pointerEvents: 'none',
      }}
    >
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 2,
            marginBottom: 6,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            transform: `translateX(${i * 2}px)`,
          }}
        />
      ))}
    </div>
  );
}

/** Pet Travel용 자연 원형 패턴 장식. */
function NaturePattern({ theme }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      style={{
        position: 'absolute',
        right: 10,
        bottom: 10,
        width: 110,
        height: 110,
        opacity: 0.09,
        pointerEvents: 'none',
      }}
    >
      <circle cx="20" cy="22" r="15" fill="#fcd34d" />
      <circle cx="60" cy="42" r="20" fill="#2dd4bf" />
      <circle cx="40" cy="72" r="18" fill="#0ea5e9" />
      <circle cx="82" cy="80" r="10" fill="#fb923c" />
    </svg>
  );
}

export default function TravelPortalButton({
  href,
  tag = 'Travel',
  title = 'Go adventure',
  desc = '',
  cta = 'Start Journey',
  Icon,
  theme = 'cinema',
  fullWidth = true,
}) {
  const t = THEMES[theme] || THEMES.cinema;
  const router = useRouter();
  const uidRef = useRef(`tpb-${Math.random().toString(36).slice(2, 9)}`);
  const uid = uidRef.current;

  const handleClick = (e) => {
    // motion.a 가 useRouter 의 soft-nav 보다 나은 경우가 있어, 수동 push 로 전환.
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
        .${uid}-card {
          position: relative;
          display: block;
          border-radius: 22px;
          padding: 2px;
          overflow: hidden;
          text-decoration: none;
          isolation: isolate;
          cursor: pointer;
          box-shadow: ${t.glow};
          transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1);
          width: ${fullWidth ? '100%' : 'auto'};
        }
        .${uid}-card:hover {
          transform: translateY(-8px) scale(1.015);
          box-shadow: ${t.hoverGlow};
        }
        .${uid}-card:active { transform: translateY(-3px) scale(1.0); }
        .${uid}-border {
          position: absolute;
          inset: -40%;
          background: ${t.gradient};
          animation: ${uid}-spin 6s linear infinite;
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
            radial-gradient(130% 160% at 0% 0%, rgba(255,255,255,0.04) 0%, transparent 55%),
            linear-gradient(160deg, #0b1220 0%, #0f172a 55%, #0b1220 100%);
          color: #f8fafc;
          overflow: hidden;
          min-height: 178px;
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
            rgba(255,255,255,0.16) 50%,
            rgba(255,255,255,0) 75%,
            transparent 100%
          );
          filter: blur(2px);
          animation: ${uid}-shimmer 3.6s ease-in-out infinite;
          z-index: 2;
        }
        .${uid}-icon {
          position: relative;
          z-index: 3;
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: ${t.iconBg};
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
          color: ${t.tagColor};
        }
        .${uid}-title {
          position: relative;
          z-index: 3;
          margin: 0;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.15;
          background: ${t.textGrad};
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
          color: rgba(226, 232, 240, 0.72);
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
          background: ${t.textGrad};
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
          color: ${t.accentColor};
          background: ${t.accentColor}22;
          border: 1px solid ${t.accentColor}55;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
                      background 220ms ease;
        }
        .${uid}-card:hover .${uid}-arrow {
          transform: translateX(6px) rotate(-6deg);
          background: ${t.accentColor}3a;
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
          {theme === 'cinema' ? (
            <BoardingPassLines color="#a7f3d0" />
          ) : (
            <NaturePattern theme={t} />
          )}

          <motion.span
            className={`${uid}-icon`}
            variants={{
              rest: { rotate: 0, scale: 1 },
              hover: {
                rotate: [0, -10, 10, -10, 0],
                scale: [1, 1.12, 1.12, 1.12, 1],
                transition: { duration: 0.55, times: [0, 0.2, 0.4, 0.6, 1] },
              },
            }}
          >
            {Icon ? <Icon size={26} color="#ffffff" strokeWidth={2.2} /> : null}
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
