'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, PawPrint, Plane, PlaneTakeoff, Camera, Tent, Leaf, Stethoscope, Headphones, Radar, Compass } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';
import TravelPortalButton from '@/components/TravelPortalButton';
import TrekkingPortalButton from '@/components/TrekkingPortalButton';

const RANK_COLORS = [
  'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
  'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
];

const fallbackRank = (i) => RANK_COLORS[i] || 'rgba(255, 255, 255, 0.1)';

const PERIOD_KEYS = ['today', 'week', 'month'];

export default function TrendingRegionsWidget({ limit = 5, defaultPeriod = 'today' }) {
  const { t } = useTranslation();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [maxVolume, setMaxVolume] = useState(0);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(defaultPeriod);

  const PERIODS = useMemo(
    () =>
      PERIOD_KEYS.map((k) => ({
        key: k,
        label: t(`trendingRegions.${k}.label`, { defaultValue: k }),
        title: t(`trendingRegions.${k}.title`, { defaultValue: k }),
        subtitle: t(`trendingRegions.${k}.subtitle`, { defaultValue: '' }),
      })),
    [t]
  );

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
        if (alive) setError(t('trendingRegions.errorLoad', '데이터를 불러올 수 없어요'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [limit, period, t]);

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
        maxWidth: 720,
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
        aria-label={t('trendingRegions.tabsAriaLabel', '트렌딩 지역 기간 선택')}
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
          {t('trendingRegions.empty', '아직 집계된 지역이 없어요')}
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

      <div className="trw-cta-grid">
        <TravelPortalButton
          href="/cine-trip"
          tag={t('dashboardCta.cineTrip.tag', 'CineTrip · Boarding Pass')}
          title={t('dashboardCta.cineTrip.title', '영화로 떠나는 여행')}
          desc={t('dashboardCta.cineTrip.desc', '촬영지·배경·OST가 살아있는 큐레이션 카드로 체크인하세요.')}
          cta={t('dashboardCta.cineTrip.cta', 'CineTrip 전체 카드 보기')}
          Icon={PlaneTakeoff}
          theme="cinema"
          fullWidth
        />
        <TravelPortalButton
          href="/pet-travel"
          tag={t('dashboardCta.petTravel.tag', 'Pet Travel · Fresh Air')}
          title={t('dashboardCta.petTravel.title', '반려동물과 함께 떠나요')}
          desc={t('dashboardCta.petTravel.desc', '햇살 가득, 네 발로 봄바람. 동반 가능 장소를 지도처럼 펼쳐요.')}
          cta={t('dashboardCta.petTravel.cta', '반려동물 여행 전체 보기')}
          Icon={PawPrint}
          theme="outdoor"
          fullWidth
        />
        <TrekkingPortalButton
          href="/trekking"
          tag={t('dashboardCta.trekking.tag', 'Durunubi · Korea Trails')}
          title={t('dashboardCta.trekking.title', '코스로 떠나는 걷기여행')}
          desc={t('dashboardCta.trekking.desc', '코리아둘레길 284개 코스, 숲길·바닷길·마을길을 따라 산뜻하게 걸어봐요.')}
          cta={t('dashboardCta.trekking.cta', '걷기여행 코스 둘러보기')}
          fullWidth
        />
        <TravelPortalButton
          href="/photo-gallery"
          tag={t('dashboardCta.photoGallery.tag', 'Korea Photo Gallery')}
          title={t('dashboardCta.photoGallery.title', '관광사진 갤러리')}
          desc={t('dashboardCta.photoGallery.desc', '한국관광공사가 큐레이션한 전국 풍경 사진첩을 지역별로 둘러봐요.')}
          cta={t('dashboardCta.photoGallery.cta', '사진첩 열어보기')}
          Icon={Camera}
          theme="gallery"
          fullWidth
        />
        <TravelPortalButton
          href="/camping"
          tag={t('dashboardCta.camping.tag', 'GoCamping · Nature Stay')}
          title={t('dashboardCta.camping.title', '전국 야영장 찾기')}
          desc={t('dashboardCta.camping.desc', '영화 본 그날 밤, 숲속 야영장에서 별을 보며 하루 더. 내 주변 야영장도 한 번에.')}
          cta={t('dashboardCta.camping.cta', '야영장 전체 보기')}
          Icon={Tent}
          theme="camping"
          fullWidth
        />
        <TravelPortalButton
          href="/wellness"
          tag={t('dashboardCta.wellness.tag', 'Binge Recovery · Wellness')}
          title={t('dashboardCta.wellness.title', '정주행 번아웃 힐링 스팟')}
          desc={t('dashboardCta.wellness.desc', '드라마 몰아본 뒤 뻐근한 어깨와 지친 마음. 가까운 온천·스파·힐링숲에서 리셋해요.')}
          cta={t('dashboardCta.wellness.cta', '힐링 스팟 둘러보기')}
          Icon={Leaf}
          theme="wellness"
          fullWidth
        />
        <div className="trw-cta-span-full">
          <TravelPortalButton
            href="/medical-tourism"
            tag={t('dashboardCta.medicalTourism.tag', 'K-Medical Tourism · Global · EN / KO')}
            title={t('dashboardCta.medicalTourism.title', 'K-의료관광 · 외국인 환영')}
            desc={t('dashboardCta.medicalTourism.desc', '성형·한방·건강검진·재활·미용·척추·치과 — 해외 여행객을 위한 검증된 한국 의료 스팟을 ko/en 양 언어로 탐색하세요.')}
            cta={t('dashboardCta.medicalTourism.cta', '의료관광 스팟 둘러보기')}
            Icon={Stethoscope}
            theme="medical"
            fullWidth
          />
        </div>
        <div className="trw-cta-span-full">
          <TravelPortalButton
            href="/audio-guide"
            tag={t('dashboardCta.audioGuide.tag', 'Cine Audio Trail · Odii · 귀로 듣는 영화의 배경')}
            title={t('dashboardCta.audioGuide.title', '영화는 극장에서 · 이야기는 현지에서')}
            desc={t('dashboardCta.audioGuide.desc', '정주행 번아웃 뒤 눈 대신 귀로. 한국관광공사 오디오 가이드 팟캐스트로 만나는 4대 시그니처 코스 — 촬영지 · DVD 반납길 · 궁궐 · 사찰의 숨은 이야기를 이어폰으로.')}
            cta={t('dashboardCta.audioGuide.cta', '4대 코스 열어 보기')}
            Icon={Headphones}
            theme="audio"
            fullWidth
          />
        </div>
        <div className="trw-cta-span-full">
          <TravelPortalButton
            href="/crowd-radar"
            tag={t('dashboardCta.crowdRadar.tag', 'Quiet Set Radar · 향후 30일 혼잡도 예측')}
            title={t('dashboardCta.crowdRadar.title', '조용한 촬영지를 귀띔해 드려요')}
            desc={t('dashboardCta.crowdRadar.desc', '영화는 왁자지껄했지만, 촬영지는 한가할 때 가자. 한국관광공사 KT 빅데이터 기반 관광지 30일 집중률 예측으로 인파 없는 날 · 한산한 촬영지를 골라봐요.')}
            cta={t('dashboardCta.crowdRadar.cta', '한산한 촬영지 레이더 열기')}
            Icon={Radar}
            theme="radar"
            fullWidth
          />
        </div>
        <div className="trw-cta-span-full">
          <TravelPortalButton
            href="/related-spots"
            tag={t('dashboardCta.relatedSpots.tag', 'Korea Tour Big Data · 함께 다녀간 곳')}
            title={t('dashboardCta.relatedSpots.title', '조용한 명소 옆, 사람들은 어디로 갔을까')}
            desc={t('dashboardCta.relatedSpots.desc', '한 곳을 떠올려 보세요. 그 곁을 거닐던 사람들이 다음으로 향한 자리들을, 한국관광공사 TarRlteTarService1 데이터가 잔잔히 보여드릴게요.')}
            cta={t('dashboardCta.relatedSpots.cta', '잔잔히 둘러보기')}
            Icon={Compass}
            theme="related"
            fullWidth
          />
        </div>
      </div>
      <style jsx>{`
        .trw-cta-grid {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        .trw-cta-span-full {
          grid-column: 1 / -1;
        }
        @media (max-width: 640px) {
          .trw-cta-grid {
            grid-template-columns: 1fr;
          }
          .trw-cta-span-full { grid-column: auto; }
        }
      `}</style>
    </div>
  );
}
