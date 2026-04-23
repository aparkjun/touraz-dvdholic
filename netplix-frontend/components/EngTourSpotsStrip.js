'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  UtensilsCrossed,
  Hotel,
  ExternalLink,
  Navigation,
  X,
  Phone,
  Globe,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';

/**
 * 영어 모드 전용 "Travel Spots Around This Film" 스트립.
 *
 * <p>한국관광공사 영문 관광정보 서비스(EngService2) 기반.
 * 3 버킷 탭(Attractions / Restaurants / Accommodations) 으로, 사용자가 밝힌 키워드
 * "관광, 지역관광, 관광지, 한류산업, 미식산업, 웰니스치유, 숙박" 중 대표 카테고리만 선별 노출.
 *
 * <p>백엔드 엔드포인트: {@code GET /api/v1/tour/eng?areaCode=X&type=Y&limit=Z}
 * contentTypeId 는 KorService2 스키마 값을 그대로 넘기면 어댑터가 자동으로 EngService2 로 매핑.
 *
 * <p>fallback 정책: 영어 모드에서 0건일 경우 섹션 자체를 숨긴다(사용자 지정 'ㄴ' 정책).
 */
const BUCKETS = [
  { key: 'attractions', type: '12', icon: MapPin, color: '#10b981' },
  { key: 'restaurants', type: '39', icon: UtensilsCrossed, color: '#f97316' },
  { key: 'accommodations', type: '32', icon: Hotel, color: '#6366f1' },
];

export default function EngTourSpotsStrip({ areaCode, regionLabel = '' }) {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [buckets, setBuckets] = useState({});
  const [activeBucket, setActiveBucket] = useState('attractions');
  const [loading, setLoading] = useState(true);
  const [activePoi, setActivePoi] = useState(null);

  useEffect(() => {
    if (!isEn || !areaCode) {
      setBuckets({});
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // 3 버킷 동시 요청(병렬). EngService2 는 응답이 빠르고 캐시되어 있어 다중 호출 부담 낮음.
        const results = await Promise.all(
          BUCKETS.map((b) =>
            axios
              .get(`/api/v1/tour/eng?areaCode=${encodeURIComponent(areaCode)}&type=${b.type}&limit=8`)
              .then((res) => [b.key, Array.isArray(res?.data?.data) ? res.data.data : []])
              .catch(() => [b.key, []])
          )
        );
        if (!alive) return;
        const next = {};
        results.forEach(([k, list]) => {
          next[k] = list;
        });
        setBuckets(next);
      } catch (e) {
        console.error('[eng-tour-spots] fetch failed:', e?.message || e);
        if (alive) setBuckets({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isEn, areaCode]);

  // 활성 탭이 비어있으면 첫 번째로 채워진 탭으로 자동 전환 (hook 순서 규칙 준수를 위해 early return 전).
  useEffect(() => {
    if (loading) return;
    if ((buckets?.[activeBucket] || []).length > 0) return;
    const firstFilled = BUCKETS.find((b) => (buckets?.[b.key] || []).length > 0);
    if (firstFilled && firstFilled.key !== activeBucket) {
      setActiveBucket(firstFilled.key);
    }
  }, [loading, buckets, activeBucket]);

  const totalCount = useMemo(
    () => BUCKETS.reduce((acc, b) => acc + ((buckets?.[b.key] || []).length || 0), 0),
    [buckets]
  );

  if (!isEn) return null; // 이 컴포넌트는 영어 모드 전용.
  if (!loading && totalCount === 0) return null;

  const activeList = buckets?.[activeBucket] || [];

  return (
    <section style={{ marginTop: 16, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
            {t('cineTrip.engSpots.title', 'Travel Spots Around This Film')}
          </h3>
          {regionLabel && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {t('cineTrip.engSpots.subtitle', { region: regionLabel, defaultValue: `Handpicked places in ${regionLabel}` })}
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        {BUCKETS.map((b) => {
          const list = buckets?.[b.key] || [];
          const active = activeBucket === b.key;
          const Icon = b.icon;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => setActiveBucket(b.key)}
              disabled={!loading && list.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: active ? `1px solid ${b.color}` : '1px solid rgba(255,255,255,0.15)',
                background: active ? `${b.color}22` : 'rgba(255,255,255,0.04)',
                color: active ? b.color : list.length === 0 ? '#64748b' : '#cbd5e1',
                fontSize: 13,
                fontWeight: 600,
                cursor: list.length === 0 ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: list.length === 0 ? 0.5 : 1,
              }}
            >
              <Icon size={14} />
              {t(`cineTrip.engSpots.tab.${b.key}`, defaultLabel(b.key))}
              <span style={{ fontSize: 11, opacity: 0.7 }}>{list.length}</span>
            </button>
          );
        })}
      </div>

      {/* 카드 레일 */}
      {loading ? (
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 220,
                height: 160,
                flex: '0 0 auto',
                borderRadius: 12,
                background: 'linear-gradient(90deg, #1e293b, #334155, #1e293b)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.4s infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="js-drag-scroll"
          style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}
        >
          {activeList.map((poi) => (
            <motion.button
              key={poi.contentId}
              type="button"
              whileHover={{ y: -3 }}
              onClick={() => setActivePoi(poi)}
              style={{
                flex: '0 0 auto',
                width: 220,
                textAlign: 'left',
                borderRadius: 12,
                overflow: 'hidden',
                background: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div style={{ width: '100%', height: 120, background: '#0f172a' }}>
                {poi.firstImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={poi.firstImage}
                    alt={poi.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                    }}
                  >
                    <MapPin size={24} />
                  </div>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#f1f5f9',
                    display: '-webkit-box',
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {poi.title}
                </div>
                {poi.addr1 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      marginTop: 4,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {poi.addr1}
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* 상세 모달 */}
      <AnimatePresence>
        {activePoi && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePoi(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 520,
                maxHeight: '80vh',
                overflow: 'auto',
                borderRadius: 16,
                background: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: 20,
                position: 'relative',
                color: '#f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => setActivePoi(null)}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: '#cbd5e1',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>

              {activePoi.firstImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activePoi.firstImage}
                  alt={activePoi.title}
                  style={{
                    width: '100%',
                    height: 200,
                    objectFit: 'cover',
                    borderRadius: 12,
                    marginBottom: 12,
                  }}
                />
              )}
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{activePoi.title}</h4>
              {activePoi.addr1 && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    marginTop: 8,
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  <MapPin size={14} style={{ marginTop: 2, flex: '0 0 auto' }} />
                  <span>
                    {activePoi.addr1}
                    {activePoi.addr2 ? ` ${activePoi.addr2}` : ''}
                  </span>
                </div>
              )}
              {activePoi.tel && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                    marginTop: 6,
                    fontSize: 13,
                    color: '#94a3b8',
                  }}
                >
                  <Phone size={14} />
                  <span>{activePoi.tel}</span>
                </div>
              )}
              {activePoi.overview && (
                <p
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#cbd5e1',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {stripHtml(activePoi.overview)}
                </p>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {activePoi.mapX != null && activePoi.mapY != null && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${activePoi.mapY},${activePoi.mapX}`}
                    target="_blank"
                    rel="noreferrer"
                    style={buttonStyle('#10b981')}
                  >
                    <Navigation size={14} />
                    {t('cineTrip.engSpots.openMap', 'Open in Maps')}
                  </a>
                )}
                {activePoi.homepage && (
                  <a
                    href={extractHref(activePoi.homepage)}
                    target="_blank"
                    rel="noreferrer"
                    style={buttonStyle('#6366f1')}
                  >
                    <Globe size={14} />
                    {t('cineTrip.engSpots.website', 'Website')}
                  </a>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .js-drag-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}

function defaultLabel(key) {
  switch (key) {
    case 'attractions': return 'Attractions';
    case 'restaurants': return 'Restaurants';
    case 'accommodations': return 'Stays';
    default: return key;
  }
}

function stripHtml(input) {
  if (!input) return '';
  return String(input).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// KTO overview.homepage 은 종종 "<a href='...'>...</a>" 형태로 내려와 직접 링크로 못 쓴다.
function extractHref(raw) {
  if (!raw) return '#';
  const m = String(raw).match(/href=['"]([^'"]+)['"]/i);
  if (m && m[1]) return m[1];
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

function buttonStyle(color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 999,
    background: `${color}22`,
    border: `1px solid ${color}`,
    color,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
  };
}
