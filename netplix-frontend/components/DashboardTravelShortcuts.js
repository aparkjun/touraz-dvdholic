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
} from 'lucide-react';

const TRAVEL_SHORTCUTS = [
  { href: '/cine-trip', shortcutKey: 'cineTrip', Icon: PlaneTakeoff },
  { href: '/pet-travel', shortcutKey: 'petTravel', Icon: PawPrint },
  { href: '/trekking', shortcutKey: 'trekking', Icon: Footprints },
  { href: '/photo-gallery', shortcutKey: 'photoGallery', Icon: Camera },
  { href: '/camping', shortcutKey: 'camping', Icon: Tent },
  { href: '/wellness', shortcutKey: 'wellness', Icon: Leaf },
  { href: '/medical-tourism', shortcutKey: 'medical', Icon: Stethoscope },
  { href: '/audio-guide', shortcutKey: 'audio', Icon: Headphones },
  { href: '/crowd-radar', shortcutKey: 'radar', Icon: Radar },
  { href: '/related-spots', shortcutKey: 'related', Icon: Compass },
];

/**
 * 대시보드 전용 — 트렌딩 카드와 분리된 패널에 정사각형 CTA 그리드.
 */
export default function DashboardTravelShortcuts() {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t('trendingRegions.shortcutsAriaLabel', '여행 바로가기')}
      style={{
        width: '100%',
        maxWidth: 720,
        background: 'linear-gradient(160deg, #12131a 0%, #0c0d12 100%)',
        border: '1px solid rgba(99, 102, 241, 0.15)',
        borderRadius: 14,
        padding: '14px 16px 16px',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <h2
        style={{
          fontSize: 15,
          fontWeight: 700,
          margin: '0 0 12px 0',
          color: 'rgba(199, 210, 254, 0.95)',
          letterSpacing: '-0.02em',
        }}
      >
        {t('trendingRegions.shortcutsPanelTitle', '여행 바로가기')}
      </h2>

      <nav className="dts-shortcuts">
        {TRAVEL_SHORTCUTS.map(({ href, shortcutKey, Icon }) => (
          <Link key={href} href={href} className="dts-shortcut-link">
            {Icon ? <Icon size={20} strokeWidth={2} aria-hidden /> : null}
            <span className="dts-shortcut-label">
              {t(`trendingRegions.shortcuts.${shortcutKey}`, shortcutKey)}
            </span>
          </Link>
        ))}
      </nav>

      <style jsx>{`
        .dts-shortcuts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .dts-shortcut-link {
          position: relative;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 8px;
          aspect-ratio: 1;
          min-width: 0;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(255, 255, 255, 0.88);
          text-decoration: none;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .dts-shortcut-link :global(svg) {
          flex-shrink: 0;
          display: block;
          opacity: 0.95;
        }
        .dts-shortcut-label {
          font-size: 10px;
          font-weight: 600;
          line-height: 1.15;
          text-align: left;
          flex: 1;
          min-width: 0;
          max-width: 100%;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-break: keep-all;
        }
        .dts-shortcut-link:hover {
          background: rgba(99, 102, 241, 0.12);
          border-color: rgba(129, 140, 248, 0.35);
        }
        @media (max-width: 420px) {
          .dts-shortcuts {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
