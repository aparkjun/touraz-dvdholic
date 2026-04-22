'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PawPrint, Sparkles } from 'lucide-react';
import PetFriendlySpotsStrip from '@/components/PetFriendlySpotsStrip';
import useDragScrollAll from '@/lib/useDragScroll';

/**
 * 반려동물 동반여행 전용 랜딩 페이지.
 *
 * - 한국관광공사 KorPetTourService 데이터를 지역별로 탐색.
 * - 각 지역 섹션은 {@link PetFriendlySpotsStrip} 재사용 (관광지/문화시설/레포츠/숙박/쇼핑/음식점 6 버킷).
 * - 탭으로 지역을 전환(전체 스크롤 vs 단일 지역) 할 수 있도록 설계.
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

// "전국" 탭에서 노출할 대표 지역 묶음.
const NATIONAL_FEATURED = ['1', '6', '31', '39', '32', '35'];
const AREA_LABEL = Object.fromEntries(AREA_CODES.map((a) => [a.code, a.label]));

export default function PetTravelPage() {
  const [selected, setSelected] = useState(null); // null = 전국
  const pageRef = useRef(null);
  useDragScrollAll(pageRef);

  useEffect(() => {
    // 탭 전환 시 상단으로.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selected]);

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

      {/* 히어로 */}
      <div
        style={{
          background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a1f 50%, #0a0a0a 100%)',
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
              'radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 14,
              background: 'rgba(244,114,182,0.15)',
              border: '1px solid rgba(244,114,182,0.35)',
              fontSize: 12,
              fontWeight: 700,
              color: '#fbcfe8',
              marginBottom: 14,
            }}
          >
            <Sparkles size={13} /> 한국관광공사 반려동물 동반여행 정보
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 900,
              margin: '0 0 10px',
              background:
                'linear-gradient(135deg, #ffffff 0%, #f9a8d4 55%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <PawPrint size={36} style={{ color: '#f472b6' }} />
            반려동물과 함께 떠나는 한국 여행
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#cbd5e1' }}>
            지역·카테고리별로 반려동물 동반 가능한 관광지, 숙소, 음식점 등을 찾아보세요.
          </p>
        </motion.div>
      </div>

      {/* 지역 탭 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(10,10,10,0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 20px',
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
                onClick={() => setSelected(a.code)}
                style={{
                  flex: '0 0 auto',
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: active
                    ? '1px solid #f472b6'
                    : '1px solid rgba(255,255,255,0.1)',
                  background: active
                    ? 'linear-gradient(135deg, rgba(244,114,182,0.25), rgba(168,85,247,0.25))'
                    : 'rgba(255,255,255,0.04)',
                  color: active ? '#fff' : '#cbd5e1',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
        {selected == null ? (
          // 전국 → 대표 지역들을 세로로 나열
          NATIONAL_FEATURED.map((code) => (
            <section
              key={code}
              style={{
                marginBottom: 36,
                padding: 16,
                borderRadius: 16,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <PetFriendlySpotsStrip
                areaCode={code}
                regionLabel={AREA_LABEL[code]}
              />
            </section>
          ))
        ) : (
          <section
            style={{
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <PetFriendlySpotsStrip
              areaCode={selected}
              regionLabel={AREA_LABEL[selected]}
            />
          </section>
        )}

        <p
          style={{
            marginTop: 30,
            fontSize: 11,
            color: '#555',
            textAlign: 'center',
          }}
        >
          © 한국관광공사 반려동물 동반여행 정보 (KorPetTourService)
        </p>
      </div>
    </div>
  );
}
