'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Radar, MapPin, ArrowRight, Image as ImageIcon, Leaf, Sparkles } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import { areaLabel, resolveAreaCode } from '@/lib/regionAreaCode';

/**
 * Quiet Set Radar · 영화 상세 페이지용 혼잡도 배지 스트립.
 *
 * 디자인 방향:
 *  - 슬레이트 다크 베이스(#0b1220 → #0f172a) + 시안(#22d3ee) 액센트 1색 포인트로 절제.
 *  - 정보 위계 3단(헤더 / 7일 미니 차트 / 액션 푸터)을 부드러운 디바이더로 명확히 분리.
 *  - "가장 한가한 날(BEST)" 한 칸만 시안 컬러 + 글로우로 시선 잠금.
 *  - 막대 위에 수치(%), 막대 아래에 두 줄 날짜(MM.DD / 요일) 노출 — 작아도 읽힘.
 *  - 회전형 conic-gradient 같은 노이지한 장식 제거. 미세한 그리드 그라디언트만 잔향으로.
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
      bestIdx,
      spotName: predictions[0]?.spotName,
      areaName: predictions[0]?.areaName,
      signguName: predictions[0]?.signguName,
    };
  }, [predictions]);

  if (isEn) return null;
  if (!movieName) return null;
  if (!loading && (!mapping || !predictions.length)) return null;

  const level = summary ? rateLevel(summary.avg) : null;
  const regionLabel = [
    summary?.areaName || mapping?.regionName,
    summary?.signguName,
    summary?.spotName,
  ]
    .filter(Boolean)
    .join(' · ');
  // q 키워드 폴백 시 KTO searchKeyword API 의 정확 매칭 특성상 "서울특별시" 보다 "서울"
  // 같이 짧은 라벨이 hit rate 가 훨씬 높다. 그래서 areaCode → 짧은 라벨을 가장 먼저 시도.
  const wellnessQuery =
    areaLabel(mapping?.areaCode) || summary?.areaName || mapping?.regionName || '';

  // 힐링 CTA 진입 경로 결정.
  // 1순위: areaCode 가 있으면 백엔드 KorService areaBasedList 행정구역 필터(/wellness?korArea=) 사용.
  //        searchKeyword 보다 데이터 hit rate 가 안정적이라 "총 0곳" 이슈가 없다.
  // 2순위: areaCode 가 없으면 자유형식 지역명에서 광역코드를 다시 추정해 본다.
  // 3순위: 그래도 실패하면 옛 ?q= 키워드 모드로 폴백 (이때라도 짧은 라벨이 q 에 들어간다).
  const wellnessHref = (() => {
    const directCode = mapping?.areaCode != null ? String(mapping.areaCode).trim() : '';
    const resolvedCode =
      directCode || resolveAreaCode(summary?.areaName) || resolveAreaCode(mapping?.regionName) || '';
    if (resolvedCode) {
      return `/wellness?korArea=${encodeURIComponent(resolvedCode)}`;
    }
    return wellnessQuery
      ? `/wellness?q=${encodeURIComponent(wellnessQuery)}`
      : '/wellness';
  })();

  return (
    <section
      style={{
        margin: '0 15px 12px',
        borderRadius: 16,
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(11,18,32,0.92) 100%)',
        border: '1px solid rgba(148,163,184,0.14)',
        boxShadow:
          '0 18px 40px -24px rgba(2,6,23,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(14px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
        overflow: 'hidden',
        position: 'relative',
      }}
      aria-label="Quiet Set Radar"
    >
      {/* 카드 상단 시안 라이팅 — 헤어라인 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.55) 50%, transparent 100%)',
        }}
      />
      {/* 카드 좌상단 시안 광원 — 미세 글로우 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          left: -40,
          width: 220,
          height: 220,
          background:
            'radial-gradient(closest-side, rgba(34,211,238,0.16), transparent 70%)',
          filter: 'blur(8px)',
          pointerEvents: 'none',
        }}
      />

      {/* HEADER */}
      <header
        style={{
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(34,211,238,0.10)',
              border: '1px solid rgba(34,211,238,0.30)',
              color: '#67e8f9',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.12em',
              alignSelf: 'flex-start',
              textTransform: 'uppercase',
            }}
          >
            <Radar size={11} strokeWidth={2.5} />
            Quiet Set Radar
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              color: '#f8fafc',
              letterSpacing: '-0.3px',
              lineHeight: 1.25,
            }}
          >
            이번 주 촬영지 한가함
          </h3>
          {regionLabel && (
            <Link
              href={`/cine-trip?area=${encodeURIComponent(mapping?.areaCode || '')}`}
              title="이 촬영지를 Cine-Trip 페이지에서 열기"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                color: '#cbd5e1',
                fontSize: 12,
                fontWeight: 600,
                textDecoration: 'none',
                opacity: 0.92,
                alignSelf: 'flex-start',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#67e8f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              <MapPin size={11} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                {regionLabel}
              </span>
            </Link>
          )}
        </div>
        {level && (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
              padding: '8px 12px',
              borderRadius: 12,
              background:
                'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.4) 100%)',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              minWidth: 92,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#e2e8f0',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.1px',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: level.color,
                  boxShadow: `0 0 0 3px ${level.color}26`,
                  flexShrink: 0,
                }}
              />
              {level.label}
            </span>
            <span
              style={{
                fontSize: 10,
                color: '#94a3b8',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ opacity: 0.75, marginRight: 4 }}>AVG</span>
              <span style={{ color: '#cbd5e1', fontWeight: 700 }}>
                {summary.avg.toFixed(1)}
              </span>
            </span>
          </div>
        )}
      </header>

      {/* 디바이더 */}
      <div
        aria-hidden
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(148,163,184,0.18), transparent)',
        }}
      />

      {/* CHART */}
      <div style={{ padding: '16px 16px 12px' }}>
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 8,
              height: 96,
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 8,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
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
              gap: 8,
              alignItems: 'end',
            }}
          >
            {predictions.slice(0, 7).map((p, idx) => (
              <MiniBar
                key={p.baseDate || idx}
                prediction={p}
                index={idx}
                isBest={summary?.bestIdx === idx}
              />
            ))}
          </div>
        )}
        {/* 범례 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            marginTop: 10,
            fontSize: 10,
            color: '#94a3b8',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: 'linear-gradient(180deg, #22d3ee, #06b6d4)',
                boxShadow: '0 0 0 2px rgba(34,211,238,0.18)',
              }}
            />
            가장 한가
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {LEVELS.map((l) => (
              <span
                key={l.label}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                title={`< ${l.max}`}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: l.color,
                    opacity: 0.85,
                  }}
                />
                {l.label}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* 디바이더 */}
      <div
        aria-hidden
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, transparent, rgba(148,163,184,0.14), transparent)',
        }}
      />

      {/* FOOTER */}
      <footer style={{ padding: '12px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {summary?.best && (
            <Link
              href={wellnessHref}
              title="이 지역의 힐링 스팟으로 한산한 날 회복하기"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 11px',
                borderRadius: 10,
                background: 'rgba(34,211,238,0.08)',
                border: '1px solid rgba(34,211,238,0.28)',
                color: '#a5f3fc',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(34,211,238,0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(34,211,238,0.08)';
              }}
            >
              <Sparkles size={12} />
              <span>
                <b style={{ color: '#67e8f9', fontWeight: 800 }}>
                  {formatDateShort(summary.best.baseDate)}
                </b>{' '}
                힐링
              </span>
            </Link>
          )}
          <Link
            href={`/photo-gallery?q=${encodeURIComponent(wellnessQuery)}`}
            title="이 지역 촬영지 사진 갤러리"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 11px',
              borderRadius: 10,
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.22)',
              color: '#e2e8f0',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(148,163,184,0.16)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(148,163,184,0.08)';
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
              padding: '7px 14px',
              borderRadius: 999,
              background:
                'linear-gradient(135deg, rgba(34,211,238,0.95), rgba(14,165,233,0.95))',
              color: '#0b1220',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.01em',
              textDecoration: 'none',
              boxShadow: '0 6px 18px -8px rgba(34,211,238,0.7)',
              transition: 'transform 0.18s ease, box-shadow 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(34,211,238,0.85)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 18px -8px rgba(34,211,238,0.7)';
            }}
          >
            30일 레이더
            <ArrowRight size={12} />
          </Link>
        </div>
        <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.01em' }}>
          출처: 한국관광공사 관광지 집중률 방문자 추이 예측 · 영화 매핑은 자체 큐레이션
        </div>
      </footer>

      <style>{`
        @keyframes crowdradar-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes crowdradar-bar { from { transform: scaleY(0); } to { transform: scaleY(1); } }
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

function MiniBar({ prediction, index, isBest = false }) {
  const rate = prediction?.concentrationRate ?? 0;
  const level = rateLevel(rate);
  const pct = Math.max(8, Math.min(100, rate));
  const dateLabel = formatDateShort(prediction?.baseDate);
  const datePart = dateLabel.replace(/\([^)]*\)$/, '');
  const dowMatch = dateLabel.match(/\(([^)]+)\)$/);
  const dowPart = dowMatch ? dowMatch[1] : '';

  // BEST 칸은 시안 그라디언트 + 글로우, 나머지는 등급별 절제된 단색 그라디언트.
  const barFill = isBest
    ? 'linear-gradient(180deg, #67e8f9 0%, #22d3ee 50%, #0891b2 100%)'
    : `linear-gradient(180deg, ${level.color}f2 0%, ${level.color}99 100%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.32) }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
      }}
      title={`${dateLabel} · 집중률 ${rate?.toFixed?.(1) ?? '-'}${isBest ? ' · 가장 한가' : ''}`}
    >
      {/* 막대 위 수치 */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: isBest ? '#67e8f9' : '#cbd5e1',
          letterSpacing: '-0.2px',
          lineHeight: 1,
          minHeight: 12,
        }}
      >
        {Number.isFinite(rate) ? rate.toFixed(0) : '-'}
      </span>

      {/* 막대 트랙 */}
      <div
        style={{
          width: '100%',
          height: 64,
          borderRadius: 8,
          background:
            'linear-gradient(180deg, rgba(15,23,42,0.6) 0%, rgba(15,23,42,0.35) 100%)',
          border: isBest
            ? '1px solid rgba(103,232,249,0.6)'
            : '1px solid rgba(148,163,184,0.12)',
          display: 'flex',
          alignItems: 'flex-end',
          overflow: 'hidden',
          boxShadow: isBest
            ? '0 0 0 2px rgba(34,211,238,0.18), 0 6px 18px -8px rgba(34,211,238,0.55)'
            : 'inset 0 1px 0 rgba(255,255,255,0.03)',
          position: 'relative',
        }}
      >
        {/* 그리드 가이드라인 (눈금 25/50/75%) */}
        {[75, 50, 25].map((g) => (
          <span
            key={g}
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${g}%`,
              height: 1,
              background: 'rgba(148,163,184,0.08)',
            }}
          />
        ))}

        {/* 실제 막대 */}
        <div
          style={{
            width: '100%',
            height: `${pct}%`,
            background: barFill,
            transformOrigin: 'bottom',
            animation: 'crowdradar-bar 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
            animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
            borderRadius: '6px 6px 4px 4px',
          }}
        />

        {/* BEST 표지 */}
        {isBest && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontWeight: 800,
              color: '#001a1f',
              background:
                'linear-gradient(135deg, #67e8f9, #06b6d4)',
              borderRadius: 4,
              padding: '1px 6px',
              letterSpacing: '0.06em',
              textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              boxShadow: '0 2px 6px rgba(34,211,238,0.45)',
            }}
          >
            BEST
          </span>
        )}
      </div>

      {/* 날짜 라벨 (두 줄) */}
      <div
        style={{
          textAlign: 'center',
          lineHeight: 1.15,
          textShadow: '0 1px 2px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: isBest ? '#67e8f9' : '#e2e8f0',
            letterSpacing: '-0.2px',
          }}
        >
          {datePart}
        </div>
        {dowPart && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: isBest ? '#a5f3fc' : '#94a3b8',
              marginTop: 1,
            }}
          >
            ({dowPart})
          </div>
        )}
      </div>
    </motion.div>
  );
}
