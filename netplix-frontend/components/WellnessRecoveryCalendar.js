'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarHeart, Sparkles, ArrowRight, Leaf } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';

/**
 * 정주행 회복 캘린더 · 웰니스 × 집중률 크로스오버 위젯.
 *
 * 컨셉: "정주행 번아웃 디톡스 일정표"
 *   - 한국관광공사 관광지 집중률 30일 예측 오버뷰 (/api/v1/cine-trip/concentration/overview)
 *     → 전국 대표 관광지 × 날짜 매트릭스에서 "혼잡도가 가장 낮은 날"을 뽑는다.
 *   - 가장 한산한 상위 5개 "날짜 + 지역" 을 카드로 정렬해 보여준다.
 *   - "이 날 근처 힐링 스팟은?" 버튼으로 /wellness?nearby=true 또는 /crowd-radar 로 연결.
 *
 * 웰니스 페이지 전용. 결과 0건이면 숨김. 영어 모드 숨김.
 */
export default function WellnessRecoveryCalendar() {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEn) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/v1/cine-trip/concentration/overview`);
        const payload = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (alive) setRows(payload);
      } catch (e) {
        console.warn('[WellnessRecoveryCalendar] fetch failed:', e?.message || e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEn]);

  const topQuietDays = useMemo(() => {
    if (!rows.length) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(today.getDate() + 14); // 앞으로 2주 내로 제한 (회복 일정은 가까운 날이 실용적)

    const candidates = rows
      .filter((r) => typeof r?.concentrationRate === 'number')
      .filter((r) => {
        const d = toDate(r.baseDate);
        return d && d >= today && d <= limit;
      });
    if (!candidates.length) return [];

    // 각 (날짜, 광역) 을 유일 키로 간주 — 같은 지역이 반복되지 않도록 선별
    const seen = new Set();
    const sorted = candidates.slice().sort((a, b) => a.concentrationRate - b.concentrationRate);
    const picks = [];
    for (const r of sorted) {
      const key = `${dateKey(r.baseDate)}_${r.areaCode}`;
      if (seen.has(key)) continue;
      const areaSeen = picks.filter((p) => p.areaCode === r.areaCode).length;
      if (areaSeen >= 2) continue; // 같은 광역 3번 이상 반복 방지
      seen.add(key);
      picks.push(r);
      if (picks.length >= 5) break;
    }
    return picks;
  }, [rows]);

  if (isEn) return null;
  if (!loading && topQuietDays.length === 0) return null;

  return (
    <section
      style={{
        margin: '24px 0',
        padding: 22,
        borderRadius: 18,
        background:
          'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(34,211,238,0.08) 50%, rgba(139,92,246,0.10) 100%)',
        border: '1px solid rgba(52,211,153,0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -80,
          background:
            'radial-gradient(circle at 20% 20%, rgba(34,197,94,0.18), transparent 40%), radial-gradient(circle at 80% 80%, rgba(99,102,241,0.18), transparent 40%)',
          filter: 'blur(30px)',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: 'rgba(52,211,153,0.14)',
              border: '1px solid rgba(52,211,153,0.36)',
              color: '#6ee7b7',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}
          >
            <CalendarHeart size={12} />
            BINGE RECOVERY CALENDAR
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>
            정주행 회복 · 한산한 힐링 데이 TOP 5
          </h3>
        </div>
        <p style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 16px', lineHeight: 1.55 }}>
          시즌 완주하신 당신에게. 향후 2주 안에서 관광지 혼잡도 예측이 가장 낮은 날과 지역을 골라
          드려요. 이 날짜에 온천·힐링숲·템플스테이를 잡으면 사람에 치이지 않고 제대로 회복할 수
          있어요.
        </p>

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 150,
                  borderRadius: 14,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'wrc-shimmer 1.6s infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {topQuietDays.map((r, i) => (
              <QuietDayCard key={`${r.areaCode}-${dateKey(r.baseDate)}`} r={r} rank={i + 1} delay={i * 0.05} />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 18,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            출처: 한국관광공사 관광지 집중률 방문자 추이 예측 × 웰니스관광 큐레이션
          </span>
          <Link
            href="/crowd-radar"
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #10b981, #6366f1)',
              color: '#ecfeff',
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 10px 28px -14px rgba(16,185,129,0.7)',
            }}
          >
            더 많은 날짜/지역 보기
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
      <style>{`@keyframes wrc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </section>
  );
}

function QuietDayCard({ r, rank, delay }) {
  const color = levelColor(r.concentrationRate);
  // 웰니스 페이지 자체 내에서 바로 지역 필터를 걸어 스팟을 노출 — 회복 동선 즉답.
  const dest = `/wellness?q=${encodeURIComponent(r.areaName || '')}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.32, delay }}
      style={{
        position: 'relative',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <Link
        href={dest}
        title={`${r.areaName} 힐링 스팟으로 회복 시작`}
        style={{
          display: 'block',
          position: 'relative',
          padding: 14,
          borderRadius: 14,
          background:
            'linear-gradient(180deg, rgba(10,20,30,0.7) 0%, rgba(10,20,30,0.45) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          textDecoration: 'none',
          color: 'inherit',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}55, transparent 60%)`,
            filter: 'blur(14px)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              fontWeight: 800,
              color: '#fde68a',
            }}
          >
            <Sparkles size={12} /> #{rank}
          </span>
          <span
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              color,
              background: `${color}22`,
              border: `1px solid ${color}55`,
              fontWeight: 700,
            }}
          >
            혼잡도 {r.concentrationRate.toFixed(1)}
          </span>
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.2,
            letterSpacing: '-0.3px',
          }}
        >
          {formatDateShort(r.baseDate)}
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 12,
            color: '#a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Leaf size={12} />
          {r.areaName || ''}
          {r.signguName ? ` · ${r.signguName}` : ''}
        </div>
        {r.spotName && (
          <div style={{ marginTop: 2, fontSize: 11, color: '#cbd5e1' }}>
            대표 관광지 · {r.spotName}
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            color: '#6ee7b7',
            fontWeight: 700,
          }}
        >
          이 지역 힐링 스팟 열기 →
        </div>
      </Link>
    </motion.div>
  );
}

function levelColor(rate) {
  if (rate == null) return '#6b7280';
  if (rate < 30) return '#34d399';
  if (rate < 60) return '#fbbf24';
  if (rate < 85) return '#fb7185';
  return '#f43f5e';
}

function dateKey(baseDate) {
  if (!baseDate) return '';
  if (Array.isArray(baseDate)) {
    const [y, m, d] = baseDate;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const d = new Date(baseDate);
  if (Number.isNaN(d.getTime())) return String(baseDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function toDate(baseDate) {
  if (!baseDate) return null;
  const arr = Array.isArray(baseDate) ? baseDate : null;
  const d = arr ? new Date(arr[0], arr[1] - 1, arr[2]) : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateShort(baseDate) {
  const d = toDate(baseDate);
  if (!d) return '-';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${mm}.${dd} (${dow})`;
}
