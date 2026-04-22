'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Film, TrendingUp, Sparkles, Share2, X, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/axiosConfig';
import { shareContent, shareResultMessage } from '@/lib/shareUtils';
import PhotoGalleryStrip from '@/components/PhotoGalleryStrip';
import ConcentrationForecastStrip from '@/components/ConcentrationForecastStrip';

const REGION_FILTERS = [
  { label: '전체', areaCode: null },
  { label: '서울', areaCode: '1' },
  { label: '부산', areaCode: '6' },
  { label: '경기', areaCode: '31' },
  { label: '강원', areaCode: '32' },
  { label: '제주', areaCode: '39' },
  { label: '경북', areaCode: '37' },
  { label: '경남', areaCode: '38' },
  { label: '전북', areaCode: '35' },
  { label: '전남', areaCode: '36' },
  { label: '인천', areaCode: '2' },
  { label: '대전', areaCode: '3' },
  { label: '대구', areaCode: '4' },
  { label: '광주', areaCode: '5' },
  { label: '울산', areaCode: '7' },
  { label: '세종', areaCode: '8' },
  { label: '충북', areaCode: '33' },
  { label: '충남', areaCode: '34' },
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
  const [courseOpen, setCourseOpen] = useState(false);
  const movie = item.movie || {};
  const mappings = item.mappings || [];
  const regionIndices = item.regionIndices || [];
  const score = item.trendingScore || 0;
  const topRegionIndex = regionIndices[0];
  const primaryArea = mappings[0]?.areaCode || topRegionIndex?.areaCode;

  const openCourse = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setCourseOpen(true);
  };

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
            type="button"
            onClick={openCourse}
            disabled={mappings.length === 0}
            aria-label="여행 코스 보기"
            style={{
              flex: 1,
              padding: 12,
              background: mappings.length === 0
                ? 'rgba(168, 85, 247, 0.08)'
                : isHovered
                  ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                  : 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              borderRadius: 12,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: mappings.length === 0 ? 'not-allowed' : 'pointer',
              opacity: mappings.length === 0 ? 0.5 : 1,
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

      <AnimatePresence>
        {courseOpen && (
          <TravelCourseModal
            movie={movie}
            mappings={mappings}
            regionIndices={regionIndices}
            score={score}
            onClose={() => setCourseOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TravelCourseModal({ movie, mappings, regionIndices, score, onClose }) {
  const router = useRouter();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handler);
    };
  }, [onClose]);

  const regionMap = new Map();
  for (const m of mappings) {
    if (!m?.areaCode) continue;
    if (!regionMap.has(m.areaCode)) regionMap.set(m.areaCode, m);
  }
  const stops = Array.from(regionMap.values());
  const indexByArea = new Map(regionIndices.map((r) => [r.areaCode, r]));

  const openMovieDetail = () => {
    if (!movie?.movieName) return;
    router.push(
      `/dashboard/images?movieName=${encodeURIComponent(movie.movieName)}&contentType=movie`
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: 'linear-gradient(180deg, #141419 0%, #0a0a0f 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 60px rgba(168,85,247,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.45)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        <div
          style={{
            display: 'flex',
            gap: 20,
            padding: '28px 28px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <img
            src={posterSrc(movie.posterPath)}
            alt={movie.movieName || 'poster'}
            style={{
              width: 120,
              height: 170,
              objectFit: 'cover',
              borderRadius: 12,
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/240x340/1a1a1a/666?text=No+Image';
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 12,
                background: 'rgba(168,85,247,0.15)',
                border: '1px solid rgba(168,85,247,0.35)',
                fontSize: 11,
                fontWeight: 700,
                color: '#c4b5fd',
                marginBottom: 10,
              }}
            >
              <Sparkles size={12} /> 이 영화로 떠나는 여행
            </div>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: '#fff',
                margin: 0,
                marginBottom: 6,
                wordBreak: 'keep-all',
              }}
            >
              {movie.movieName || '제목 미상'}
            </h2>
            {(movie.tagline || movie.genre) && (
              <p style={{ color: '#a0a0a0', fontSize: 13, margin: '0 0 14px' }}>
                {movie.tagline || movie.genre}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {stops.map((m, idx) => (
                <span
                  key={m.areaCode}
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
                  Stop {idx + 1} · {m.regionName || m.areaCode}
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.22)',
                      fontSize: 10,
                    }}
                  >
                    {MAPPING_TYPE_LABEL[m.mappingType] || m.mappingType}
                  </span>
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>
                <TrendingUp size={12} style={{ verticalAlign: -2, color: '#a855f7' }} /> 트렌딩{' '}
                <b style={{ color: '#fff' }}>{score.toFixed(1)}</b>
              </span>
              <button
                type="button"
                onClick={openMovieDetail}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                영화 상세로 <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 28px 32px' }}>
          {stops.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14, textAlign: 'center', padding: '40px 0' }}>
              아직 연결된 지역 정보가 없어요. 다른 작품을 골라보세요.
            </div>
          ) : (
            stops.map((m, idx) => {
              const idxRow = indexByArea.get(m.areaCode);
              return (
                <section
                  key={m.areaCode}
                  style={{
                    padding: '18px 0',
                    borderTop: idx === 0 ? 'none' : '1px dashed rgba(255,255,255,0.06)',
                  }}
                >
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
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        background: 'linear-gradient(135deg,#a855f7,#ec4899)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: '#fff', margin: 0 }}>
                      {m.regionName || m.areaCode}
                    </h3>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 10,
                        background: MAPPING_TYPE_COLORS[m.mappingType] || '#333',
                        color: '#fff',
                        fontWeight: 700,
                      }}
                    >
                      {MAPPING_TYPE_LABEL[m.mappingType] || m.mappingType}
                    </span>
                    {idxRow && (
                      <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                        관광수요 <b style={{ color: '#fff' }}>{(idxRow.tourDemandIdx ?? 0).toFixed(1)}</b>
                        {' · '}검색 <b style={{ color: '#fff' }}>{idxRow.searchVolume ?? 0}</b>
                      </span>
                    )}
                  </div>
                  {m.evidence && (
                    <p
                      style={{
                        fontSize: 13,
                        color: '#cbd5e1',
                        background: 'rgba(168,85,247,0.07)',
                        border: '1px solid rgba(168,85,247,0.18)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        margin: '0 0 10px',
                        lineHeight: 1.55,
                      }}
                    >
                      {m.evidence}
                    </p>
                  )}

                  <ConcentrationForecastStrip
                    areaCode={m.areaCode}
                    regionLabel={m.regionName || ''}
                  />

                  <PhotoGalleryStrip
                    areaCode={m.areaCode}
                    limit={8}
                    title={`${m.regionName || m.areaCode} 관광공모전 수상작`}
                  />
                </section>
              );
            })
          )}
        </div>
      </motion.div>
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
        // '전체' 탭은 CSV 시드 고유 영화 전체(≈234)를 한 번에 노출.
        // 지역 탭은 해당 지역 고유 영화 전체(최대 서울 90).
        const url =
          selectedAreaCode == null
            ? '/api/v1/cine-trip/curate?limit=500'
            : `/api/v1/cine-trip/region/${selectedAreaCode}?limit=200`;
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
        <ConcentrationForecastStrip
          areaCode={selectedAreaCode}
          regionLabel={
            REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''
          }
        />

        <PhotoGalleryStrip
          areaCode={selectedAreaCode}
          limit={12}
          title={
            selectedAreaCode
              ? `${REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''} 수상작 포토스팟`
              : '전국 수상작 포토스팟'
          }
        />

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
