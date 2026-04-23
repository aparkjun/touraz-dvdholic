'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '@/lib/axiosConfig';

// 지역별 사진 프리뷰 캐시 (탭 생명주기 동안 유지).
const photoCache = new Map();

async function fetchRegionPhotos(areaCode) {
  if (photoCache.has(areaCode)) return photoCache.get(areaCode);
  try {
    const res = await axios.get(
      `/api/v1/cine-trip/photos?areaCode=${encodeURIComponent(areaCode)}&limit=3`
    );
    const list = Array.isArray(res?.data?.data) ? res.data.data : [];
    photoCache.set(areaCode, list);
    return list;
  } catch {
    photoCache.set(areaCode, []);
    return [];
  }
}

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
 * 문화 × 관광 지도 오버레이 (Kakao Maps 버전)
 * - 부모 컴포넌트가 가진 `map` 인스턴스를 prop 으로 받아 Circle + InfoWindow 를 그린다.
 * - layer: 'stores' | 'tourDemand' | 'cultural' | 'search'
 */
export default function CultureMapLayer({ layer = 'stores', map }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState([]);
  const [tour, setTour] = useState([]);
  const [loading, setLoading] = useState(true);
  const circlesRef = useRef([]);
  const infoRef = useRef(null);

  // 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [a, b] = await Promise.all([
          axios.get('/api/v1/dvd-stores/stats/by-region'),
          axios.get('/api/v1/tour/regions').catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        setStats(a.data?.data || []);
        setTour(b.data?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tourByArea = useMemo(() => {
    const m = new Map();
    for (const r of tour) m.set(r.areaCode, r);
    return m;
  }, [tour]);

  const maxStores = useMemo(
    () => stats.reduce((m, r) => Math.max(m, Number(r.totalCount || 0)), 1),
    [stats]
  );
  const maxSearch = useMemo(
    () => tour.reduce((m, r) => Math.max(m, Number(r.searchVolume || 0)), 1),
    [tour]
  );

  const points = useMemo(() => {
    return stats
      .filter((r) => r.avgLatitude != null && r.avgLongitude != null)
      .map((r) => {
        const tr = tourByArea.get(r.areaCode);
        return {
          areaCode: r.areaCode,
          lat: Number(r.avgLatitude),
          lon: Number(r.avgLongitude),
          totalCount: Number(r.totalCount || 0),
          operatingCount: Number(r.operatingCount || 0),
          closedCount: Number(r.closedCount || 0),
          regionName: tr?.regionName || r.areaCode,
          tourDemandIdx: tr?.tourDemandIdx,
          culturalResourceDemand: tr?.culturalResourceDemand,
          searchVolume: tr?.searchVolume,
        };
      });
  }, [stats, tourByArea]);

  // 기존 Circle 제거 함수
  const clearCircles = () => {
    circlesRef.current.forEach((obj) => {
      try {
        obj.circle?.setMap(null);
      } catch (_) {
        /* noop */
      }
    });
    circlesRef.current = [];
  };

  // 레이어 변경 / 데이터 갱신 시 Circle 다시 그리기
  useEffect(() => {
    if (typeof window === 'undefined' || !window.kakao || !map) return;
    const kakao = window.kakao;
    if (loading) return;

    clearCircles();
    if (!infoRef.current) {
      infoRef.current = new kakao.maps.InfoWindow({ removable: true, zIndex: 5 });
    }

    points.forEach((p) => {
      const style = computeStyle(p, layer, maxStores, maxSearch);
      const center = new kakao.maps.LatLng(p.lat, p.lon);
      // Circle 의 단위는 미터. 반경(px 느낌) → km 로 환산한 값을 쓴다. (8~32 px → 3~30km)
      const radiusM = style.radiusKm * 1000;
      const circle = new kakao.maps.Circle({
        center,
        radius: radiusM,
        strokeWeight: 1,
        strokeColor: style.color,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        fillColor: style.fill,
        fillOpacity: 0.45,
      });
      circle.setMap(map);

      kakao.maps.event.addListener(circle, 'click', async () => {
        const info = infoRef.current;
        if (!info) return;
        info.setContent(renderPopupHtml(p, t, /* photos */ null));
        info.setPosition(center);
        info.open(map);
        // 사진 로드 후 재렌더
        const photos = await fetchRegionPhotos(p.areaCode);
        if (info.getMap && info.getMap()) {
          info.setContent(renderPopupHtml(p, t, photos));
        }
      });

      circlesRef.current.push({ circle, areaCode: p.areaCode });
    });

    return () => {
      clearCircles();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, layer, map, loading, maxStores, maxSearch]);

  // InfoWindow 생명주기
  useEffect(() => {
    return () => {
      if (infoRef.current) {
        try {
          infoRef.current.close();
        } catch (_) {
          /* noop */
        }
        infoRef.current = null;
      }
    };
  }, []);

  return null;
}

function renderPopupHtml(p, t, photos) {
  const photoRow =
    photos == null
      ? `<div style="display:flex;gap:4px;margin-top:6px;">
           ${[0, 1, 2]
             .map(
               () =>
                 `<div style="flex:1 1 0;height:44px;border-radius:4px;background:linear-gradient(90deg,#eee 0%,#f6f6f6 50%,#eee 100%);"></div>`
             )
             .join('')}
         </div>`
      : photos.length === 0
        ? ''
        : `<div style="display:flex;gap:4px;margin-top:6px;">
            ${photos
              .slice(0, 3)
              .map(
                (ph) => `
                <a href="/cine-trip?area=${encodeURIComponent(p.areaCode)}"
                   title="${escapeHtml(`${ph.title || ''}${ph.filmSite ? ' · ' + ph.filmSite : ''}`)}"
                   style="flex:1 1 0;height:44px;border-radius:4px;overflow:hidden;display:block;background:#111;">
                  <img src="${escapeHtml(ph.thumbnailUrl || ph.imageUrl || '')}"
                       alt="${escapeHtml(ph.title || '관광 사진')}"
                       loading="lazy"
                       style="width:100%;height:100%;object-fit:cover;display:block;"
                       onerror="this.style.display='none'" />
                </a>
              `
              )
              .join('')}
          </div>`;

  return `
    <div style="min-width:200px;padding:10px 12px;font-size:12px;color:#222;">
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;">${escapeHtml(p.regionName)}</div>
      <div>${escapeHtml(t('cultureMap.regionTotal'))}: <b>${p.totalCount}</b></div>
      <div>${escapeHtml(t('cultureMap.regionOperating'))}: ${p.operatingCount}</div>
      <div>${escapeHtml(t('cultureMap.regionClosed'))}: ${p.closedCount}</div>
      ${
        p.tourDemandIdx != null
          ? `<div>${escapeHtml(t('cultureMap.regionTourIdx'))}: ${p.tourDemandIdx.toFixed(1)}</div>`
          : ''
      }
      ${
        p.culturalResourceDemand != null
          ? `<div>${escapeHtml(t('cultureMap.regionCulture'))}: ${p.culturalResourceDemand.toFixed(1)}</div>`
          : ''
      }
      ${
        p.searchVolume != null
          ? `<div>${escapeHtml(t('cultureMap.regionSearch'))}: ${Number(p.searchVolume).toLocaleString()}</div>`
          : ''
      }
      ${photoRow}
    </div>
  `;
}

function computeStyle(p, layer, maxStores, maxSearch) {
  switch (layer) {
    case 'tourDemand': {
      const v = p.tourDemandIdx ?? 0;
      return {
        radiusKm: 6 + Math.min(1, p.totalCount / maxStores) * 20,
        color: '#f97316',
        fill: heatColor(v / 100),
      };
    }
    case 'cultural': {
      const v = p.culturalResourceDemand ?? 0;
      return {
        radiusKm: 6 + Math.min(1, p.totalCount / maxStores) * 20,
        color: '#8b5cf6',
        fill: heatColorPurple(v / 100),
      };
    }
    case 'search': {
      const v = p.searchVolume ?? 0;
      return {
        radiusKm: 5 + Math.min(1, v / maxSearch) * 25,
        color: '#0ea5e9',
        fill: heatColorBlue(v / maxSearch),
      };
    }
    case 'stores':
    default: {
      const ratio = Math.min(1, p.totalCount / maxStores);
      return {
        radiusKm: 5 + ratio * 25,
        color: '#ea580c',
        fill: heatColor(ratio),
      };
    }
  }
}

function heatColor(v) {
  const r = Math.round(255 * Math.min(1, 0.2 + v));
  const g = Math.round(120 * (1 - v));
  return `rgb(${r}, ${g}, 30)`;
}
function heatColorPurple(v) {
  const r = Math.round(120 + 100 * v);
  const b = Math.round(200 + 55 * v);
  return `rgb(${r}, 60, ${b})`;
}
function heatColorBlue(v) {
  const b = Math.round(200 + 55 * v);
  const g = Math.round(120 + 120 * v);
  return `rgb(30, ${g}, ${b})`;
}
