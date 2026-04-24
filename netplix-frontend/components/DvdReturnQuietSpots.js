'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Radar, MapPin, ArrowRight, PackageCheck } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import { resolveAreaCode, areaLabel } from '@/lib/regionAreaCode';

/**
 * DVD 반납길 근처 저혼잡 관광지 스트립.
 *
 * 시나리오: "DVD 반납하러 가는 그 길, 붐비지 않는 관광지에서 한 템포 쉬어가기"
 *
 * 프론트-온리 큐레이션:
 *   - props.keyword (DVD 매장 목록의 대표 시·도 문자열) → resolveAreaCode 로 areaCode 추출
 *   - /api/v1/cine-trip/concentration/overview 호출 (전국 30일 예측, 백엔드 6h 캐시)
 *   - 해당 areaCode 로 필터 → 스팟별로 평균 집중률 계산 → 가장 한가한 TOP 6 추출
 *   - 각 카드 클릭 시 /crowd-radar 로 이동 (이미 배포된 세부 페이지)
 *
 * 숨김 조건:
 *   - areaCode 매칭 실패
 *   - 영어 모드
 *   - 결과 없음
 */
export default function DvdReturnQuietSpots({ keyword = '', lat, lng }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // keyword 가 빈 문자열이면 숨김 (좌표만으로는 areaCode 매핑이 불확실하므로)
  const areaCode = useMemo(() => resolveAreaCode(keyword), [keyword]);

  useEffect(() => {
    if (!areaCode || isEn) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/v1/cine-trip/concentration/overview`);
        const payload = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (alive) setRows(payload);
      } catch (e) {
        console.warn('[DvdReturnQuietSpots] fetch failed:', e?.message || e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode, isEn]);

  const topQuiet = useMemo(() => {
    if (!areaCode) return [];
    const inArea = rows.filter((r) => String(r?.areaCode ?? '') === String(areaCode));
    if (!inArea.length) return [];
    const spots = new Map();
    inArea.forEach((r) => {
      const key = `${r.signguCode ?? ''}_${r.spotName ?? ''}`;
      if (!spots.has(key)) {
        spots.set(key, {
          spotName: r.spotName,
          signguName: r.signguName,
          areaName: r.areaName,
          rates: [],
          dates: [],
        });
      }
      const s = spots.get(key);
      if (typeof r.concentrationRate === 'number') {
        s.rates.push(r.concentrationRate);
        s.dates.push({ date: r.baseDate, rate: r.concentrationRate });
      }
    });
    const enriched = Array.from(spots.values()).map((s) => {
      const avg = s.rates.reduce((a, b) => a + b, 0) / Math.max(1, s.rates.length);
      const best = s.dates.reduce(
        (acc, d) => (d.rate < (acc?.rate ?? 999) ? d : acc),
        null
      );
      return { ...s, avg, best };
    });
    return enriched.sort((a, b) => a.avg - b.avg).slice(0, 6);
  }, [rows, areaCode]);

  if (isEn) return null;
  if (!areaCode) return null;
  if (!loading && topQuiet.length === 0) return null;

  const regionText = areaLabel(areaCode) || keyword;

  return (
    <section
      style={{
        marginTop: 20,
        marginBottom: 8,
        padding: 18,
        borderRadius: 16,
        background:
          'linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(34,211,238,0.08) 55%, rgba(99,102,241,0.10) 100%)',
        border: '1px solid rgba(249,115,22,0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'rgba(249,115,22,0.14)',
            border: '1px solid rgba(249,115,22,0.35)',
            color: '#fdba74',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.4px',
          }}
        >
          <PackageCheck size={12} />
          DVD RETURN DETOUR
        </div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
          반납길 근처, 한산한 관광지
        </h3>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 10,
            background: 'rgba(103,232,249,0.12)',
            border: '1px solid rgba(103,232,249,0.28)',
            color: '#a7f3d0',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <MapPin size={11} />
          {regionText}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          30일 예측 평균 혼잡도 낮은 순
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#cbd5e1', margin: '0 0 14px' }}>
        반납만 찍고 가지 마세요. 30일 예측으로 뽑은 <b style={{ color: '#fdba74' }}>{regionText}</b>
        의 한산한 관광지에서 정주행의 여운을 가라앉혀 보세요.
      </p>

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 118,
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                backgroundSize: '200% 100%',
                animation: 'dvdquiet-shimmer 1.6s infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
          }}
        >
          {topQuiet.map((s, i) => (
            <QuietCard
              key={`${s.spotName}-${i}`}
              s={s}
              delay={i * 0.04}
              areaCode={areaCode}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          출처: 한국관광공사 관광지 집중률 방문자 추이 예측
        </span>
        <Link
          href={`/crowd-radar?area=${encodeURIComponent(areaCode)}&preset=all`}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 999,
            background: 'linear-gradient(90deg, #22d3ee, #6366f1)',
            color: '#0b1220',
            fontSize: 12,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 8px 24px -12px rgba(34,211,238,0.7)',
          }}
        >
          이 지역 30일 레이더 열기
          <ArrowRight size={12} />
        </Link>
      </div>
      <style>{`@keyframes dvdquiet-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </section>
  );
}

function QuietCard({ s, delay }) {
  const color = levelColor(s.avg);
  const name = s.spotName || '';
  // 반납길 동선 본 취지: "DVD 반납 후 이어폰으로 이 관광지 해설 듣기" → 오디오 가이드 검색으로 이동.
  const dest = `/audio-guide?q=${encodeURIComponent(name)}&type=theme`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ duration: 0.3, delay }}
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <Link
        href={dest}
        title={`${name} — 이 관광지 오디오 가이드 찾기`}
        style={{
          display: 'block',
          padding: 12,
          borderRadius: 12,
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.35) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          textDecoration: 'none',
          color: 'inherit',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}44, transparent 70%)`,
            filter: 'blur(8px)',
          }}
        />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 999,
            background: `${color}22`,
            border: `1px solid ${color}55`,
            color,
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          <Radar size={10} />
          평균 {s.avg.toFixed(1)}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 14,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.3,
          }}
        >
          {name || '관광지'}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: '#93c5fd' }}>
          {s.areaName} {s.signguName ? `· ${s.signguName}` : ''}
        </div>
        {s.best && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#a7f3d0' }}>
            가장 한가한 날 · <b>{formatDateShort(s.best.date)}</b> ({s.best.rate.toFixed(1)})
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#fcd34d',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            opacity: 0.9,
          }}
        >
          귀로 듣는 가이드 →
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
