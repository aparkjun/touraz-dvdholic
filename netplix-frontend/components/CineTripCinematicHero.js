'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Play, MapPin } from 'lucide-react';

/**
 * CineTripCinematicHero
 * ---------------------
 * "영화·DVD의 추억 + 지금 당장 그곳으로 떠나고 싶은 여행 욕구"를 동시에 전달하는
 * 시네마틱 히어로 섹션 (Magic MCP: Cinematic Hero 기반).
 *
 * 구성 요소:
 *  - Film grain overlay (SVG noise)
 *  - Scan lines (횡선 반복)
 *  - 35mm Film perforations (좌/우 세로 구멍)
 *  - Marquee bulbs (극장 간판 전구, 박동)
 *  - Spotlight beam (화면을 천천히 가로지르는 따뜻한 빛)
 *  - Rotating film reel (우측 상단 회전 릴)
 *  - Typewriter title ("CINETRIP")
 *  - Champagne gold 타이틀 + red-carpet crimson 악센트
 *  - 필름 스트립 무한 스크롤러 (포스터 프레임)
 *
 * props:
 *   posters: string[]   — 아래 필름 스트립 스크롤러에 사용할 이미지 URL 배열 (없으면 섹션 자체 미노출)
 *   tagline: string     — 영어 한 줄 인용구
 *   korean:  string     — 한국어 보조 카피
 *   ctas:    [{label, onClick, Icon, primary?}] — 옵션 버튼
 */
const BULB_COUNT = 14;

function FilmGrainOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 4,
        opacity: 0.08,
        mixBlendMode: 'overlay',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

function Scanlines() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
        opacity: 0.08,
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }}
    />
  );
}

function FilmPerforations({ side = 'left' }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 32,
        left: side === 'left' ? 0 : 'auto',
        right: side === 'right' ? 0 : 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-around',
        padding: '16px 0',
        zIndex: 5,
        pointerEvents: 'none',
        background:
          side === 'left'
            ? 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, transparent 100%)'
            : 'linear-gradient(270deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
      }}
    >
      {Array.from({ length: 22 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 14,
            height: 10,
            margin: '0 auto',
            background: '#0a0a16',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            borderRadius: 2,
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.7)',
          }}
        />
      ))}
    </div>
  );
}

function MarqueeBulb({ delay = 0 }) {
  return (
    <motion.span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: '#fde68a',
        boxShadow: '0 0 8px #fbbf24, 0 0 18px #f59e0b',
      }}
      animate={{ opacity: [0.35, 1, 0.35], scale: [0.9, 1.15, 0.9] }}
      transition={{ duration: 1.5, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

function SpotlightBeam() {
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 220,
        zIndex: 2,
        pointerEvents: 'none',
        background:
          'linear-gradient(90deg, transparent 0%, rgba(253, 224, 71, 0.22) 50%, transparent 100%)',
        filter: 'blur(22px)',
        mixBlendMode: 'screen',
      }}
      initial={{ left: '-25%' }}
      animate={{ left: ['-25%', '110%'] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
    />
  );
}

function RotatingReel({ size = 64, top = 20, right = 28 }) {
  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        top,
        right,
        width: size,
        height: size,
        zIndex: 6,
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          border: '3px solid rgba(212, 175, 55, 0.55)',
          boxShadow:
            '0 0 18px rgba(212, 175, 55, 0.35), inset 0 0 10px rgba(212, 175, 55, 0.25)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 8,
            borderRadius: '50%',
            border: '2px solid rgba(212, 175, 55, 0.3)',
          }}
        />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 2,
              height: size / 2.5,
              background: 'rgba(212, 175, 55, 0.55)',
              transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
              transformOrigin: 'center',
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            inset: size / 5,
            borderRadius: '50%',
            background: '#0a0a16',
            border: '1px solid rgba(212, 175, 55, 0.7)',
          }}
        />
      </div>
    </motion.div>
  );
}

function TypewriterText({ text, startDelayMs = 400, speedMs = 110 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = setTimeout(() => {
      const id = setInterval(() => {
        setN((prev) => {
          if (prev >= text.length) {
            clearInterval(id);
            return prev;
          }
          return prev + 1;
        });
      }, speedMs);
      return () => clearInterval(id);
    }, startDelayMs);
    return () => clearTimeout(start);
  }, [text, startDelayMs, speedMs]);
  return (
    <>
      {text.slice(0, n)}
      <motion.span
        aria-hidden
        style={{
          display: 'inline-block',
          width: '0.06em',
          height: '0.95em',
          marginLeft: 4,
          background: 'linear-gradient(180deg, #f5f5dc, #d4af37)',
          verticalAlign: 'middle',
        }}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.9, repeat: Infinity }}
      />
    </>
  );
}

function FilmStripFrame({ image, index }) {
  return (
    <motion.div
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 168,
        height: 252,
        background: '#0a0a16',
        border: '2px solid rgba(212, 175, 55, 0.28)',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow:
          '0 4px 20px rgba(0,0,0,0.8), inset 0 1px 2px rgba(212, 175, 55, 0.1)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.8) }}
    >
      {/* 상단 천공 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 14,
          background: '#1a1a28',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 4px',
          zIndex: 2,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            style={{ width: 6, height: 6, background: 'rgba(212, 175, 55, 0.22)', borderRadius: '50%' }}
          />
        ))}
      </div>
      {/* 하단 천공 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 14,
          background: '#1a1a28',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '0 4px',
          zIndex: 2,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            style={{ width: 6, height: 6, background: 'rgba(212, 175, 55, 0.22)', borderRadius: '50%' }}
          />
        ))}
      </div>
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.src = '/no-poster-placeholder.png';
        }}
        style={{
          position: 'absolute',
          top: 14,
          bottom: 14,
          left: 0,
          right: 0,
          width: '100%',
          height: 'calc(100% - 28px)',
          objectFit: 'cover',
          opacity: 0.9,
          filter: 'sepia(0.15) contrast(1.08) saturate(1.05)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(10,10,22,0.0) 35%, rgba(10,10,22,0.45) 100%)',
          zIndex: 1,
        }}
      />
    </motion.div>
  );
}

export default function CineTripCinematicHero({
  posters = [],
  tagline = 'Your favorite scene is a real place.',
  korean = '좋아하는 그 장면이, 실제로 존재하는 장소입니다.',
  topLabel = 'Cinematic Journeys · 영화로 떠나는 여행',
  ctas = [],
}) {
  // 스트립에 쓸 포스터. 부족하면 반복해서 채움.
  const stripImages = useMemo(() => {
    const clean = (posters || []).filter(Boolean);
    if (clean.length === 0) return [];
    const minCount = 12;
    const result = [...clean];
    while (result.length < minCount) result.push(...clean);
    return [...result, ...result]; // 무한 스크롤을 위해 2배 복제
  }, [posters]);

  return (
    <section
      style={{
        position: 'relative',
        minHeight: 620,
        background:
          'radial-gradient(1200px 600px at 80% 0%, rgba(196, 30, 58, 0.18) 0%, transparent 55%),' +
          'radial-gradient(900px 500px at 10% 100%, rgba(212, 175, 55, 0.12) 0%, transparent 60%),' +
          'linear-gradient(180deg, #080814 0%, #0a0a1a 45%, #05050e 100%)',
        overflow: 'hidden',
        color: '#f5f5dc',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", sans-serif',
      }}
    >
      <Scanlines />
      <FilmGrainOverlay />
      <SpotlightBeam />
      <RotatingReel />
      <FilmPerforations side="left" />
      <FilmPerforations side="right" />

      {/* 상단 페이드 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 80,
          background: 'linear-gradient(180deg, #05050e 0%, transparent 100%)',
          zIndex: 7,
          pointerEvents: 'none',
        }}
      />

      {/* 본문 */}
      <div
        style={{
          position: 'relative',
          zIndex: 8,
          padding: '88px 48px 40px',
          textAlign: 'center',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* 타이틀 상단 라벨 */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Film size={18} style={{ color: '#d4af37' }} />
          <span
            style={{
              color: '#d4af37',
              fontSize: 11,
              letterSpacing: '0.34em',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}
          >
            {topLabel}
          </span>
          <Film size={18} style={{ color: '#d4af37', transform: 'scaleX(-1)' }} />
        </motion.div>

        {/* 마키 + 타이틀 */}
        <div style={{ position: 'relative', marginBottom: 22 }}>
          {/* 마키 전구 링 */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(92%, 720px)',
              height: 'calc(100% + 28px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 18px',
              }}
            >
              {Array.from({ length: BULB_COUNT }).map((_, i) => (
                <MarqueeBulb key={`t-${i}`} delay={i * 0.12} />
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '0 18px',
              }}
            >
              {Array.from({ length: BULB_COUNT }).map((_, i) => (
                <MarqueeBulb key={`b-${i}`} delay={i * 0.12 + 0.25} />
              ))}
            </div>
          </div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 0.4 }}
            style={{
              position: 'relative',
              margin: 0,
              fontSize: 'clamp(44px, 8vw, 92px)',
              fontWeight: 900,
              letterSpacing: '0.02em',
              lineHeight: 1,
              background: 'linear-gradient(180deg, #fef3c7 0%, #d4af37 50%, #7c5f2a 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              textShadow: '0 0 40px rgba(212, 175, 55, 0.25)',
            }}
          >
            <TypewriterText text="CINETRIP" startDelayMs={500} speedMs={120} />
          </motion.h1>
        </div>

        {/* 태그라인 (영문 + 한글) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
          style={{
            position: 'relative',
            maxWidth: 680,
            margin: '0 auto 24px',
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: -4,
              top: -18,
              fontSize: 64,
              color: 'rgba(196, 30, 58, 0.28)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              lineHeight: 1,
            }}
          >
            “
          </span>
          <p
            style={{
              fontSize: 22,
              fontWeight: 300,
              color: 'rgba(245, 245, 220, 0.92)',
              margin: '0 0 6px',
              letterSpacing: '0.01em',
            }}
          >
            {tagline}
          </p>
          {korean && (
            <p
              style={{
                fontSize: 14.5,
                color: 'rgba(245, 245, 220, 0.62)',
                margin: 0,
                letterSpacing: '-0.005em',
              }}
            >
              {korean}
            </p>
          )}
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: -4,
              bottom: -38,
              fontSize: 64,
              color: 'rgba(196, 30, 58, 0.28)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              lineHeight: 1,
            }}
          >
            ”
          </span>
        </motion.div>

        {/* CTA 버튼 */}
        {ctas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 2 }}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 12,
              marginTop: 12,
            }}
          >
            {ctas.map((c, idx) => {
              const Icon = c.Icon || (c.primary ? Play : MapPin);
              const isPrimary = !!c.primary;
              return (
                <button
                  key={c.label || idx}
                  type="button"
                  onClick={c.onClick}
                  style={{
                    position: 'relative',
                    padding: '12px 22px',
                    borderRadius: 2,
                    border: isPrimary
                      ? '1px solid #c41e3a'
                      : '2px solid #d4af37',
                    background: isPrimary
                      ? 'linear-gradient(135deg, #c41e3a 0%, #9b162d 100%)'
                      : 'transparent',
                    color: isPrimary ? '#fef3c7' : '#d4af37',
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: isPrimary
                      ? '0 10px 30px -10px rgba(196, 30, 58, 0.6)'
                      : '0 8px 24px -12px rgba(212, 175, 55, 0.45)',
                    transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                    if (!isPrimary) {
                      e.currentTarget.style.background = '#d4af37';
                      e.currentTarget.style.color = '#0a0a16';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    if (!isPrimary) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#d4af37';
                    }
                  }}
                >
                  <Icon size={16} />
                  {c.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* 필름 스트립 무한 스크롤러 */}
      {stripImages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.6 }}
          style={{
            position: 'relative',
            marginTop: 8,
            height: 280,
            zIndex: 8,
            overflow: 'hidden',
          }}
        >
          {/* 상단 슬래셔 필름 라인 */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 6,
              left: 0,
              right: 0,
              height: 10,
              background:
                'repeating-linear-gradient(90deg, rgba(212,175,55,0.22) 0 12px, transparent 12px 26px)',
              zIndex: 2,
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              bottom: 6,
              left: 0,
              right: 0,
              height: 10,
              background:
                'repeating-linear-gradient(90deg, rgba(212,175,55,0.22) 0 12px, transparent 12px 26px)',
              zIndex: 2,
            }}
          />
          {/* 좌/우 페이드 */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, #0a0a1a 0%, transparent 10%, transparent 90%, #0a0a1a 100%)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          />
          <motion.div
            style={{
              display: 'flex',
              gap: 14,
              height: '100%',
              alignItems: 'center',
              paddingLeft: 30,
            }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{
              duration: 55,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {stripImages.map((src, i) => (
              <FilmStripFrame key={i} image={src} index={i} />
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* 하단 페이드 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 90,
          background:
            'linear-gradient(180deg, transparent 0%, #0a0a0a 100%)',
          zIndex: 9,
          pointerEvents: 'none',
        }}
      />
    </section>
  );
}
