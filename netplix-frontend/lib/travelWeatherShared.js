'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import axios from '@/lib/axiosConfig';

/** 빠른 1회 시도 (다른 화면·테스트용) */
export function getGeoOnce() {
  return geoTryOnce({ enableHighAccuracy: false, maximumAge: 600000, timeoutMs: 3500 });
}

/**
 * 대시보드 날씨용: 먼저 캐시·저전력으로 빠르게 받고, 실패 시 고정밀·긴 타임아웃으로 한 번 더 시도.
 * 허용만 되어 있으면 서버에 lat/lng 전달 → 가장 가까운 단기 reg + 초단시 보조.
 */
export async function getGeoForWeather() {
  let p = await geoTryOnce({ enableHighAccuracy: false, maximumAge: 600000, timeoutMs: 4000 });
  if (p?.coords) return p;
  p = await geoTryOnce({ enableHighAccuracy: true, maximumAge: 120000, timeoutMs: 12000 });
  return p?.coords ? p : null;
}

function geoTryOnce({ enableHighAccuracy, maximumAge, timeoutMs }) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy, maximumAge, timeout: timeoutMs }
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
    sky: row.sky != null ? String(row.sky) : undefined,
    tmp: row.tmp ?? null,
  };
}

/** 기상청 단기 SKY·PTY 코드 → 짧은 하늘·강수 상태 문구 (네비·스트립용) */
export function skyStateLabel(sky, pty, wet, t) {
  const ps = pty != null ? String(pty) : '0';
  if (wet || isWetPty(ps)) {
    if (ps === '1') return t('travelWeather.ptyRain', '비');
    if (ps === '2') return t('travelWeather.ptyRainSnow', '비 또는 눈');
    if (ps === '3') return t('travelWeather.ptySnow', '눈');
    if (ps === '4') return t('travelWeather.ptyShower', '소나기');
    return t('travelWeather.statePrecip', '강수');
  }
  const sk = sky != null ? String(sky) : '';
  if (sk === '1') return t('travelWeather.skyClear', '맑음');
  if (sk === '3') return t('travelWeather.skyMostlyCloud', '구름 많음');
  if (sk === '4') return t('travelWeather.skyOvercast', '흐림');
  return t('travelWeather.skyUnknown', '하늘 상태 미제공');
}

function getFirstUpcomingMergedRow(merged, now = new Date()) {
  if (!Array.isArray(merged) || merged.length === 0) return null;
  const nowParts = nowYyyymmddHour(now);
  const upcoming = merged.filter((s) => {
    if (s.date > nowParts.yyyymmdd) return true;
    if (s.date < nowParts.yyyymmdd) return false;
    const h = hourFromTime(s.time);
    return h != null && h >= nowParts.hour;
  });
  const list = upcoming.length ? upcoming : merged;
  return list[0];
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
    const ps = String(row.pty ?? '0');
    if (ps === '3' || ps === '2') {
      return {
        Icon: CloudSnow,
        iconProps: { strokeWidth: 1.55, color: '#0284c7' },
      };
    }
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
  if (sk === '3') {
    return {
      Icon: CloudSun,
      iconProps: { strokeWidth: 1.45, color: '#ca8a04' },
    };
  }
  if (sk === '4') {
    return {
      Icon: Cloud,
      iconProps: { strokeWidth: 1.5, color: '#475569' },
    };
  }
  return {
    Icon: Cloud,
    iconProps: { strokeWidth: 1.5, color: '#64748b' },
  };
}

/** 기상청 JSON 트리에서 fcstDate+fcstTime 행 후보 추출 (서버 extractor 미스·series 누락 시 보강) */
export function extractForecastRowsFromPayload(payload, depth = 0, acc = null) {
  const out = acc || [];
  if (depth > 14 || payload == null || typeof payload !== 'object') return out;
  if (Array.isArray(payload)) {
    for (const el of payload) extractForecastRowsFromPayload(el, depth + 1, out);
    return out;
  }
  const o = payload;
  const fcstDate = o.fcstDate ?? o.FCST_DATE;
  const fcstTime = o.fcstTime ?? o.FCST_TIME;
  if (fcstDate != null && fcstTime != null) {
    const dateStr = String(fcstDate).replace(/\D/g, '');
    const timeRaw = String(fcstTime).replace(/\D/g, '');
    const timeStr = timeRaw.length >= 3 ? timeRaw.padStart(4, '0') : '';
    const hasMetric =
      o.TMP != null ||
      o.tmp != null ||
      o.T1H != null ||
      o.t1h != null ||
      o.POP != null ||
      o.pop != null ||
      o.SKY != null ||
      o.sky != null ||
      o.PTY != null ||
      o.pty != null;
    if (dateStr.length === 8 && timeStr.length === 4 && hasMetric) {
      out.push({ ...o, fcstDate: dateStr, fcstTime: timeStr });
    }
  }
  for (const v of Object.values(o)) {
    if (v != null && typeof v === 'object') extractForecastRowsFromPayload(v, depth + 1, out);
  }
  return out;
}

/** short-reg 응답에서 단기 시계열용 series 결정 (series 우선, 없으면 payload DFS) */
export function resolveSeriesForWeatherTimeline(weatherData) {
  if (!weatherData) return [];
  if (Array.isArray(weatherData.series) && weatherData.series.length > 0) {
    return weatherData.series;
  }
  return extractForecastRowsFromPayload(weatherData.payload);
}

/**
 * @returns {{ slots: Array<{ date: string, time: string, hour: number, tmp: number|null, pop: number|null, wet: boolean, sky?: string, pty: string, Icon: import('react').ComponentType, iconProps: object }>, source?: 'vsrt'|'shortReg' }}
 * opts.skipVsrt — true 이면 단기(series)만 사용해 슬롯 구성(초단기 슬롯과 나란히 쓰기 위함).
 */
export function buildTravelWeatherTimeline(series, opts = {}) {
  const maxSlots = opts.maxSlots ?? 8;
  const vsrt = opts.vsrtHourly;
  const skipVsrt = opts.skipVsrt === true;
  if (!skipVsrt && Array.isArray(vsrt) && vsrt.length > 0) {
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
        pop: row.pop != null ? row.pop : null,
        wet: isRainyRow(row),
        sky: row.sky != null ? String(row.sky) : undefined,
        pty: row.pty != null ? String(row.pty) : '0',
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
      pop: row.pop != null ? row.pop : null,
      wet: isRainyRow(row),
      sky: row.sky != null ? String(row.sky) : undefined,
      pty: row.pty != null ? String(row.pty) : '0',
      Icon,
      iconProps,
    });
  }
  return { slots, source: slots.length ? 'shortReg' : undefined };
}

/** API 응답(reg·regLabel·regFromGeo) → 네비 첫 줄 지역 문구 */
export function buildDashboardRegionLine(weatherApiData, t) {
  if (!weatherApiData || weatherApiData.configured === false) {
    return { regionLine: '', regionHint: '' };
  }
  const regLabel = weatherApiData.regLabel;
  const reg = weatherApiData.reg;
  const fromGeo = weatherApiData.regFromGeo === true;
  const dist = weatherApiData.regDistanceKm;

  let regionLine = '';
  if (regLabel != null && String(regLabel).trim()) {
    const place = String(regLabel).trim();
    regionLine = fromGeo
      ? t('travelWeather.navRegionNearYou', '{{place}} · 내 위치', { place })
      : place;
  } else if (reg != null && String(reg).trim()) {
    regionLine = t('travelWeather.navRegionCode', '예보구역 {{code}}', { code: String(reg).trim() });
  }

  let regionHint = regionLine;
  if (regionLine && fromGeo && typeof dist === 'number') {
    regionHint = `${regionLine} · ${t('travelWeather.navRegionGeoKm', '격자까지 약 {{km}}km', { km: dist })}`;
  }
  return { regionLine, regionHint };
}

/** 대시보드 네비 캡션: 지역 / 요일·주말 / 기상상태 / 시각·기온 / 출처 (@param weatherApiData — short-reg 응답 data) */
export function buildDashboardNavCaption(presentation, timeline, t, weatherApiData) {
  const { regionLine, regionHint } = buildDashboardRegionLine(weatherApiData, t);
  const slots = timeline?.slots;
  if (Array.isArray(slots) && slots.length > 0) {
    const s = slots[0];
    const day = dayLabel(s.date, t);
    const y = parseInt(s.date.slice(0, 4), 10);
    const mo = parseInt(s.date.slice(4, 6), 10) - 1;
    const dNum = parseInt(s.date.slice(6, 8), 10);
    const dow = new Date(y, mo, dNum).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const weekendHint = isWeekend ? t('travelWeather.weekendShort', '주말') : '';
    const line1 = [day, weekendHint].filter(Boolean).join(' · ');
    const line2 = skyStateLabel(s.sky, s.pty, s.wet, t);
    const line3 =
      s.tmp != null
        ? t('travelWeather.navHourTemp', '{{h}}시 {{tmp}}°', { h: s.hour, tmp: s.tmp })
        : t('travelWeather.navHourOnly', '{{h}}시', { h: s.hour });
    const sourceNote =
      timeline?.source === 'vsrt'
        ? t('travelWeather.navSourceVsrt', '초단기(1h)')
        : t('travelWeather.navSourceShort', '단기');
    return { regionLine, regionHint, line1, line2, line3, foot: sourceNote };
  }
  if (presentation) {
    const line1 = presentation.chipDay || t('travelWeather.dayToday', '오늘');
    const line2 =
      presentation.stateLabel ||
      (presentation.kind === 'dry'
        ? t('travelWeather.navDryShort', '맑음 쪽')
        : presentation.kind === 'rain' || presentation.kind === 'maybe' || presentation.kind === 'vague'
          ? t('travelWeather.navWetShort', '비 가능')
          : '');
    const line3 = presentation.chipHours || '';
    if (line2 || line3) {
      return {
        regionLine,
        regionHint,
        line1,
        line2: line2 || t('travelWeather.navWeather', '날씨'),
        line3,
        foot: t('travelWeather.navSourceShort', '단기'),
      };
    }
  }
  return {
    regionLine,
    regionHint,
    line1: t('travelWeather.dayToday', '오늘'),
    line2: t('travelWeather.navWeather', '날씨'),
    line3: '',
    foot: '',
  };
}

/** 스크린리더용 — 시각·기온·하늘·강수 상태 요약 */
export function formatTimelineAria(slots, t) {
  if (!slots || !slots.length) return '';
  return slots
    .slice(0, 8)
    .map((s) => {
      let p = `${s.hour}시`;
      if (s.tmp != null) p += ` ${s.tmp}도`;
      if (typeof t === 'function') {
        p += ` ${skyStateLabel(s.sky, s.pty, s.wet, t)}`;
      } else if (s.wet) {
        p += ' 비 또는 눈 가능';
      }
      return p;
    })
    .join(', ');
}

export function dayLabel(yyyymmdd, t) {
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
  const keys = ['POP', 'pop', 'PTY', 'pty', 'TMP', 'tmp', 'T1H', 'SKY', 'sky'];
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
 * @returns {{ kind: 'rain'|'dry'|'maybe'|'vague'|'idle', Icon: import('react').ComponentType, iconProps: object, stateLabel?: string, chipDay?: string, chipHours?: string, ariaLabel: string }}
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
      const pick = getFirstUpcomingMergedRow(merged) || merged[0];
      const { Icon, iconProps } = iconForMergedRow(pick);
      const stateLabel = skyStateLabel(pick.sky, pick.pty, false, t);
      return {
        kind: 'dry',
        Icon,
        iconProps,
        stateLabel,
        ariaLabel: `${stateLabel}. ${t('travelWeather.ariaDry', '가까운 예보에서 강수는 없어 보입니다. 야외 일정 참고용입니다.')}`,
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
    const wetPick = merged.find((m) => m.date === first && wet.some((w) => w.time === m.time && isRainyRow(m))) || merged.find((m) => m.date === first && isRainyRow(m));
    const rainState = wetPick ? skyStateLabel(wetPick.sky, wetPick.pty, true, t) : t('travelWeather.statePrecip', '강수');
    if (h0 != null && endHour != null) {
      return {
        kind: 'rain',
        Icon: CloudRain,
        iconProps: { strokeWidth: 1.65, color: '#0369a1', style: { filter: 'drop-shadow(0 2px 6px rgba(3,105,161,0.2))' } },
        stateLabel: rainState,
        chipDay: day,
        chipHours: `${h0}–${endHour}시`,
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
      stateLabel: rainState,
      chipDay: day,
      ariaLabel: t('travelWeather.ariaRainVague', '{{day}} 강수 가능성이 있습니다.', { day }),
    };
  }

  const flat = flattenFirstForecastLike(payload);
  const pop = toNum(flat.POP ?? flat.pop);
  const ptyRaw = flat.PTY ?? flat.pty;
  const skyRaw = flat.SKY ?? flat.sky;
  const ptyStr = ptyRaw != null && String(ptyRaw) !== '' ? String(ptyRaw) : '0';
  const skyStr = skyRaw != null && String(skyRaw) !== '' ? String(skyRaw) : undefined;
  const pseudo = { sky: skyStr, pty: ptyStr, pop: pop ?? null };

  if (isWetPty(ptyStr) || (pop != null && pop >= 45)) {
    const { Icon, iconProps } = iconForMergedRow(pseudo);
    const stateLabel = skyStateLabel(skyStr, ptyStr, true, t);
    return {
      kind: 'maybe',
      Icon,
      iconProps,
      stateLabel,
      chipHours: pop != null ? `${pop}%` : undefined,
      ariaLabel:
        pop != null
          ? t('travelWeather.ariaRainMaybePop', '강수 확률 {{n}}퍼센트입니다.', { n: pop })
          : t('travelWeather.ariaRainMaybe', '강수 가능성이 있습니다. 시간대는 기상청 발표를 확인해 주세요.'),
    };
  }
  if (pop != null) {
    const { Icon, iconProps } = iconForMergedRow(pseudo);
    const stateLabel = skyStateLabel(skyStr, '0', false, t);
    return {
      kind: 'dry',
      Icon,
      iconProps,
      stateLabel,
      chipHours: `${pop}%`,
      ariaLabel: t('travelWeather.ariaDryPop', '강수 확률 {{n}}퍼센트입니다.', { n: pop }),
    };
  }
  const { Icon, iconProps } = iconForMergedRow(pseudo);
  const stateLabel = skyStateLabel(skyStr, '0', false, t);
  return {
    kind: 'dry',
    Icon,
    iconProps,
    stateLabel,
    ariaLabel: `${stateLabel}. ${t('travelWeather.ariaDryNeutral', '특별한 강수 예보는 없습니다.')}`,
  };
}

export function useTravelWeatherShortReg() {
  const [state, setState] = useState({ phase: 'loading', data: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      const pos = await getGeoForWeather();
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
