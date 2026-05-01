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
    ? 'linear-gradient(135deg, #047857 0%, #0d9488 50%, #0e7490 100%)'
    : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(56,189,248,0.18))';
  const headerBadgeBorder = isLight ? '1px solid rgba(6, 78, 59, 0.35)' : 'rgba(110,231,183,0.45)';
  const headerBadgeColor = isLight ? '#fff' : '#a7f3d0';
  const headerTitleColor = isLight ? '#020617' : '#fff';
  const headerSubtitleColor = isLight ? '#0f172a' : '#94a3b8';
  const headerLinkColor = isLight ? '#065f46' : '#a7f3d0';
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

  const lightRailStyle = isLight
    ? {
        background: 'rgba(255, 255, 255, 0.97)',
        border: '1px solid rgba(13, 148, 136, 0.32)',
        borderRadius: 16,
        padding: '14px 14px 12px',
        boxShadow:
          '0 10px 28px rgba(14, 116, 144, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      }
    : null;

  const inner = (
    <>
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
            padding: isLight ? '5px 12px' : '4px 10px',
            borderRadius: 999,
            background: headerBadgeBg,
            border: typeof headerBadgeBorder === 'string' && headerBadgeBorder.startsWith('1px')
              ? headerBadgeBorder
              : `1px solid ${headerBadgeBorder}`,
            color: headerBadgeColor,
            fontSize: isLight ? 12 : 11,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            boxShadow: isLight
              ? '0 4px 14px rgba(4, 120, 87, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
              : 'none',
          }}
        >
          <Footprints size={isLight ? 13 : 12} /> {badgeLabel}
        </span>
        <h4
          style={{
            fontSize: isLight ? 16 : 15,
            fontWeight: 900,
            color: headerTitleColor,
            margin: 0,
            letterSpacing: isLight ? '-0.02em' : undefined,
            lineHeight: 1.25,
          }}
        >
          {title || '이 영화 배경, 이렇게 걸어봐요'}
        </h4>
        {regionName && (
          <span
            style={{
              fontSize: isLight ? 13 : 12,
              color: headerSubtitleColor,
              fontWeight: isLight ? 700 : 400,
              lineHeight: 1.4,
            }}
          >
            · {subtitle || `${regionName} 인근 두루누비 코스`}
          </span>
        )}
        <Link
          href={`/trekking?fromArea=${areaCode}`}
          style={{
            marginLeft: 'auto',
            fontSize: isLight ? 13 : 12,
            color: headerLinkColor,
            fontWeight: 800,
            textDecoration: isLight ? 'underline' : 'none',
            textUnderlineOffset: isLight ? 4 : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          전체 걷기여행 <ArrowRight size={isLight ? 13 : 12} strokeWidth={2.5} />
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
                  background: isLight
                    ? 'linear-gradient(90deg, rgba(15,23,42,0.07) 0%, rgba(15,23,42,0.14) 50%, rgba(15,23,42,0.07) 100%)'
                    : 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'cinetrip-shimmer 1.5s infinite',
                  border: isLight ? '1px solid rgba(13, 148, 136, 0.2)' : undefined,
                }}
              />
            ))
          : error
            ? (
                <div
                  style={{
                    color: isLight ? '#0f172a' : '#94a3b8',
                    fontSize: 13,
                    padding: 8,
                    fontWeight: 600,
                  }}
                >
                  {error}
                </div>
              )
            : courses.map((c, idx) => (
                <NearbyCourseCard
                  key={c.crsIdx || idx}
                  course={c}
                  index={idx}
                  theme={theme}
                />
              ))}
      </div>
    </>
  );

  return (
    <section style={{ marginTop: 18 }}>
      {isLight ? <div style={lightRailStyle}>{inner}</div> : inner}
    </section>
  );
}

function NearbyCourseCard({ course, index, theme = 'dark' }) {
  const isLight = theme === 'light';
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

  const cardBg = isLight
    ? 'linear-gradient(165deg, #ffffff 0%, #f8fafc 35%, #ecfdf5 70%, #e0f2fe 100%)'
    : 'linear-gradient(160deg, rgba(16,185,129,0.12) 0%, rgba(59,130,246,0.10) 60%, rgba(10,10,15,0.6) 100%)';
  const cardBorder = isLight
    ? '1px solid rgba(13, 148, 136, 0.35)'
    : '1px solid rgba(110,231,183,0.3)';
  const cardShadow = isLight
    ? '0 10px 28px rgba(14, 116, 144, 0.14), inset 0 1px 0 rgba(255,255,255,0.95)'
    : '0 10px 28px rgba(16,185,129,0.12)';

  const badgeStyle = isLight
    ? {
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: '#065f46',
        padding: '3px 9px',
        borderRadius: 999,
        background: 'rgba(16, 185, 129, 0.22)',
        border: '1px solid rgba(5, 150, 105, 0.55)',
      }
    : {
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.08em',
        color: '#6ee7b7',
        padding: '2px 8px',
        borderRadius: 999,
        background: 'rgba(110,231,183,0.14)',
        border: '1px solid rgba(110,231,183,0.3)',
      };

  const titleColor = isLight ? '#020617' : '#fff';
  const regionColor = isLight ? '#0f172a' : '#94a3b8';
  const metaColor = isLight ? '#0f172a' : '#cbd5f5';
  const metaMountain = isLight ? '#047857' : '#6ee7b7';
  const metaTimer = isLight ? '#0369a1' : '#93c5fd';
  const levelBg = isLight ? 'rgba(79, 70, 229, 0.12)' : 'rgba(99,102,241,0.18)';
  const levelFg = isLight ? '#3730a3' : '#c7d2fe';

  const gpxStyle = isLight
    ? {
        marginTop: 2,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        padding: '6px 10px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 800,
        color: '#047857',
        textDecoration: 'none',
        background: 'rgba(16, 185, 129, 0.18)',
        border: '1px solid rgba(5, 150, 105, 0.5)',
      }
    : {
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
      };

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
        background: cardBg,
        border: cardBorder,
        boxShadow: cardShadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {brdNm && <span style={badgeStyle}>{brdNm}</span>}
        {sigun && (
          <span style={{ fontSize: isLight ? 12 : 11, color: regionColor, fontWeight: isLight ? 700 : 400 }}>
            {sigun}
          </span>
        )}
      </div>

      <h5
        style={{
          fontSize: isLight ? 15 : 14,
          fontWeight: 800,
          color: titleColor,
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
          fontSize: isLight ? 12.5 : 11.5,
          color: metaColor,
          fontWeight: isLight ? 700 : 400,
        }}
      >
        {crsDstnc && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Mountain size={11} style={{ color: metaMountain }} />
            {crsDstnc}km
          </span>
        )}
        {crsTotlRqrmHour && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Timer size={11} style={{ color: metaTimer }} />
            {crsTotlRqrmHour}
          </span>
        )}
        {levelLabel && (
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 999,
              background: levelBg,
              color: levelFg,
              fontWeight: 700,
            }}
          >
            난이도 {levelLabel}
          </span>
        )}
      </div>

      {gpxHref && (
        <a href={gpxHref} rel="noopener noreferrer" download style={gpxStyle}>
          <Download size={11} /> GPX 다운로드
        </a>
      )}
    </motion.div>
  );
}
