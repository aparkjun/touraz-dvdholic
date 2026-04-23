'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Footprints, Mountain, Timer, Download, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';

/**
 * CineTrip 영화 모달의 각 Stop(지역) 섹션 하단에 노출되는
 * "🥾 이 영화 배경 걸어보기" 두루누비 코스 가로 스트립.
 *
 * - props.areaCode : 한국관광공사 광역시도 코드(1~39)
 * - props.regionName : 한글 광역명(표시용)
 * - 내부에서 /api/v1/tour/trekking/courses?areaCode=X 호출
 * - 가로 스와이프는 globals.css 의 .js-drag-scroll 레일 규칙을 재활용
 *   (useDragScroll 훅이 cine-trip 페이지 루트에 이미 바인딩되어 있어
 *    모달이 동적으로 마운트되어도 MutationObserver 가 자동 바인딩)
 */
export default function NearbyTrekkingStrip({
  areaCode,
  regionName,
  limit = 6,
  theme = 'dark',
  title,
  badgeLabel = 'CineWalk',
  subtitle,
}) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const isLight = theme === 'light';
  const headerBadgeBg = isLight
    ? 'linear-gradient(135deg, #059669 0%, #0ea5e9 100%)'
    : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(56,189,248,0.18))';
  const headerBadgeBorder = isLight ? 'transparent' : 'rgba(110,231,183,0.45)';
  const headerBadgeColor = isLight ? '#fff' : '#a7f3d0';
  const headerTitleColor = isLight ? '#0f172a' : '#fff';
  const headerSubtitleColor = isLight ? '#475569' : '#94a3b8';
  const headerLinkColor = isLight ? '#059669' : '#a7f3d0';
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (areaCode == null) {
      setCourses([]);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          areaCode: String(areaCode),
          limit: String(limit),
        });
        const res = await axios.get(`/api/v1/tour/trekking/courses?${params.toString()}`);
        const payload = res?.data?.data ?? [];
        if (alive) setCourses(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error('[nearby-trekking] fetch failed:', e?.message || e);
        if (alive) setError('걷기 코스를 불러올 수 없어요');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode, limit]);

  if (!loading && !error && courses.length === 0) return null;
  // 두루누비(한국관광공사 코리아둘레길) 국내 전용 트래킹 코스 → 영어 모드에서는 섹션 숨김.
  if (isEn) return null;

  return (
    <section style={{ marginTop: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: headerBadgeBg,
            border: `1px solid ${headerBadgeBorder}`,
            color: headerBadgeColor,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: isLight ? '0 6px 18px rgba(16,185,129,0.3)' : 'none',
          }}
        >
          <Footprints size={12} /> {badgeLabel}
        </span>
        <h4 style={{ fontSize: 15, fontWeight: 800, color: headerTitleColor, margin: 0 }}>
          {title || '이 영화 배경, 이렇게 걸어봐요'}
        </h4>
        {regionName && (
          <span style={{ fontSize: 12, color: headerSubtitleColor }}>
            · {subtitle || `${regionName} 인근 두루누비 코스`}
          </span>
        )}
        <Link
          href={`/trekking?fromArea=${areaCode}`}
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: headerLinkColor,
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          전체 걷기여행 <ArrowRight size={12} />
        </Link>
      </div>

      <div
        className="js-drag-scroll"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 6,
        }}
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: '0 0 auto',
                  width: 260,
                  height: 150,
                  borderRadius: 14,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'cinetrip-shimmer 1.5s infinite',
                }}
              />
            ))
          : error
            ? <div style={{ color: '#94a3b8', fontSize: 13, padding: 8 }}>{error}</div>
            : courses.map((c, idx) => <NearbyCourseCard key={c.crsIdx || idx} course={c} index={idx} />)}
      </div>
    </section>
  );
}

function NearbyCourseCard({ course, index }) {
  const {
    crsIdx,
    crsKorNm,
    crsDstnc,
    crsLevel,
    crsTotlRqrmHour,
    sigun,
    gpxpath,
    brdNm,
  } = course || {};

  // 난이도 숫자(1~3) → 한글 라벨
  const levelLabel = ({ 1: '쉬움', 2: '보통', 3: '어려움' }[Number(crsLevel)] || crsLevel || '');

  const gpxHref = gpxpath
    ? `/api/v1/tour/trekking/gpx?url=${encodeURIComponent(gpxpath)}&name=${encodeURIComponent(crsKorNm || crsIdx || 'durunubi-course')}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
      style={{
        flex: '0 0 auto',
        width: 260,
        borderRadius: 14,
        padding: 14,
        background:
          'linear-gradient(160deg, rgba(16,185,129,0.12) 0%, rgba(59,130,246,0.10) 60%, rgba(10,10,15,0.6) 100%)',
        border: '1px solid rgba(110,231,183,0.3)',
        boxShadow: '0 10px 28px rgba(16,185,129,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {brdNm && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#6ee7b7',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(110,231,183,0.14)',
              border: '1px solid rgba(110,231,183,0.3)',
            }}
          >
            {brdNm}
          </span>
        )}
        {sigun && (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{sigun}</span>
        )}
      </div>

      <h5
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#fff',
          margin: 0,
          lineHeight: 1.35,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {crsKorNm || '코스 정보'}
      </h5>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 11.5,
          color: '#cbd5f5',
        }}
      >
        {crsDstnc && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Mountain size={11} style={{ color: '#6ee7b7' }} />
            {crsDstnc}km
          </span>
        )}
        {crsTotlRqrmHour && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Timer size={11} style={{ color: '#93c5fd' }} />
            {crsTotlRqrmHour}
          </span>
        )}
        {levelLabel && (
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 999,
              background: 'rgba(99,102,241,0.18)',
              color: '#c7d2fe',
              fontWeight: 700,
            }}
          >
            난이도 {levelLabel}
          </span>
        )}
      </div>

      {gpxHref && (
        <a
          href={gpxHref}
          rel="noopener noreferrer"
          download
          style={{
            marginTop: 2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            alignSelf: 'flex-start',
            padding: '6px 10px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 800,
            color: '#a7f3d0',
            textDecoration: 'none',
            background: 'rgba(16,185,129,0.14)',
            border: '1px solid rgba(110,231,183,0.4)',
          }}
        >
          <Download size={11} /> GPX 다운로드
        </a>
      )}
    </motion.div>
  );
}
