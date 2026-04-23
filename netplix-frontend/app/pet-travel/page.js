'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PawPrint,
  Sun,
  Cloud,
  Leaf,
  MapPin,
  Heart,
  Wind,
  Sparkles,
} from 'lucide-react';
import PetFriendlySpotsStrip from '@/components/PetFriendlySpotsStrip';
import NearbyCineTripStrip from '@/components/NearbyCineTripStrip';
import NearbyTrekkingStrip from '@/components/NearbyTrekkingStrip';
import PetCinemaCurationStrip from '@/components/PetCinemaCurationStrip';
import useDragScrollAll from '@/lib/useDragScroll';

/**
 * 반려동물 동반여행 전용 랜딩 페이지 (Sunshine / Teal 테마).
 *
 * - 영화/DVD 탭(다크 시네마틱)과 대비되는 밝고 싱그러운 야외 분위기.
 * - 한국관광공사 KorPetTourService 데이터를 지역별로 탐색 (PetFriendlySpotsStrip 재사용).
 * - 햇살 · 구름 · 발자국 · 잎사귀 · 빛 입자 등 모션 요소로 "밖으로 나가고 싶은" 무드.
 */
const AREA_CODES = [
  { code: null, label: '전국', hint: '주요 지역 요약' },
  { code: '1', label: '서울' },
  { code: '6', label: '부산' },
  { code: '31', label: '경기' },
  { code: '39', label: '제주' },
  { code: '32', label: '강원' },
  { code: '35', label: '경북' },
  { code: '36', label: '경남' },
  { code: '37', label: '전북' },
  { code: '38', label: '전남' },
  { code: '2', label: '인천' },
  { code: '3', label: '대전' },
  { code: '4', label: '대구' },
  { code: '5', label: '광주' },
  { code: '7', label: '울산' },
  { code: '8', label: '세종' },
  { code: '33', label: '충북' },
  { code: '34', label: '충남' },
];

const NATIONAL_FEATURED = ['1', '6', '31', '39', '32', '35'];
const AREA_LABEL = Object.fromEntries(AREA_CODES.map((a) => [a.code, a.label]));

/** 햇살 방사형 광선 한 줄. */
function SunRay({ rotation = 0, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0.25, scaleY: 0.8 }}
      animate={{ opacity: [0.2, 0.55, 0.2], scaleY: [0.8, 1.05, 0.8] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: 4,
        height: 320,
        transform: `translateX(-50%) rotate(${rotation}deg)`,
        transformOrigin: 'top center',
        background:
          'linear-gradient(to bottom, rgba(253, 224, 71, 0.55), rgba(253, 224, 71, 0.15) 50%, transparent 100%)',
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    />
  );
}

/** 화면을 가로지르며 떠다니는 플로팅 요소. */
function FloatingItem({
  children,
  delay = 0,
  duration = 26,
  startLeft = 0,
  topPct = 20,
  drift = 40,
}) {
  return (
    <motion.div
      initial={{ x: -120, opacity: 0 }}
      animate={{
        x: ['-10vw', '110vw'],
        y: [0, -drift, 0, drift, 0],
        opacity: [0, 1, 1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        position: 'absolute',
        top: `${topPct}%`,
        left: `${startLeft}%`,
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}

export default function PetTravelPage() {
  const [selected, setSelected] = useState(null); // null = 전국
  const pageRef = useRef(null);
  useDragScrollAll(pageRef);

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selected]);

  // 배경 빛 입자 (SSR/클라이언트 불일치 방지를 위해 마운트 후 생성)
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    setParticles(
      [...Array(28)].map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 3 + 1.5,
        duration: Math.random() * 3 + 3,
        delay: Math.random() * 3,
      }))
    );
  }, []);

  const floatingClouds = useMemo(
    () => [
      { delay: 0, duration: 42, topPct: 8, startLeft: -10, drift: 20 },
      { delay: 6, duration: 55, topPct: 16, startLeft: -30, drift: 30 },
      { delay: 14, duration: 48, topPct: 28, startLeft: -20, drift: 24 },
      { delay: 22, duration: 60, topPct: 40, startLeft: -15, drift: 36 },
    ],
    []
  );

  return (
    <div
      ref={pageRef}
      className="pet-travel-page"
      style={{
        minHeight: '100vh',
        color: '#0f172a',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #7dd3fc 0%, #5eead4 45%, #99f6e4 75%, #ecfeff 100%)',
      }}
    >
      <style>{`
        @keyframes pt-gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pt-sun-glow {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes pt-paw-trail {
          0%, 100% { opacity: 0.25; transform: translateY(0) rotate(-12deg); }
          50% { opacity: 0.6; transform: translateY(-4px) rotate(-12deg); }
        }
        .pt-hero-title {
          background: linear-gradient(135deg, #065f46 0%, #0e7490 45%, #1e40af 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .pt-tab-btn {
          transition: transform 0.18s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .pt-tab-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(13, 148, 136, 0.18);
        }
        .pt-card {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .pt-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 50px rgba(2, 132, 199, 0.18);
        }
        @media (max-width: 640px) {
          .pt-hero-title-text { font-size: 32px !important; line-height: 1.15 !important; }
          .pt-hero-subtitle { font-size: 14px !important; }
          .pt-sun-wrap { right: 8px !important; top: 8px !important; width: 140px !important; height: 140px !important; }
          .pt-feature-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* 움직이는 오렌지/옐로 선샤인 오버레이 */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(1200px 600px at 85% 0%, rgba(253, 224, 71, 0.55) 0%, rgba(253, 224, 71, 0) 60%), radial-gradient(800px 500px at 10% 20%, rgba(186, 230, 253, 0.7) 0%, rgba(186, 230, 253, 0) 55%)',
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 햇살 + 광선 */}
      <div
        className="pt-sun-wrap"
        aria-hidden
        style={{
          position: 'absolute',
          top: 24,
          right: 40,
          width: 220,
          height: 220,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(253, 224, 71, 0.95) 0%, rgba(253, 224, 71, 0.55) 45%, rgba(253, 224, 71, 0) 75%)',
            filter: 'blur(6px)',
            animation: 'pt-sun-glow 5s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: '18%',
            width: '64%',
            height: '64%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 35%, #fef9c3 0%, #fde047 55%, #fbbf24 100%)',
            boxShadow:
              '0 0 60px 10px rgba(253, 224, 71, 0.6), 0 0 120px 30px rgba(251, 191, 36, 0.35)',
          }}
        />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((rot, i) => (
          <SunRay key={rot} rotation={rot} delay={i * 0.18} />
        ))}
      </div>

      {/* 구름들 */}
      {floatingClouds.map((c, i) => (
        <FloatingItem key={`cloud-${i}`} {...c}>
          <Cloud
            size={i === 1 ? 120 : i === 3 ? 96 : 80}
            color="#ffffff"
            strokeWidth={1.2}
            style={{
              fill: 'rgba(255,255,255,0.75)',
              filter: 'drop-shadow(0 10px 20px rgba(14, 116, 144, 0.15))',
            }}
          />
        </FloatingItem>
      ))}

      {/* 잎사귀 */}
      <FloatingItem delay={3} duration={30} topPct={58} startLeft={-10} drift={30}>
        <Leaf size={30} color="#065f46" style={{ fill: 'rgba(16,185,129,0.55)' }} />
      </FloatingItem>
      <FloatingItem delay={10} duration={34} topPct={72} startLeft={-5} drift={22}>
        <Leaf size={22} color="#0f766e" style={{ fill: 'rgba(20,184,166,0.55)' }} />
      </FloatingItem>
      <FloatingItem delay={18} duration={38} topPct={50} startLeft={-15} drift={28}>
        <Leaf size={26} color="#047857" style={{ fill: 'rgba(16,185,129,0.45)' }} />
      </FloatingItem>

      {/* 발자국 */}
      <FloatingItem delay={5} duration={28} topPct={82} startLeft={-8} drift={12}>
        <PawPrint size={28} color="#0e7490" style={{ fill: 'rgba(14,165,233,0.35)' }} />
      </FloatingItem>
      <FloatingItem delay={12} duration={32} topPct={64} startLeft={-18} drift={18}>
        <PawPrint size={22} color="#0891b2" style={{ fill: 'rgba(45,212,191,0.35)' }} />
      </FloatingItem>

      {/* 빛 입자 */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          aria-hidden
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.9)',
            boxShadow: '0 0 8px 2px rgba(255, 255, 255, 0.7)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1, 0.6] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* 히어로 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '84px 20px 48px',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(13, 148, 136, 0.25)',
              fontSize: 12,
              fontWeight: 700,
              color: '#0f766e',
              marginBottom: 18,
              backdropFilter: 'blur(6px)',
              boxShadow: '0 6px 16px rgba(13, 148, 136, 0.12)',
            }}
          >
            <Sun size={14} style={{ color: '#f59e0b' }} />
            한국관광공사 · 반려동물 동반여행
          </div>

          <h1
            className="pt-hero-title-text"
            style={{
              fontSize: 52,
              fontWeight: 900,
              margin: '0 0 14px',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-flex' }}
            >
              <PawPrint size={44} color="#0f766e" style={{ fill: 'rgba(20,184,166,0.45)' }} />
            </motion.span>
            <span className="pt-hero-title">햇살 가득, 함께 떠나요</span>
          </h1>

          <p
            className="pt-hero-subtitle"
            style={{
              margin: '0 auto 6px',
              fontSize: 17,
              color: '#0f172a',
              maxWidth: 620,
              fontWeight: 600,
            }}
          >
            방 안에만 머물렀다면, 이제는 네 발로 봄바람을 느낄 차례.
          </p>
          <p
            className="pt-hero-subtitle"
            style={{
              margin: '0 auto',
              fontSize: 14,
              color: '#0369a1',
              maxWidth: 600,
            }}
          >
            지역별 반려동물 동반 가능한 관광지·숙소·음식점을 한눈에 확인하세요.
          </p>

          {/* 3개 특징 카드 */}
          <div
            className="pt-feature-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
              maxWidth: 880,
              margin: '28px auto 0',
              padding: '0 8px',
            }}
          >
            {[
              {
                icon: MapPin,
                title: '반려동물 동반 가능',
                desc: '공원·해변·산책로 명소',
                accent: '#0d9488',
              },
              {
                icon: Heart,
                title: '안전한 여행 팁',
                desc: '이동·숙박 시 유의 사항',
                accent: '#0284c7',
              },
              {
                icon: Sun,
                title: '야외 액티비티',
                desc: '햇살 아래 자연 탐험',
                accent: '#f59e0b',
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                whileHover={{ y: -4 }}
                className="pt-card"
                style={{
                  background: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(15, 118, 110, 0.18)',
                  borderRadius: 18,
                  padding: '16px 14px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(14, 116, 144, 0.1)',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    padding: 10,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${f.accent}33, ${f.accent}11)`,
                    marginBottom: 8,
                  }}
                >
                  <f.icon size={22} color={f.accent} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: 2,
                  }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 500 }}>
                  {f.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 부드러운 웨이브 디바이더 */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          zIndex: 2,
          height: 70,
          marginTop: -24,
          pointerEvents: 'none',
        }}
      >
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
          <defs>
            <linearGradient id="pt-wave-g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <motion.path
            initial={{ d: 'M0,64 C360,100 720,20 1440,64 L1440,120 L0,120 Z' }}
            animate={{
              d: [
                'M0,64 C360,100 720,20 1440,64 L1440,120 L0,120 Z',
                'M0,80 C360,40 720,80 1440,50 L1440,120 L0,120 Z',
                'M0,64 C360,100 720,20 1440,64 L1440,120 L0,120 Z',
              ],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            fill="url(#pt-wave-g)"
          />
        </svg>
      </div>

      {/* 지역 탭 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background:
            'linear-gradient(180deg, rgba(224, 242, 254, 0.92) 0%, rgba(236, 254, 255, 0.92) 100%)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(13, 148, 136, 0.18)',
          padding: '14px 20px',
          boxShadow: '0 4px 12px rgba(14, 116, 144, 0.08)',
        }}
      >
        <div
          className="js-drag-scroll"
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 2,
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {AREA_CODES.map((a) => {
            const active =
              (a.code == null && selected == null) || a.code === selected;
            return (
              <button
                key={a.label}
                type="button"
                className="pt-tab-btn"
                onClick={() => setSelected(a.code)}
                style={{
                  flex: '0 0 auto',
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: active
                    ? '1px solid #0d9488'
                    : '1px solid rgba(15, 118, 110, 0.25)',
                  background: active
                    ? 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)'
                    : 'rgba(255,255,255,0.82)',
                  color: active ? '#ffffff' : '#0f766e',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: active
                    ? '0 8px 20px rgba(13, 148, 136, 0.35)'
                    : '0 2px 6px rgba(13, 148, 136, 0.08)',
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 본문 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 1200,
          margin: '0 auto',
          padding: '28px 20px 60px',
        }}
      >
        {/* 산뜻한 안내 배너 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 16,
            marginBottom: 24,
            background:
              'linear-gradient(135deg, rgba(236, 254, 255, 0.95) 0%, rgba(219, 234, 254, 0.95) 100%)',
            border: '1px solid rgba(13, 148, 136, 0.18)',
            boxShadow: '0 8px 22px rgba(14, 116, 144, 0.08)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(251, 191, 36, 0.35)',
            }}
          >
            <Wind size={20} color="#92400e" />
          </div>
          <div style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.55 }}>
            <strong style={{ color: '#0f766e' }}>신선한 바람 한 모금, 준비되셨나요?</strong>
            <br />
            지역 탭을 눌러 오늘 떠날 장소를 골라보세요. 모든 정보는 한국관광공사에서 제공합니다.
          </div>
          <Sparkles
            size={18}
            color="#0284c7"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          />
        </motion.div>

        {/* 옵션 2: Pet-Cinema 큐레이션 — 반려와 함께 보기 좋은 영화 */}
        <PetCinemaCurationStrip />

        {selected == null ? (
          NATIONAL_FEATURED.map((code, idx) => (
            <motion.section
              key={code}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: idx * 0.06 }}
              style={{
                marginBottom: 28,
                padding: 18,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.82)',
                border: '1px solid rgba(13, 148, 136, 0.14)',
                boxShadow:
                  '0 12px 32px rgba(14, 116, 144, 0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <PetFriendlySpotsStrip
                areaCode={code}
                regionLabel={AREA_LABEL[code]}
              />

              <div style={{ height: 14 }} />
              {/* 옵션 1: 이 동네 배경 영화 */}
              <NearbyCineTripStrip
                areaCode={code}
                theme="light"
                badgeLabel="PetCinema"
                title={`${AREA_LABEL[code]} 배경, 반려와 돌아와 보면 좋은 영화`}
                limit={8}
              />

              <div style={{ height: 14 }} />
              {/* 옵션 3: 반려와 산책 삼아 걷기 좋은 코스 */}
              <NearbyTrekkingStrip
                areaCode={code}
                regionName={AREA_LABEL[code]}
                theme="light"
                badgeLabel="PetWalk"
                title="반려와 산책 삼아 걷기 좋은 코스"
                subtitle={`${AREA_LABEL[code]} 인근 두루누비 코스`}
                limit={6}
              />
            </motion.section>
          ))
        ) : (
          <motion.section
            key={selected}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              padding: 18,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(13, 148, 136, 0.14)',
              boxShadow:
                '0 12px 32px rgba(14, 116, 144, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <PetFriendlySpotsStrip
              areaCode={selected}
              regionLabel={AREA_LABEL[selected]}
            />

            <div style={{ height: 14 }} />
            <NearbyCineTripStrip
              areaCode={selected}
              theme="light"
              badgeLabel="PetCinema"
              title={`${AREA_LABEL[selected]} 배경, 반려와 돌아와 보면 좋은 영화`}
              limit={8}
            />

            <div style={{ height: 14 }} />
            <NearbyTrekkingStrip
              areaCode={selected}
              regionName={AREA_LABEL[selected]}
              theme="light"
              badgeLabel="PetWalk"
              title="반려와 산책 삼아 걷기 좋은 코스"
              subtitle={`${AREA_LABEL[selected]} 인근 두루누비 코스`}
              limit={6}
            />
          </motion.section>
        )}

        <p
          style={{
            marginTop: 34,
            fontSize: 11,
            color: '#0f766e',
            textAlign: 'center',
            opacity: 0.85,
          }}
        >
          © 한국관광공사 반려동물 동반여행 정보 (KorPetTourService)
        </p>
      </div>
    </div>
  );
}
