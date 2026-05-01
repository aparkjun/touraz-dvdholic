'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Accessibility,
  UtensilsCrossed,
  Hotel,
  MapPin,
  Phone,
  Eye,
  Ear,
  Baby,
  X,
  Navigation,
  Landmark,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { KakaoMapLogo, NaverNLogo } from '@/components/BrandMapSearchIcons';
import { useTranslation } from 'react-i18next';

/**
 * CineTrip 상세 모달용 "이 지역 무장애 스팟" 스트립.
 *
 * <p>한 번의 API 호출({@code GET /api/v1/cine-trip/region/:areaCode/accessible})로
 * 관광지/음식점/숙박 3 버킷을 받아와 탭 UI 로 전환 노출.
 *
 * <p>접근성 칩:
 * - 휠체어/엘리베이터 (hasPhysicalAccess)
 * - 시각장애 편의 (hasVisualAccess)
 * - 청각장애 편의 (hasHearingAccess)
 * - 가족/유아 동반 (hasFamilyAccess)
 *
 * 백엔드가 빈 버킷(KorWithService2 미설정/응답 0건)을 반환하면 컴포넌트 자체를 숨긴다.
 */
const BUCKET_META = {
  attractions: { label: '관광지', icon: MapPin, color: '#10b981' },
  cultural: { label: '문화시설', icon: Landmark, color: '#a855f7' },
  restaurants: { label: '음식점', icon: UtensilsCrossed, color: '#f97316' },
  accommodations: { label: '숙박', icon: Hotel, color: '#6366f1' },
};
const BUCKET_ORDER = [
  'attractions',
  'cultural',
  'restaurants',
  'accommodations',
];

export default function AccessibleSpotsStrip({ areaCode, regionLabel = '' }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [buckets, setBuckets] = useState({});
  const [activeBucket, setActiveBucket] = useState('attractions');
  const [loading, setLoading] = useState(true);
  const [activePoi, setActivePoi] = useState(null); // { poi, bucket }

  useEffect(() => {
    if (!areaCode) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(
          `/api/v1/cine-trip/region/${encodeURIComponent(areaCode)}/accessible?perBucket=6`
        );
        const payload = res?.data?.data ?? {};
        if (alive) setBuckets(payload || {});
      } catch (e) {
        console.error('[accessible-spots] fetch failed:', e?.message || e);
        if (alive) setBuckets({});
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode]);

  // 로드 직후 활성 탭이 비어있으면 첫 번째로 채워진 탭으로 자동 전환.
  // (early return 앞에 둬야 React hook 순서 규칙 준수)
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
  if (!loading && totalCount === 0) {
    return null;
  }
  // 무장애 관광(KorWithService2) 국내 전용 데이터셋 → 영어 모드에서는 섹션 전체 숨김.
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
        <Accessibility size={18} style={{ color: '#22d3ee' }} />
        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>
          {regionLabel ? `${regionLabel} 무장애 여행 스팟` : '무장애 여행 스팟'}
        </h4>
        <span style={{ fontSize: 11, color: '#888' }}>한국관광공사 무장애 여행정보</span>
      </div>

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
          이 카테고리에 등록된 무장애 정보가 없어요.
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
          <AccessiblePoiDetailModal
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
      aria-label={`${poi.title || ''} 상세 정보 보기`}
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
        <AccessibilityChips poi={poi} />
      </div>
    </motion.button>
  );
}

function AccessibilityChips({ poi }) {
  const chips = [];
  if (poi.physicalAccess)
    chips.push({ key: 'phys', label: '휠체어', icon: Accessibility, color: '#22d3ee' });
  if (poi.visualAccess)
    chips.push({ key: 'vis', label: '시각', icon: Eye, color: '#a855f7' });
  if (poi.hearingAccess)
    chips.push({ key: 'hear', label: '청각', icon: Ear, color: '#f472b6' });
  if (poi.familyAccess)
    chips.push({ key: 'fam', label: '가족', icon: Baby, color: '#fbbf24' });

  if (chips.length === 0) {
    return (
      <p style={{ margin: '8px 0 0', fontSize: 10, color: '#555' }}>접근성 정보 없음</p>
    );
  }

  return (
    <div
      style={{
        marginTop: 8,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
      }}
    >
      {chips.map((c) => {
        const Icon = c.icon;
        return (
          <span
            key={c.key}
            title={`${c.label} 편의 제공`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 8,
              background: `${c.color}22`,
              color: c.color,
              border: `1px solid ${c.color}44`,
            }}
          >
            <Icon size={9} />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

/**
 * POI 상세 모달.
 * - areaBasedList2 로 얻은 summary 를 즉시 표시하고,
 *   백그라운드로 detailWithTour2 를 호출해 접근성 원문 필드를 채운다.
 * - detailWithTour2 가 비어있어도(KTO 미등록) summary 만으로 동작.
 */
function AccessiblePoiDetailModal({ summary, bucket, onClose }) {
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
          `/api/v1/tour/accessible/${encodeURIComponent(summary.contentId)}${typeQuery}`,
          { timeout: 15000 }
        );
        if (alive) setDetail(res?.data?.data || null);
      } catch (e) {
        console.error('[accessible-detail] fetch failed:', e?.message || e);
        if (alive) setErr('상세 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [summary?.contentId, summary?.contentTypeId]);

  // summary 를 기준으로, detail 응답의 "비어있지 않은" 필드만 덮어쓴다.
  // - detailCommon2 에서 firstImage/title 등이 null 로 내려와 summary 값을 지워버리는 현상 방지
  // - accessibilityDetail 은 항목 수가 더 많은 쪽을 채택
  const merged = useMemo(() => mergeDetailOverSummary(summary, detail), [summary, detail]);
  const addr = merged.addr1 || merged.addr2 || '';
  const image = merged.firstImage || merged.firstImageThumb;
  // 이미지 URL 이 바뀌면 실패 상태를 리셋해 새 URL 을 다시 시도.
  useEffect(() => {
    setImageBroken(false);
  }, [image]);
  const kakaoMapUrl = merged.mapY && merged.mapX
    ? `https://map.kakao.com/link/map/${encodeURIComponent(merged.title || '장소')},${merged.mapY},${merged.mapX}`
    : null;
  const naverSearchUrl = merged.title
    ? `https://search.naver.com/search.naver?query=${encodeURIComponent(merged.title)}`
    : null;

  return (
    <motion.div
      key="accessible-poi-lightbox"
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
        aria-label={merged.title || '무장애 여행 스팟 상세'}
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
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 10,
              background: meta.color,
              color: '#fff',
              marginBottom: 8,
            }}
          >
            {meta.label}
          </span>
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

          {/* 접근성 칩 요약 */}
          <AccessibilityChips poi={merged} />

          {/* overview */}
          {merged.overview && (
            <p
              style={{
                marginTop: 16,
                fontSize: 13,
                lineHeight: 1.65,
                color: '#cbd5e1',
                whiteSpace: 'pre-line',
              }}
            >
              {stripHtml(merged.overview)}
            </p>
          )}

          {/* 접근성 원문 필드 그리드 */}
          <AccessibilityDetailGrid detail={merged} loading={loading} err={err} />

          <p style={{ marginTop: 18, fontSize: 10, color: '#555' }}>
            © 한국관광공사 무장애 여행정보 (KorWithService2)
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AccessibilityDetailGrid({ detail, loading, err }) {
  // 1) 신규 KorWithService2 detailInfo2 경로 — 서버가 label → value 맵을 그대로 내려줌.
  const rawMap = detail?.accessibilityDetail || {};
  const mapEntries = Object.entries(rawMap).filter(
    ([k, v]) => k && String(v || '').trim() !== ''
  );

  // 2) 레거시 고정 필드 (이전 detailWithTour2 호환) — 값이 있을 때만 폴백으로 사용.
  const legacyFields = [
    { key: 'parkingAccessible', label: '장애인 주차', icon: Accessibility },
    { key: 'restroomAccessible', label: '장애인 화장실', icon: Accessibility },
    { key: 'wheelchairRental', label: '휠체어 대여', icon: Accessibility },
    { key: 'elevatorAccessible', label: '엘리베이터', icon: Accessibility },
    { key: 'publicTransport', label: '대중교통', icon: Navigation },
    { key: 'blindHandicapEtc', label: '시각장애 편의', icon: Eye },
    { key: 'brailleBlock', label: '점자블록', icon: Eye },
    { key: 'hearingHandicapEtc', label: '청각장애 편의', icon: Ear },
    { key: 'signGuide', label: '수어/안내판', icon: Ear },
    { key: 'videoGuide', label: '수어 비디오', icon: Ear },
    { key: 'helpDog', label: '안내견 동반', icon: Accessibility },
    { key: 'strollerRental', label: '유모차 대여', icon: Baby },
    { key: 'lactationRoom', label: '수유실', icon: Baby },
  ];
  const legacyPopulated = legacyFields.filter((f) => {
    const v = detail?.[f.key];
    return v != null && String(v).trim() !== '';
  });
  // 라벨별 아이콘 추정 (맵 key 는 자유 텍스트이므로 키워드 기반)
  const iconFor = (label = '') => {
    const s = String(label);
    if (/휠체어|주차|화장실|엘리베이터|안내견/.test(s)) return Accessibility;
    if (/점자|시각/.test(s)) return Eye;
    if (/수어|청각|비디오/.test(s)) return Ear;
    if (/유모차|수유|유아/.test(s)) return Baby;
    if (/교통|이동/.test(s)) return Navigation;
    return Accessibility;
  };

  if (loading) {
    return (
      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 140,
              height: 44,
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
    return (
      <p style={{ marginTop: 16, fontSize: 12, color: '#f87171' }}>{err}</p>
    );
  }

  const useMap = mapEntries.length > 0;
  const useLegacy = !useMap && legacyPopulated.length > 0;

  if (!useMap && !useLegacy) {
    return (
      <p style={{ marginTop: 18, fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
        한국관광공사에 등록된 무장애 상세 편의시설 정보가 아직 없습니다.
        기본 정보만 제공해요.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
        편의시설 정보
      </h4>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 8,
        }}
      >
        {useMap
          ? mapEntries.map(([label, value]) => {
              const Icon = iconFor(label);
              return (
                <div key={label} style={detailCellStyle}>
                  <p style={detailLabelStyle}>
                    <Icon size={11} style={{ color: '#a855f7' }} />
                    {label}
                  </p>
                  <p style={detailValueStyle}>{value}</p>
                </div>
              );
            })
          : legacyPopulated.map(({ key, label, icon: Icon }) => (
              <div key={key} style={detailCellStyle}>
                <p style={detailLabelStyle}>
                  <Icon size={11} style={{ color: '#a855f7' }} />
                  {label}
                </p>
                <p style={detailValueStyle}>{detail[key]}</p>
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
  lineHeight: 1.5,
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

/**
 * 요약(summary) 위에 상세(detail) 값을 "비어있지 않은 경우에만" 덮어쓴다.
 * - null/undefined/빈 문자열은 무시 (요약 값 유지)
 * - accessibilityDetail 맵은 항목 수가 더 많은 쪽을 채택해, 상세 호출 실패 시에도 퇴행 없음
 */
function mergeDetailOverSummary(summary, detail) {
  const base = { ...(summary || {}) };
  if (!detail) return base;
  Object.entries(detail).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'string' && v.trim() === '') return;
    if (k === 'accessibilityDetail') {
      const existing = base.accessibilityDetail || {};
      const incoming = v || {};
      base.accessibilityDetail =
        Object.keys(incoming).length >= Object.keys(existing).length ? incoming : existing;
      return;
    }
    base[k] = v;
  });
  return base;
}

/** overview 에 섞여 들어오는 <br>/<p> 를 개행으로 치환하고 나머지 태그 제거. */
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
