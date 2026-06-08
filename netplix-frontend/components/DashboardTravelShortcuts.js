'use client';

import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  PawPrint,
  PlaneTakeoff,
  Camera,
  Tent,
  Leaf,
  Stethoscope,
  Headphones,
  Radar,
  Compass,
  Footprints,
  Clapperboard,
  MapPinned,
  ShieldCheck,
} from 'lucide-react';

const TRAVEL_SHORTCUTS = [
  { href: '/cine-trip', shortcutKey: 'cineTrip', Icon: PlaneTakeoff, jewel: 'dts-jewel-0' },
  { href: '/film-scenic', shortcutKey: 'filmScenic', Icon: Clapperboard, jewel: 'dts-jewel-10' },
  { href: '/pet-travel', shortcutKey: 'petTravel', Icon: PawPrint, jewel: 'dts-jewel-1' },
  { href: '/trekking', shortcutKey: 'trekking', Icon: Footprints, jewel: 'dts-jewel-2' },
  { href: '/photo-gallery', shortcutKey: 'photoGallery', Icon: Camera, jewel: 'dts-jewel-3' },
  { href: '/camping', shortcutKey: 'camping', Icon: Tent, jewel: 'dts-jewel-4' },
  { href: '/wellness', shortcutKey: 'wellness', Icon: Leaf, jewel: 'dts-jewel-5' },
  { href: '/medical-tourism', shortcutKey: 'medical', Icon: Stethoscope, jewel: 'dts-jewel-6' },
  { href: '/audio-guide', shortcutKey: 'audio', Icon: Headphones, jewel: 'dts-jewel-7' },
  { href: '/crowd-radar', shortcutKey: 'radar', Icon: Radar, jewel: 'dts-jewel-8' },
  { href: '/related-spots?discover=trending', shortcutKey: 'related', Icon: Compass, jewel: 'dts-jewel-9' },
  { href: '/safe-tourism', shortcutKey: 'safeTourism', Icon: ShieldCheck, jewel: 'dts-jewel-11' },
  { href: '/korea-corners', shortcutKey: 'koreaCorners', Icon: MapPinned, jewel: 'dts-jewel-12' },
];

// 클릭 시 사방으로 튀는 스파클 색상 팔레트
const SPARK_COLORS = [
  '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24',
  '#34d399', '#60a5fa', '#fb7185', '#fde047',
];

/**
 * 개별 바로가기 버튼.
 * 클릭하면 젤리처럼 말랑 눌렸다가 → 충격파 링 + 색색깔 스파클이 터지고
 * → 아이콘이 통통 튀는 "톡!" 인터랙션 후 페이지로 이동한다.
 */
function ShortcutLink({ href, label, Icon, jewel }) {
  const router = useRouter();
  const anchorRef = useRef(null);
  const [bursting, setBursting] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [sparks, setSparks] = useState([]);

  const handleClick = useCallback(
    (e) => {
      // 모바일(iOS 저전력 모드 등)에서도 항상 보이도록 동작 제한 게이트 제거.
      // 탭 시 잠깐 나타나는 일회성 피드백이라 접근성 영향은 작다.
      if (bursting) return;

      e.preventDefault();

      const rect = anchorRef.current?.getBoundingClientRect();
      // 클릭 지점(키보드 활성화 시 좌표가 0이면 버튼 중앙에서 터뜨림)
      const cx =
        rect && e.clientX ? e.clientX - rect.left : (rect ? rect.width / 2 : 0);
      const cy =
        rect && e.clientY ? e.clientY - rect.top : (rect ? rect.height / 2 : 0);

      const count = 12;
      const newSparks = Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
        const dist = 28 + Math.random() * 30;
        return {
          id: `${Date.now()}-${i}`,
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          color: SPARK_COLORS[i % SPARK_COLORS.length],
          scale: 0.6 + Math.random() * 0.9,
          rot: Math.floor(Math.random() * 360),
        };
      });

      setOrigin({ x: cx, y: cy });
      setSparks(newSparks);
      setBursting(true);

      // 버튼이 눌리는 모양(젤리)이 보이자마자 바로 이동 — 끊김 없이 빠르게.
      window.setTimeout(() => router.push(href), 150);
      window.setTimeout(() => {
        setBursting(false);
        setSparks([]);
      }, 650);
    },
    [bursting, href, router]
  );

  return (
    <Link
      ref={anchorRef}
      href={href}
      onClick={handleClick}
      className={`dts-shortcut-link ${jewel}${bursting ? ' is-bursting' : ''}`}
    >
      <span
        className="dts-burst-ring"
        aria-hidden
        style={{ left: origin.x, top: origin.y }}
      />
      {sparks.map((s) => (
        <span
          key={s.id}
          className="dts-spark"
          aria-hidden
          style={{
            left: origin.x,
            top: origin.y,
            color: s.color,
            background: s.color,
            '--tx': `${s.tx}px`,
            '--ty': `${s.ty}px`,
            '--sc': s.scale,
            '--rot': `${s.rot}deg`,
          }}
        />
      ))}
      {Icon ? (
        <Icon size={18} strokeWidth={2.25} aria-hidden className="dts-jewel-icon" />
      ) : null}
      <span className="dts-shortcut-label">{label}</span>
    </Link>
  );
}

/**
 * 대시보드 — 여행 바로가기. 칸마다 원색 2색 듀오 그라데이션(구석구석 CTA 톤).
 */
export default function DashboardTravelShortcuts() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('trendingRegions.shortcutsAriaLabel', '여행 바로가기')}
      className="dts-jewel-shell"
      style={{
        width: '100%',
        maxWidth: 720,
        borderRadius: 18,
        padding: 2,
        background:
          'linear-gradient(125deg, #06b6d4 0%, #8b5cf6 18%, #ec4899 38%, #f59e0b 58%, #10b981 78%, #6366f1 100%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.12) inset, 0 12px 40px rgba(99, 102, 241, 0.35), 0 0 60px rgba(236, 72, 153, 0.15)',
      }}
    >
      <div
        className="dts-jewel-inner"
        style={{
          borderRadius: 16,
          padding: '14px 16px 16px',
          background:
            'radial-gradient(120% 80% at 10% -20%, rgba(99, 102, 241, 0.25), transparent 55%),' +
            'radial-gradient(90% 70% at 100% 0%, rgba(236, 72, 153, 0.12), transparent 50%),' +
            'linear-gradient(165deg, #0a0b12 0%, #06060a 45%, #0c1020 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <h2
          className="dts-jewel-title"
          style={{
            fontSize: 15,
            fontWeight: 800,
            margin: '0 0 12px 0',
            letterSpacing: '-0.03em',
            background:
              'linear-gradient(92deg, #a5f3fc 0%, #c4b5fd 22%, #f9a8d4 44%, #fde68a 66%, #6ee7b7 88%, #93c5fd 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: '0 1px 24px rgba(165, 243, 252, 0.35)',
            filter: 'brightness(1.05)',
          }}
        >
          {t('trendingRegions.shortcutsPanelTitle', '여행 바로가기')}
        </h2>

        <nav className="dts-shortcuts">
          {TRAVEL_SHORTCUTS.map(({ href, shortcutKey, Icon, jewel }) => (
            <ShortcutLink
              key={href}
              href={href}
              Icon={Icon}
              jewel={jewel}
              label={t(`trendingRegions.shortcuts.${shortcutKey}`, shortcutKey)}
            />
          ))}
        </nav>
      </div>

      <style jsx global>{`
        .dts-jewel-shell {
          position: relative;
        }
        .dts-jewel-inner {
          position: relative;
          overflow: hidden;
        }
        .dts-jewel-inner::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset: -40%;
          background: conic-gradient(
            from 180deg at 50% 50%,
            rgba(6, 182, 212, 0.07),
            rgba(139, 92, 246, 0.09),
            rgba(236, 72, 153, 0.07),
            rgba(245, 158, 11, 0.08),
            rgba(16, 185, 129, 0.07),
            rgba(6, 182, 212, 0.07)
          );
          opacity: 0.85;
          animation: dts-jewel-slow 18s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .dts-jewel-inner::before {
            animation: none;
          }
        }
        @keyframes dts-jewel-slow {
          to {
            transform: rotate(360deg);
          }
        }
        .dts-jewel-inner > * {
          position: relative;
          z-index: 1;
        }
        .dts-shortcuts {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
          gap: 8px;
        }
        .dts-shortcut-link {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 0;
          padding: 9px 11px;
          border-radius: 12px;
          text-decoration: none;
          overflow: hidden;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          border: 1px solid rgba(255, 255, 255, 0.22);
          color: rgba(255, 250, 245, 0.96);
          font-weight: 600;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            filter 0.2s ease,
            border-color 0.2s ease;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35);
        }
        .dts-shortcut-link::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(125deg, rgba(255, 255, 255, 0.2) 0%, transparent 42%, transparent 58%, rgba(255, 255, 255, 0.08) 100%);
          opacity: 0.65;
          pointer-events: none;
        }
        .dts-jewel-icon {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
          display: block;
          filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
          transition: transform 0.2s ease;
        }
        .dts-shortcut-link:hover .dts-jewel-icon {
          transform: rotate(-8deg) scale(1.12);
        }
        .dts-shortcut-label {
          position: relative;
          z-index: 1;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.2;
          text-align: center;
          flex: 0 1 auto;
          min-width: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: keep-all;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
        }
        .dts-shortcut-link:hover {
          transform: translateY(-2px) scale(1.02);
          filter: saturate(1.15) brightness(1.08);
          border-color: rgba(255, 255, 255, 0.55);
        }
        .dts-shortcut-link:active {
          transform: translateY(0) scale(0.96);
        }

        /* ── 클릭 인터랙션 ── */
        /* 1) 버튼 전체가 젤리처럼 말랑하게 눌렸다 튄다 */
        .dts-shortcut-link.is-bursting {
          animation: dts-jelly 0.4s cubic-bezier(0.22, 1.4, 0.36, 1) both;
          z-index: 2;
        }
        @keyframes dts-jelly {
          0% {
            transform: scale(1, 1);
          }
          22% {
            transform: scale(1.14, 0.82);
          }
          44% {
            transform: scale(0.9, 1.12);
          }
          64% {
            transform: scale(1.06, 0.96);
          }
          82% {
            transform: scale(0.98, 1.02);
          }
          100% {
            transform: scale(1, 1);
          }
        }

        /* 2) 아이콘이 통통 튀어오르며 한 바퀴 살짝 돈다 */
        .dts-shortcut-link.is-bursting .dts-jewel-icon {
          animation: dts-icon-pop 0.4s cubic-bezier(0.22, 1.4, 0.36, 1) both;
        }
        @keyframes dts-icon-pop {
          0% {
            transform: scale(1) rotate(0deg);
          }
          30% {
            transform: scale(1.55) rotate(-16deg);
          }
          60% {
            transform: scale(0.85) rotate(14deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }

        /* 3) 클릭 지점에서 퍼지는 충격파 링 */
        .dts-burst-ring {
          position: absolute;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.95);
          opacity: 0;
          transform: scale(0);
          pointer-events: none;
          z-index: 4;
        }
        .dts-shortcut-link.is-bursting .dts-burst-ring {
          animation: dts-ring 0.5s ease-out both;
        }
        @keyframes dts-ring {
          0% {
            opacity: 0.9;
            transform: scale(0);
          }
          100% {
            opacity: 0;
            transform: scale(16);
          }
        }

        /* 4) 사방으로 튀는 색색깔 스파클(폭죽) */
        .dts-spark {
          position: absolute;
          width: 7px;
          height: 7px;
          margin: -3.5px 0 0 -3.5px;
          border-radius: 2px;
          pointer-events: none;
          z-index: 5;
          opacity: 0;
          box-shadow: 0 0 8px currentColor;
          animation: dts-spark 0.6s cubic-bezier(0.18, 0.7, 0.3, 1) forwards;
        }
        @keyframes dts-spark {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(var(--sc)) rotate(var(--rot));
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(0) rotate(var(--rot));
          }
        }
        /* 2색 듀오 그라데이션 — 구석구석 CTA와 동일 톤(원색 유지, 선명한 2색 조합) */
        .dts-jewel-0 {
          background: linear-gradient(135deg, #06b6d4 0%, #0d9488 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(34, 211, 238, 0.4);
        }
        .dts-jewel-1 {
          background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(196, 181, 253, 0.45);
        }
        .dts-jewel-2 {
          background: linear-gradient(135deg, #34d399 0%, #047857 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(52, 211, 153, 0.4);
        }
        .dts-jewel-3 {
          background: linear-gradient(135deg, #f472b6 0%, #c026d3 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(244, 114, 182, 0.45);
        }
        .dts-jewel-4 {
          background: linear-gradient(135deg, #fbbf24 0%, #ca8a04 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(250, 204, 21, 0.4);
        }
        .dts-jewel-5 {
          background: linear-gradient(135deg, #4ade80 0%, #15803d 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(74, 222, 128, 0.4);
        }
        .dts-jewel-6 {
          background: linear-gradient(135deg, #38bdf8 0%, #0369a1 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(125, 211, 252, 0.4);
        }
        .dts-jewel-7 {
          background: linear-gradient(135deg, #fb923c 0%, #c2410c 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(251, 146, 60, 0.45);
        }
        .dts-jewel-8 {
          background: linear-gradient(135deg, #818cf8 0%, #1d4ed8 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(129, 140, 248, 0.45);
        }
        .dts-jewel-9 {
          background: linear-gradient(135deg, #2dd4bf 0%, #0f766e 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(45, 212, 191, 0.45);
        }
        .dts-jewel-10 {
          background: linear-gradient(135deg, #a855f7 0%, #f59e0b 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 24px rgba(251, 191, 36, 0.4);
        }
        .dts-jewel-11 {
          background: linear-gradient(135deg, #2dd4bf 0%, #0284c7 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(45, 212, 191, 0.45);
        }
        .dts-jewel-12 {
          background: linear-gradient(135deg, #ea580c 0%, #f59e0b 45%, #84cc16 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(234, 88, 12, 0.4);
        }
      `}</style>
    </section>
  );
}
