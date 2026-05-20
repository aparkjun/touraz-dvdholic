'use client';

import { useEffect, useMemo, useState } from 'react';
import { Cloud } from 'lucide-react';
import axios from '@/lib/axiosConfig';
import { useTranslation } from 'react-i18next';
import {
  buildDailyWeatherOutlook,
  weatherGlyphStrokeProps,
} from '@/lib/travelWeatherShared';
import { getWeatherQueryForShortcutCode } from '@/lib/regionCodeToWeatherPreset';

const CACHE_TTL_MS = 6 * 60 * 1000;
const cache = new Map();

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

function iconPropsForDay(day) {
  const base = weatherGlyphStrokeProps(day.Icon, 'dark');
  const fromRow = day.iconProps || {};
  return {
    ...base,
    stroke: fromRow.color || base.stroke,
    strokeWidth: fromRow.strokeWidth ?? base.strokeWidth,
  };
}

function formatTempRange(day) {
  const { minTmp, maxTmp, tmp } = day;
  if (minTmp != null && maxTmp != null && minTmp !== maxTmp) {
    return `${minTmp}° / ${maxTmp}°`;
  }
  if (tmp != null) return `${tmp}°`;
  return '—';
}

function cardStyle(wet) {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 88,
    padding: '12px 10px',
    borderRadius: 16,
    background: wet
      ? 'linear-gradient(160deg, rgba(14,165,233,0.22) 0%, rgba(30,58,138,0.35) 100%)'
      : 'rgba(255,255,255,0.08)',
    border: wet
      ? '1px solid rgba(125,211,252,0.35)'
      : '1px solid rgba(255,255,255,0.12)',
    boxShadow: wet ? '0 4px 20px rgba(14,165,233,0.15)' : 'none',
  };
}

function DayCard({ day, t }) {
  const WIcon = day.Icon || Cloud;
  const props = iconPropsForDay({ ...day, Icon: WIcon });
  const tempLine = formatTempRange(day);
  const popLine =
    day.wetDay && day.maxPop > 0
      ? t('travelWeather.dailyPop', '강수 {{pop}}%', { pop: day.maxPop })
      : null;

  return (
    <div
      title={[day.stateLabel, tempLine, popLine].filter(Boolean).join(' · ')}
      style={cardStyle(day.wetDay)}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.88)' }}>
        {day.dayLabel}
      </span>
      <WIcon size={40} {...props} aria-hidden style={{ flexShrink: 0 }} />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: day.wetDay ? '#7dd3fc' : 'rgba(255,255,255,0.75)',
          textAlign: 'center',
          lineHeight: 1.25,
          maxWidth: 72,
        }}
      >
        {day.stateLabel}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{tempLine}</span>
      {popLine && (
        <span style={{ fontSize: 10, color: 'rgba(125,211,252,0.9)', fontWeight: 600 }}>
          {popLine}
        </span>
      )}
    </div>
  );
}

function WeatherRow({ children }) {
  return (
    <div
      className="cinetrip-scroll-row"
      style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 4,
        margin: '0 -4px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          minWidth: 'min-content',
          padding: '4px 4px 8px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * CineTrip — 날짜마다 맑음·비·눈 등 아이콘 모양이 바뀌는 주간 날씨 스트립.
 */
export default function TravelDailyWeatherStrip({
  regionCode = '1',
  regionLabel = '',
  nationalView = false,
  dayCount = 7,
}) {
  const { t } = useTranslation();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const query = useMemo(
    () => getWeatherQueryForShortcutCode(regionCode || '1'),
    [regionCode]
  );

  useEffect(() => {
    if (!query?.reg) {
      setLoading(false);
      setError(true);
      return;
    }
    const key = `daily2:${query.reg}:${query.lat ?? ''}:${query.lng ?? ''}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setPayload(cached.data);
      setLoading(false);
      setError(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(false);

    fetchShortRegOnce(query)
      .then((data) => {
        if (!alive) return;
        if (data) cache.set(key, { ts: Date.now(), data });
        setPayload(data);
        setError(!data);
      })
      .catch(() => {
        if (!alive) return;
        setPayload(null);
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [query]);

  const days = useMemo(
    () => buildDailyWeatherOutlook(payload, { t, dayCount }),
    [payload, t, dayCount]
  );

  const titleRegion = regionLabel || t('regionShortcuts.1', '서울');
  const title = t('travelWeather.dailyStripTitle', '{{region}} · 주간 날씨', {
    region: titleRegion,
  });

  if (!query?.reg) return null;

  return (
    <section
      aria-label={title}
      style={{
        position: 'relative',
        zIndex: 2,
        margin: '0 auto',
        maxWidth: 1100,
        padding: '0 20px 16px',
      }}
    >
      <h3
        style={{
          margin: '0 0 10px',
          fontSize: 14,
          fontWeight: 800,
          color: 'rgba(255,255,255,0.92)',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        {title}
      </h3>
      {nationalView && (
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
          }}
        >
          {t(
            'travelWeather.dailyStripNationalHint',
            '전국 보기 — 서울 기준 참고 예보입니다'
          )}
        </p>
      )}

      {loading && (
        <WeatherRow>
          {Array.from({ length: Math.min(dayCount, 5) }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </WeatherRow>
      )}

      {!loading && error && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'rgba(255,255,255,0.65)',
            textAlign: 'center',
          }}
        >
          {t('travelWeather.error', '날씨 정보를 불러오지 못했습니다.')}
        </p>
      )}

      {!loading && !error && days.length > 0 && (
        <WeatherRow>
          {days.map((day) => (
            <DayCard key={day.date} day={day} t={t} />
          ))}
        </WeatherRow>
      )}
    </section>
  );
}

function SkeletonCard() {
  return (
    <div style={cardStyle(false)}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.1)',
        }}
      />
      <div
        style={{
          height: 8,
          width: 36,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.12)',
        }}
      />
      <div
        style={{
          height: 8,
          width: 52,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.12)',
        }}
      />
    </div>
  );
}
