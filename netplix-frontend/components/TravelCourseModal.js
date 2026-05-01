'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  X,
  MapPin,
  Sparkles,
  TrendingUp,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { KakaoMapLogo, NaverNLogo, GoogleGLogo } from '@/components/BrandMapSearchIcons';
import ConcentrationForecastStrip from '@/components/ConcentrationForecastStrip';
import PhotoGalleryStrip from '@/components/PhotoGalleryStrip';
import AccessibleSpotsStrip from '@/components/AccessibleSpotsStrip';
import PetFriendlySpotsStrip from '@/components/PetFriendlySpotsStrip';
import NearbyTrekkingStrip from '@/components/NearbyTrekkingStrip';

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

/**
 * CineTrip 스텁(매핑만 있고 TMDB/DB 카탈로그에 없음)은 /dashboard/images 가 비어
 * "영화 정보를 찾을 수 없습니다"만 보인다. 카탈로그에 실제 행이 있을 때만 상세 CTA 노출.
 */
function hasCatalogMovieSummary(movie) {
  if (!movie?.movieName) return false;
  if (typeof movie.overview === 'string' && movie.overview.trim()) return true;
  if (typeof movie.genre === 'string' && movie.genre.trim()) return true;
  if (typeof movie.tagline === 'string' && movie.tagline.trim()) return true;
  if (movie.voteAverage != null && Number.isFinite(Number(movie.voteAverage))) return true;
  if (typeof movie.movieNameEn === 'string' && movie.movieNameEn.trim()) return true;
  if (typeof movie.releasedAt === 'string' && movie.releasedAt.trim()) return true;
  if (typeof movie.backdropPath === 'string' && movie.backdropPath.trim()) return true;
  return false;
}

export default function TravelCourseModal({
  movie,
  mappings = [],
  regionIndices = [],
  score = 0,
  onClose,
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    if (!hasCatalogMovieSummary(movie)) return;
    router.push(
      `/dashboard/images?movieName=${encodeURIComponent(movie.movieName)}&contentType=movie`
    );
  };
  const showMovieDetailCta = hasCatalogMovieSummary(movie);

  if (!mounted || typeof document === 'undefined') return null;

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="tc-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(8px, 2vw, 16px)',
      }}
    >
      <style>{`
        .tc-modal {
          width: 100%;
          max-width: 960px;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 20px;
          background: linear-gradient(180deg, #141419 0%, #0a0a0f 100%);
          border: 1px solid rgba(168, 85, 247, 0.35);
          box-shadow: 0 25px 60px rgba(168,85,247,0.25), 0 0 0 1px rgba(255,255,255,0.04);
          position: relative;
        }
        .tc-modal-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .tc-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 44px;
          height: 44px;
          border-radius: 22px;
          border: none;
          background: transparent;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 10;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .tc-modal-close:hover {
          color: rgba(255, 255, 255, 0.92);
        }
        .tc-modal-close:focus-visible {
          outline: 2px solid rgba(196, 181, 253, 0.7);
          outline-offset: 2px;
        }
        .tc-modal-header {
          display: flex;
          gap: 20px;
          padding: 24px 24px 18px;
          padding-right: 72px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .tc-modal-poster {
          width: 120px;
          height: 170px;
          object-fit: cover;
          border-radius: 12px;
          flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
          user-select: none;
        }
        .tc-modal-info { flex: 1; min-width: 0; }
        .tc-modal-title {
          font-size: clamp(20px, 5.5vw, 30px);
          font-weight: 800;
          margin: 0 0 6px;
          word-break: keep-all;
          overflow-wrap: anywhere;
          line-height: 1.2;
          background: linear-gradient(135deg, #ffffff 0%, #c4b5fd 55%, #f9a8d4 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.01em;
        }
        .tc-modal-action-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .tc-modal-detail-btn { margin-left: auto; }
        .tc-modal-body { padding: 18px 22px 28px; }
        .tc-stop-section { padding: 16px 16px 18px; }
        .tc-link-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 6px 0 14px;
        }
        .tc-link-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          letter-spacing: -0.01em;
          white-space: nowrap;
        }
        @media (max-width: 600px) {
          .tc-modal {
            max-height: 90vh;
            max-height: 90dvh;
          }
          .tc-modal-header {
            gap: 14px;
            padding: 20px 16px 16px;
            padding-right: 68px;
          }
          .tc-modal-poster { width: 92px; height: 132px; border-radius: 10px; }
          .tc-modal-body { padding: 14px 14px 24px; }
          .tc-stop-section { padding: 14px 12px 16px; }
          .tc-modal-detail-btn {
            margin-left: 0;
            width: 100%;
            justify-content: center;
          }
          .tc-link-btn {
            flex: 1 1 calc(50% - 8px);
            min-width: 0;
            font-size: 12px;
            padding: 9px 10px;
          }
          .tc-link-btn span.tc-link-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
          }
        }
        @media (max-width: 380px) {
          .tc-modal-header { gap: 12px; padding: 16px 14px 14px; padding-right: 60px; }
          .tc-modal-poster { width: 78px; height: 112px; }
        }
      `}</style>
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="tc-modal"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="tc-modal-close"
        >
          <X size={20} />
        </button>

        <div className="tc-modal-scroll">
        <div className="tc-modal-header">
          <img
            src={posterSrc(movie.posterPath)}
            alt={movie.movieName || 'poster'}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="tc-modal-poster"
            style={{ WebkitUserDrag: 'none' }}
            onError={(e) => {
              if (!e.target.src.endsWith(NO_POSTER_PLACEHOLDER)) {
                e.target.src = NO_POSTER_PLACEHOLDER;
              }
            }}
          />
          <div className="tc-modal-info">
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
            <h2 className="tc-modal-title">
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

            <div className="tc-modal-action-row">
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
              {showMovieDetailCta && (
                <motion.button
                  type="button"
                  onClick={openMovieDetail}
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="tc-modal-detail-btn"
                  style={{
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
              )}
            </div>
          </div>
        </div>

        <div className="tc-modal-body">
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
                  className="tc-stop-section"
                  style={{
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
                  <div className="tc-link-row">
                    {kakao && (
                      <motion.a
                        href={kakao}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        title={`카카오맵에서 ${regionName} 보기`}
                        aria-label={`카카오맵에서 ${regionName} 보기`}
                        className="tc-link-btn"
                        style={{
                          color: '#1a1a1a',
                          background:
                            'linear-gradient(180deg, #ffe94a 0%, #fee500 55%, #f7d900 100%)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          boxShadow:
                            '0 6px 18px rgba(254,229,0,0.25), inset 0 1px 0 rgba(255,255,255,0.6)',
                        }}
                      >
                        <KakaoMapLogo size={22} dark />
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
                        aria-label={`네이버에서 ${regionName} 검색`}
                        className="tc-link-btn"
                        style={{
                          color: '#fff',
                          background:
                            'linear-gradient(180deg, #14d96e 0%, #03c75a 55%, #03a94c 100%)',
                          border: '1px solid rgba(0,0,0,0.08)',
                          boxShadow:
                            '0 6px 18px rgba(3,199,90,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
                        }}
                      >
                        <NaverNLogo size={22} />
                      </motion.a>
                    )}
                    {google && (
                      <motion.a
                        href={google}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -2, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        title={`Google에서 ${regionName} 촬영지 검색`}
                        aria-label={`Google에서 ${regionName} 촬영지 검색`}
                        className="tc-link-btn"
                        style={{
                          color: '#fff',
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
                          border: '1px solid rgba(255,255,255,0.18)',
                          boxShadow:
                            '0 4px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        <GoogleGLogo size={22} />
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

                  <PetFriendlySpotsStrip
                    areaCode={m.areaCode}
                    regionLabel={regionName}
                  />

                  <NearbyTrekkingStrip
                    areaCode={m.areaCode}
                    regionName={regionName}
                    limit={18}
                  />
                </section>
              );
            })
          )}
        </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
