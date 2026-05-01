'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PawPrint,
  UtensilsCrossed,
  Hotel,
  MapPin,
  Phone,
  ShoppingBag,
  Landmark,
  Trees,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import { KakaoMapLogo, NaverNLogo } from '@/components/BrandMapSearchIcons';

/**
 * CineTrip 상세 모달 / 반려동물 전용 페이지에서 공용으로 쓰는 "반려동물 친화 스팟" 스트립.
 *
 * <p>한 번의 API 호출({@code GET /api/v1/cine-trip/region/:areaCode/pet-friendly})로
 * 관광지/문화시설/레포츠/숙박/쇼핑/음식점 6 버킷을 받아와 탭 UI 로 전환 노출.
 *
 * <p>동반 가능 구분 칩:
 * - fullyAllowed: "동반 가능" (초록)
 * - limitedAllowed: "일부 구역 가능" (호박)
 * - notAllowed: "동반 불가" (빨강)
 * - 그 외: "정책 정보 없음" (회색)
 *
 * 백엔드가 빈 버킷(KorPetTourService 미설정/응답 0건)을 반환하면 컴포넌트 자체를 숨긴다.
 */
const BUCKET_META = {
  attractions: { label: '관광지', icon: MapPin, color: '#10b981' },
  cultural: { label: '문화시설', icon: Landmark, color: '#a855f7' },
  leisure: { label: '레포츠', icon: Trees, color: '#22c55e' },
  accommodations: { label: '숙박', icon: Hotel, color: '#6366f1' },
  shopping: { label: '쇼핑', icon: ShoppingBag, color: '#f97316' },
  restaurants: { label: '음식점', icon: UtensilsCrossed, color: '#ef4444' },
};
const BUCKET_ORDER = [
  'attractions',
  'cultural',
  'leisure',
  'accommodations',
  'shopping',
  'restaurants',
];

export default function PetFriendlySpotsStrip({ areaCode, regionLabel = '' }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [buckets, setBuckets] = useState({});
  const [activeBucket, setActiveBucket] = useState('attractions');
  const [loading, setLoading] = useState(true);
  const [activePoi, setActivePoi] = useState(null);

  useEffect(() => {
    if (!areaCode) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // perBucket 미지정 → 백엔드가 버킷별 전체 건수를 반환.
        const res = await axios.get(
          `/api/v1/cine-trip/region/${encodeURIComponent(areaCode)}/pet-friendly`
        );
        const payload = res?.data?.data ?? {};
        if (alive) setBuckets(payload || {});
      } catch (e) {
        console.error('[pet-friendly] fetch failed:', e?.message || e);
        if (alive) setBuckets({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode]);

  useEffect(() => {
    if (loading) return;
    if ((buckets?.[activeBucket] || []).length > 0) return;
    const firstFilled = BUCKET_ORDER.find((k) => (buckets?.[k] || []).length > 0);
    if (firstFilled && firstFilled !== activeBucket) {
      setActiveBucket(firstFilled);
    }
  }, [loading, buckets, activeBucket]);

  const totalCount = BUCKET_ORDER.reduce(
    (acc, k) => acc + ((buckets?.[k] || []).length || 0),
    0
  );
  if (!loading && totalCount === 0) return null;
  // 반려동물 친화 관광(KorPetTourService) 국내 전용 → 영어 모드에서는 섹션 숨김.
  if (isEn) return null;

  const activeList = buckets?.[activeBucket] || [];

  return (
    <section style={{ marginTop: 16, marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <PawPrint size={18} style={{ color: '#f472b6' }} />
        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
          {regionLabel ? `${regionLabel} 반려동물 친화 스팟` : '반려동물 친화 스팟'}
        </h4>
        <span style={{ fontSize: 11, color: '#888' }}>
          한국관광공사 반려동물 동반여행 정보
        </span>
      </div>

      {!loading && totalCount > 0 && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 10,
            fontSize: 14,
            fontWeight: 700,
            color: '#ef4444',
            letterSpacing: '-0.01em',
          }}
          aria-live="polite"
        >
          {`총 ${totalCount}편`}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {BUCKET_ORDER.map((k) => {
          const meta = BUCKET_META[k];
          const Icon = meta.icon;
          const count = (buckets?.[k] || []).length;
          const active = activeBucket === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActiveBucket(k)}
              disabled={count === 0 && !loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 18,
                border: active
                  ? `1px solid ${meta.color}`
                  : '1px solid rgba(255,255,255,0.12)',
                background: active
                  ? `${meta.color}22`
                  : count === 0
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(255,255,255,0.05)',
                color: count === 0 && !loading ? '#555' : '#e5e7eb',
                fontSize: 12,
                fontWeight: 600,
                cursor: count === 0 && !loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={13} style={{ color: active ? meta.color : undefined }} />
              {meta.label}
              <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div
          className="js-drag-scroll"
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 6,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 auto',
                width: 220,
                height: 150,
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                backgroundSize: '200% 100%',
                animation: 'cinetrip-shimmer 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : activeList.length === 0 ? (
        <div
          style={{
            color: '#666',
            fontSize: 13,
            padding: '12px 0',
            textAlign: 'center',
          }}
        >
          이 카테고리에 등록된 반려동물 동반 정보가 없어요.
        </div>
      ) : (
        <div
          className="js-drag-scroll"
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 6,
          }}
        >
          {activeList.map((poi, idx) => (
            <PoiCard
              key={poi.contentId || idx}
              poi={poi}
              bucket={activeBucket}
              onOpen={() => setActivePoi({ poi, bucket: activeBucket })}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {activePoi && (
          <PetFriendlyPoiDetailModal
            summary={activePoi.poi}
            bucket={activePoi.bucket}
            onClose={() => setActivePoi(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function PoiCard({ poi, bucket, onOpen }) {
  const meta = BUCKET_META[bucket];
  const Icon = meta.icon;
  const addr = poi.addr1 || poi.addr2 || '';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, borderColor: meta.color }}
      transition={{ duration: 0.3 }}
      aria-label={`${poi.title || ''} 반려동물 동반 정보 보기`}
      style={{
        flex: '0 0 auto',
        width: 240,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
        background: '#0f0f0f',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: '100%',
          height: 110,
          background: '#1a1a1a',
          position: 'relative',
        }}
      >
        {poi.firstImageThumb || poi.firstImage ? (
          <img
            src={poi.firstImageThumb || poi.firstImage}
            alt={poi.title || 'poi'}
            loading="lazy"
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
              userSelect: 'none',
              WebkitUserDrag: 'none',
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#444',
            }}
          >
            <Icon size={32} />
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 10,
            background: meta.color,
            color: '#fff',
          }}
        >
          {meta.label}
        </span>
        <AcceptanceBadge poi={poi} />
      </div>
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h5
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {poi.title || '이름 없음'}
        </h5>
        {addr && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 11,
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <MapPin size={11} style={{ color: '#6b7280', flexShrink: 0 }} />
            {addr}
          </p>
        )}
        {poi.tel && (
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 11,
              color: '#6ee7b7',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Phone size={11} style={{ flexShrink: 0 }} /> {poi.tel}
          </p>
        )}
      </div>
    </motion.button>
  );
}

function AcceptanceBadge({ poi }) {
  // acmpyTypeCd 가 없으면(미집계) 배지 숨김. 상세 모달에서 설명.
  if (!poi.acmpyTypeCd) return null;
  const bg = poi.fullyAllowed ? '#10b981' : poi.limitedAllowed ? '#f59e0b' : '#ef4444';
  const Icon = poi.fullyAllowed ? CheckCircle2 : AlertTriangle;
  const label = poi.acceptanceLabel || '정책';
  return (
    <span
      title={label}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 10,
        background: bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <Icon size={10} />
      {poi.fullyAllowed ? '동반 가능' : poi.limitedAllowed ? '일부 가능' : '동반 불가'}
    </span>
  );
}

/**
 * 반려동물 친화 스팟 상세 모달.
 * - 요약(areaBasedList2)을 즉시 표시하고, 백그라운드로 /pet-friendly/:contentId 호출하여
 *   detailCommon2 + detailPetTour2 를 병합 노출.
 */
function PetFriendlyPoiDetailModal({ summary, bucket, onClose }) {
  const meta = BUCKET_META[bucket];
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!summary?.contentId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const typeQuery = summary.contentTypeId
          ? `?type=${encodeURIComponent(summary.contentTypeId)}`
          : '';
        const res = await axios.get(
          `/api/v1/tour/pet-friendly/${encodeURIComponent(summary.contentId)}${typeQuery}`,
          { timeout: 15000 }
        );
        if (alive) setDetail(res?.data?.data || null);
      } catch (e) {
        console.error('[pet-detail] fetch failed:', e?.message || e);
        if (alive) setErr('상세 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [summary?.contentId, summary?.contentTypeId]);

  const merged = mergeDetailOverSummary(summary, detail);
  const addr = merged.addr1 || merged.addr2 || '';
  const image = merged.firstImage || merged.firstImageThumb;
  useEffect(() => {
    setImageBroken(false);
  }, [image]);

  const kakaoMapUrl = merged.mapY && merged.mapX
    ? `https://map.kakao.com/link/map/${encodeURIComponent(merged.title || '장소')},${merged.mapY},${merged.mapX}`
    : null;
  const naverSearchUrl = merged.title
    ? `https://search.naver.com/search.naver?query=${encodeURIComponent(
        `${merged.title} 반려동물`
      )}`
    : null;

  const acceptanceColor = merged.fullyAllowed
    ? '#10b981'
    : merged.limitedAllowed
    ? '#f59e0b'
    : merged.notAllowed
    ? '#ef4444'
    : '#6b7280';

  return (
    <motion.div
      key="pet-poi-lightbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        cursor: 'zoom-out',
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={merged.title || '반려동물 동반 스팟 상세'}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 20,
          background: 'linear-gradient(180deg, #141419 0%, #0a0a0f 100%)',
          border: `1px solid ${meta.color}55`,
          boxShadow: `0 25px 60px ${meta.color}33, 0 0 0 1px rgba(255,255,255,0.04)`,
          cursor: 'default',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 2,
          }}
        >
          <X size={18} />
        </button>

        {image && !imageBroken ? (
          <img
            src={image}
            alt={merged.title || 'poi'}
            style={{
              width: '100%',
              maxHeight: 360,
              objectFit: 'cover',
              display: 'block',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              background: '#111',
            }}
            onError={() => setImageBroken(true)}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 200,
              background: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#444',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <meta.icon size={48} />
          </div>
        )}

        <div style={{ padding: '22px 24px 24px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 10,
                background: meta.color,
                color: '#fff',
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 10,
                background: acceptanceColor,
                color: '#fff',
              }}
            >
              <PawPrint size={11} /> {merged.acceptanceLabel || '정책 정보 없음'}
            </span>
          </div>
          <h3 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>
            {merged.title || '이름 없음'}
          </h3>

          {addr && (
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#cbd5e1', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <MapPin size={14} style={{ color: '#a855f7', marginTop: 2, flexShrink: 0 }} />
              <span>{addr}</span>
            </p>
          )}
          {merged.tel && (
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone size={13} />
              <a href={`tel:${merged.tel}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                {merged.tel}
              </a>
            </p>
          )}

          {/* 외부 링크 */}
          {(kakaoMapUrl || naverSearchUrl) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, marginBottom: 14 }}>
              {kakaoMapUrl && (
                <a
                  href={kakaoMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="카카오맵에서 열기"
                  title="카카오맵"
                  style={extLinkStyle('#fbbf24')}
                >
                  <KakaoMapLogo size={20} />
                </a>
              )}
              {naverSearchUrl && (
                <a
                  href={naverSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="네이버에서 검색"
                  title="네이버 검색"
                  style={extLinkStyle('#10b981')}
                >
                  <NaverNLogo size={20} />
                </a>
              )}
            </div>
          )}

          {/* overview */}
          {merged.overview && (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                lineHeight: 1.65,
                color: '#cbd5e1',
                whiteSpace: 'pre-line',
              }}
            >
              {stripHtml(merged.overview)}
            </p>
          )}

          {/* 반려동물 정책 그리드 */}
          <PetAcceptanceGrid detail={merged} loading={loading} err={err} />

          <p style={{ marginTop: 18, fontSize: 10, color: '#555' }}>
            © 한국관광공사 반려동물 동반여행 정보 (KorPetTourService)
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PetAcceptanceGrid({ detail, loading, err }) {
  const rawMap = detail?.petAcceptance || {};
  const entries = Object.entries(rawMap).filter(
    ([k, v]) => k && String(v || '').trim() !== ''
  );

  if (loading) {
    return (
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 180,
              height: 60,
              borderRadius: 10,
              background:
                'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              backgroundSize: '200% 100%',
              animation: 'cinetrip-shimmer 1.5s infinite',
            }}
          />
        ))}
      </div>
    );
  }
  if (err) {
    return <p style={{ marginTop: 16, fontSize: 12, color: '#f87171' }}>{err}</p>;
  }
  if (entries.length === 0) {
    return (
      <p style={{ marginTop: 18, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        한국관광공사에 등록된 반려동물 동반 상세 정책이 아직 없습니다.
        방문 전 해당 시설에 직접 문의해 주세요.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
        반려동물 동반 정책
      </h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {entries.map(([label, value]) => (
          <div key={label} style={detailCellStyle}>
            <p style={detailLabelStyle}>
              <PawPrint size={11} style={{ color: '#f472b6' }} />
              {label}
            </p>
            <p style={detailValueStyle}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const detailCellStyle = {
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
};
const detailLabelStyle = {
  margin: '0 0 4px',
  fontSize: 11,
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
};
const detailValueStyle = {
  margin: 0,
  fontSize: 13,
  color: '#e5e7eb',
  lineHeight: 1.55,
  whiteSpace: 'pre-line',
  wordBreak: 'break-word',
};

function extLinkStyle(color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: 8,
    background: `${color}22`,
    color,
    textDecoration: 'none',
    border: `1px solid ${color}44`,
  };
}

/** summary 위에 detail 값을 "비어있지 않은 경우에만" 덮어쓴다. */
function mergeDetailOverSummary(summary, detail) {
  const base = { ...(summary || {}) };
  if (!detail) return base;
  Object.entries(detail).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (k === 'petAcceptance') {
      const existing = base.petAcceptance || {};
      const incoming = v || {};
      base.petAcceptance =
        Object.keys(incoming).length >= Object.keys(existing).length ? incoming : existing;
      return;
    }
    base[k] = v;
  });
  return base;
}

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}
