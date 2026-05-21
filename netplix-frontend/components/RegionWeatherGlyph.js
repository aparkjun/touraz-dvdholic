'use client';

/**
 * CineTrip 지역 칩 날씨 아이콘 정의:
 * - 지역마다 아이콘 1개 = 해당 지역 격자 기준 KST **현재 시각(1시간 구간) 초단기예보(vsrtHourly)** 의 맑음/비/눈·기온
 * - 정각이 바뀌면(예: 16시→17시) 다음 조회·갱신 시 그 시간대 예보 아이콘으로 바뀜 (시간대별 스트립 UI 아님)
 */

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
import {
  buildWeatherGlyphPickFromPayload,
  buildWeatherGlyphTooltip,
  kstHourBucket,
  stateLabelFromWeatherIcon,
  weatherGlyphStrokeProps,
} from '@/lib/travelWeatherShared';
import { getWeatherQueryForShortcutCode, getWeatherQueryFromAreaNames } from '@/lib/regionCodeToWeatherPreset';
import { useTranslation } from 'react-i18next';

const CACHE_TTL_MS = 6 * 60 * 1000;
const GLYPH_FETCH_TIMEOUT_MS = 12_000;
const cache = new Map();
const inflight = new Map();

function cacheKeyForQuery(q) {
  const hour = kstHourBucket();
  if (!q) return '';
  if (q.reg) return `w7:${q.reg}:${hour}`;
  const lat = q.lat != null ? Number(q.lat).toFixed(3) : '';
  const lng = q.lng != null ? Number(q.lng).toFixed(3) : '';
  return `w7:geo:${lat}:${lng}:${hour}`;
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

/** 칩 아이콘용 — 단기 series + 초단기 vsrt 전체 필드(SKY·PTY·POP·PCP·REH·WSD) */
async function fetchShortRegForGlyph(params) {
  const p =
    params.reg && params.lat != null && params.lng != null
      ? { reg: params.reg, lat: params.lat, lng: params.lng }
      : params.reg
        ? { reg: params.reg }
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
        timeout: 22_000,
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


const FALLBACK_PICK = { Icon: Cloud, tmp: null, stateLabel: null };

function derivePickFromPayload(d, t) {
  if (d == null || typeof d !== 'object') return FALLBACK_PICK;
  const built = buildWeatherGlyphPickFromPayload(d, { maxSlots: 12, t });
  if (built?.Icon) {
    return built;
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
  const [hourBucket, setHourBucket] = useState(() => kstHourBucket());

  /** KST 정각이 바뀌면 캐시 키가 달라지므로 아이콘을 다시 받음 */
  useEffect(() => {
    const tick = () => {
      const next = kstHourBucket();
      setHourBucket((prev) => (prev !== next ? next : prev));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

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
  }, [visible, query, t, hourBucket]);

  if (!query) return null;

  const title =
    titleProp ||
    buildWeatherGlyphTooltip(pick, t) ||
    (pick?.Icon ? stateLabelFromWeatherIcon(pick.Icon, pick, t) : '') ||
    t('travelWeather.navWeather', '날씨');

  const onLight = variant === 'onLight';
  const WIcon = pick?.Icon;
  const glyphProps = WIcon
    ? { ...weatherGlyphStrokeProps(WIcon, onLight ? 'light' : 'dark'), ...pick.iconProps }
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
          {...weatherGlyphStrokeProps(Cloud, onLight ? 'light' : 'dark')}
          aria-hidden
          style={{ opacity: 0.35 }}
        />
      )}
    </span>
  );
}
