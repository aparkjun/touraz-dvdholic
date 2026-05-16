'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, Loader2 } from 'lucide-react';
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

function derivePickFromPayload(d) {
  const series = resolveSeriesForWeatherTimeline(d);
  const tl = buildTravelWeatherTimeline(series, {
    maxSlots: 6,
    vsrtHourly: d?.vsrtHourly,
    skipVsrt: false,
  });
  const s = tl.slots?.[0];
  return s ? { Icon: s.Icon, iconProps: s.iconProps, tmp: s.tmp } : null;
}

/**
 * 광역 코드·행정명·좌표 중 하나로 기상청 단기/초단기 첫 슬롯 날씨 아이콘 표시.
 * 뷰포트 진입 후 로드(칩 다수 화면에서 요청 폭주 완화).
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
}) {
  const { t } = useTranslation();
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState('idle');
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
    const el = wrapRef.current;
    if (!el || !query) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: '100px', threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  useEffect(() => {
    if (!visible || !query) return undefined;
    const key = cacheKeyForQuery(query);
    if (!key) return undefined;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      setPick(hit.pick);
      setPhase('ready');
      return undefined;
    }

    let alive = true;
    setPhase('loading');

    let promise = inflight.get(key);
    if (!promise) {
      promise = fetchShortRegOnce(query)
        .then((d) => {
          const nextPick = derivePickFromPayload(d);
          cache.set(key, { ts: Date.now(), pick: nextPick });
          return nextPick;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, promise);
    }

    promise
      .then((nextPick) => {
        if (!alive) return;
        setPick(nextPick);
        setPhase(nextPick ? 'ready' : 'idle');
      })
      .catch(() => {
        if (alive) {
          setPick(null);
          setPhase('idle');
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

  const WIcon = pick?.Icon;

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
      }}
    >
      {phase === 'loading' && (
        <Loader2
          size={Math.max(12, size - 4)}
          className="animate-spin"
          style={{ opacity: 0.65, color: 'rgba(148,163,184,0.95)' }}
          aria-hidden
        />
      )}
      {phase !== 'loading' && WIcon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            padding: 3,
            background: 'rgba(15,23,42,0.45)',
            border: '1px solid rgba(148,163,184,0.35)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <WIcon size={size} {...(pick.iconProps || {})} aria-hidden />
        </span>
      )}
      {phase === 'ready' && !WIcon && (
        <span
          style={{
            display: 'inline-flex',
            padding: 3,
            borderRadius: 999,
            background: 'rgba(15,23,42,0.35)',
            border: '1px solid rgba(148,163,184,0.25)',
          }}
        >
          <Cloud size={size - 2} strokeWidth={1.4} color="#94a3b8" aria-hidden />
        </span>
      )}
    </span>
  );
}
