'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, MapPin } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';

/**
 * 관광공모전(사진) 수상작 갤러리 스트립.
 * - areaCode 가 있으면 해당 광역 지자체 필터, 없으면 전체 최신.
 * - 클릭 시 라이트박스로 원본 이미지 + 촬영지 + 작가 + 상격 표시.
 * - 저작권 Type1 이 아닌 경우도 소셜 공유 방지 목적에서 다운로드/우클릭 차단.
 *
 * 백엔드 엔드포인트: GET /api/v1/cine-trip/photos
 *   query: areaCode | lDongRegnCd | q | limit
 */
export default function PhotoGalleryStrip({ areaCode = null, keyword = null, limit = 12, title = '수상작 포토스팟' }) {
  const { i18n } = useTranslation();
  const isEn = i18n.language && i18n.language.startsWith('en');

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(null);

  // 라이트박스 이미지 줌/팬 상태. 사진이 바뀔 때마다 1배 / 가운데로 리셋.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pinchRef = useRef(null); // 핀치 제스처 시작 거리/줌
  const dragRef = useRef(null);  // 드래그 시작 좌표 + 시작 시점 pan
  const lastTapRef = useRef(0);
  const isInteractingRef = useRef(false); // 트랜지션 비활성화 트리거
  const [, forceTick] = useState(0);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activePhoto?.contentId]);

  useEffect(() => {
    if (zoom <= 1.001) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const clampZoom = (z) => Math.max(1, Math.min(5, z));

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.003;
    setZoom((z) => clampZoom(z + delta));
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), zoom };
      isInteractingRef.current = true;
      forceTick((n) => n + 1);
    } else if (e.touches.length === 1 && zoom > 1) {
      dragRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
        touch: true,
      };
      isInteractingRef.current = true;
      forceTick((n) => n + 1);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.hypot(dx, dy);
      setZoom(clampZoom(pinchRef.current.zoom * (dist / pinchRef.current.dist)));
    } else if (e.touches.length === 1 && dragRef.current?.touch && zoom > 1) {
      e.preventDefault();
      setPan({
        x: dragRef.current.panX + (e.touches[0].clientX - dragRef.current.x),
        y: dragRef.current.panY + (e.touches[0].clientY - dragRef.current.y),
      });
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length < 1) dragRef.current = null;
    if (!pinchRef.current && !dragRef.current) {
      isInteractingRef.current = false;
      forceTick((n) => n + 1);
    }
  };

  const handleMouseDown = (e) => {
    if (zoom > 1 && e.button === 0) {
      e.preventDefault();
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
        touch: false,
      };
      isInteractingRef.current = true;
      forceTick((n) => n + 1);
    }
  };

  const handleMouseMove = (e) => {
    if (dragRef.current && !dragRef.current.touch) {
      setPan({
        x: dragRef.current.panX + (e.clientX - dragRef.current.x),
        y: dragRef.current.panY + (e.clientY - dragRef.current.y),
      });
    }
  };

  const handleMouseUp = (e) => {
    if (dragRef.current && !dragRef.current.touch) {
      // 드래그 직후 mouseup 이 outer 오버레이로 버블되어 라이트박스가 닫히는 것 방지.
      e?.stopPropagation?.();
      dragRef.current = null;
      isInteractingRef.current = false;
      forceTick((n) => n + 1);
    }
  };

  const handleImageAreaClick = (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (zoom > 1) {
        setZoom(1);
      } else {
        setZoom(2.5);
      }
    }
    lastTapRef.current = now;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        if (keyword) params.set('q', keyword);
        else if (areaCode) params.set('areaCode', String(areaCode));
        const res = await axios.get(`/api/v1/cine-trip/photos?${params.toString()}`);
        const payload = res?.data?.data ?? [];
        if (alive) setPhotos(Array.isArray(payload) ? payload : []);
      } catch (e) {
        console.error('[photo-gallery] fetch failed:', e?.message || e);
        if (alive) setPhotos([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [areaCode, keyword, limit]);

  if (!loading && photos.length === 0) {
    return null;
  }

  // KTO 관광공모전(수상작 사진) 서비스는 영문판이 존재하지 않는 한국 특화 데이터라,
  // 영어 모드에서는 섹션 자체를 숨겨 한국어 사진 설명/수상 정보가 외국인 사용자에게
  // 그대로 노출되는 것을 막는다. (ㄴ 정책)
  if (isEn) return null;

  return (
    <section style={{ marginTop: 32, marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <Camera size={20} style={{ color: '#f59e0b' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' }}>
          {title}
        </h3>
      </div>

      {!loading && photos.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 12,
            fontSize: 15,
            fontWeight: 700,
            color: '#ef4444',
            letterSpacing: '-0.01em',
          }}
          aria-live="polite"
        >
          {`총 ${photos.length}편`}
        </div>
      )}

      <div
        className="js-drag-scroll"
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 8,
        }}
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: '0 0 auto',
                  width: 200,
                  height: 140,
                  borderRadius: 12,
                  background: 'linear-gradient(90deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'cinetrip-shimmer 1.5s infinite',
                }}
              />
            ))
          : photos.map((p, idx) => (
              <motion.button
                key={p.contentId || idx}
                type="button"
                onClick={() => setActivePhoto(p)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.35) }}
                whileHover={{ scale: 1.03 }}
                style={{
                  flex: '0 0 auto',
                  width: 200,
                  height: 140,
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: '#0f0f0f',
                  padding: 0,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.2s',
                }}
                title={`${p.title || ''} · ${p.filmSite || ''}`}
              >
                <img
                  src={p.thumbnailUrl || p.imageUrl}
                  alt={p.title || '관광 사진'}
                  loading="lazy"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                    WebkitUserDrag: 'none',
                    pointerEvents: 'none',
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '8px 10px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
                    textAlign: 'left',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {p.title || '무제'}
                  </p>
                </div>
              </motion.button>
            ))}
      </div>

      <AnimatePresence>
        {activePhoto && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              // 부모 모달(TravelCourseModal) 의 오버레이로 클릭이 전파되어
              // 두 모달이 동시에 닫히는 것을 차단한다.
              e.stopPropagation();
              setActivePhoto(null);
            }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.92)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              cursor: 'zoom-out',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 960,
                width: '100%',
                maxHeight: '90vh',
                background: '#0a0a0a',
                // 모달 상단(좌·우)만 라운드 — 바텀시트 느낌으로 사진이 무대처럼 떠오르게.
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhoto(null);
                }}
                aria-label="닫기"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  background: 'rgba(10,10,15,0.92)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
                }}
              >
                <X size={20} />
              </button>
              {/* 줌/팬 영역 — 모바일 핀치, 데스크톱 휠/드래그, 더블탭 리셋.
                  이 컨테이너 안에서만 transform 이 적용되므로 아래 설명 텍스트는
                  배율과 무관하게 원본 크기를 유지한다. */}
              <div
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleImageAreaClick}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '100%',
                  height: '70vh',
                  overflow: 'hidden',
                  background: '#000',
                  touchAction: 'none',
                  cursor: zoom > 1 ? (dragRef.current ? 'grabbing' : 'grab') : 'zoom-in',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  position: 'relative',
                }}
              >
                <img
                  src={activePhoto.imageUrl || activePhoto.thumbnailUrl}
                  alt={activePhoto.title || '관광 사진'}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isInteractingRef.current
                      ? 'none'
                      : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: 'none',
                    willChange: 'transform',
                  }}
                />
                {zoom > 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: 12,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'rgba(10, 10, 15, 0.7)',
                      color: '#fef3c7',
                      fontSize: 12,
                      fontWeight: 700,
                      backdropFilter: 'blur(6px)',
                      WebkitBackdropFilter: 'blur(6px)',
                      pointerEvents: 'none',
                    }}
                  >
                    {`${zoom.toFixed(1)}x`}
                  </div>
                )}
              </div>
              <div style={{ padding: 20 }}>
                <h4 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
                  {activePhoto.title || '무제'}
                </h4>
                {activePhoto.filmSite && (
                  <p
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      color: '#cfcfcf',
                      margin: '0 0 6px',
                    }}
                  >
                    <MapPin size={14} style={{ color: '#a855f7' }} />
                    {activePhoto.filmSite}
                  </p>
                )}
                <p style={{ fontSize: 12, color: '#888', margin: '0 0 12px' }}>
                  {activePhoto.photographer && <span>작가: {activePhoto.photographer} · </span>}
                  {activePhoto.award && <span>{activePhoto.award}</span>}
                  {activePhoto.filmDay && <span> · 촬영 {formatFilmDay(activePhoto.filmDay)}</span>}
                </p>
                {activePhoto.keywords && (
                  <p style={{ fontSize: 11, color: '#666', margin: 0, lineHeight: 1.5 }}>
                    {activePhoto.keywords}
                  </p>
                )}
                <p style={{ fontSize: 10, color: '#444', marginTop: 10 }}>
                  © 한국관광공사 포토코리아 관광공모전
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function formatFilmDay(filmDay) {
  if (!filmDay) return '';
  if (filmDay.length === 6) return `${filmDay.slice(0, 4)}.${filmDay.slice(4, 6)}`;
  if (filmDay.length === 8)
    return `${filmDay.slice(0, 4)}.${filmDay.slice(4, 6)}.${filmDay.slice(6, 8)}`;
  return filmDay;
}
