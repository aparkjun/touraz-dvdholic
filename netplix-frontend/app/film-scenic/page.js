'use client';

/**
 * 「풍경 릴」— 영화·DVD 무드와 한국관광공사 포토코리아 관광공모전(PhokoAwrd) 수상 사진을
 * 한 화면에서 잇는 두 번째 앱 경험. 기존 백엔드 KTO 연동 API만 사용한다.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  Clapperboard,
  Film,
  MapPin,
  Sparkles,
  Disc3,
  Compass,
  Camera,
  Headphones,
  ArrowRight,
} from 'lucide-react';
import AmbientBackdrop from '@/components/AmbientBackdrop';
import PhotoGalleryStrip from '@/components/PhotoGalleryStrip';

const AREA_CHIPS = [
  { code: null, labelKey: 'filmScenic.areas.all' },
  { code: '39', labelKey: 'filmScenic.areas.jeju' },
  { code: '6', labelKey: 'filmScenic.areas.busan' },
  { code: '32', labelKey: 'filmScenic.areas.gangwon' },
  { code: '31', labelKey: 'filmScenic.areas.gyeonggi' },
  { code: '1', labelKey: 'filmScenic.areas.seoul' },
  { code: '36', labelKey: 'filmScenic.areas.jeonnam' },
];

const HUB_LINKS = [
  { href: '/cine-trip', icon: MapPin, titleKey: 'filmScenic.hubs.cine.title', descKey: 'filmScenic.hubs.cine.desc' },
  { href: '/related-spots', icon: Compass, titleKey: 'filmScenic.hubs.related.title', descKey: 'filmScenic.hubs.related.desc' },
  { href: '/dvd-stores?nearby=true', icon: Disc3, titleKey: 'filmScenic.hubs.dvd.title', descKey: 'filmScenic.hubs.dvd.desc' },
  { href: '/photo-gallery', icon: Camera, titleKey: 'filmScenic.hubs.gallery.title', descKey: 'filmScenic.hubs.gallery.desc' },
  { href: '/audio-guide?nearby=true', icon: Headphones, titleKey: 'filmScenic.hubs.audio.title', descKey: 'filmScenic.hubs.audio.desc' },
];

export default function FilmScenicPage() {
  const { t } = useTranslation();
  const [areaCode, setAreaCode] = useState(null);

  const stripTitle = useMemo(() => {
    if (!areaCode) return t('filmScenic.galleryTitleAll', '관광공모전 수상 풍경 — 전국 릴');
    const chip = AREA_CHIPS.find((a) => a.code === areaCode);
    const areaName = chip ? t(chip.labelKey) : '';
    return t('filmScenic.galleryTitleArea', '관광공모전 수상 풍경 — {{area}} 릴', { area: areaName });
  }, [areaCode, t]);

  return (
    <div
      style={{
        position: 'relative',
        isolation: 'isolate',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(900px 520px at 12% -8%, rgba(251,191,36,0.14), transparent),' +
          ' radial-gradient(720px 480px at 92% 12%, rgba(244,114,182,0.12), transparent),' +
          ' radial-gradient(800px 100% at 50% 100%, rgba(30,27,75,0.95), #050508 100%)',
        color: '#f8fafc',
        padding: '32px 16px 88px',
      }}
    >
      <AmbientBackdrop palette={['#fbbf24', '#f472b6', '#6366f1', '#0ea5e9']} intensity={0.75} />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1024, margin: '0 auto' }}>
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 28 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(15,23,42,0.55)',
              border: '1px solid rgba(251,191,36,0.35)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#fde68a',
              marginBottom: 14,
            }}
          >
            <Clapperboard size={14} aria-hidden />
            {t('filmScenic.badge', 'Film × KTO · Scenic Reel')}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(26px, 5.5vw, 40px)',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.04em',
              background: 'linear-gradient(115deg, #fef9c3 0%, #fde047 18%, #fb7185 42%, #c4b5fd 72%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: '0 0 42px rgba(251,191,36,0.25)',
            }}
          >
            {t('filmScenic.heroTitle', '풍경 릴')}
          </h1>
          <p
            style={{
              margin: '14px auto 0',
              maxWidth: 560,
              fontSize: 15,
              lineHeight: 1.75,
              color: 'rgba(226,232,240,0.88)',
            }}
          >
            {t(
              'filmScenic.heroBody',
              'DVD·MOVIE 큐레이션과 같은 무드로, 한국관광공사 포토코리아 관광공모전 수상 사진(PhokoAwrd)과 여행 정보를 한 릴에 감았습니다. 촬영지·동선·오디오 가이드로 장면을 이어 가 보세요.'
            )}
          </p>
        </motion.header>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginBottom: 28,
          }}
        >
          {[
            { k: 'filmScenic.pill1', icon: Film },
            { k: 'filmScenic.pill2', icon: Sparkles },
            { k: 'filmScenic.pill3', icon: Camera },
          ].map(({ k, icon: Icon }, i) => (
            <div
              key={k}
              style={{
                padding: '14px 16px',
                borderRadius: 16,
                background: 'linear-gradient(145deg, rgba(15,23,42,0.72), rgba(30,27,75,0.55))',
                border: '1px solid rgba(148,163,184,0.2)',
                fontSize: 13,
                lineHeight: 1.55,
                color: '#e2e8f0',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Icon size={20} strokeWidth={2} style={{ flexShrink: 0, color: '#fcd34d', marginTop: 2 }} aria-hidden />
              <span>{t(k)}</span>
            </div>
          ))}
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.4 }}
          style={{ marginBottom: 18 }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', marginBottom: 10, letterSpacing: '0.06em' }}>
            {t('filmScenic.areaLabel', '지역 필터')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {AREA_CHIPS.map((a) => {
              const active = areaCode === a.code;
              return (
                <button
                  key={a.code ?? 'all'}
                  type="button"
                  onClick={() => setAreaCode(a.code)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: active ? '1px solid rgba(251,191,36,0.65)' : '1px solid rgba(148,163,184,0.25)',
                    background: active ? 'rgba(251,191,36,0.16)' : 'rgba(15,23,42,0.45)',
                    color: active ? '#fef3c7' : '#cbd5e1',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t(a.labelKey)}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45 }}
          style={{
            padding: '18px 16px 22px',
            borderRadius: 20,
            background: 'linear-gradient(165deg, rgba(15,23,42,0.88), rgba(8,10,22,0.92))',
            border: '1px solid rgba(165,180,252,0.22)',
            boxShadow: '0 24px 56px rgba(0,0,0,0.45)',
            marginBottom: 32,
          }}
        >
          <PhotoGalleryStrip
            key={areaCode ?? 'all'}
            areaCode={areaCode}
            limit={20}
            title={stripTitle}
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
        >
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 18,
              fontWeight: 900,
              color: '#fef3c7',
              textAlign: 'center',
              letterSpacing: '-0.02em',
            }}
          >
            {t('filmScenic.hubsTitle', '다음 장면으로')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {HUB_LINKS.map(({ href, icon: Icon, titleKey, descKey }) => (
              <Link
                key={href}
                href={href}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'block',
                  padding: '16px 18px',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, rgba(30,27,75,0.75), rgba(15,23,42,0.85))',
                  border: '1px solid rgba(251,191,36,0.15)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Icon size={22} style={{ color: '#fcd34d' }} aria-hidden />
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{t(titleKey)}</span>
                  <ArrowRight size={16} style={{ marginLeft: 'auto', color: '#94a3b8' }} aria-hidden />
                </div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#94a3b8' }}>{t(descKey)}</p>
              </Link>
            ))}
          </div>
        </motion.section>

        <p
          style={{
            marginTop: 36,
            textAlign: 'center',
            fontSize: 11,
            lineHeight: 1.65,
            color: 'rgba(148,163,184,0.75)',
            maxWidth: 640,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {t(
            'filmScenic.attribution',
            '관광공모전 수상 사진 데이터: 한국관광공사 포토코리아(PhokoAwrd) · 앱 내 API 경유 제공. 영화/DVD 및 기타 여행 정보는 기존 Touraz Holic 서비스와 연결됩니다.'
          )}
        </p>
      </div>
    </div>
  );
}
