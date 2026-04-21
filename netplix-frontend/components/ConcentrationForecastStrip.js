'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, MapPin } from 'lucide-react';
import axios from '@/lib/axiosConfig';

/**
 * 관광지 7일 혼잡도 예측 스트립.
 * 백엔드 엔드포인트: GET /api/v1/cine-trip/concentration?areaCode=...
 *
 * - areaCode 가 null 이면 렌더링하지 않는다. (전국 비교는 의미가 없어서 UX상 숨김 처리)
 * - 서비스 레이어가 광역별 대표 시군구로 변환해 주므로 프론트는 areaCode 만 전달.
 * - 각 바는 색상으로 혼잡도를 표현:
 *     < 30  : 여유 (초록)
 *     30-60 : 보통 (노랑)
 *     60-85 : 혼잡 (주황)
 *     >= 85 : 매우 혼잡 (빨강)
 */
export default function ConcentrationForecastStrip({ areaCode = null, regionLabel = '' }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaCode) {
      setPredictions([]);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `/api/v1/cine-trip/concentration?areaCode=${encodeURIComponent(areaCode)}`
        );
        const payload = res?.data?.data ?? [];
        if (alive) setPredictions(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error('[concentration] fetch failed:', e?.message || e);
        if (alive) setPredictions([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode]);

  if (!areaCode) return null;
  if (!loading && predictions.length === 0) return null;

  const spotName = predictions[0]?.spotName;
  const signguName = predictions[0]?.signguName;
  const areaName = predictions[0]?.areaName || regionLabel;

  return (
    <section
      style={{
        marginTop: 32,
        marginBottom: 24,
        padding: 20,
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.10) 0%, rgba(139,92,246,0.08) 100%)',
        border: '1px solid rgba(139,92,246,0.22)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <Activity size={20} style={{ color: '#60a5fa' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
          7일 혼잡도 예측
        </h3>
        {spotName && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 12,
              background: 'rgba(96,165,250,0.15)',
              border: '1px solid rgba(96,165,250,0.3)',
              color: '#cfe0ff',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <MapPin size={12} />
            {areaName} {signguName} · {spotName}
          </span>
        )}
        <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>
          출처: 한국관광공사 관광지 집중률 방문자 추이 예측
        </span>
      </div>

      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
            height: 120,
          }}
        >
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                backgroundSize: '200% 100%',
                animation: 'cinetrip-shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(predictions.length, 7)}, 1fr)`,
            gap: 8,
          }}
        >
          {predictions.slice(0, 7).map((p, idx) => (
            <ForecastBar key={p.baseDate || idx} prediction={p} index={idx} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {LEVELS.map((l) => (
          <div
            key={l.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#aaa',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: l.color,
                display: 'inline-block',
              }}
            />
            {l.label}
          </div>
        ))}
      </div>
    </section>
  );
}

const LEVELS = [
  { max: 30, label: '여유 (<30)', color: '#10b981' },
  { max: 60, label: '보통 (30-60)', color: '#f59e0b' },
  { max: 85, label: '혼잡 (60-85)', color: '#fb7185' },
  { max: 101, label: '매우 혼잡 (85+)', color: '#ef4444' },
];

function levelColor(rate) {
  if (rate == null) return '#555';
  for (const l of LEVELS) {
    if (rate < l.max) return l.color;
  }
  return '#ef4444';
}

function formatDate(baseDate) {
  if (!baseDate) return '';
  const arr = Array.isArray(baseDate) ? baseDate : null;
  const d = arr ? new Date(arr[0], arr[1] - 1, arr[2]) : new Date(baseDate);
  if (Number.isNaN(d.getTime())) return String(baseDate);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return { label: `${mm}.${dd}`, dow };
}

function ForecastBar({ prediction, index }) {
  const rate = prediction?.concentrationRate ?? 0;
  const fmt = formatDate(prediction?.baseDate);
  const color = levelColor(rate);
  const pct = Math.max(6, Math.min(100, rate));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#fff',
          textShadow: `0 0 10px ${color}66`,
        }}
      >
        {rate != null ? rate.toFixed(1) : '-'}
      </div>
      <div
        style={{
          width: '100%',
          height: 90,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'flex-end',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${pct}%`,
            background: `linear-gradient(180deg, ${color}ff, ${color}80)`,
            boxShadow: `inset 0 -6px 12px rgba(0,0,0,0.25)`,
            transition: 'height 0.5s ease',
          }}
        />
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
        <div style={{ fontSize: 11, color: '#cfcfcf' }}>{fmt?.label || '-'}</div>
        <div style={{ fontSize: 10, color: '#888' }}>{fmt?.dow || ''}</div>
      </div>
    </motion.div>
  );
}
