'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, PawPrint, Plane, PlaneTakeoff } from 'lucide-react';
import Link from 'next/link';
import axios from '@/lib/axiosConfig';
import TravelPortalButton from '@/components/TravelPortalButton';

const RANK_COLORS = [
  'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
  'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
];

const fallbackRank = (i) => RANK_COLORS[i] || 'rgba(255, 255, 255, 0.1)';

const PERIODS = [
  { key: 'today', label: '오늘',   title: '오늘 뜨는 지역',   subtitle: '관광공사 검색량 급등 기준' },
  { key: 'week',  label: '이번주', title: '이번주 뜨는 지역', subtitle: '관광수요·경쟁력 가중 지수' },
  { key: 'month', label: '이번달', title: '이번달 뜨는 지역', subtitle: '문화·관광자원 종합 점수' },
];

export default function TrendingRegionsWidget({ limit = 5, defaultPeriod = 'today' }) {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxVolume, setMaxVolume] = useState(0);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(defaultPeriod);

  const currentPeriodMeta = PERIODS.find((p) => p.key === period) || PERIODS[0];

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `/api/v1/tour/trending-regions?limit=${limit}&period=${period}`
        );
        const data = res?.data?.data ?? [];
        if (!alive) return;
        const rows = Array.isArray(data) ? data : [];
        setRegions(rows);
        setMaxVolume(
          rows.length ? Math.max(...rows.map((r) => Number(r.searchVolume) || 0), 0) : 0
        );
      } catch (e) {
        console.error('[trending-regions] fetch failed:', e?.message || e);
        if (alive) setError('데이터를 불러올 수 없어요');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit, period]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        background: 'linear-gradient(145deg, #141418 0%, #0f0f12 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 16,
        padding: 22,
        color: '#fff',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Sparkles size={20} style={{ color: '#fbbf24' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{currentPeriodMeta.title}</h2>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          {currentPeriodMeta.subtitle}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="트렌딩 지역 기간 선택"
        style={{
          display: 'inline-flex',
          padding: 3,
          marginBottom: 16,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          gap: 2,
        }}
      >
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(p.key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: active
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)'
                  : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                boxShadow: active ? '0 2px 8px rgba(139, 92, 246, 0.35)' : 'none',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 56,
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 10,
                animation: 'trending-pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
          <style>{`
            @keyframes trending-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : regions.length === 0 ? (
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 13,
          }}
        >
          아직 집계된 지역이 없어요
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {regions.map((r, i) => {
            const volume = Number(r.searchVolume) || 0;
            const hasVolume = r.searchVolume !== null && r.searchVolume !== undefined;
            const percentage = maxVolume > 0 && hasVolume
              ? (volume / maxVolume) * 100
              : Math.max(20, 100 - i * 18);
            return (
              <motion.div key={`${r.areaCode}-${i}`} variants={itemVariants}>
                <Link
                  href={`/cine-trip${r.areaCode ? `?area=${r.areaCode}` : ''}`}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      padding: 14,
                      transition: 'all 0.25s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: fallbackRank(i),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {r.regionName || r.areaCode}
                        </div>
                      </div>
                      {hasVolume && (
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#fbbf24',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <TrendingUp size={12} />
                          {volume.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 4,
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
                        style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        <TravelPortalButton
          href="/cine-trip"
          tag="CineTrip · Boarding Pass"
          title="영화로 떠나는 여행"
          desc="촬영지·배경·OST가 살아있는 큐레이션 카드로 체크인하세요."
          cta="CineTrip 전체 카드 보기"
          Icon={PlaneTakeoff}
          theme="cinema"
          fullWidth
        />
        <TravelPortalButton
          href="/pet-travel"
          tag="Pet Travel · Fresh Air"
          title="반려동물과 함께 떠나요"
          desc="햇살 가득, 네 발로 봄바람. 동반 가능 장소를 지도처럼 펼쳐요."
          cta="반려동물 여행 전체 보기"
          Icon={PawPrint}
          theme="outdoor"
          fullWidth
        />
      </div>
    </div>
  );
}
