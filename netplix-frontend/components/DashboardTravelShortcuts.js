'use client';

import React from 'react';
import Link from 'next/link';
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
];

/**
 * 대시보드 — 여행 바로가기(10링크). 보석/프리즘 톤 그라데이션 + 글로우.
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
            <Link key={href} href={href} className={`dts-shortcut-link ${jewel}`}>
              {Icon ? <Icon size={18} strokeWidth={2.25} aria-hidden className="dts-jewel-icon" /> : null}
              <span className="dts-shortcut-label">
                {t(`trendingRegions.shortcuts.${shortcutKey}`, shortcutKey)}
              </span>
            </Link>
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
          justify-content: flex-start;
          gap: 8px;
          min-width: 0;
          padding: 9px 11px;
          border-radius: 12px;
          text-decoration: none;
          overflow: hidden;
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
        }
        .dts-shortcut-label {
          position: relative;
          z-index: 1;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.2;
          text-align: left;
          flex: 1;
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
          border-color: rgba(255, 255, 255, 0.45);
        }
        .dts-shortcut-link:active {
          transform: translateY(0) scale(0.99);
        }
        /* 보석 톤 — 칸마다 다른 프리즘 그라데이션 */
        .dts-jewel-0 {
          background: linear-gradient(135deg, #0e7490 0%, #155e75 40%, #0f766e 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(34, 211, 238, 0.35);
        }
        .dts-jewel-1 {
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 45%, #5b21b6 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(196, 181, 253, 0.4);
        }
        .dts-jewel-2 {
          background: linear-gradient(135deg, #047857 0%, #0f766e 50%, #115e59 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(52, 211, 153, 0.35);
        }
        .dts-jewel-3 {
          background: linear-gradient(135deg, #c026d3 0%, #a21caf 45%, #86198f 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(244, 114, 182, 0.4);
        }
        .dts-jewel-4 {
          background: linear-gradient(135deg, #ca8a04 0%, #a16207 45%, #854d0e 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(250, 204, 21, 0.35);
        }
        .dts-jewel-5 {
          background: linear-gradient(135deg, #15803d 0%, #166534 50%, #14532d 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(74, 222, 128, 0.35);
        }
        .dts-jewel-6 {
          background: linear-gradient(135deg, #0369a1 0%, #075985 50%, #0c4a6e 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(125, 211, 252, 0.35);
        }
        .dts-jewel-7 {
          background: linear-gradient(135deg, #7c2d12 0%, #9a3412 40%, #b45309 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(251, 146, 60, 0.35);
        }
        .dts-jewel-8 {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 45%, #312e81 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 22px rgba(129, 140, 248, 0.45);
        }
        .dts-jewel-9 {
          background: linear-gradient(135deg, #0f766e 0%, #115e59 40%, #134e4a 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 20px rgba(45, 212, 191, 0.4);
        }
        .dts-jewel-10 {
          background: linear-gradient(135deg, #4c1d95 0%, #5b21b6 35%, #7c2d12 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 6px 18px rgba(0, 0, 0, 0.35),
            0 0 24px rgba(251, 191, 36, 0.35);
        }
      `}</style>
    </section>
  );
}
