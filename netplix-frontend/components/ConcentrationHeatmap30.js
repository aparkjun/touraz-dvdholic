'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarRange, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';

/**
 * Cine-Trip 지역 상세용 · 향후 30일 관광지 집중률 히트맵 달력.
 *
 * 데이터:  GET /api/v1/cine-trip/concentration?areaCode={X}
 */
export default function ConcentrationHeatmap30({ areaCode = null, regionLabel = '' }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaCode || isEn) {
      setRows([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `/api/v1/cine-trip/concentration?areaCode=${encodeURIComponent(areaCode)}`
        );
        const payload = res?.data?.data ?? [];
        if (alive) setRows(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.warn('[ConcentrationHeatmap30] fetch failed:', e?.message || e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode, isEn]);

  const { bestDay, worstDay, avg, byDate } = useMemo(() => {
    const map = new Map();
    let best = null;
    let worst = null;
    let sum = 0;
    let count = 0;
    rows.forEach((p) => {
      const key = dateKey(p?.baseDate);
      if (!key) return;
      map.set(key, p);
      const r = p?.concentrationRate;
      if (typeof r !== 'number') return;
      sum += r;
      count += 1;
      if (!best || r < (best?.concentrationRate ?? 999)) best = p;
      if (!worst || r > (worst?.concentrationRate ?? -1)) worst = p;
    });
    return {
      bestDay: best,
      worstDay: worst,
      avg: count ? sum / count : null,
      byDate: map,
    };
  }, [rows]);

  if (isEn) return null;
  if (!areaCode) return null;
  if (!loading && rows.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = isoDate(d);
    cells.push({ date: d, key, row: byDate.get(key) || null });
  }

  const firstDay = cells[0].date.getDay();
  const pads = Array.from({ length: firstDay }, () => null);

  const displayAreaName = rows[0]?.areaName || regionLabel || '';

  return (
    <section className="concentration-h30">
      <div className="concentration-h30__glow" aria-hidden />
      <div className="concentration-h30__head">
        <div className="concentration-h30__titleRow">
          <CalendarRange size={22} className="concentration-h30__titleIcon" strokeWidth={2} />
          <h3 className="concentration-h30__title">향후 30일 혼잡도 히트맵</h3>
          {displayAreaName && (
            <span className="concentration-h30__areaChip">
              <Radar size={13} strokeWidth={2.5} />
              {displayAreaName}
              {rows[0]?.signguName ? ` · ${rows[0].signguName}` : ''}
              {rows[0]?.spotName ? ` · ${rows[0].spotName}` : ''}
            </span>
          )}
        </div>
        <p className="concentration-h30__source">출처: 한국관광공사 관광지 집중률 방문자 추이 예측</p>
      </div>

      {loading ? (
        <div className="concentration-h30__grid concentration-h30__grid--skeleton">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="concentration-h30__skelCell" />
          ))}
        </div>
      ) : (
        <>
          <div className="concentration-h30__dowRow">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`concentration-h30__dow ${i === 0 ? 'sun' : ''} ${i === 6 ? 'sat' : ''}`}>
                {d}
              </div>
            ))}
          </div>
          <div className="concentration-h30__grid">
            {pads.map((_, i) => (
              <div key={`pad-${i}`} className="concentration-h30__pad" />
            ))}
            {cells.map((c, idx) => (
              <HeatCell key={c.key} cell={c} delay={idx * 0.012} areaName={displayAreaName} />
            ))}
          </div>
        </>
      )}

      <div className="concentration-h30__footer">
        <div className="concentration-h30__ctaRow">
          {bestDay && (
            <Link
              href={`/wellness?q=${encodeURIComponent(displayAreaName || '')}`}
              title="한산한 이 날에 이 지역 힐링 스팟 찾기"
              className="concentration-h30__cta concentration-h30__cta--quiet"
            >
              <TrendingDown size={14} strokeWidth={2.5} />
              가장 한가한 날 {formatDateShort(bestDay.baseDate)} ·{' '}
              {bestDay.concentrationRate?.toFixed(1)} → 힐링하러 가기
            </Link>
          )}
          {worstDay && (
            <Link
              href={`/crowd-radar?area=${encodeURIComponent(areaCode || '')}&sort=busy&preset=all`}
              title="전국 혼잡한 순 랭킹으로 비교해보기"
              className="concentration-h30__cta concentration-h30__cta--busy"
            >
              <TrendingUp size={14} strokeWidth={2.5} />
              가장 붐비는 날 {formatDateShort(worstDay.baseDate)} ·{' '}
              {worstDay.concentrationRate?.toFixed(1)}
            </Link>
          )}
          {avg != null && (
            <span className="concentration-h30__avg">
              30일 평균 <strong>{avg.toFixed(1)}</strong>
            </span>
          )}
        </div>
        <div className="concentration-h30__legend">
          {LEVELS.map((l) => (
            <span key={l.label} className="concentration-h30__legendPill">
              <span className="concentration-h30__legendSwatch" style={{ background: l.gradient }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .concentration-h30 {
          position: relative;
          margin-top: 20px;
          margin-bottom: 24px;
          padding: 22px 22px 20px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background:
            linear-gradient(155deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 27, 60, 0.94) 45%, rgba(15, 23, 42, 0.96) 100%);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.06) inset,
            0 24px 48px -24px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(99, 102, 241, 0.08);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .concentration-h30__glow {
          pointer-events: none;
          position: absolute;
          inset: -40% -20% auto -20%;
          height: 70%;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99, 102, 241, 0.22), transparent 72%),
            radial-gradient(ellipse 60% 50% at 20% 30%, rgba(34, 211, 238, 0.12), transparent 70%),
            radial-gradient(ellipse 55% 45% at 85% 25%, rgba(52, 211, 153, 0.1), transparent 68%);
          opacity: 0.95;
        }

        .concentration-h30__head {
          position: relative;
          z-index: 1;
          margin-bottom: 18px;
        }

        .concentration-h30__titleRow {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .concentration-h30__titleIcon {
          color: #a5b4fc;
          flex-shrink: 0;
          filter: drop-shadow(0 0 12px rgba(129, 140, 248, 0.35));
        }

        .concentration-h30__title {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #f8fafc;
          text-shadow: 0 1px 18px rgba(99, 102, 241, 0.25);
        }

        .concentration-h30__areaChip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: #ccfbf1;
          background: linear-gradient(135deg, rgba(45, 212, 191, 0.14), rgba(99, 102, 241, 0.12));
          border: 1px solid rgba(103, 232, 249, 0.22);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        .concentration-h30__source {
          margin: 10px 0 0;
          font-size: 11px;
          font-weight: 500;
          color: rgba(148, 163, 184, 0.88);
          letter-spacing: 0.02em;
        }

        .concentration-h30__dowRow {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          margin-bottom: 10px;
          padding: 8px 6px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .concentration-h30__dow {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: rgba(148, 163, 184, 0.92);
          text-transform: none;
        }

        .concentration-h30__dow.sun {
          color: #fda4af;
        }

        .concentration-h30__dow.sat {
          color: #93c5fd;
        }

        .concentration-h30__grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }

        .concentration-h30__grid--skeleton {
          min-height: 280px;
          align-content: start;
        }

        .concentration-h30__skelCell {
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0.03) 0%,
            rgba(255, 255, 255, 0.07) 45%,
            rgba(255, 255, 255, 0.03) 90%
          );
          background-size: 200% 100%;
          animation: ch30-shimmer 1.8s ease-in-out infinite;
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .concentration-h30__pad {
          min-height: 1px;
        }

        .concentration-h30__cell {
          aspect-ratio: 1 / 1;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          transition:
            transform 0.2s cubic-bezier(0.34, 1.2, 0.64, 1),
            box-shadow 0.2s ease,
            border-color 0.2s ease;
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.12) inset,
            0 8px 20px -8px rgba(0, 0, 0, 0.45);
        }

        .concentration-h30__cell--weekend {
          border-color: rgba(147, 197, 253, 0.28) !important;
        }

        .concentration-h30__cell--empty {
          background: linear-gradient(160deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.02));
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: #64748b;
          cursor: default;
          box-shadow: none;
        }

        .concentration-h30__cell--quiet {
          background: linear-gradient(145deg, #0f766e 0%, #059669 42%, #047857 100%);
          border: 1px solid rgba(110, 231, 183, 0.35);
          color: #ecfdf5;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .concentration-h30__cell--normal {
          background: linear-gradient(145deg, #ca8a04 0%, #d97706 48%, #b45309 100%);
          border: 1px solid rgba(253, 224, 71, 0.35);
          color: #fffbeb;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
        }

        .concentration-h30__cell--busy {
          background: linear-gradient(145deg, #e11d48 0%, #f43f5e 50%, #be123c 100%);
          border: 1px solid rgba(253, 164, 175, 0.45);
          color: #fff1f2;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }

        .concentration-h30__cell--critical {
          background: linear-gradient(145deg, #991b1b 0%, #dc2626 42%, #7f1d1d 100%);
          border: 1px solid rgba(252, 165, 165, 0.5);
          color: #fef2f2;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.15) inset,
            0 0 22px -4px rgba(239, 68, 68, 0.35),
            0 10px 24px -10px rgba(0, 0, 0, 0.5);
        }

        .concentration-h30__cellInner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          text-decoration: none;
          color: inherit;
          padding: 4px;
        }

        .concentration-h30__cellDay {
          font-size: clamp(12px, 3.2vw, 14px);
          line-height: 1.15;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .concentration-h30__cellRate {
          margin-top: 3px;
          font-size: clamp(10px, 2.7vw, 11px);
          font-weight: 600;
          opacity: 0.92;
          letter-spacing: 0.02em;
        }

        .concentration-h30__cell--empty .concentration-h30__cellRate {
          opacity: 0.65;
          font-weight: 600;
        }

        .concentration-h30__footer {
          position: relative;
          z-index: 1;
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid rgba(148, 163, 184, 0.12);
        }

        .concentration-h30__ctaRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 14px;
        }

        .concentration-h30__cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease;
          border: 1px solid transparent;
        }

        .concentration-h30__cta:hover {
          transform: translateY(-1px);
        }

        .concentration-h30__cta--quiet {
          background: linear-gradient(135deg, rgba(52, 211, 153, 0.18), rgba(16, 185, 129, 0.1));
          border-color: rgba(110, 231, 183, 0.35);
          color: #a7f3d0;
          box-shadow: 0 6px 18px rgba(16, 185, 129, 0.12);
        }

        .concentration-h30__cta--busy {
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.16), rgba(225, 29, 72, 0.08));
          border-color: rgba(253, 164, 175, 0.35);
          color: #fecdd3;
          box-shadow: 0 6px 18px rgba(244, 63, 94, 0.1);
        }

        .concentration-h30__avg {
          font-size: 13px;
          color: rgba(148, 163, 184, 0.95);
          font-weight: 500;
        }

        .concentration-h30__avg strong {
          color: #f1f5f9;
          font-weight: 800;
          margin-left: 4px;
        }

        .concentration-h30__legend {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .concentration-h30__legendPill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: rgba(226, 232, 240, 0.95);
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.14);
          letter-spacing: 0.02em;
        }

        .concentration-h30__legendSwatch {
          width: 14px;
          height: 14px;
          border-radius: 6px;
          flex-shrink: 0;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.35) inset,
            0 2px 6px rgba(0, 0, 0, 0.25);
        }

        @keyframes ch30-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @media (max-width: 520px) {
          .concentration-h30 {
            padding: 18px 14px 16px;
            border-radius: 18px;
          }

          .concentration-h30__grid,
          .concentration-h30__grid--skeleton {
            gap: 6px;
          }

          .concentration-h30__dowRow {
            gap: 4px;
            padding: 6px 4px;
          }

          .concentration-h30__cell {
            border-radius: 12px;
          }
        }
      `}</style>
    </section>
  );
}

const LEVELS = [
  {
    max: 30,
    label: '여유',
    gradient: 'linear-gradient(145deg, #0f766e, #34d399)',
  },
  {
    max: 60,
    label: '보통',
    gradient: 'linear-gradient(145deg, #ca8a04, #fbbf24)',
  },
  {
    max: 85,
    label: '혼잡',
    gradient: 'linear-gradient(145deg, #e11d48, #fb7185)',
  },
  {
    max: 101,
    label: '매우 혼잡',
    gradient: 'linear-gradient(145deg, #991b1b, #ef4444)',
  },
];

function tierClass(rate) {
  if (rate == null || typeof rate !== 'number') return 'empty';
  if (rate < 30) return 'quiet';
  if (rate < 60) return 'normal';
  if (rate < 85) return 'busy';
  return 'critical';
}

function HeatCell({ cell, delay, areaName }) {
  const rate = cell.row?.concentrationRate;
  const hasData = typeof rate === 'number';
  const tier = tierClass(hasData ? rate : null);
  const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;

  const dest = !hasData ? null : rate < 60 ? `/wellness?q=${encodeURIComponent(areaName || '')}` : `/photo-gallery?q=${encodeURIComponent(areaName || '')}`;
  const hint = !hasData ? '데이터 없음' : rate < 60 ? '한산 — 이 날 힐링 스팟 보기' : '혼잡 — 이 지역 사진 갤러리 보기';

  const cellClass = [
    'concentration-h30__cell',
    `concentration-h30__cell--${tier}`,
    isWeekend ? 'concentration-h30__cell--weekend' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <span className="concentration-h30__cellDay">{cell.date.getDate()}</span>
      <span className="concentration-h30__cellRate">{hasData ? rate.toFixed(0) : '—'}</span>
    </>
  );

  const motionProps = {
    initial: { opacity: 0, scale: 0.92, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.28, delay: Math.min(delay, 0.38), ease: [0.22, 1, 0.36, 1] },
    whileHover: hasData && dest ? { scale: 1.05, y: -2 } : undefined,
    whileTap: hasData && dest ? { scale: 0.98 } : undefined,
  };

  if (hasData && dest) {
    return (
      <motion.div {...motionProps} className={cellClass}>
        <Link
          href={dest}
          title={`${formatDateShort(cell.row.baseDate)} · ${rate.toFixed(1)} — ${hint}`}
          className="concentration-h30__cellInner"
        >
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...motionProps}
      title={
        hasData ? `${formatDateShort(cell.row.baseDate)} · ${rate.toFixed(1)}` : `${formatDateShort(isoDate(cell.date))} · 데이터 없음`
      }
      className={cellClass}
    >
      {inner}
    </motion.div>
  );
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function dateKey(baseDate) {
  if (!baseDate) return null;
  if (Array.isArray(baseDate)) {
    const [y, m, d] = baseDate;
    if (!y) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const d = new Date(baseDate);
  if (Number.isNaN(d.getTime())) return String(baseDate);
  return isoDate(d);
}

function formatDateShort(baseDate) {
  if (!baseDate) return '-';
  const arr = Array.isArray(baseDate) ? baseDate : null;
  const d = arr ? new Date(arr[0], arr[1] - 1, arr[2]) : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return String(baseDate);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${mm}.${dd}(${dow})`;
}
