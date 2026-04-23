'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadKakaoMapsSdk } from '@/lib/kakaoMapLoader';
import CultureMapLayer from '@/components/CultureMapLayer';

const KOREA_CENTER = { lat: 36.5, lng: 127.5 };
const DEFAULT_ZOOM = 10; // Kakao 레벨 1(가까움) ~ 14(멂)
const NEARBY_ZOOM = 6;

// 색상 톤의 커스텀 마커 (SVG data URL).
// Leaflet 때 사용한 3색 핀(초록=영업, 빨강=폐업, 파랑=내 위치) 톤을 유지.
function svgPin(color, ringColor = '#ffffff') {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='28' height='40' viewBox='0 0 28 40'>
  <defs>
    <filter id='s' x='-20%' y='-10%' width='140%' height='140%'>
      <feDropShadow dx='0' dy='1.5' stdDeviation='1.2' flood-color='#000' flood-opacity='0.35'/>
    </filter>
  </defs>
  <path filter='url(#s)' fill='${color}' stroke='${ringColor}' stroke-width='1.6'
    d='M14 1.6 C 6.7 1.6 1.8 6.9 1.8 13.6 C 1.8 22.4 13 38 14 38 C 15 38 26.2 22.4 26.2 13.6 C 26.2 6.9 21.3 1.6 14 1.6 Z'/>
  <circle cx='14' cy='13.6' r='4.3' fill='${ringColor}'/>
</svg>`.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ICONS = {
  open: { url: svgPin('#22c55e'), size: [28, 40], anchor: [14, 38] },
  closed: { url: svgPin('#ef4444'), size: [28, 40], anchor: [14, 38] },
  me: { url: svgPin('#3b82f6'), size: [32, 44], anchor: [16, 42] },
};

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * DVD 매장 지도 컴포넌트 (Kakao Maps 기반).
 * - props.stores: 표시할 매장 배열
 * - props.userPos: { lat, lon } 내 위치 (있으면 파란 핀)
 * - props.nearbyMode: 주변 찾기 모드일 때 좀 더 확대
 * - props.cultureLayer: 'off' | 'stores' | 'tourDemand' | 'cultural' | 'search'
 */
export default function KakaoStoreMap({ stores, userPos, nearbyMode, cultureLayer = 'off' }) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const infoWindowRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const mappable = useMemo(
    () => (stores || []).filter((s) => s.latitude && s.longitude),
    [stores]
  );

  // SDK 로드 + 맵 생성
  useEffect(() => {
    let disposed = false;
    loadKakaoMapsSdk()
      .then((kakao) => {
        if (disposed || !containerRef.current) return;
        const center = userPos
          ? new kakao.maps.LatLng(userPos.lat, userPos.lon)
          : mappable.length > 0
            ? new kakao.maps.LatLng(mappable[0].latitude, mappable[0].longitude)
            : new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng);
        const map = new kakao.maps.Map(containerRef.current, {
          center,
          level: nearbyMode ? NEARBY_ZOOM : DEFAULT_ZOOM,
        });
        map.addControl(
          new kakao.maps.ZoomControl(),
          kakao.maps.ControlPosition.RIGHT
        );
        map.addControl(
          new kakao.maps.MapTypeControl(),
          kakao.maps.ControlPosition.TOPRIGHT
        );
        mapRef.current = map;
        infoWindowRef.current = new kakao.maps.InfoWindow({ removable: true, zIndex: 3 });
        setReady(true);
      })
      .catch((e) => {
        console.error('[kakao-maps] load failed:', e);
        if (!disposed) setError(e?.message || 'Kakao Maps 로드 실패');
      });
    return () => {
      disposed = true;
      if (infoWindowRef.current) {
        try {
          infoWindowRef.current.close();
        } catch (_) {
          /* noop */
        }
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null);
        userMarkerRef.current = null;
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 컨테이너 크기 바뀌면 리레이아웃
  useEffect(() => {
    if (!ready || !mapRef.current || typeof window === 'undefined') return;
    const kakao = window.kakao;
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.relayout();
    });
    ro.observe(containerRef.current);
    setTimeout(() => {
      mapRef.current.relayout();
      if (kakao) fitBounds(kakao, mapRef.current, mappable, userPos);
    }, 120);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // 마커 다시 그리기
  useEffect(() => {
    if (!ready || typeof window === 'undefined' || !window.kakao) return;
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    mappable.forEach((store, idx) => {
      const isOpen = store.statusCode === '01';
      const icon = isOpen ? ICONS.open : ICONS.closed;
      const markerImage = new kakao.maps.MarkerImage(
        icon.url,
        new kakao.maps.Size(icon.size[0], icon.size[1]),
        { offset: new kakao.maps.Point(icon.anchor[0], icon.anchor[1]) }
      );
      const position = new kakao.maps.LatLng(store.latitude, store.longitude);
      const marker = new kakao.maps.Marker({
        position,
        image: markerImage,
        title: store.businessName || '',
      });
      marker.setMap(map);

      kakao.maps.event.addListener(marker, 'click', () => {
        if (!infoWindowRef.current) return;
        infoWindowRef.current.setContent(renderStoreInfo(store, t));
        infoWindowRef.current.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    // 내 위치 마커
    if (userPos) {
      if (!userMarkerRef.current) {
        const meImage = new kakao.maps.MarkerImage(
          ICONS.me.url,
          new kakao.maps.Size(ICONS.me.size[0], ICONS.me.size[1]),
          { offset: new kakao.maps.Point(ICONS.me.anchor[0], ICONS.me.anchor[1]) }
        );
        userMarkerRef.current = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(userPos.lat, userPos.lon),
          image: meImage,
          zIndex: 10,
        });
        kakao.maps.event.addListener(userMarkerRef.current, 'click', () => {
          if (!infoWindowRef.current) return;
          infoWindowRef.current.setContent(
            `<div style="padding:8px 10px;font-size:12px;font-weight:700;">${escapeHtml(
              t('dvdStores.myLocation')
            )}</div>`
          );
          infoWindowRef.current.open(map, userMarkerRef.current);
        });
      } else {
        userMarkerRef.current.setPosition(
          new kakao.maps.LatLng(userPos.lat, userPos.lon)
        );
      }
      userMarkerRef.current.setMap(map);
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    // 포커스 조정
    fitBounds(kakao, map, mappable, userPos, nearbyMode);
  }, [ready, mappable, userPos, nearbyMode, t]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#f0ede6',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: 520 }} />

      {ready && mapRef.current && cultureLayer !== 'off' && (
        <CultureMapLayer layer={cultureLayer} map={mapRef.current} />
      )}

      {!ready && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            fontSize: 13,
          }}
        >
          {t('dvdStores.loading')}
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 13,
            textAlign: 'center',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700, color: '#fca5a5' }}>카카오 지도 로드 실패</div>
          <div style={{ opacity: 0.8, maxWidth: 420 }}>{error}</div>
          <div style={{ opacity: 0.6, fontSize: 11 }}>
            개발자 콘솔의 &quot;플랫폼 &gt; Web&quot;에 현재 도메인이 등록되어 있는지 확인해주세요.
          </div>
        </div>
      )}

      {mappable.length < stores.length && (
        <div
          style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.04)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
          }}
        >
          {t('dvdStores.mapCoordInfo', { shown: mappable.length, total: stores.length })}
        </div>
      )}
    </div>
  );
}

function fitBounds(kakao, map, points, userPos, nearbyMode) {
  if (!kakao || !map) return;
  const bounds = new kakao.maps.LatLngBounds();
  let count = 0;
  points.forEach((s) => {
    if (s.latitude && s.longitude) {
      bounds.extend(new kakao.maps.LatLng(s.latitude, s.longitude));
      count += 1;
    }
  });
  if (userPos) {
    bounds.extend(new kakao.maps.LatLng(userPos.lat, userPos.lon));
    count += 1;
  }
  if (count === 0) return;
  if (count === 1) {
    map.setLevel(nearbyMode ? NEARBY_ZOOM : 5);
    const only = userPos || points[0];
    map.setCenter(
      new kakao.maps.LatLng(only.lat ?? only.latitude, only.lon ?? only.longitude)
    );
    return;
  }
  map.setBounds(bounds, 40, 40, 40, 40);
}

function renderStoreInfo(store, t) {
  const isOpen = store.statusCode === '01';
  const addr = store.roadAddress || store.jibunAddress || '';
  const distHtml =
    store.distance != null
      ? `<span style="color:#ea580c;margin-left:6px;font-weight:600;">${
          store.distance < 1
            ? Math.round(store.distance * 1000) + 'm'
            : store.distance.toFixed(1) + 'km'
        }</span>`
      : '';
  const statusText =
    store.statusName || (isOpen ? t('dvdStores.operating') : t('dvdStores.closed'));
  const statusColor = isOpen ? '#d97706' : '#dc2626';

  const mapUrl = addr
    ? `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`
    : '';

  return `
    <div style="min-width:200px;max-width:280px;padding:10px 12px;font-size:12px;line-height:1.5;color:#222;">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(
        store.businessName || t('dvdStores.unregistered')
      )}</div>
      <div style="font-size:12px;color:${statusColor};font-weight:600;margin-bottom:4px;">
        ${escapeHtml(statusText)}${distHtml}
      </div>
      ${addr ? `<div style="font-size:11px;color:#555;margin-bottom:2px;">${escapeHtml(addr)}</div>` : ''}
      ${store.phone ? `<div style="font-size:11px;color:#555;">Tel: ${escapeHtml(store.phone)}</div>` : ''}
      ${store.productInfo ? `<div style="font-size:11px;color:#555;">${escapeHtml(t('dvdStores.productsLabel'))}: ${escapeHtml(store.productInfo)}</div>` : ''}
      ${store.businessType ? `<div style="font-size:11px;color:#555;">${escapeHtml(t('dvdStores.businessType'))}: ${escapeHtml(store.businessType)}</div>` : ''}
      ${
        mapUrl
          ? `<div style="margin-top:6px;"><a href="${mapUrl}" target="_blank" rel="noopener" style="color:#ea580c;font-size:11px;text-decoration:none;font-weight:600;">카카오맵에서 길찾기 →</a></div>`
          : ''
      }
    </div>
  `;
}
