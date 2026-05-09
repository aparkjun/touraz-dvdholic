'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';

const PERIOD_KEYS = ['today', 'week', 'month'];

export default function TrendingRegionsWidget({ limit = 5, defaultPeriod = 'today' }) {
  const { t } = useTranslation();
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState(defaultPeriod);

  const PERIODS = useMemo(
    () =>
      PERIOD_KEYS.map((k) => ({
        key: k,
        label: t(`trendingRegions.${k}.label`, { defaultValue: k }),
      })),
    [t]
  );

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
        setRegions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[trending-regions] fetch failed:', e?.message || e);
        if (alive) setError(t('trendingRegions.errorLoad', '불러오기 실패'));
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
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
  };
  const itemVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.18 } },
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        background: 'linear-gradient(145deg, #141418 0%, #0f0f12 100%)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 14,
        padding: '14px 16px 16px',
        color: '#fff',
        boxShadow: '0 8px 28px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          {t('trendingRegions.heading', '인기 지역')}
        </h2>
        <div
          role="tablist"
          aria-label={t('trendingRegions.tabsAriaLabel', '기간')}
          style={{
            display: 'inline-flex',
            padding: 2,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            gap: 2,
          }}
        >
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.key)}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 40,
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: 8,
                animation: 'trw-pulse 1.4s ease-in-out infinite',
              }}
            />
          ))}
          <style>{`
            @keyframes trw-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.45; }
            }
          `}</style>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '12px 0',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      ) : regions.length === 0 ? (
        <div
          style={{
            padding: '12px 0',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 12,
          }}
        >
          {t('trendingRegions.empty', '목록 없음')}
        </div>
      ) : (
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {regions.map((r, i) => {
            const volume = Number(r.searchVolume) || 0;
            const hasVolume = r.searchVolume !== null && r.searchVolume !== undefined;
            return (
              <motion.li key={`${r.areaCode}-${period}-${i}`} variants={itemVariants}>
                <Link
                  href={`/cine-trip${r.areaCode ? `?area=${r.areaCode}` : ''}`}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                  <div
                    className="trw-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '7px 10px',
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                        color: 'rgba(255,255,255,0.85)',
                      }}
                    >
                      {i + 1}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.regionName || r.areaCode}
                    </div>
                    {hasVolume ? (
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.45)',
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {volume.toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
