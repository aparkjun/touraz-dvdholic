'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, MapPin, Film, Sparkles, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';
import useBackButtonClose from '@/lib/useBackButtonClose';
import { hasCatalogMovieSummary } from '@/lib/movieCatalog';
import { getMovieTitle, getOverview, getTagline, getPosterPath } from '@/lib/movieLang';

const NO_POSTER_PLACEHOLDER = '/no-poster-placeholder.png';

const MAPPING_TYPE_KEY = {
  SHOT: 'nearbyCineTrip.mappingShot',
  BACKGROUND: 'nearbyCineTrip.mappingBackground',
  THEME: 'nearbyCineTrip.mappingTheme',
};
const MAPPING_TYPE_FALLBACK = {
  SHOT: '촬영지',
  BACKGROUND: '배경',
  THEME: '테마',
};

const posterSrc = (posterPath) => {
  if (!posterPath) return NO_POSTER_PLACEHOLDER;
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
};

/**
 * Film×Trip / NearbyCineTrip 포스터 탭 시 — CineTrip 페이지 없이 작품 요약만 보여 주는 모달.
 */
export default function FilmTripMovieModal({ item, theme = 'dark', onClose }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isLight = theme === 'light';
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const movie = item?.movie || {};
  const mappings = item?.mappings || [];
  const movieName = movie.movieName;

  useBackButtonClose(!!item, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!item) return undefined;
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
  }, [item, onClose]);

  useEffect(() => {
    if (!movieName) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    axios
      .get(`/api/v1/movie/${encodeURIComponent(movieName)}/detail`)
      .then((res) => {
        if (!alive) return;
        if (res.data?.success && res.data.data) {
          setDetail(res.data.data);
        } else {
          setDetail(null);
        }
      })
      .catch(() => {
        if (alive) setDetail(null);
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [movieName]);

  const display = useMemo(
    () => ({ ...movie, ...(detail || {}) }),
    [movie, detail],
  );

  const regionChips = useMemo(() => {
    const map = new Map();
    for (const m of mappings) {
      if (!m?.areaCode || map.has(m.areaCode)) continue;
      map.set(m.areaCode, m);
    }
    return Array.from(map.values());
  }, [mappings]);

  const title = getMovieTitle(display) || movieName;
  const tagline = getTagline(display);
  const overview = getOverview(display);
  const canOpenDetail = hasCatalogMovieSummary(display);
  const contentType = display.contentType || 'movie';

  const openDetail = () => {
    if (!canOpenDetail || !movieName) return;
    onClose?.();
    router.push(
      `/dashboard/images?movieName=${encodeURIComponent(movieName)}&contentType=${encodeURIComponent(contentType)}`,
    );
  };

  if (!item || !mounted || typeof document === 'undefined') return null;

  const cardBg = isLight
    ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
    : 'linear-gradient(180deg, #1a1a22 0%, #0d0d12 100%)';
  const text = isLight ? '#0f172a' : '#f8fafc';
  const muted = isLight ? '#64748b' : '#94a3b8';
  const border = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(168,85,247,0.35)';

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: isLight ? 'rgba(15,23,42,0.45)' : 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 20px)',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="film-trip-modal-title"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 18,
          background: cardBg,
          border: `1px solid ${border}`,
          boxShadow: isLight
            ? '0 24px 48px rgba(15,23,42,0.18)'
            : '0 25px 60px rgba(168,85,247,0.22)',
          color: text,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close', '닫기')}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
            color: text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        <motion.div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 20px 16px',
            paddingRight: 56,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 12,
              background: isLight ? 'rgba(14,165,233,0.12)' : 'rgba(168,85,247,0.15)',
              color: isLight ? '#0369a1' : '#c4b5fd',
              border: isLight ? '1px solid rgba(14,165,233,0.25)' : '1px solid rgba(168,85,247,0.35)',
            }}
          >
            <Sparkles size={12} />
            {t('filmTripModal.badge', 'Film×Trip')}
          </motion.div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <img
              src={posterSrc(getPosterPath(display))}
              alt={title || 'poster'}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onError={(e) => {
                if (!e.target.src.endsWith(NO_POSTER_PLACEHOLDER)) {
                  e.target.src = NO_POSTER_PLACEHOLDER;
                }
              }}
              style={{
                width: 108,
                height: 162,
                objectFit: 'cover',
                borderRadius: 12,
                flexShrink: 0,
                border: `1px solid ${border}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                id="film-trip-modal-title"
                style={{
                  margin: '0 0 8px',
                  fontSize: 'clamp(18px, 4.5vw, 22px)',
                  fontWeight: 800,
                  lineHeight: 1.25,
                  wordBreak: 'keep-all',
                }}
              >
                {title || t('nearbyCineTrip.untitled', '제목 미상')}
              </h2>
              {(tagline || display.genre) && (
                <p style={{ margin: '0 0 10px', fontSize: 13, color: muted, lineHeight: 1.5 }}>
                  {tagline || display.genre}
                </p>
              )}
              {display.releasedAt && (
                <p style={{ margin: '0 0 8px', fontSize: 12, color: muted }}>
                  {t('filmTripModal.release', '개봉')} {display.releasedAt}
                </p>
              )}
              {display.voteAverage != null && Number.isFinite(Number(display.voteAverage)) && (
                <p style={{ margin: 0, fontSize: 12, color: muted }}>
                  ★ {Number(display.voteAverage).toFixed(1)}
                </p>
              )}
            </div>
          </div>

          {regionChips.length > 0 && (
            <motion.div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {regionChips.map((m) => {
                const typeKey = MAPPING_TYPE_KEY[m.mappingType];
                const typeLabel = typeKey
                  ? t(typeKey, MAPPING_TYPE_FALLBACK[m.mappingType])
                  : '';
                return (
                  <span
                    key={m.areaCode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                      color: text,
                    }}
                  >
                    <MapPin size={12} style={{ opacity: 0.75 }} />
                    {m.regionName || m.areaCode}
                    {typeLabel && (
                      <span style={{ opacity: 0.7, fontSize: 11 }}>
                        <Film size={10} style={{ marginRight: 3, verticalAlign: '-1px' }} />
                        {typeLabel}
                      </span>
                    )}
                  </span>
                );
              })}
            </motion.div>
          )}

          <motion.div style={{ marginTop: 16 }}>
            {detailLoading ? (
              <p style={{ fontSize: 13, color: muted, margin: 0 }}>
                {t('filmTripModal.loading', '작품 정보를 불러오는 중…')}
              </p>
            ) : overview ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.65,
                  color: isLight ? '#334155' : '#cbd5e1',
                  display: '-webkit-box',
                  WebkitLineClamp: 6,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {overview}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: muted }}>
                {t(
                  'filmTripModal.noOverview',
                  '이 작품은 이 지역 여행 큐레이션에 연결된 작품입니다. 줄거리·상세 메타는 카탈로그에 등록된 경우에만 볼 수 있어요.',
                )}
              </p>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          style={{
            padding: '12px 20px 18px',
            borderTop: `1px solid ${border}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {canOpenDetail ? (
            <button
              type="button"
              onClick={openDetail}
              style={{
                width: '100%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 800,
                color: '#fff',
                background: isLight
                  ? 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
                  : 'linear-gradient(135deg, rgba(168,85,247,0.85), rgba(236,72,153,0.85))',
                boxShadow: isLight ? '0 8px 20px rgba(14,165,233,0.35)' : 'none',
              }}
            >
              {t('filmTripModal.viewDetail', '자세히 보기')}
              <ArrowRight size={16} />
            </button>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, textAlign: 'center', color: muted, lineHeight: 1.5 }}>
              {t(
                'filmTripModal.catalogOnlyHint',
                '영화 상세 페이지는 앱 카탈로그에 등록된 작품만 열 수 있어요.',
              )}
            </p>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}
