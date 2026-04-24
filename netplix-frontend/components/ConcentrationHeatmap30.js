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
 * 기존 ConcentrationForecastStrip(7일 막대)가 "다음 주 분위기 한 눈에" 용도라면,
 * 이 컴포넌트는 "한 달 장기 계획용". 날짜별 셀에 색상으로 혼잡도를 표현해
 * 여행 날짜를 고를 때 달력처럼 훑어볼 수 있게 한다.
 *
 * 데이터:  GET /api/v1/cine-trip/concentration?areaCode={X} (서비스가 대표 시군구 스팟의 30일 예측 반환)
 * 조건:
 *  - areaCode 없으면 숨김
 *  - 영어 모드(i18n) 에서 숨김 (국내 한정, 한글 라벨)
 *  - 결과 0건이면 숨김
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

  const firstDay = cells[0].date.getDay(); // 0=일
  const pads = Array.from({ length: firstDay }, () => null);

  const displayAreaName = rows[0]?.areaName || regionLabel || '';

  return (
    <section
      style={{
        marginTop: 20,
        marginBottom: 24,
        padding: 20,
        borderRadius: 16,
        background:
          'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(99,102,241,0.10) 55%, rgba(34,197,94,0.06) 100%)',
        border: '1px solid rgba(99,102,241,0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <CalendarRange size={20} style={{ color: '#a5b4fc' }} />
        <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
          향후 30일 혼잡도 히트맵
        </h3>
        {displayAreaName && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(103,232,249,0.12)',
              border: '1px solid rgba(103,232,249,0.3)',
              color: '#a7f3d0',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Radar size={12} />
            {displayAreaName}
            {rows[0]?.signguName ? ` · ${rows[0].signguName}` : ''}
            {rows[0]?.spotName ? ` · ${rows[0].spotName}` : ''}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8b8f99' }}>
          출처: 한국관광공사 관광지 집중률 방문자 추이 예측
        </span>
      </div>

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
            height: 260,
          }}
        >
          {Array.from({ length: 35 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 6,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                backgroundSize: '200% 100%',
                animation: 'ch30-shimmer 1.6s infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
              marginBottom: 6,
            }}
          >
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  color: i === 0 ? '#fda4af' : i === 6 ? '#93c5fd' : '#9ca3af',
                  letterSpacing: '0.6px',
                  fontWeight: 700,
                }}
              >
                {d}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
            }}
          >
            {pads.map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {cells.map((c, idx) => (
              <HeatCell
                key={c.key}
                cell={c}
                delay={idx * 0.012}
                areaName={displayAreaName}
              />
            ))}
          </div>
        </>
      )}

      <div
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 14,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {bestDay && (
          <Link
            href={`/wellness?q=${encodeURIComponent(displayAreaName || '')}`}
            title="한산한 이 날에 이 지역 힐링 스팟 찾기"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.3)',
              color: '#6ee7b7',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <TrendingDown size={13} />
            가장 한가한 날 {formatDateShort(bestDay.baseDate)} ·{' '}
            {bestDay.concentrationRate?.toFixed(1)} → 힐링하러 가기
          </Link>
        )}
        {worstDay && (
          <Link
            href={`/crowd-radar?area=${encodeURIComponent(areaCode || '')}&sort=busy&preset=all`}
            title="전국 혼잡한 순 랭킹으로 비교해보기"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: '#fda4af',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <TrendingUp size={13} />
            가장 붐비는 날 {formatDateShort(worstDay.baseDate)} ·{' '}
            {worstDay.concentrationRate?.toFixed(1)}
          </Link>
        )}
        {avg != null && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            30일 평균 <b style={{ color: '#e5e7eb' }}>{avg.toFixed(1)}</b>
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {LEVELS.map((l) => (
            <span
              key={l.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#aaa',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: l.color,
                  display: 'inline-block',
                }}
              />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes ch30-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </section>
  );
}

const LEVELS = [
  { max: 30, label: '여유', color: '#10b981' },
  { max: 60, label: '보통', color: '#f59e0b' },
  { max: 85, label: '혼잡', color: '#fb7185' },
  { max: 101, label: '매우 혼잡', color: '#ef4444' },
];

function levelColor(rate) {
  if (rate == null) return '#2a2a2a';
  for (const l of LEVELS) if (rate < l.max) return l.color;
  return '#ef4444';
}

function HeatCell({ cell, delay, areaName }) {
  const rate = cell.row?.concentrationRate;
  const hasData = typeof rate === 'number';
  const bg = hasData ? levelColor(rate) : 'rgba(255,255,255,0.04)';
  const isWeekend = cell.date.getDay() === 0 || cell.date.getDay() === 6;
  // 한가함(<60)이면 힐링으로, 혼잡(>=60)이면 인증샷 갤러리로 유도
  const dest = !hasData
    ? null
    : rate < 60
    ? `/wellness?q=${encodeURIComponent(areaName || '')}`
    : `/photo-gallery?q=${encodeURIComponent(areaName || '')}`;
  const hint = !hasData
    ? '데이터 없음'
    : rate < 60
    ? '한산 — 이 날 힐링 스팟 보기'
    : '혼잡 — 이 지역 사진 갤러리 보기';

  const cellStyle = {
    aspectRatio: '1 / 1',
    borderRadius: 6,
    background: hasData
      ? `linear-gradient(135deg, ${bg}ee, ${bg}99)`
      : bg,
    border: isWeekend
      ? '1px solid rgba(147,197,253,0.18)'
      : '1px solid rgba(255,255,255,0.05)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: hasData ? '#0b1220' : '#6b7280',
    fontWeight: 700,
    fontSize: 11,
    lineHeight: 1.1,
    cursor: hasData && dest ? 'pointer' : 'default',
    textDecoration: 'none',
    transition: 'transform 0.15s',
  };

  const inner = (
    <>
      <div>{cell.date.getDate()}</div>
      <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>
        {hasData ? rate.toFixed(0) : '-'}
      </div>
    </>
  );

  const motionProps = {
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.24, delay: Math.min(delay, 0.35) },
    whileHover: hasData && dest ? { scale: 1.06 } : undefined,
  };

  if (hasData && dest) {
    return (
      <motion.div {...motionProps} style={cellStyle}>
        <Link
          href={dest}
          title={`${formatDateShort(cell.row.baseDate)} · ${rate.toFixed(1)} — ${hint}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            textDecoration: 'none',
            color: 'inherit',
          }}
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
        hasData
          ? `${formatDateShort(cell.row.baseDate)} · ${rate.toFixed(1)}`
          : `${formatDateShort(isoDate(cell.date))} · 데이터 없음`
      }
      style={cellStyle}
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
