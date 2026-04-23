'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Compass, Sparkles, Share2, Plane, Footprints } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { shareContent, shareResultMessage } from '@/lib/shareUtils';

const MAPPING_BADGE = {
  SHOT: { label: '촬영지', bg: 'rgba(236, 72, 153, 0.18)', color: '#ff6bd6' },
  BACKGROUND: { label: '배경', bg: 'rgba(59, 130, 246, 0.18)', color: '#60a5fa' },
  THEME: { label: '테마', bg: 'rgba(139, 92, 246, 0.18)', color: '#a78bfa' },
};

/**
 * DVD 상세 페이지에서는 "이 DVD로 여행가기",
 * 영화(혹은 all) 상세 페이지에서는 "이 영화로 여행가기" 로 문구를 동적 결정.
 */
const resolveCtaLabel = (contentType) => {
  const ct = String(contentType || '').toLowerCase();
  if (ct === 'dvd') return '이 DVD로 여행가기';
  return '이 영화로 여행가기';
};

export default function CineTripCTA({ movieName, posterUrl, contentType }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [shareToast, setShareToast] = useState('');

  useEffect(() => {
    if (!movieName) return;
    let alive = true;
    setLoading(true);
    axios
      .get(`/api/v1/cine-trip/movie?name=${encodeURIComponent(movieName)}`)
      .then((res) => {
        if (!alive) return;
        setItems(res?.data?.data ?? []);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [movieName]);

  if (loading) return null;

  const ctaLabel = resolveCtaLabel(contentType);
  const hasItems = Array.isArray(items) && items.length > 0;

  const mappings = hasItems ? items.flatMap((it) => it.mappings || []) : [];
  const regions = hasItems ? items.flatMap((it) => it.regionIndices || []) : [];
  const uniqueRegions = new Map();
  mappings.forEach((m) => {
    if (m?.areaCode && !uniqueRegions.has(m.areaCode)) {
      uniqueRegions.set(m.areaCode, {
        areaCode: m.areaCode,
        regionName: m.regionName,
        mappingType: m.mappingType,
      });
    }
  });
  const regionChips = Array.from(uniqueRegions.values()).slice(0, 6);
  const primaryArea = regionChips[0]?.areaCode;
  const primaryRegionName = regionChips[0]?.regionName;

  return (
    <div
      style={{
        padding: '20px 18px',
        background:
          'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.18) 50%, rgba(236,72,153,0.18) 100%)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '14px',
        marginBottom: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Sparkles size={18} style={{ color: '#fbbf24' }} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.3px',
          }}
        >
          {ctaLabel}
        </span>
      </div>
      <p
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.75)',
          margin: '0 0 12px 0',
          lineHeight: 1.5,
        }}
      >
        {hasItems
          ? '이 작품과 연결된 지역의 실시간 관광 지표를 확인하고, 촬영지·배경을 따라 여행을 계획해 보세요.'
          : '스크린 속 풍경을 직접 걷고 싶다면 CineTrip 으로 떠나보세요. 전국 촬영지·배경 큐레이션이 준비되어 있어요.'}
      </p>

      {regionChips.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 14,
          }}
        >
          {regionChips.map((r) => {
            const badge = MAPPING_BADGE[r.mappingType] || MAPPING_BADGE.THEME;
            return (
              <span
                key={r.areaCode}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                <MapPin size={11} style={{ color: badge.color }} />
                {r.regionName}
                <span
                  style={{
                    padding: '1px 6px',
                    background: badge.bg,
                    color: badge.color,
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {badge.label}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {regions.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {regions.slice(0, 4).map((r) => (
            <div
              key={`${r.areaCode}-${r.regionName}`}
              style={{
                padding: '8px 10px',
                background: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                {r.regionName}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
                검색 {Number(r.searchVolume || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link
          href={(() => {
            const qp = new URLSearchParams();
            if (movieName) qp.set('movie', movieName);
            if (primaryArea) qp.set('area', primaryArea);
            return `/cine-trip${qp.toString() ? `?${qp.toString()}` : ''}`;
          })()}
          className="cinetrip-cta-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 22px',
            background:
              'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%)',
            backgroundSize: '200% 200%',
            borderRadius: 999,
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: '0.2px',
            textDecoration: 'none',
            boxShadow:
              '0 6px 22px rgba(139, 92, 246, 0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Plane size={16} />
          {ctaLabel}
          <Compass size={14} style={{ opacity: 0.9, marginLeft: 2 }} />
        </Link>

        {primaryArea && (
          <Link
            href={`/trekking?area=${primaryArea}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: 999,
              color: '#86efac',
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Footprints size={14} />
            이 길 따라 걷기
            {primaryRegionName ? ` · ${primaryRegionName}` : ''}
          </Link>
        )}

        <button
          type="button"
          onClick={async () => {
            const regionText =
              regionChips.length > 0
                ? regionChips
                    .map((r) => r.regionName)
                    .filter(Boolean)
                    .join(', ')
                : '';
            const channel = await shareContent({
              title: `${movieName} · CineTrip`,
              description: regionText
                ? `${ctaLabel}: ${regionText}`
                : `${ctaLabel} · CineTrip 큐레이션을 확인해 보세요`,
              imageUrl: posterUrl || '',
              url:
                typeof window !== 'undefined'
                  ? `${window.location.origin}/cine-trip${
                      primaryArea ? `?area=${primaryArea}` : ''
                    }`
                  : undefined,
            });
            setShareToast(shareResultMessage(channel));
            setTimeout(() => setShareToast(''), 2000);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 999,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Share2 size={14} />
          공유
        </button>
        {shareToast && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            {shareToast}
          </span>
        )}
      </div>

      <style jsx>{`
        .cinetrip-cta-primary {
          animation: cinetripGradientShift 6s ease infinite,
            cinetripPulse 2.6s ease-in-out infinite;
        }
        .cinetrip-cta-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(139, 92, 246, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.35);
        }
        @keyframes cinetripGradientShift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        @keyframes cinetripPulse {
          0%,
          100% {
            box-shadow: 0 6px 22px rgba(139, 92, 246, 0.45),
              inset 0 1px 0 rgba(255, 255, 255, 0.25);
          }
          50% {
            box-shadow: 0 10px 30px rgba(236, 72, 153, 0.55),
              inset 0 1px 0 rgba(255, 255, 255, 0.35);
          }
        }
      `}</style>
    </div>
  );
}
