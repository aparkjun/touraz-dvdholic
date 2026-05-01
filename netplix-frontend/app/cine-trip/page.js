'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Film,
  TrendingUp,
  Sparkles,
  Share2,
  X,
  Compass,
  Plane,
  ChevronDown,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import { shareContent, shareResultMessage } from '@/lib/shareUtils';
import PhotoGalleryStrip from '@/components/PhotoGalleryStrip';
import TourGallerySection from '@/components/TourGallerySection';
import NearbyCampingStrip from '@/components/NearbyCampingStrip';
import NearbyWellnessStrip from '@/components/NearbyWellnessStrip';
import NearbyMedicalTourismStrip from '@/components/NearbyMedicalTourismStrip';
import NearbyAudioGuideStrip from '@/components/NearbyAudioGuideStrip';
import ConcentrationForecastStrip from '@/components/ConcentrationForecastStrip';
import ConcentrationHeatmap30 from '@/components/ConcentrationHeatmap30';
import EngTourSpotsStrip from '@/components/EngTourSpotsStrip';
import TravelCourseModal from '@/components/TravelCourseModal';
import CineTripCinematicHero from '@/components/CineTripCinematicHero';
import useDragScrollAll from '@/lib/useDragScroll';

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

// KTO/TMDB 모두 이미지가 없을 때 dashboard 와 동일한 로컬 NO IMAGE 플레이스홀더를 사용.
const NO_POSTER_PLACEHOLDER = '/no-poster-placeholder.png';

// w500 → w342 로 다운사이징(이미지 바이트 ~55% 감소).
// 모바일(특히 iOS Safari) 에서 200+ 카드 동시 디코딩 시 메모리 한계로
// 페이지가 강제 리로드(`이 페이지에서 문제가 반복적으로 발생했습니다`)되던 문제 완화.
const posterSrc = (posterPath) => {
  if (!posterPath) return NO_POSTER_PLACEHOLDER;
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w342${posterPath}`;
};

// 첫 화면에 즉시 렌더할 영화 카드 수. 나머지는 IntersectionObserver 로 점진 로드.
const CARDS_INITIAL_BATCH = 24;
const CARDS_BATCH_INCREMENT = 24;

function SkeletonCard() {
  return (
    <div
      style={{
        flex: '0 0 auto',
        width: 300,
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
      style={{
        flex: '1 1 100%',
        minWidth: '100%',
        textAlign: 'center',
        padding: '80px 20px',
      }}
    >
      <Film size={64} style={{ margin: '0 auto 24px', opacity: 0.3, color: '#a855f7' }} />
      <h3 style={{ fontSize: 24, fontWeight: 600, color: '#fff', marginBottom: 12 }}>
        아직 연결된 영화가 없어요
      </h3>
      <p style={{ fontSize: 16, color: '#888' }}>다른 지역을 골라보거나 잠시 뒤에 다시 오세요.</p>
    </motion.div>
  );
}

/**
 * "이 영화로 여행가기" 진입 시 최상단에 렌더링되는 스포트라이트 배너.
 *
 * - `/api/v1/cine-trip/movie?name=<movieName>` 로 해당 영화의
 *   mappings / regionIndices / 영화 메타를 불러와 한눈에 요약.
 * - 사용자가 길을 잃지 않도록 두 가지 명확한 진입점을 제공:
 *   1) "여행 코스 바로 보기" → `TravelCourseModal` 즉시 오픈
 *   2) "이 영화의 장소 모아보기" → 지역 필터 자동 활성 + 카드 영역 스크롤
 * - 로컬 CineTrip DB 에 매핑이 없는 영화(예: 런닝맨: 라이트&쉐도우)는
 *   매핑 없음 안내와 함께 전체 CineTrip 둘러보기 CTA 만 노출.
 */
function MovieSpotlightBanner({ movieName, onFocusRegion, onDismiss }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [courseOpen, setCourseOpen] = useState(false);

  useEffect(() => {
    if (!movieName) return;
    let alive = true;
    setLoading(true);
    axios
      .get(`/api/v1/cine-trip/movie?name=${encodeURIComponent(movieName)}`)
      .then((res) => {
        if (!alive) return;
        const list = res?.data?.data ?? [];
        setData(Array.isArray(list) && list.length > 0 ? list[0] : null);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [movieName]);

  if (loading) return null;

  const movie = data?.movie || { movieName };
  const mappings = data?.mappings || [];
  const regionIndices = data?.regionIndices || [];
  const uniqueRegions = new Map();
  mappings.forEach((m) => {
    if (m?.areaCode && !uniqueRegions.has(m.areaCode)) {
      uniqueRegions.set(m.areaCode, {
        areaCode: m.areaCode,
        regionName: m.regionName,
        mappingType: m.mappingType,
      });
    }
  });
  const regionChips = Array.from(uniqueRegions.values());
  const primaryAreaCode = regionChips[0]?.areaCode;
  const hasMapping = regionChips.length > 0;
  const poster = posterSrc(movie.posterPath);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        position: 'relative',
        maxWidth: 1100,
        margin: '20px auto 0',
        padding: '18px 18px 20px',
        borderRadius: 18,
        background:
          'linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(139,92,246,0.22) 50%, rgba(236,72,153,0.22) 100%)',
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow:
          '0 20px 50px -18px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        }}
      />

      <button
        type="button"
        onClick={onDismiss}
        aria-label="스포트라이트 닫기"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.18)',
          background: 'rgba(0,0,0,0.35)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={15} />
      </button>

      <div
        style={{
          display: 'flex',
          gap: 18,
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            flex: '0 0 120px',
            width: 120,
            height: 170,
            borderRadius: 12,
            overflow: 'hidden',
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
          }}
        >
          <img
            src={poster}
            alt={movie.movieName || 'movie'}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              if (!e.target.src.endsWith(NO_POSTER_PLACEHOLDER)) {
                e.target.src = NO_POSTER_PLACEHOLDER;
              }
            }}
          />
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(251,191,36,0.35)',
              color: '#fde68a',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            <Sparkles size={12} />
            CineTrip Spotlight
          </div>

          <h2
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#fff',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
              lineHeight: 1.25,
            }}
          >
            『{movie.movieName || movieName}』의 발자취를 따라
          </h2>
          <p
            style={{
              fontSize: 13.5,
              color: 'rgba(255,255,255,0.78)',
              margin: '0 0 12px 0',
              lineHeight: 1.55,
            }}
          >
            {hasMapping
              ? '아래 버튼 중 하나를 선택해 이 작품과 연결된 여행지를 바로 확인해 보세요.'
              : '이 작품은 아직 촬영지 매핑이 준비되지 않았어요. 대신 전국 CineTrip 큐레이션을 둘러보세요.'}
          </p>

          {regionChips.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 14,
              }}
            >
              {regionChips.slice(0, 6).map((r) => {
                const color = MAPPING_TYPE_COLORS[r.mappingType] || '#333';
                const label = MAPPING_TYPE_LABEL[r.mappingType] || r.mappingType;
                return (
                  <button
                    key={r.areaCode}
                    type="button"
                    onClick={() => onFocusRegion?.(r.areaCode)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: 999,
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <MapPin size={11} />
                    {r.regionName}
                    <span
                      style={{
                        padding: '1px 7px',
                        borderRadius: 6,
                        background: color,
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#fff',
                      }}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              alignItems: 'center',
            }}
          >
            {hasMapping && (
              <button
                type="button"
                onClick={() => setCourseOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: 999,
                  cursor: 'pointer',
                  background:
                    'linear-gradient(135deg, #f59e0b 0%, #ef4444 50%, #ec4899 100%)',
                  color: '#fff',
                  fontSize: 14.5,
                  fontWeight: 800,
                  letterSpacing: '0.1px',
                  boxShadow: '0 10px 26px -8px rgba(236,72,153,0.6)',
                }}
              >
                <Plane size={15} />
                여행 코스 바로 보기
              </button>
            )}

            {hasMapping && primaryAreaCode && (
              <button
                type="button"
                onClick={() => onFocusRegion?.(primaryAreaCode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Compass size={14} />
                이 영화의 장소 모아보기
                <ChevronDown size={14} style={{ opacity: 0.85 }} />
              </button>
            )}

            {!hasMapping && (
              <button
                type="button"
                onClick={() => onFocusRegion?.(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: 'none',
                  background:
                    'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 10px 26px -8px rgba(139,92,246,0.55)',
                }}
              >
                <Compass size={15} />
                전체 CineTrip 둘러보기
              </button>
            )}

            {regionIndices.length > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.35)',
                  color: 'rgba(251,191,36,0.95)',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                <TrendingUp size={13} />
                관심도{' '}
                {regionIndices
                  .reduce((s, r) => s + Number(r?.searchVolume || 0), 0)
                  .toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {courseOpen && (
          <TravelCourseModal
            movie={movie}
            mappings={mappings}
            regionIndices={regionIndices}
            score={data?.trendingScore || 0}
            onClose={() => setCourseOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MovieCard({ item, index, eager = false }) {
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
      // 첫 배치(eager) 만 staggered fade-in 으로 시네마틱 인상을 주고,
      // 이후 점진 로드 카드는 motion 초기 애니메이션을 끄는 것이 모바일 성능에 유리.
      // (motion.div initial+animate 가 카드마다 GPU 합성 레이어 + transform 처리를
      //  유발하므로 200+ 동시 마운트 시 iOS 메모리 폭주의 직접 원인.)
      initial={eager ? { opacity: 0, y: 30 } : false}
      animate={eager ? { opacity: 1, y: 0 } : false}
      transition={
        eager
          ? { duration: 0.5, delay: Math.min(index * 0.06, 0.5) }
          : undefined
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        // 가로 스크롤 캐러셀용 고정 너비 (부모가 flex row 일 때)
        flex: '0 0 auto',
        width: 300,
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
          // 첫 배치 외 카드는 lazy 디코딩 → iOS Safari 메모리 압박 완화.
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.3s ease',
            transform: isHovered ? 'scale(1.08)' : 'scale(1)',
            // 네이티브 이미지 드래그가 부모의 스와이프 드래그를 가로채는 문제 방지.
            // 이미지에 pointer-events: none 을 걸면 모든 포인터는 부모(카드)로 전달되어
            // useDragScrollAll 훅이 정상적으로 가로 스크롤을 처리.
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserDrag: 'none',
          }}
          onError={(e) => {
            if (!e.target.src.endsWith(NO_POSTER_PLACEHOLDER)) {
              e.target.src = NO_POSTER_PLACEHOLDER;
            }
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


function CineTripPageInner() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const searchParams = useSearchParams();
  const movieParam = searchParams.get('movie');
  const areaParam = searchParams.get('area');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaCode, setSelectedAreaCode] = useState(areaParam || null);
  // URL 의 movie= 로 진입한 경우에만 스포트라이트 배너를 렌더.
  // 사용자가 닫으면 다시 나타나지 않음.
  const [spotlightMovie, setSpotlightMovie] = useState(movieParam || null);
  // iOS Safari 메모리 보호: 영화 카드를 한 번에 200+ 마운트하면
  // 페이지가 강제 리로드되므로 첫 24장만 즉시 렌더하고,
  // 우측 가장자리 sentinel 이 화면에 보일 때마다 24장씩 추가 마운트.
  const [visibleCount, setVisibleCount] = useState(CARDS_INITIAL_BATCH);
  const pageRef = useRef(null);
  const cardsRef = useRef(null);
  const loadMoreSentinelRef = useRef(null);
  useDragScrollAll(pageRef);

  // 필터/스포트라이트가 바뀌어 items 가 새로 들어오면 visibleCount 리셋.
  useEffect(() => {
    setVisibleCount(CARDS_INITIAL_BATCH);
  }, [selectedAreaCode]);

  // sentinel 이 가로 스크롤 컨테이너 안에서 보일 때 24장씩 추가.
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    const root = cardsRef.current;
    if (!sentinel || !root) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisibleCount(items.length);
      return;
    }
    if (visibleCount >= items.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisibleCount((prev) =>
              Math.min(prev + CARDS_BATCH_INCREMENT, items.length)
            );
          }
        }
      },
      { root, rootMargin: '0px 600px 0px 600px', threshold: 0.01 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  /**
   * 스포트라이트 배너 → "이 영화의 장소 모아보기" 버튼 콜백.
   * 지역 필터를 활성화하고 영화 카드 영역으로 부드럽게 스크롤.
   */
  const focusRegion = (areaCode) => {
    setSelectedAreaCode(areaCode ?? null);
    requestAnimationFrame(() => {
      cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // '전체' 탭은 CSV 시드 고유 영화 전체(≈234)를 한 번에 노출.
        // 지역 탭은 해당 지역 고유 영화 전체(최대 서울 90).
        // limit 미지정 → 백엔드가 전체 반환
        const url =
          selectedAreaCode == null
            ? '/api/v1/cine-trip/curate'
            : `/api/v1/cine-trip/region/${selectedAreaCode}`;
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
      ref={pageRef}
      className="cinetrip-page"
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

      {spotlightMovie && (
        <MovieSpotlightBanner
          movieName={spotlightMovie}
          onFocusRegion={focusRegion}
          onDismiss={() => setSpotlightMovie(null)}
        />
      )}

      <CineTripCinematicHero
        posters={items
          .map((it) => posterSrc(it?.posterPath))
          .filter((u) => u && !u.includes('no-poster-placeholder'))
          .slice(0, 16)}
        topLabel={t('cineTrip.hero.topLabel', 'Cinematic Journeys · 영화로 떠나는 여행')}
        tagline={
          isEn
            ? t('cineTrip.hero.taglineEn', 'Travel the Korea you saw on screen.')
            : t('cineTrip.hero.tagline', 'Your favorite scene is a real place.')
        }
        korean={
          isEn
            ? ''
            : t('cineTrip.hero.subcopy', '좋아하는 그 장면이, 실제로 존재하는 장소입니다.')
        }
        ctas={[
          {
            label: t('cineTrip.hero.cta.explore', 'Explore Scenes'),
            primary: true,
            onClick: () => {
              if (typeof window !== 'undefined') {
                document
                  .querySelector('.cinetrip-scroll-row')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            },
          },
          {
            label: t('cineTrip.hero.cta.findLocations', 'Find Locations'),
            onClick: () => {
              if (typeof window !== 'undefined') {
                document
                  .getElementById('cinetrip-region-filter')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            },
          },
        ]}
      />

      {/* 지역 필터 (마퀴 하단, 영화관 좌석 라인처럼 배치) */}
      <div
        id="cinetrip-region-filter"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background:
            'linear-gradient(180deg, rgba(10, 10, 26, 0.92) 0%, rgba(10, 10, 26, 0.88) 100%)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(212, 175, 55, 0.18)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {REGION_FILTERS.map((region) => {
            const active = selectedAreaCode === region.areaCode;
            return (
              <motion.button
                key={region.label}
                onClick={() => setSelectedAreaCode(region.areaCode)}
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.96 }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 2,
                  border: active
                    ? '1px solid #d4af37'
                    : '1px solid rgba(212, 175, 55, 0.22)',
                  background: active
                    ? 'linear-gradient(135deg, #c41e3a 0%, #9b162d 100%)'
                    : 'rgba(10, 10, 26, 0.6)',
                  color: active ? '#fef3c7' : 'rgba(245, 245, 220, 0.78)',
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: active
                    ? '0 6px 20px -8px rgba(196, 30, 58, 0.7)'
                    : 'none',
                }}
              >
                {region.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 20px' }}>
        <ConcentrationForecastStrip
          areaCode={selectedAreaCode}
          regionLabel={
            REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''
          }
        />

        {/*
         * 30일 집중률 히트맵 (달력형). 7일 스트립이 "다음 주 분위기" 라면
         * 이 히트맵은 "한 달 전체 중 언제 가는 게 가장 한가한가?" 의 시각화.
         * selectedAreaCode 가 null (전체) 이거나 영어 모드면 자동 숨김.
         */}
        <ConcentrationHeatmap30
          areaCode={selectedAreaCode}
          regionLabel={
            REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''
          }
        />

        <PhotoGalleryStrip
          areaCode={selectedAreaCode}
          // limit=0 → 백엔드 캐시 전량 반환 (KTO PhokoAwrdService totalCount 만큼).
          // 카드 자체는 200x140 썸네일이고 <img loading="lazy"> 가 가로 스크롤 뷰포트 진입 시에만
          // 디코딩하므로, 수백 건이라도 동시 메모리 부담은 화면에 보이는 ~10장 수준.
          limit={0}
          title={
            selectedAreaCode
              ? `${REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''} 수상작 포토스팟`
              : '전국 수상작 포토스팟'
          }
        />

        {/*
         * 관광사진갤러리 — PhotoGalleryService1
         * - 지역이 선택되어 있을 때만 해당 지역명(한글 라벨)을 키워드로 검색
         * - 결과 0건 또는 키 미승인 상태면 컴포넌트 자체가 null 반환 → 섹션 숨김
         * - PhotoGalleryStrip(수상작) 이 비어 있거나 적을 때 전체 DB 기반 커버리지 보강
         */}
        {selectedAreaCode && (
          <TourGallerySection
            keyword={REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''}
            title={t('tourGallery.regionSection')}
            subtitle={t('tourGallery.poweredBy')}
            limit={24}
          />
        )}

        {/*
         * 이 지역의 야영장 (GoCamping) — CineTrip 촬영지 근처에서 하루 더 묵기.
         * 지역이 선택되어 있을 때만 해당 지역명을 키워드로 조회, 0건이면 섹션 숨김.
         */}
        {selectedAreaCode && (
          <NearbyCampingStrip
            keyword={REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''}
            title={t('nearbyCamping.regionSection')}
            subtitle={t('nearbyCamping.poweredBy')}
            limit={6}
          />
        )}

        {/* 촬영지 답사 후 힐링 마무리 · 지역 기반 웰니스 스팟 */}
        {selectedAreaCode && (
          <NearbyWellnessStrip
            keyword={REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''}
            title={t('nearbyWellness.regionSection')}
            subtitle={t('nearbyWellness.poweredByRegion')}
            limit={6}
          />
        )}

        {/* 외국인 방문객 대상 K-의료관광 — 영화 촬영지 탐방 일정에 의료관광 클러스터 교차 노출 */}
        {selectedAreaCode && (
          <NearbyMedicalTourismStrip
            keyword={REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''}
            title={t('nearbyMedicalTourism.regionSection')}
            subtitle={t('nearbyMedicalTourism.poweredByRegion')}
            limit={6}
          />
        )}

        {/* Cine Audio Trail · 촬영지 현장 오디오 해설 — 영화 답사 동선에서 이어폰으로 듣는 이야기 */}
        {selectedAreaCode && (
          <NearbyAudioGuideStrip
            type="theme"
            keyword={REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''}
            title={t('nearbyAudioGuide.regionSection')}
            subtitle={t('nearbyAudioGuide.poweredByRegion')}
            limit={6}
          />
        )}

        {/*
         * 영어 모드 전용 "Travel Spots Around This Film" 스트립.
         * - 컴포넌트 내부에서 isEn / areaCode / 0건 fallback 을 모두 처리하므로
         *   조건부 렌더링 없이 그대로 렌더해도 국문 모드에서는 null 반환.
         * - 사용자가 제시한 키워드(관광지·미식산업·숙박) 3 버킷 탭으로 구성.
         */}
        <EngTourSpotsStrip
          areaCode={selectedAreaCode}
          regionLabel={
            REGION_FILTERS.find((r) => r.areaCode === selectedAreaCode)?.label || ''
          }
        />

        {/*
         * 총 컨텐츠 수 카운터: 현재 필터/로케일 조합에서 화면에 노출되는 영화 카드 총 개수.
         * - 자동 매핑(AUTO) 집계 반영을 즉시 체감할 수 있도록 그리드 바로 위 중앙에 빨간색 강조.
         * - 로딩 중/빈 상태에서는 숨겨 UX 혼선을 막는다.
         */}
        {!loading && items.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              margin: '8px 0 16px',
              color: '#dc2626',
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              textShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
            aria-live="polite"
          >
            {isEn ? `Total ${items.length} titles` : `총 ${items.length}편`}
          </div>
        )}

        {/*
         * 영화 카드 영역: 그리드 → 가로 스와이프 캐러셀.
         * - 마우스 드래그/터치 스와이프로 좌우 이동(useDragScrollAll 로 바인딩)
         * - 스크롤바(수평/수직) 는 .cinetrip-page / .cinetrip-scroll-row 전역 규칙으로 숨김.
         */}
        <div
          ref={cardsRef}
          className="cinetrip-scroll-row"
          role="list"
          aria-label="영화 카드"
        >
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {items.slice(0, visibleCount).map((item, i) => (
                <MovieCard
                  key={`${item?.movie?.movieName || 'item'}-${i}`}
                  item={item}
                  index={i}
                  // 첫 배치만 staggered fade-in + 이미지 즉시 디코딩.
                  eager={i < CARDS_INITIAL_BATCH}
                />
              ))}
              {visibleCount < items.length && (
                <div
                  ref={loadMoreSentinelRef}
                  aria-hidden="true"
                  // sentinel 은 너비를 가져 가로 레일에서 IntersectionObserver 가
                  // 정상 발화하도록 하고, 시각적 점유는 거의 없게 둔다.
                  style={{
                    flex: '0 0 auto',
                    width: 1,
                    height: 1,
                    alignSelf: 'center',
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CineTripPage() {
  // useSearchParams 는 Suspense 경계 내부에서 사용해야 Next.js 빌드 경고가 없음.
  return (
    <Suspense fallback={null}>
      <CineTripPageInner />
    </Suspense>
  );
}
