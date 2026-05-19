'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Clapperboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useBackButtonClose from '@/lib/useBackButtonClose';
import PetFriendlySpotsStrip from '@/components/PetFriendlySpotsStrip';

/**
 * Film×Trip 포스터 탭 — 해당 지역 반려동물 동반 장소(KTO KorPetTour)를 바로 보여 준다.
 */
export default function FilmTripMovieModal({
  item,
  areaCode,
  regionLabel = '',
  theme = 'dark',
  onClose,
}) {
  const { t } = useTranslation();
  const isLight = theme === 'light';
  const [mounted, setMounted] = useState(false);

  const movieName = item?.movie?.movieName;
  const mapping = (item?.mappings || [])[0];
  const region =
    regionLabel || mapping?.regionName || '';

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
          maxWidth: 560,
          maxHeight: '90vh',
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
            padding: '20px 18px 22px',
            paddingRight: 52,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: isLight
                  ? 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%)'
                  : 'linear-gradient(135deg, rgba(168,85,247,0.35), rgba(236,72,153,0.35))',
                color: '#fff',
              }}
            >
              <Clapperboard size={22} />
            </div>
            <motion.div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: isLight ? '#0d9488' : '#c4b5fd',
                }}
              >
                {t('filmTripModal.badge', 'Film×Trip')}
              </p>
              <h2
                id="film-trip-modal-title"
                style={{
                  margin: '0 0 6px',
                  fontSize: 'clamp(18px, 4.5vw, 22px)',
                  fontWeight: 800,
                  lineHeight: 1.25,
                  wordBreak: 'keep-all',
                }}
              >
                {movieName || t('nearbyCineTrip.untitled', '제목 미상')}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: muted, lineHeight: 1.5 }}>
                {region
                  ? t('filmTripModal.petSubtitle', '{{region}}에서 반려동물과 함께 가볼 곳', {
                      region,
                    })
                  : t('filmTripModal.petSubtitleNoRegion', '반려동물과 함께 가볼 곳')}
              </p>
            </motion.div>
          </div>

          {areaCode ? (
            <PetFriendlySpotsStrip
              areaCode={areaCode}
              regionLabel={region}
              theme={theme}
              embedded
            />
          ) : (
            <p style={{ fontSize: 13, color: muted, margin: 0 }}>
              {t('filmTripModal.noRegion', '지역 정보를 찾지 못했어요.')}
            </p>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}
