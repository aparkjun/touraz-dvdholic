'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  MapPin,
  Sparkles,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  Search,
  Map as MapIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ConcentrationForecastStrip from '@/components/ConcentrationForecastStrip';
import PhotoGalleryStrip from '@/components/PhotoGalleryStrip';
import AccessibleSpotsStrip from '@/components/AccessibleSpotsStrip';

/**
 * "여행 코스 보기" 버튼에서 열리는 영화 단위 여행 코스 모달.
 * - 포스터/요약/태그
 * - 지역별 Stop 섹션: 관광 지표 · 포토스팟 · 무장애 스팟
 * - 지역마다 카카오맵 길찾기 / 네이버 검색 / Google 검색 바로가기
 */

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

const NO_POSTER_PLACEHOLDER = '/no-poster-placeholder.png';

const posterSrc = (posterPath) => {
  if (!posterPath) return NO_POSTER_PLACEHOLDER;
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
};

const kakaoMapUrl = (regionName) => {
  if (!regionName) return null;
  return `https://map.kakao.com/?q=${encodeURIComponent(regionName)}`;
};

const naverSearchUrl = (movieName, regionName) => {
  const keyword = [movieName, regionName, '여행'].filter(Boolean).join(' ');
  if (!keyword) return null;
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
};

const googleSearchUrl = (movieName, regionName) => {
  const keyword = [movieName, regionName, '촬영지'].filter(Boolean).join(' ');
  if (!keyword) return null;
  return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
};

export default function TravelCourseModal({
  movie,
  mappings = [],
  regionIndices = [],
  score = 0,
  onClose,
}) {
  const router = useRouter();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
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
          boxShadow:
            '0 25px 60px rgba(168,85,247,0.25), 0 0 0 1px rgba(255,255,255,0.04)',
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
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: 120,
              height: 170,
              objectFit: 'cover',
              borderRadius: 12,
              flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
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
                fontSize: 30,
                fontWeight: 800,
                margin: 0,
                marginBottom: 6,
                wordBreak: 'keep-all',
                lineHeight: 1.2,
                background:
                  'linear-gradient(135deg, #ffffff 0%, #c4b5fd 55%, #f9a8d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.01em',
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
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  color: '#c4b5fd',
                  padding: '5px 10px',
                  borderRadius: 10,
                  background:
                    'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.16))',
                  border: '1px solid rgba(168,85,247,0.35)',
                  fontWeight: 700,
                }}
              >
                <TrendingUp size={12} style={{ color: '#c4b5fd' }} /> 트렌딩{' '}
                <b style={{ color: '#fff', fontSize: 13 }}>{score.toFixed(1)}</b>
              </span>
              <motion.button
                type="button"
                onClick={openMovieDetail}
                whileHover={{ y: -2, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(168,85,247,0.45)',
                  background:
                    'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.25))',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  boxShadow:
                    '0 8px 22px rgba(168,85,247,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                영화 상세로 <ArrowRight size={14} />
              </motion.button>
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
              const regionName = m.regionName || m.areaCode;
              const kakao = kakaoMapUrl(regionName);
              const naver = naverSearchUrl(movie.movieName, regionName);
              const google = googleSearchUrl(movie.movieName, regionName);
              return (
                <section
                  key={m.areaCode}
                  style={{
                    padding: '18px 18px 20px',
                    marginBottom: 16,
                    borderRadius: 18,
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
                    border: '1px solid rgba(255,255,255,0.06)',
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
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        background: 'linear-gradient(135deg,#a855f7,#ec4899)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 900,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 16px rgba(168,85,247,0.45)',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <h3
                      style={{
                        fontSize: 19,
                        fontWeight: 800,
                        color: '#fff',
                        margin: 0,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {regionName}
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
                      <div
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 10,
                            background:
                              'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.18))',
                            border: '1px solid rgba(168,85,247,0.35)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#e9d5ff',
                          }}
                          title="한국관광공사 관광수요지수"
                        >
                          <TrendingUp size={12} style={{ color: '#c4b5fd' }} />
                          관광수요{' '}
                          <b style={{ color: '#fff', fontSize: 12 }}>
                            {(idxRow.tourDemandIdx ?? 0).toFixed(1)}
                          </b>
                        </span>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 10,
                            background:
                              'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(14,165,233,0.16))',
                            border: '1px solid rgba(59,130,246,0.3)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#bae6fd',
                          }}
                          title="최근 검색량"
                        >
                          <Search size={12} style={{ color: '#7dd3fc' }} />
                          검색{' '}
                          <b style={{ color: '#fff', fontSize: 12 }}>
                            {idxRow.searchVolume ?? 0}
                          </b>
                        </span>
                      </div>
                    )}
                  </div>

                  {/*
                   * 외부 링크(카카오맵 / 네이버 / Google) 바로가기.
                   * - 각 서비스 브랜드 컬러를 반영
                   * - hover/tap 시 확대 + 그림자 강조 마이크로인터랙션
                   */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      margin: '6px 0 14px',
                    }}
                  >
                    {kakao && (
                      <motion.a
                        href={kakao}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        title={`카카오맵에서 ${regionName} 보기`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#1a1a1a',
                          background:
                            'linear-gradient(180deg, #ffe94a 0%, #fee500 55%, #f7d900 100%)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          textDecoration: 'none',
                          boxShadow:
                            '0 6px 18px rgba(254,229,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        <MapIcon size={15} /> 카카오맵에서 보기
                        <ExternalLink size={12} style={{ opacity: 0.65 }} />
                      </motion.a>
                    )}
                    {naver && (
                      <motion.a
                        href={naver}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        title={`네이버에서 ${regionName} 검색`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#fff',
                          background:
                            'linear-gradient(180deg, #14d96e 0%, #03c75a 55%, #03a94c 100%)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          textDecoration: 'none',
                          boxShadow:
                            '0 6px 18px rgba(3,199,90,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        <Search size={15} /> 네이버 검색
                        <ExternalLink size={12} style={{ opacity: 0.85 }} />
                      </motion.a>
                    )}
                    {google && (
                      <motion.a
                        href={google}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        title={`Google 에서 ${regionName} 촬영지 검색`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 14px',
                          borderRadius: 12,
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#fff',
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                          border: '1px solid rgba(255,255,255,0.18)',
                          textDecoration: 'none',
                          boxShadow:
                            '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                          letterSpacing: '-0.01em',
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        <Search size={15} /> Google 촬영지 검색
                        <ExternalLink size={12} style={{ opacity: 0.75 }} />
                      </motion.a>
                    )}
                  </div>

                  {m.evidence && (
                    <div
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(236,72,153,0.08) 100%)',
                        border: '1px solid rgba(168,85,247,0.28)',
                        borderRadius: 14,
                        padding: '12px 14px',
                        margin: '0 0 12px',
                        boxShadow: '0 8px 20px rgba(168,85,247,0.10) inset',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#f9a8d4',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        <Sparkles size={12} /> 이 영화와 이 지역의 연결고리
                      </div>
                      <p
                        style={{
                          fontSize: 13.5,
                          color: '#e2e8f0',
                          margin: 0,
                          lineHeight: 1.6,
                        }}
                      >
                        {m.evidence}
                      </p>
                    </div>
                  )}

                  <ConcentrationForecastStrip
                    areaCode={m.areaCode}
                    regionLabel={regionName}
                  />

                  <PhotoGalleryStrip
                    areaCode={m.areaCode}
                    limit={8}
                    title={`${regionName} 관광공모전 수상작`}
                  />

                  <AccessibleSpotsStrip
                    areaCode={m.areaCode}
                    regionLabel={regionName}
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
