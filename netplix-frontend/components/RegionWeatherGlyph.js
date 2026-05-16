'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Loader2,
  Sun,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { buildTravelWeatherTimeline, resolveSeriesForWeatherTimeline } from '@/lib/travelWeatherShared';
import { getWeatherQueryForShortcutCode, getWeatherQueryFromAreaNames } from '@/lib/regionCodeToWeatherPreset';
import { useTranslation } from 'react-i18next';

const CACHE_TTL_MS = 12 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

function cacheKeyForQuery(q) {
  if (!q?.reg && q?.lat == null) return '';
  const lat = q.lat != null ? Number(q.lat).toFixed(3) : '';
  const lng = q.lng != null ? Number(q.lng).toFixed(3) : '';
  return `w:${q.reg || ''}:${lat}:${lng}`;
}

async function fetchShortRegOnce(params) {
  const sets = [];
  if (params.reg && params.lat != null && params.lng != null) {
    sets.push({ reg: params.reg, lat: params.lat, lng: params.lng });
  }
  if (params.reg) sets.push({ reg: params.reg });
  if (params.lat != null && params.lng != null) {
    sets.push({ lat: params.lat, lng: params.lng });
  }
  let lastErr;
  for (const p of sets) {
    try {
      const res = await axios.get('/api/v1/weather/short-reg', { params: p, timeout: 28000 });
      const body = res?.data;
      if (body && body.success === false) continue;
      const d = body?.data;
      if (d != null && typeof d === 'object') return d;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

/** 기상 앱 스타일: 원·배경 없이 라인 아이콘만 */
function simpleGlyphProps(Icon, onLight) {
  const strokeWidth = 1.85;
  if (onLight) {
    if (Icon === Sun) return { stroke: '#b45309', strokeWidth };
    if (Icon === CloudSun) return { stroke: '#78716c', strokeWidth };
    if (Icon === CloudRain || Icon === CloudDrizzle) return { stroke: '#0369a1', strokeWidth };
    if (Icon === CloudSnow) return { stroke: '#475569', strokeWidth };
    if (Icon === CloudLightning) return { stroke: '#a16207', strokeWidth };
    return { stroke: '#64748b', strokeWidth };
  }
  if (Icon === Sun) return { stroke: '#fde047', strokeWidth };
  if (Icon === CloudSun) return { stroke: '#fefce8', strokeWidth };
  if (Icon === CloudRain || Icon === CloudDrizzle) return { stroke: '#e0f2fe', strokeWidth };
  if (Icon === CloudSnow) return { stroke: '#f8fafc', strokeWidth };
  if (Icon === CloudLightning) return { stroke: '#fef9c3', strokeWidth };
  return { stroke: '#f8fafc', strokeWidth };
}

const FALLBACK_PICK = { Icon: Cloud, tmp: null };

function derivePickFromPayload(d) {
  if (d == null || typeof d !== 'object') return FALLBACK_PICK;
  const series = resolveSeriesForWeatherTimeline(d);
  const tl = buildTravelWeatherTimeline(series, {
    maxSlots: 6,
    vsrtHourly: d?.vsrtHourly,
    skipVsrt: false,
  });
  const s = tl.slots?.[0];
  if (s?.Icon) {
    return { Icon: s.Icon, tmp: s.tmp ?? null };
  }
  return FALLBACK_PICK;
}

/**
 * 광역 코드·행정명·좌표로 오늘 날씨 아이콘 — 원형 배경·테두리 없이 심플 라인 아이콘.
 * @param {'default'|'onLight'} variant — `onLight`: 밝은 칩(시네트립 비선택 등).
 * @param {boolean} eager — true 면 뷰포트 대기 없이 즉시 로드.
 */
export default function RegionWeatherGlyph({
  regionCode,
  areaName,
  signguName,
  reg,
  lat,
  lng,
  size = 18,
  title: titleProp,
  variant = 'default',
  eager = false,
}) {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(eager);
  const [phase, setPhase] = useState(eager ? 'loading' : 'idle');
  const [pick, setPick] = useState(null);

  const query = useMemo(() => {
    if (reg && lat != null && lng != null) return { reg, lat, lng };
    if (reg) return { reg };
    if (lat != null && lng != null) return { lat, lng };
    if (regionCode != null && regionCode !== '') {
      const q = getWeatherQueryForShortcutCode(regionCode);
      if (q) return q;
    }
    if (areaName || signguName) {
      return getWeatherQueryFromAreaNames(areaName, signguName);
    }
    return null;
  }, [regionCode, areaName, signguName, reg, lat, lng]);

  useEffect(() => {
    if (eager) {
      setVisible(true);
      return undefined;
    }
    const el = wrapRef.current;
    if (!el || !query) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: '320px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query, eager]);

  useEffect(() => {
    if (!visible || !query) return undefined;
    const key = cacheKeyForQuery(query);
    if (!key) return undefined;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      setPick(hit.pick ?? FALLBACK_PICK);
      setPhase('ready');
      return undefined;
    }

    let alive = true;
    setPhase((p) => (p === 'ready' ? 'ready' : 'loading'));

    let promise = inflight.get(key);
    if (!promise) {
      promise = fetchShortRegOnce(query)
        .then((d) => {
          const nextPick = derivePickFromPayload(d);
          cache.set(key, { ts: Date.now(), pick: nextPick });
          return nextPick;
        })
        .catch(() => FALLBACK_PICK)
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, promise);
    }

    promise
      .then((nextPick) => {
        if (!alive) return;
        setPick(nextPick ?? FALLBACK_PICK);
        setPhase('ready');
      })
      .catch(() => {
        if (alive) {
          setPick(FALLBACK_PICK);
          setPhase('ready');
        }
      });

    return () => {
      alive = false;
    };
  }, [visible, query]);

  if (!query) return null;

  const title =
    titleProp ||
    (pick?.tmp != null
      ? t('travelWeather.widgetGlyphTitle', '{{tmp}}° · 오늘 날씨', { tmp: pick.tmp })
      : t('travelWeather.navWeather', '날씨'));

  const onLight = variant === 'onLight';
  const WIcon = pick?.Icon ?? Cloud;
  const glyphProps = simpleGlyphProps(WIcon, onLight);
  const loaderColor = onLight ? '#94a3b8' : 'rgba(248,250,252,0.55)';

  return (
    <span
      ref={wrapRef}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      {phase === 'loading' ? (
        <Loader2
          size={Math.max(12, size - 2)}
          className="animate-spin"
          stroke={loaderColor}
          strokeWidth={1.75}
          aria-hidden
        />
      ) : (
        <WIcon size={size} {...glyphProps} aria-hidden />
      )}
    </span>
  );
}
