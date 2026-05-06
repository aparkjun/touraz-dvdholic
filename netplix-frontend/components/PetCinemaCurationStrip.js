'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Clapperboard, Heart, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * 반려동물·동물·가족 테마 영화 큐레이션 스트립.
 *
 * /pet-travel 페이지 상단에 노출되어, "반려동물 여행" 과 "집에서 함께 보는 영화"
 * 두 경험을 이어주는 진입점 역할을 한다.
 *
 * - 공모전 컨텍스트를 고려해 한국 영화(마음이, 각설탕, 마리 이야기) 비중을 높였다.
 * - 포스터 자동 조회에 의존하지 않고 영화별 고유 그라디언트 + 이모지 아트 카드로
 *   구성해 일관된 톤을 유지한다.
 * - 카드 클릭 시 기존 영화 이미지 페이지(`/dashboard/images`)로 이동해, 사용자의
 *   탐색 경로 안에서 자연스럽게 이어진다.
 */
// 클릭 시 이동할 외부 정보 페이지(네이버 영화 검색). 쿼리는 title+연도로 구체화하여
// 오작동 없이 정확한 상세 페이지가 상단에 뜨도록 한다.
const buildNaverMovieUrl = (query) =>
  `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;

const PET_CINEMA_PICKS = [
  {
    id: 'maum',
    fallback: { title: '마음이', subtitle: '한국 · 2006', blurb: '진돗개 "마음이" 와 남매의 자전거 로드무비', tag: '반려견 · 한국' },
    emoji: '🐕‍🦺',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 55%, #dc2626 100%)',
    accent: '#fef3c7',
    searchQuery: '마음이 영화 2006',
  },
  {
    id: 'sugar',
    fallback: { title: '각설탕', subtitle: '한국 · 2006', blurb: '소녀와 경주마 "천둥" 의 청춘 성장기', tag: '가족 · 한국' },
    emoji: '🐎',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #14b8a6 50%, #22c55e 100%)',
    accent: '#ccfbf1',
    searchQuery: '각설탕 영화 2006',
  },
  {
    id: 'mari',
    fallback: { title: '마리 이야기', subtitle: '한국 애니 · 2002', blurb: '어린 날 친구가 되어준 하얀 고양이의 기억', tag: '애니 · 한국' },
    emoji: '🐈',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f472b6 100%)',
    accent: '#fce7f3',
    searchQuery: '마리이야기 애니메이션 2002',
  },
  {
    id: 'hachi',
    fallback: { title: '하치 이야기', subtitle: 'Hachi · 2009', blurb: '주인을 기다린 전설의 견공 아키타', tag: '실화 · 견공' },
    emoji: '🐕',
    gradient: 'linear-gradient(135deg, #1e3a8a 0%, #7c3aed 55%, #db2777 100%)',
    accent: '#e0e7ff',
    searchQuery: '하치 이야기 영화 2009',
  },
  {
    id: 'marley',
    fallback: { title: '말리와 나', subtitle: 'Marley & Me · 2008', blurb: '장난꾸러기 골든 리트리버가 만든 가족의 12년', tag: '가족 · 리트리버' },
    emoji: '🐶',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #10b981 50%, #0ea5e9 100%)',
    accent: '#d1fae5',
    searchQuery: '말리와 나 영화 2008',
  },
  {
    id: 'isle',
    fallback: { title: '개들의 섬', subtitle: 'Isle of Dogs · 2018', blurb: '추방된 개들과 소년이 만든 기묘한 모험', tag: '모험 · 애니' },
    emoji: '🦴',
    gradient: 'linear-gradient(135deg, #c2410c 0%, #a855f7 55%, #0284c7 100%)',
    accent: '#fed7aa',
    searchQuery: '개들의 섬 영화 2018 웨스 앤더슨',
  },
];

export default function PetCinemaCurationStrip() {
  const { t } = useTranslation();
  return (
    <section
      style={{
        padding: '20px 18px 18px',
        borderRadius: 22,
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(236,254,255,0.85) 100%)',
        border: '1px solid rgba(14, 165, 233, 0.15)',
        boxShadow:
          '0 18px 44px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255,255,255,0.85)',
        backdropFilter: 'blur(6px)',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(253, 224, 71, 0.4) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: '0 6px 18px rgba(14,165,233,0.35)',
          }}
        >
          <Clapperboard size={12} /> Pet-Cinema
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 900,
            color: '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          {t('petCinema.headerTitle', '반려와 함께 보면 좋은 영화 큐레이션')}
        </h3>
        <span style={{ fontSize: 12.5, color: '#0f766e' }}>
          {t('petCinema.headerSubtitle', '산책 다녀온 저녁, 소파 위에서 한 편')}
        </span>
      </header>

      <div
        className="js-drag-scroll"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 6,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {PET_CINEMA_PICKS.map((pick, i) => (
          <PetCinemaCard key={pick.id} pick={pick} index={i} />
        ))}
      </div>
    </section>
  );
}

function PetCinemaCard({ pick, index }) {
  const { t } = useTranslation();
  const title = t(`petCinema.picks.${pick.id}.title`, pick.fallback.title);
  const subtitle = t(`petCinema.picks.${pick.id}.subtitle`, pick.fallback.subtitle);
  const blurb = t(`petCinema.picks.${pick.id}.blurb`, pick.fallback.blurb);
  const tag = t(`petCinema.picks.${pick.id}.tag`, pick.fallback.tag);
  const href = buildNaverMovieUrl(pick.searchQuery || `${pick.fallback.title} 영화`);

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('petCinema.cardAria', '{{title}} 영화 정보 새 탭으로 보기', { title })}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -5 }}
      style={{
        flex: '0 0 auto',
        width: 220,
        padding: 0,
        borderRadius: 16,
        overflow: 'hidden',
        textDecoration: 'none',
        border: 'none',
        cursor: 'pointer',
        background: pick.gradient,
        boxShadow:
          '0 14px 28px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
        textAlign: 'left',
        position: 'relative',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 100% 0%, rgba(255,255,255,0.28) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          padding: '18px 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: 232,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            fontSize: 42,
            lineHeight: 1,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.25))',
          }}
        >
          {pick.emoji}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '2px 8px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.22)',
              color: pick.accent,
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
          >
            <Heart size={9} style={{ verticalAlign: -1, marginRight: 3 }} />
            {tag}
          </span>

          <h4
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 900,
              color: '#fff',
              textShadow: '0 2px 10px rgba(0,0,0,0.25)',
              letterSpacing: '-0.015em',
            }}
          >
            {title}
          </h4>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            {subtitle}
          </div>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.95)',
            lineHeight: 1.5,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {blurb}
        </p>

        <div
          style={{
            marginTop: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11.5,
            fontWeight: 800,
            color: '#fff',
            alignSelf: 'flex-start',
            padding: '5px 10px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.28)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {t('petCinema.viewMovieInfo', '영화 정보 보기')} <ExternalLink size={11} />
        </div>
      </div>
    </motion.a>
  );
}
