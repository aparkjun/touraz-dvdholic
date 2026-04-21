'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Film, TrendingUp, Sparkles, Share2 } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { shareContent, shareResultMessage } from '@/lib/shareUtils';

const REGION_FILTERS = [
  { label: '전체', areaCode: null },
  { label: '서울', areaCode: '1' },
  { label: '부산', areaCode: '6' },
  { label: '강원도', areaCode: '32' },
  { label: '제주도', areaCode: '39' },
  { label: '경상북도', areaCode: '37' },
  { label: '인천', areaCode: '2' },
  { label: '광주광역시', areaCode: '29' },
];

const MAPPING_TYPE_COLORS = {
  SHOT: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  BACKGROUND: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  THEME: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};

const MAPPING_TYPE_LABEL = {
  SHOT: '촬영지',
  BACKGROUND: '배경',
  THEME: '테마',
};

const posterSrc = (posterPath) => {
  if (!posterPath) return 'https://via.placeholder.com/500x750/1a1a1a/666666?text=No+Image';
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
};

function SkeletonCard() {
  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 280,
          background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
          backgroundSize: '200% 100%',
          animation: 'cinetrip-shimmer 1.5s infinite',
        }}
      />
      <div style={{ padding: 20 }}>
        {[70, 90, 60].map((w, i) => (
          <div
            key={i}
            style={{
              width: `${w}%`,
              height: i === 0 ? 24 : 14,
              background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              backgroundSize: '200% 100%',
              animation: 'cinetrip-shimmer 1.5s infinite',
              borderRadius: 4,
              marginBottom: 12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px' }}
    >
      <Film size={64} style={{ margin: '0 auto 24px', opacity: 0.3, color: '#a855f7' }} />
      <h3 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
        아직 연결된 영화가 없어요
      </h3>
      <p style={{ fontSize: 16, color: '#888' }}>다른 지역을 골라보거나 잠시 뒤에 다시 오세요.</p>
    </motion.div>
  );
}

function MovieCard({ item, index }) {
  const [isHovered, setIsHovered] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const movie = item.movie || {};
  const mappings = item.mappings || [];
  const regionIndices = item.regionIndices || [];
  const score = item.trendingScore || 0;
  const topRegionIndex = regionIndices[0];
  const primaryArea = mappings[0]?.areaCode || topRegionIndex?.areaCode;

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const regionLabel = mappings
      .slice(0, 3)
      .map((m) => m.regionName)
      .filter(Boolean)
      .join(', ');
    const channel = await shareContent({
      title: `${movie.movieName || '영화'} · CineTrip`,
      description: regionLabel
        ? `이 영화로 떠나는 여행: ${regionLabel}`
        : '이 영화로 떠나는 여행 큐레이션',
      imageUrl: movie.posterPath
        ? (movie.posterPath.startsWith('http')
            ? movie.posterPath
            : `https://image.tmdb.org/t/p/w500${movie.posterPath}`)
        : '',
      url:
        typeof window !== 'undefined'
          ? `${window.location.origin}/cine-trip${primaryArea ? `?area=${primaryArea}` : ''}`
          : undefined,
    });
    setShareToast(shareResultMessage(channel));
    setTimeout(() => setShareToast(''), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.5) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%)',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        transition: 'all 0.3s ease',
        transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 20px 40px rgba(168, 85, 247, 0.3), 0 0 20px rgba(236, 72, 153, 0.2)'
          : '0 4px 12px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: 280, overflow: 'hidden' }}>
        <img
          src={posterSrc(movie.posterPath)}
          alt={movie.movieName || 'movie'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease',
            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
          }}
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/500x750/1a1a1a/666666?text=No+Image';
          }}
        />
        {typeof movie.voteAverage === 'number' && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              padding: '6px 12px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <span style={{ color: '#fbbf24', fontSize: 14 }}>⭐</span>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
              {movie.voteAverage.toFixed(1)}
            </span>
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 110,
            background: 'linear-gradient(to top, rgba(0,0,0,0.92), transparent)',
          }}
        />
      </div>

      <div style={{ padding: 20 }}>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: '#fff',
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {movie.movieName || '제목 미상'}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: '#888',
            marginBottom: 16,
            minHeight: 18,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {movie.tagline || movie.genre || ' '}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {mappings.slice(0, 3).map((m, idx) => (
            <div
              key={idx}
              title={m.evidence || ''}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 20,
                background: MAPPING_TYPE_COLORS[m.mappingType] || '#333',
                fontSize: 12,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              <MapPin size={12} />
              <span>{m.regionName || m.areaCode}</span>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.22)',
                  fontSize: 10,
                }}
              >
                {MAPPING_TYPE_LABEL[m.mappingType] || m.mappingType}
              </span>
            </div>
          ))}
        </div>

        {topRegionIndex && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 12px',
              marginBottom: 16,
              borderRadius: 10,
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.18)',
              fontSize: 12,
              color: '#cfcfcf',
            }}
          >
            <span style={{ opacity: 0.8 }}>{topRegionIndex.regionName} 지표</span>
            <span>
              관광수요 <b>{(topRegionIndex.tourDemandIdx ?? 0).toFixed(1)}</b> · 검색{' '}
              <b>{topRegionIndex.searchVolume ?? 0}</b>
            </span>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} style={{ color: '#a855f7' }} />
              <span style={{ fontSize: 12, color: '#888' }}>트렌딩 스코어</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{score.toFixed(1)}</span>
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(score, 100)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)',
                transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{
              flex: 1,
              padding: 12,
              background: isHovered
                ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                : 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Film size={16} />
            여행 코스 보기
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="공유"
            title="카카오톡으로 공유"
            style={{
              width: 46,
              padding: 12,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 12,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={16} />
          </button>
        </div>
        {shareToast && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#a5b4fc', textAlign: 'center' }}>
            {shareToast}
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function CineTripPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaCode, setSelectedAreaCode] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const url =
          selectedAreaCode == null
            ? '/api/v1/cine-trip/curate?limit=12'
            : `/api/v1/cine-trip/region/${selectedAreaCode}?limit=12`;
        const res = await axios.get(url);
        const payload = res?.data?.data ?? [];
        if (alive) setItems(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error('[cine-trip] fetch failed:', e?.message || e);
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedAreaCode]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <style>{`
        @keyframes cinetrip-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div
        style={{
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 50%, #0a0a0a 100%)',
          padding: '72px 20px 52px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Sparkles size={28} style={{ color: '#a855f7' }} />
            <h1
              style={{
                fontSize: 44,
                fontWeight: 800,
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #3b82f6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
              }}
            >
              CineTrip
            </h1>
          </div>
          <p style={{ fontSize: 18, color: '#bfbfbf', marginBottom: 32 }}>
            영화로 떠나는 한국 여행
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              maxWidth: 880,
              margin: '0 auto',
            }}
          >
            {REGION_FILTERS.map((region) => {
              const active = selectedAreaCode === region.areaCode;
              return (
                <motion.button
                  key={region.label}
                  onClick={() => setSelectedAreaCode(region.areaCode)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 24,
                    border: active ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                    background: active
                      ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                      : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  {region.label}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 24,
          }}
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            items.map((item, i) => (
              <MovieCard key={`${item?.movie?.movieName || 'item'}-${i}`} item={item} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
