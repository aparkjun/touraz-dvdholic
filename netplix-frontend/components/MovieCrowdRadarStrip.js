'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Radar, Activity, MapPin, ArrowRight, Image as ImageIcon, Leaf } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import { areaLabel } from '@/lib/regionAreaCode';

/**
 * Quiet Set Radar · 영화 상세 페이지용 혼잡도 배지 스트립.
 *
 * 동선:
 *   영화 상세 진입 → /api/v1/cine-trip/movie?name={movieName} 로 이 영화의 촬영지/배경지 매핑 조회
 *   → 신뢰도 가장 높은 매핑의 areaCode 를 추출
 *   → /api/v1/cine-trip/concentration?areaCode={X} 로 향후 7일 혼잡도 예측 수집
 *   → 평균 집중률을 계산해 "이번 주 촬영지 한가함/보통/혼잡" 배지로 요약
 *   → 7일 막대(미니 바) + "Quiet Set Radar 로 한산한 날 찾기" CTA 노출
 *
 * 숨김 조건(UX 간섭 방지):
 *   - 영화 → areaCode 매핑이 하나도 없으면 섹션 자체 숨김
 *   - 영어 모드(i18n) 에서는 혼잡도 데이터가 한국어 라벨만 제공되므로 숨김
 *   - 로딩 중 404/에러면 숨김 (영화 상세의 다른 콘텐츠에 간섭하지 않도록)
 */
export default function MovieCrowdRadarStrip({ movieName }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [mapping, setMapping] = useState(null); // { areaCode, regionName, evidence } | null
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastMovieRef = useRef('');

  useEffect(() => {
    if (!movieName || isEn) return;
    if (lastMovieRef.current === movieName) return;
    lastMovieRef.current = movieName;
    let alive = true;
    (async () => {
      setLoading(true);
      setMapping(null);
      setPredictions([]);
      try {
        const res = await axios.get(
          `/api/v1/cine-trip/movie?name=${encodeURIComponent(movieName)}`
        );
        // CineTripResponse 배열: [{ movie, mappings: [{areaCode, regionName, confidence, trendingScore, ...}], trendingScore }]
        // 모든 아이템의 mappings 를 평탄화한 뒤 trendingScore/confidence 최고를 선택.
        const items = Array.isArray(res?.data?.data) ? res.data.data : [];
        const allMappings = [];
        items.forEach((it) => {
          const ms = Array.isArray(it?.mappings) ? it.mappings : [];
          ms.forEach((m) => allMappings.push(m));
        });
        if (!allMappings.length) return;
        const pick = allMappings.slice().sort(
          (a, b) =>
            (b?.trendingScore ?? 0) - (a?.trendingScore ?? 0) ||
            (b?.confidence ?? 0) - (a?.confidence ?? 0)
        )[0];
        const areaCode = pick?.areaCode != null ? String(pick.areaCode) : null;
        if (!areaCode) return;
        if (!alive) return;
        setMapping({
          areaCode,
          regionName: pick?.regionName || '',
          evidence: pick?.evidence || '',
          mappingType: pick?.mappingType || '',
        });
        const cres = await axios.get(
          `/api/v1/cine-trip/concentration?areaCode=${encodeURIComponent(areaCode)}`
        );
        const rows = Array.isArray(cres?.data?.data) ? cres.data.data : [];
        if (alive) setPredictions(rows.slice(0, 7));
      } catch (e) {
        console.warn('[MovieCrowdRadarStrip] fetch failed:', e?.message || e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [movieName, isEn]);

  const summary = useMemo(() => {
    if (!predictions.length) return null;
    const rates = predictions
      .map((p) => p?.concentrationRate)
      .filter((v) => typeof v === 'number');
    if (!rates.length) return null;
    const avg = rates.reduce((s, v) => s + v, 0) / rates.length;
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    // 가장 한가한 날 찾기
    let bestIdx = 0;
    predictions.forEach((p, i) => {
      if ((p?.concentrationRate ?? 999) < (predictions[bestIdx]?.concentrationRate ?? 999)) {
        bestIdx = i;
      }
    });
    const best = predictions[bestIdx];
    return {
      avg,
      min,
      max,
      best,
      spotName: predictions[0]?.spotName,
      areaName: predictions[0]?.areaName,
      signguName: predictions[0]?.signguName,
    };
  }, [predictions]);

  if (isEn) return null;
  if (!movieName) return null;
  if (!loading && (!mapping || !predictions.length)) return null;

  const level = summary ? rateLevel(summary.avg) : null;

  return (
    <section
      style={{
        margin: '0 15px 12px',
        padding: '14px 16px',
        borderRadius: 14,
        background:
          'linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(99,102,241,0.10) 55%, rgba(244,63,94,0.10) 100%)',
        border: '1px solid rgba(103,232,249,0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: -60,
          background:
            'conic-gradient(from 0deg, rgba(34,211,238,0.08), rgba(99,102,241,0.08), rgba(244,63,94,0.08), rgba(34,211,238,0.08))',
          animation: 'crowdradar-sweep 14s linear infinite',
          filter: 'blur(40px)',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(103,232,249,0.12)',
              border: '1px solid rgba(103,232,249,0.35)',
              color: '#a7f3d0',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.4px',
            }}
          >
            <Radar size={12} />
            QUIET SET RADAR
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.2px',
            }}
          >
            이번 주 촬영지 한가함
          </h3>
          {summary?.spotName && (
            <Link
              href={`/cine-trip?area=${encodeURIComponent(mapping?.areaCode || '')}`}
              title="이 촬영지를 Cine-Trip 페이지에서 열기"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 10,
                background: 'rgba(96,165,250,0.12)',
                border: '1px solid rgba(96,165,250,0.28)',
                color: '#cfe0ff',
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(96,165,250,0.22)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(96,165,250,0.12)';
              }}
            >
              <MapPin size={11} />
              {summary.areaName || mapping?.regionName}
              {summary.signguName ? ` · ${summary.signguName}` : ''}
              {summary.spotName ? ` · ${summary.spotName}` : ''}
            </Link>
          )}
          {level && (
            <span
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: `${level.color}22`,
                border: `1px solid ${level.color}66`,
                color: level.color,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <Activity size={12} />
              {level.label} · 평균 {summary.avg.toFixed(1)}
            </span>
          )}
        </div>

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 6,
              height: 64,
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 6,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'crowdradar-shimmer 1.6s infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, Math.min(predictions.length, 7))}, 1fr)`,
              gap: 6,
            }}
          >
            {predictions.slice(0, 7).map((p, idx) => (
              <MiniBar key={p.baseDate || idx} prediction={p} index={idx} />
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 10,
            flexWrap: 'wrap',
          }}
        >
          {summary?.best && (
            <Link
              href={`/wellness?q=${encodeURIComponent(
                summary.areaName || mapping?.regionName || areaLabel(mapping?.areaCode) || ''
              )}`}
              title="이 지역의 힐링 스팟으로 한산한 날 회복하기"
              style={{
                fontSize: 12,
                color: '#a7f3d0',
                padding: '4px 10px',
                borderRadius: 10,
                background: 'rgba(52,211,153,0.10)',
                border: '1px solid rgba(52,211,153,0.25)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Leaf size={12} />
              가장 한가한 날 · <b>{formatDateShort(summary.best.baseDate)}</b>
              {' '}({summary.best.concentrationRate?.toFixed(1)}) 에 힐링
            </Link>
          )}
          <Link
            href={`/photo-gallery?q=${encodeURIComponent(
              summary?.areaName || mapping?.regionName || areaLabel(mapping?.areaCode) || ''
            )}`}
            title="이 지역 촬영지 사진 갤러리"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(244,63,94,0.12)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: '#fecdd3',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <ImageIcon size={12} />
            촬영지 사진
          </Link>
          <Link
            href={`/crowd-radar?area=${encodeURIComponent(mapping?.areaCode || '')}&preset=all`}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #22d3ee, #6366f1)',
              color: '#0b1220',
              fontSize: 12,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 8px 24px -12px rgba(34,211,238,0.7)',
            }}
          >
            이 지역 30일 레이더 보기
            <ArrowRight size={12} />
          </Link>
        </div>
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>
          출처: 한국관광공사 관광지 집중률 방문자 추이 예측 (영화 매핑은 자체 큐레이션)
        </div>
      </div>
      <style>{`
        @keyframes crowdradar-sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes crowdradar-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </section>
  );
}

const LEVELS = [
  { max: 30, label: '한가함', color: '#34d399' },
  { max: 60, label: '보통', color: '#fbbf24' },
  { max: 85, label: '혼잡', color: '#fb7185' },
  { max: 101, label: '매우 혼잡', color: '#f43f5e' },
];

function rateLevel(rate) {
  if (rate == null) return null;
  for (const l of LEVELS) if (rate < l.max) return l;
  return LEVELS[LEVELS.length - 1];
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

function MiniBar({ prediction, index }) {
  const rate = prediction?.concentrationRate ?? 0;
  const level = rateLevel(rate);
  const pct = Math.max(8, Math.min(100, rate));
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.28) }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
      title={`${formatDateShort(prediction?.baseDate)} · ${rate?.toFixed?.(1) ?? '-'}`}
    >
      <div
        style={{
          width: '100%',
          height: 48,
          borderRadius: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${pct}%`,
            background: `linear-gradient(180deg, ${level.color}ff, ${level.color}88)`,
          }}
        />
      </div>
      <div style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1 }}>
        {formatDateShort(prediction?.baseDate).slice(0, 5)}
      </div>
    </motion.div>
  );
}
