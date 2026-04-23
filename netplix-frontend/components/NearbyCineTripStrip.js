'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Sparkles, ArrowRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axiosConfig';
import { sigunToAreaCode, areaCodeToLabel } from '@/lib/regionMap';

/**
 * 두루누비 트레킹 코스 카드에서 펼쳐지는
 * "🎬 이 길의 영화 큐레이션" 가로 스트립.
 *
 * - props.sigun : 두루누비 코스의 sigun 문자열(예: "경남 창원시")
 * - props.areaCode: 직접 광역시도 코드를 지정하고 싶을 때
 * - 가로 스와이프는 globals.css 의 .js-drag-scroll 레일 규칙 재활용
 */
const NO_POSTER_PLACEHOLDER = '/no-poster-placeholder.png';

const MAPPING_TYPE_LABEL = {
  SHOT: '촬영지',
  BACKGROUND: '배경',
  THEME: '테마',
};

const posterSrc = (posterPath) => {
  if (!posterPath) return NO_POSTER_PLACEHOLDER;
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
};

export default function NearbyCineTripStrip({
  sigun,
  areaCode: areaCodeProp,
  limit = 8,
  theme = 'dark',
  title,
  badgeLabel = 'CineWalk',
}) {
  const isLight = theme === 'light';
  const headerBadgeBg = isLight
    ? 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
    : 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(236,72,153,0.2) 100%)';
  const headerBadgeBorder = isLight ? 'transparent' : 'rgba(168,85,247,0.45)';
  const headerBadgeColor = isLight ? '#fff' : '#f5d0fe';
  const headerTitleColor = isLight ? '#0f172a' : '#fff';
  const headerLinkColor = isLight ? '#0ea5e9' : '#f5d0fe';
  const emptyTextColor = isLight ? '#475569' : '#94a3b8';
  const areaCode = useMemo(() => {
    if (areaCodeProp != null) return Number(areaCodeProp);
    return sigunToAreaCode(sigun);
  }, [sigun, areaCodeProp]);
  const regionLabel = areaCode ? areaCodeToLabel(areaCode) : '';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!areaCode) {
      setItems([]);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/v1/cine-trip/region/${areaCode}?limit=${limit}`);
        const payload = res?.data?.data ?? [];
        if (alive) setItems(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error('[nearby-cine-trip] fetch failed:', e?.message || e);
        if (alive) setError('이 지역의 영화 큐레이션을 불러올 수 없어요');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode, limit]);

  if (!areaCode) return null;
  if (!loading && !error && items.length === 0) {
    return (
      <div style={{ padding: '10px 2px', fontSize: 12.5, color: emptyTextColor }}>
        아직 이 지역과 연결된 영화 큐레이션이 없어요.
      </div>
    );
  }

  return (
    <div>
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
            padding: '3px 9px',
            borderRadius: 999,
            background: headerBadgeBg,
            border: `1px solid ${headerBadgeBorder}`,
            color: headerBadgeColor,
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: isLight ? '0 6px 18px rgba(14,165,233,0.35)' : 'none',
          }}
        >
          <Sparkles size={11} /> {badgeLabel}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: headerTitleColor }}>
          {title || `${regionLabel} 배경으로 한 영화들`}
        </span>
        <Link
          href={`/cine-trip?area=${areaCode}`}
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
          CineTrip 에서 보기 <ArrowRight size={12} />
        </Link>
      </div>

      <div
        className="js-drag-scroll"
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: '0 0 auto',
                  width: 130,
                  height: 200,
                  borderRadius: 12,
                  background:
                    'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'cinetrip-shimmer 1.5s infinite',
                }}
              />
            ))
          : error
            ? <div style={{ color: emptyTextColor, fontSize: 13 }}>{error}</div>
            : items.map((it, i) => (
                <MoviePosterCard key={`${it?.movie?.movieName || 'item'}-${i}`} item={it} index={i} />
              ))}
      </div>
    </div>
  );
}

function MoviePosterCard({ item, index }) {
  const router = useRouter();
  const movie = item?.movie || {};
  const mapping = (item?.mappings || [])[0];
  const tagLabel = MAPPING_TYPE_LABEL[mapping?.mappingType] || '';

  const onClick = () => {
    if (!movie.movieName) return;
    router.push(
      `/dashboard/images?movieName=${encodeURIComponent(movie.movieName)}&contentType=${encodeURIComponent(movie.contentType || 'movie')}`
    );
  };

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
      whileHover={{ scale: 1.04, y: -3 }}
      style={{
        flex: '0 0 auto',
        width: 130,
        padding: 0,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0f0f0f',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
      }}
      title={movie.movieName || ''}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3', overflow: 'hidden' }}>
        <img
          src={posterSrc(movie.posterPath)}
          alt={movie.movieName || 'movie'}
          loading="lazy"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onError={(e) => {
            if (!e.target.src.endsWith(NO_POSTER_PLACEHOLDER)) {
              e.target.src = NO_POSTER_PLACEHOLDER;
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          }}
        />
        {tagLabel && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.65)',
              color: '#f5d0fe',
              border: '1px solid rgba(168,85,247,0.45)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Film size={9} style={{ marginRight: 3, verticalAlign: '-1px' }} />
            {tagLabel}
          </span>
        )}
      </div>

      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#fff',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {movie.movieName || '제목 미상'}
        </div>
        {mapping?.regionName && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              color: '#94a3b8',
            }}
          >
            <MapPin size={10} /> {mapping.regionName}
          </div>
        )}
      </div>
    </motion.button>
  );
}
