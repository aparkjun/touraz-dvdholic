'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { buildWeatherGlyphPickFromPayload } from '@/lib/travelWeatherShared';
import { getWeatherQueryForShortcutCode, getWeatherQueryFromAreaNames } from '@/lib/regionCodeToWeatherPreset';
import { useTranslation } from 'react-i18next';

const CACHE_TTL_MS = 6 * 60 * 1000;
const GLYPH_FETCH_TIMEOUT_MS = 12_000;
const cache = new Map();
const inflight = new Map();

function cacheKeyForQuery(q) {
  if (!q) return '';
  if (q.reg) return `w3:${q.reg}`;
  const lat = q.lat != null ? Number(q.lat).toFixed(3) : '';
  const lng = q.lng != null ? Number(q.lng).toFixed(3) : '';
  return `w3:geo:${lat}:${lng}`;
}

function readCachedPick(query) {
  const key = cacheKeyForQuery(query);
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.pick ?? FALLBACK_PICK;
  }
  return null;
}

function storePick(query, pick) {
  const key = cacheKeyForQuery(query);
  if (!key) return;
  cache.set(key, { ts: Date.now(), pick: pick ?? FALLBACK_PICK });
}

/** 칩 아이콘용 — 1회 요청, 초단기 격자(vsrt) 생략, 짧은 타임아웃 */
async function fetchShortRegForGlyph(params) {
  const p =
    params.reg && params.lat != null && params.lng != null
      ? { reg: params.reg, lat: params.lat, lng: params.lng, glyphOnly: true }
      : params.reg
        ? { reg: params.reg, glyphOnly: true }
        : null;
  if (!p) return null;
  const res = await axios.get('/api/v1/weather/short-reg', { params: p, timeout: GLYPH_FETCH_TIMEOUT_MS });
  const body = res?.data;
  if (body && body.success === false) return null;
  const d = body?.data;
  return d != null && typeof d === 'object' ? d : null;
}

function ensurePickLoaded(query, t) {
  const key = cacheKeyForQuery(query);
  if (!key) return Promise.resolve(FALLBACK_PICK);
  const cached = readCachedPick(query);
  if (cached) return Promise.resolve(cached);

  let promise = inflight.get(key);
  if (!promise) {
    promise = fetchShortRegForGlyph(query)
      .then((d) => {
        const nextPick = derivePickFromPayload(d, t);
        storePick(query, nextPick);
        return nextPick;
      })
      .catch(() => {
        storePick(query, FALLBACK_PICK);
        return FALLBACK_PICK;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, promise);
  }
  return promise;
}

/**
 * CineTrip 등 — 페이지 진입 시 모든 광역 날씨를 한꺼번에 예열(배치 API + 병렬).
 */
export function prefetchRegionWeatherGlyphs(regionCodes, t) {
  if (!Array.isArray(regionCodes) || !regionCodes.length) return Promise.resolve();

  const seen = new Set();
  const queries = [];
  for (const code of regionCodes) {
    const q = getWeatherQueryForShortcutCode(code);
    const key = cacheKeyForQuery(q);
    if (!q?.reg || !key || seen.has(key) || readCachedPick(q)) continue;
    seen.add(key);
    queries.push(q);
  }
  if (!queries.length) return Promise.resolve();

  const regs = [...new Set(queries.map((q) => q.reg).filter(Boolean))];

  const warmFromBatch = async () => {
    if (regs.length < 2) return;
    try {
      const res = await axios.get('/api/v1/weather/short-reg/batch', {
        params: { regs: regs.join(','), glyphOnly: true },
        timeout: 18_000,
      });
      const byReg = res?.data?.data?.byReg;
      if (!byReg || typeof byReg !== 'object') return;
      for (const q of queries) {
        const d = byReg[q.reg];
        if (d) storePick(q, derivePickFromPayload(d, t));
      }
    } catch {
      /* 개별 요청으로 이어짐 */
    }
  };

  const fillMissing = async () => {
    const missing = queries.filter((q) => !readCachedPick(q));
    const BATCH = 5;
    for (let i = 0; i < missing.length; i += BATCH) {
      await Promise.all(missing.slice(i, i + BATCH).map((q) => ensurePickLoaded(q, t)));
    }
  };

  return warmFromBatch().then(fillMissing);
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

function derivePickFromPayload(d, t) {
  if (d == null || typeof d !== 'object') return FALLBACK_PICK;
  const built = buildWeatherGlyphPickFromPayload(d, { maxSlots: 8, t });
  if (built?.Icon) {
    return {
      Icon: built.Icon,
      tmp: built.tmp ?? null,
      stateLabel: built.stateLabel ?? null,
      iconProps: built.iconProps,
    };
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

  const [visible, setVisible] = useState(eager);
  const [pick, setPick] = useState(() => (query ? readCachedPick(query) : null));

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
    if (!query) {
      setPick(null);
      return undefined;
    }
    const cached = readCachedPick(query);
    if (cached) setPick(cached);
  }, [query]);

  useEffect(() => {
    if (!visible || !query) return undefined;
    const cached = readCachedPick(query);
    if (cached) {
      setPick(cached);
      return undefined;
    }

    let alive = true;
    ensurePickLoaded(query, t).then((nextPick) => {
      if (alive) setPick(nextPick ?? FALLBACK_PICK);
    });

    return () => {
      alive = false;
    };
  }, [visible, query, t]);

  if (!query) return null;

  const title =
    titleProp ||
    (pick?.stateLabel && pick?.tmp != null
      ? `${pick.stateLabel} · ${pick.tmp}°`
      : pick?.stateLabel
        ? pick.stateLabel
        : pick?.tmp != null
          ? t('travelWeather.widgetGlyphTitle', '{{tmp}}° · 오늘 날씨', { tmp: pick.tmp })
          : t('travelWeather.navWeather', '날씨'));

  const onLight = variant === 'onLight';
  const WIcon = pick?.Icon;
  const glyphProps = WIcon
    ? pick.iconProps
      ? { ...simpleGlyphProps(WIcon, onLight), ...pick.iconProps }
      : simpleGlyphProps(WIcon, onLight)
    : null;

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
        width: size,
        height: size,
      }}
    >
      {WIcon && glyphProps ? (
        <WIcon size={size} {...glyphProps} aria-hidden />
      ) : (
        <Cloud
          size={size}
          {...simpleGlyphProps(Cloud, onLight)}
          aria-hidden
          style={{ opacity: 0.35 }}
        />
      )}
    </span>
  );
}
