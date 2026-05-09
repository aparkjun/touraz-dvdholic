'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun } from 'lucide-react';
import axios from '@/lib/axiosConfig';

export function getGeoOnce() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const done = (v) => resolve(v);
    const timer = setTimeout(() => done(null), 2600);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        done(p);
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { enableHighAccuracy: false, maximumAge: 420000, timeout: 2500 }
    );
  });
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = parseInt(String(v).replace(/[^\d.-]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

function hourFromTime(t4) {
  const h = parseInt(String(t4).slice(0, 2), 10);
  return Number.isNaN(h) ? null : h;
}

/** 동일 fcstDate+fcstTime 행 병합 (TMP·POP·PTY·SKY 가 흩어져 올 때 대비) */
export function mergeSeriesBySlot(rawSeries) {
  if (!Array.isArray(rawSeries)) return [];
  const map = new Map();
  for (const raw of rawSeries) {
    if (!raw || typeof raw !== 'object') continue;
    const date = String(raw.fcstDate ?? raw.FCST_DATE ?? raw.fcst_date ?? '').replace(/\D/g, '');
    const timeRaw = String(raw.fcstTime ?? raw.FCST_TIME ?? raw.fcst_time ?? '').replace(/\D/g, '');
    const time = timeRaw.length >= 3 ? timeRaw.padStart(4, '0') : '';
    if (date.length !== 8 || time.length !== 4) continue;
    const key = `${date}|${time}`;
    const prev = map.get(key) || { date, time };
    const pop = toNum(raw.POP ?? raw.pop);
    const ptyRaw = raw.PTY ?? raw.pty;
    const tmp = toNum(raw.TMP ?? raw.tmp ?? raw.T1H ?? raw.TM ?? raw.t1h);
    const skyRaw = raw.SKY ?? raw.sky;

    const next = { ...prev };
    if (pop != null) next.pop = next.pop == null ? pop : Math.max(next.pop, pop);
    if (ptyRaw != null && String(ptyRaw) !== '') {
      const ps = String(ptyRaw);
      if (!next.pty || next.pty === '0') next.pty = ps;
      else if (ps !== '0') next.pty = ps;
    }
    if (tmp != null) next.tmp = tmp;
    if (skyRaw != null && skyRaw !== '') next.sky = String(skyRaw);
    map.set(key, next);
  }
  return Array.from(map.values()).sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.time.localeCompare(b.time);
  });
}

function normalizeRowFromMerged(row) {
  if (!row || !row.date || !row.time) return null;
  return {
    date: row.date,
    time: row.time,
    pop: row.pop ?? null,
    pty: row.pty != null ? String(row.pty) : '0',
  };
}

function isWetPty(pty) {
  const p = String(pty);
  return p !== '0' && p !== '';
}

function isRainyRow(row) {
  if (!row) return false;
  if (row.pop != null && row.pop >= 45) return true;
  if (isWetPty(row.pty)) return true;
  return false;
}

function nowYyyymmddHour(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { yyyymmdd: `${y}${m}${day}`, hour: d.getHours() };
}

function iconForMergedRow(row) {
  if (isRainyRow(row)) {
    return {
      Icon: CloudRain,
      iconProps: { strokeWidth: 1.5, color: '#0369a1' },
    };
  }
  const sk = String(row.sky ?? '');
  if (sk === '1') {
    return {
      Icon: Sun,
      iconProps: { strokeWidth: 1.5, color: '#ca8a04' },
    };
  }
  return {
    Icon: Cloud,
    iconProps: { strokeWidth: 1.5, color: '#64748b' },
  };
}

/**
 * @returns {{ slots: Array<{ date: string, time: string, hour: number, tmp: number|null, wet: boolean, Icon: import('react').ComponentType, iconProps: object }>, source?: 'vsrt'|'shortReg' }}
 */
export function buildTravelWeatherTimeline(series, opts = {}) {
  const maxSlots = opts.maxSlots ?? 8;
  const vsrt = opts.vsrtHourly;
  if (Array.isArray(vsrt) && vsrt.length > 0) {
    const mergedShort = mergeSeriesBySlot(Array.isArray(series) ? series : []);
    const byKey = new Map(mergedShort.map((r) => [`${r.date}|${r.time}`, r]));
    const slots = [];
    for (const raw of vsrt.slice(0, maxSlots)) {
      const date = String(raw.fcstDate ?? '').replace(/\D/g, '');
      const timeRaw = String(raw.fcstTime ?? '').replace(/\D/g, '');
      const time = timeRaw.length >= 3 ? timeRaw.padStart(4, '0') : '';
      if (date.length !== 8 || time.length !== 4) continue;
      const h = hourFromTime(time);
      if (h == null) continue;
      const extra = byKey.get(`${date}|${time}`) || {};
      const row = {
        date,
        time,
        pop: extra.pop ?? null,
        pty: raw.PTY != null ? String(raw.PTY) : extra.pty != null ? String(extra.pty) : '0',
        tmp: toNum(raw.TMP ?? raw.tmp ?? raw.T1H) ?? extra.tmp ?? null,
        sky: extra.sky,
      };
      const { Icon, iconProps } = iconForMergedRow(row);
      slots.push({
        date,
        time,
        hour: h,
        tmp: row.tmp != null ? row.tmp : null,
        wet: isRainyRow(row),
        Icon,
        iconProps,
      });
    }
    if (slots.length) return { slots, source: 'vsrt' };
  }

  const now = opts.now ?? new Date();
  const merged = mergeSeriesBySlot(series);
  if (merged.length === 0) return { slots: [] };

  const nowParts = nowYyyymmddHour(now);
  let upcoming = merged.filter((s) => {
    if (s.date > nowParts.yyyymmdd) return true;
    if (s.date < nowParts.yyyymmdd) return false;
    const h = hourFromTime(s.time);
    return h != null && h >= nowParts.hour;
  });
  if (upcoming.length === 0) upcoming = merged.slice(0, maxSlots);

  const slice = upcoming.slice(0, maxSlots);
  const slots = [];
  for (const row of slice) {
    const h = hourFromTime(row.time);
    if (h == null) continue;
    const { Icon, iconProps } = iconForMergedRow(row);
    slots.push({
      date: row.date,
      time: row.time,
      hour: h,
      tmp: row.tmp != null ? row.tmp : null,
      wet: isRainyRow(row),
      Icon,
      iconProps,
    });
  }
  return { slots, source: slots.length ? 'shortReg' : undefined };
}

/** 스크린리더용 — 시각·기온·강수 여부 요약 */
export function formatTimelineAria(slots) {
  if (!slots || !slots.length) return '';
  return slots
    .slice(0, 8)
    .map((s) => {
      let p = `${s.hour}시`;
      if (s.tmp != null) p += ` ${s.tmp}도`;
      if (s.wet) p += ' 비 또는 눈 가능';
      return p;
    })
    .join(', ');
}

function dayLabel(yyyymmdd, t) {
  if (yyyymmdd.length !== 8) return '';
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const mo = parseInt(yyyymmdd.slice(4, 6), 10) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const target = new Date(y, mo, d);
  const now = new Date();
  const z = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diff = Math.round((z(target) - z(now)) / 86400000);
  if (diff === 0) return t('travelWeather.dayToday', '오늘');
  if (diff === 1) return t('travelWeather.dayTomorrow', '내일');
  if (diff === 2) return t('travelWeather.dayAfter', '모레');
  return `${mo + 1}/${d}`;
}

function flattenFirstForecastLike(node, depth = 0) {
  if (depth > 8 || node == null || typeof node !== 'object') return {};
  const keys = ['POP', 'pop', 'PTY', 'pty', 'TMP', 'tmp', 'T1H'];
  const out = {};
  for (const k of keys) {
    if (node[k] != null && node[k] !== '') out[k] = node[k];
  }
  if (Object.keys(out).length) return out;
  if (Array.isArray(node)) {
    for (const item of node) {
      const inner = flattenFirstForecastLike(item, depth + 1);
      if (Object.keys(inner).length) return inner;
    }
    return {};
  }
  for (const v of Object.values(node)) {
    const inner = flattenFirstForecastLike(v, depth + 1);
    if (Object.keys(inner).length) return inner;
  }
  return {};
}

/**
 * @returns {{ kind: 'rain'|'dry'|'maybe'|'vague'|'idle', Icon: import('react').ComponentType, iconProps: object, chipDay?: string, chipHours?: string, ariaLabel: string }}
 */
export function deriveTravelWeatherPresentation(series, payload, t) {
  if (Array.isArray(series) && series.length) {
    const merged = mergeSeriesBySlot(series);
    const rows = merged.map(normalizeRowFromMerged).filter(Boolean).sort((a, b) => {
      const c = a.date.localeCompare(b.date);
      return c !== 0 ? c : a.time.localeCompare(b.time);
    });
    const wet = rows.filter(isRainyRow);
    if (!wet.length) {
      return {
        kind: 'dry',
        Icon: Sun,
        iconProps: { strokeWidth: 1.5, color: '#ca8a04', style: { filter: 'drop-shadow(0 1px 2px rgba(202,138,4,0.25))' } },
        ariaLabel: t('travelWeather.ariaDry', '가까운 예보에서 강수는 없어 보입니다. 야외 일정 참고용입니다.'),
      };
    }
    const byDate = {};
    for (const r of wet) {
      byDate[r.date] = byDate[r.date] || [];
      byDate[r.date].push(r);
    }
    const dates = Object.keys(byDate).sort();
    const first = dates[0];
    const slots = byDate[first].sort((a, b) => a.time.localeCompare(b.time));
    const h0 = hourFromTime(slots[0].time);
    const h1 = hourFromTime(slots[slots.length - 1].time);
    const endHour = h1 != null ? Math.min(23, h1 + 3) : h0 != null ? h0 + 3 : null;
    const day = dayLabel(first, t);
    if (h0 != null && endHour != null) {
      return {
        kind: 'rain',
        Icon: CloudRain,
        iconProps: { strokeWidth: 1.65, color: '#0369a1', style: { filter: 'drop-shadow(0 2px 6px rgba(3,105,161,0.2))' } },
        chipDay: day,
        chipHours: `${h0}–${endHour}`,
        ariaLabel: t('travelWeather.ariaRainWindow', '{{day}} {{from}}시부터 {{to}}시 사이 비 가능성이 있습니다.', {
          day,
          from: h0,
          to: endHour,
        }),
      };
    }
    return {
      kind: 'vague',
      Icon: CloudRain,
      iconProps: { strokeWidth: 1.65, color: '#475569', opacity: 0.9 },
      chipDay: day,
      ariaLabel: t('travelWeather.ariaRainVague', '{{day}} 강수 가능성이 있습니다.', { day }),
    };
  }

  const flat = flattenFirstForecastLike(payload);
  const pop = toNum(flat.POP ?? flat.pop);
  const pty = flat.PTY ?? flat.pty;
  if (isWetPty(pty) || (pop != null && pop >= 45)) {
    return {
      kind: 'maybe',
      Icon: CloudRain,
      iconProps: { strokeWidth: 1.65, color: '#0369a1' },
      chipHours: pop != null ? `${pop}%` : undefined,
      ariaLabel:
        pop != null
          ? t('travelWeather.ariaRainMaybePop', '강수 확률 {{n}}퍼센트입니다.', { n: pop })
          : t('travelWeather.ariaRainMaybe', '강수 가능성이 있습니다. 시간대는 기상청 발표를 확인해 주세요.'),
    };
  }
  if (pop != null) {
    return {
      kind: 'dry',
      Icon: Sun,
      iconProps: { strokeWidth: 1.5, color: '#ca8a04' },
      chipHours: `${pop}%`,
      ariaLabel: t('travelWeather.ariaDryPop', '강수 확률 {{n}}퍼센트입니다.', { n: pop }),
    };
  }
  return {
    kind: 'dry',
    Icon: Cloud,
    iconProps: { strokeWidth: 1.5, color: '#64748b' },
    ariaLabel: t('travelWeather.ariaDryNeutral', '특별한 강수 예보는 없습니다.'),
  };
}

export function useTravelWeatherShortReg() {
  const [state, setState] = useState({ phase: 'loading', data: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      const pos = await getGeoOnce();
      const params = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {};
      try {
        const res = await axios.get('/api/v1/weather/short-reg', { params });
        const d = res?.data?.data;
        if (!alive) return;
        setState({ phase: 'ready', data: d || null });
      } catch {
        if (!alive) return;
        setState({ phase: 'error', data: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
