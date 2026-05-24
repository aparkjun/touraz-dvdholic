'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react';

/** 기상청 단기 SKY (하늘상태) */
export const KMA_SKY = {
  '1': 'clear',
  '2': 'partlyCloudy',
  '3': 'mostlyCloudy',
  '4': 'overcast',
};

/** 기상청 PTY (강수형태) — 0=없음 */
export const KMA_PTY = {
  '0': 'none',
  '1': 'rain',
  '2': 'rainSnow',
  '3': 'snow',
  '4': 'shower',
  '5': 'drizzle',
  '6': 'drizzleSnow',
  '7': 'snowFlurry',
};

/** 기상청 공식 코드명 (API SKY·PTY 값 — 하늘은 4종, 강수형태는 8종) */
export const KMA_SKY_KO = {
  '1': '맑음',
  '2': '구름조금',
  '3': '구름많음',
  '4': '흐림',
};

export const KMA_PTY_KO = {
  '0': '없음',
  '1': '비',
  '2': '비/눈',
  '3': '눈',
  '4': '소나기',
  '5': '빗방울',
  '6': '빗방울/눈날림',
  '7': '눈날림',
};

/** 기상청 API 필드 → 화면용 한글 이름 */
export const KMA_FIELD_LABEL_KO = {
  fcstDate: '예보일',
  fcstTime: '예보시각',
  TMP: '기온',
  T1H: '기온',
  TM: '기온',
  TMN: '최저기온',
  TMX: '최고기온',
  POP: '강수확률',
  PTY: '강수형태',
  SKY: '하늘상태',
  PCP: '강수량',
  SNO: '적설',
  REH: '습도',
  WSD: '풍속',
  VEC: '풍향',
  VVV: '남북풍속',
  UUU: '동서풍속',
  WAV: '파고',
  Rn: '강수',
  hr3: '3시간 강수',
};

function kmaFieldLabel(key, t) {
  const k = String(key).trim();
  const fallback = KMA_FIELD_LABEL_KO[k] ?? k;
  return typeof t === 'function' ? t(`travelWeather.kmaField.${k}`, fallback) : fallback;
}

/** 툴팁·표시 순서 — 기상청 short-reg / vsrt 응답 필드 */
export const KMA_API_FIELD_ORDER = [
  'fcstDate',
  'fcstTime',
  'TMP',
  'T1H',
  'TM',
  'TMN',
  'TMX',
  'POP',
  'PTY',
  'SKY',
  'PCP',
  'SNO',
  'REH',
  'WSD',
  'VEC',
  'VVV',
  'UUU',
  'WAV',
  'Rn',
  'hr3',
];

function mergeKmaFieldMaps(...maps) {
  const out = {};
  for (const m of maps) {
    if (!m || typeof m !== 'object') continue;
    for (const [k, v] of Object.entries(m)) {
      if (v == null || String(v).trim() === '') continue;
      out[k] = v;
    }
  }
  return out;
}

/** API 행 객체에서 기상청 예보 필드만 추출 (키·값 그대로) */
export function extractKmaFieldsFromRaw(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const k of KMA_API_FIELD_ORDER) {
    const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
    if (v == null || String(v).trim() === '') continue;
    out[k] = typeof v === 'number' ? v : String(v).trim();
  }
  for (const [k, v] of Object.entries(raw)) {
    if (out[k] != null || k === 'date' || k === 'time') continue;
    if (!/^[A-Za-z][A-Za-z0-9]{0,3}$/.test(k)) continue;
    if (v == null || String(v).trim() === '') continue;
    out[k] = typeof v === 'number' ? v : String(v).trim();
  }
  return out;
}

export function kmaSkyName(sky, t) {
  const sk = sky != null ? String(sky) : '';
  if (!sk) return '';
  const ko = KMA_SKY_KO[sk];
  if (!ko) return sk;
  return typeof t === 'function'
    ? t(`travelWeather.kmaSky.${sk}`, ko)
    : ko;
}

export function kmaPtyName(pty, t) {
  const ps = pty != null ? String(pty) : '0';
  const ko = KMA_PTY_KO[ps];
  if (!ko) return ps;
  return typeof t === 'function'
    ? t(`travelWeather.kmaPty.${ps}`, ko)
    : ko;
}

/** API 필드 1줄 — 한글만 (예: 구름많음 · 강수확률 30% · 기온 24°C) */
export function kmaFieldDisplayLine(key, value, t) {
  const k = String(key).trim();
  const v = value == null ? '' : String(value).trim();
  if (!k || !v) return '';

  if (k === 'SKY') {
    const name = kmaSkyName(v, t);
    return name || `${kmaFieldLabel('SKY', t)} ${v}`;
  }
  if (k === 'PTY') {
    if (v === '0') {
      return typeof t === 'function'
        ? t('travelWeather.kmaPtyNone', '강수 없음')
        : '강수 없음';
    }
    const name = kmaPtyName(v, t);
    return name || `${kmaFieldLabel('PTY', t)} ${v}`;
  }
  if (k === 'POP') {
    const n = v.replace(/%/g, '');
    return typeof t === 'function'
      ? t('travelWeather.kmaPopLine', '강수확률 {{n}}%', { n })
      : `강수확률 ${n}%`;
  }
  if (k === 'TMP' || k === 'T1H' || k === 'TM') {
    return typeof t === 'function'
      ? t('travelWeather.kmaTempLine', '기온 {{n}}°C', { n: v })
      : `기온 ${v}°C`;
  }
  if (k === 'TMN') {
    return typeof t === 'function'
      ? t('travelWeather.kmaTmnLine', '최저기온 {{n}}°C', { n: v })
      : `최저기온 ${v}°C`;
  }
  if (k === 'TMX') {
    return typeof t === 'function'
      ? t('travelWeather.kmaTmxLine', '최고기온 {{n}}°C', { n: v })
      : `최고기온 ${v}°C`;
  }
  if (k === 'REH') {
    const n = v.replace(/%/g, '');
    return typeof t === 'function'
      ? t('travelWeather.rehShort', '습도 {{reh}}%', { reh: n })
      : `습도 ${n}%`;
  }
  if (k === 'WSD') {
    return typeof t === 'function'
      ? t('travelWeather.wsdShort', '풍속 {{wsd}}m/s', { wsd: v })
      : `풍속 ${v}m/s`;
  }
  if (k === 'PCP') {
    if (v === '0' || /^강수\s*없/i.test(v)) {
      return typeof t === 'function'
        ? t('travelWeather.kmaPcpNone', '강수량 없음')
        : '강수량 없음';
    }
    return typeof t === 'function'
      ? t('travelWeather.kmaPcpLine', '강수량 {{amt}}', { amt: v })
      : `강수량 ${v}`;
  }
  if (k === 'SNO') {
    if (v === '0' || /^적설\s*없/i.test(v)) {
      return typeof t === 'function'
        ? t('travelWeather.kmaSnoNone', '적설 없음')
        : '적설 없음';
    }
    return typeof t === 'function'
      ? t('travelWeather.kmaSnoLine', '적설 {{amt}}', { amt: v })
      : `적설 ${v}`;
  }
  if (k === 'fcstDate' && v.length === 8) {
    const d = `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6, 8)}`;
    return typeof t === 'function'
      ? t('travelWeather.kmaFcstDateLine', '예보일 {{d}}', { d })
      : `예보일 ${d}`;
  }
  if (k === 'fcstTime' && v.length >= 4) {
    const h = v.slice(0, 2);
    return typeof t === 'function'
      ? t('travelWeather.kmaFcstTimeLine', '예보시각 {{h}}시', { h })
      : `예보시각 ${h}시`;
  }
  const label = kmaFieldLabel(k, t);
  return `${label} ${v}`;
}

export function buildApiLinesFromKmaFields(kmaFields, t) {
  if (!kmaFields || typeof kmaFields !== 'object') return [];
  const lines = [];
  const seen = new Set();
  for (const key of KMA_API_FIELD_ORDER) {
    if (kmaFields[key] == null) continue;
    if (key === 'PTY' && String(kmaFields[key]) === '0') continue;
    const line = kmaFieldDisplayLine(key, kmaFields[key], t);
    if (line && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  for (const key of Object.keys(kmaFields).sort()) {
    if (KMA_API_FIELD_ORDER.includes(key)) continue;
    const line = kmaFieldDisplayLine(key, kmaFields[key], t);
    if (line && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }
  return lines;
}

export function kmaPrimaryLabelFromFields(kmaFields, t) {
  if (!kmaFields) return '';
  const pty = kmaFields.PTY ?? kmaFields.pty;
  if (pty != null && String(pty) !== '' && String(pty) !== '0') {
    return kmaPtyName(pty, t);
  }
  const sky = kmaFields.SKY ?? kmaFields.sky;
  if (sky != null && String(sky) !== '') {
    return kmaSkyName(sky, t);
  }
  return '';
}

function summarizeAfsDs(afsDs, maxLen = 160) {
  const plain = collectAfsDsPlainText(afsDs);
  if (!plain) return '';
  const one = plain.replace(/\s+/g, ' ').trim();
  return one.length > maxLen ? `${one.slice(0, maxLen)}…` : one;
}

function attachGlyphPickMeta(weatherData, slot, t) {
  const kmaFields = mergeKmaFieldMaps(
    extractKmaFieldsFromRaw({
      fcstDate: slot.date,
      fcstTime: slot.time,
      TMP: slot.tmp,
      POP: slot.pop,
      PTY: slot.pty,
      SKY: slot.sky,
      PCP: slot.pcpAmt,
      REH: slot.reh,
      WSD: slot.wsd,
      SNO: slot.snoAmt,
      TMN: slot.tmn,
      TMX: slot.tmx,
    }),
    slot.kmaFields
  );
  const apiLines = buildApiLinesFromKmaFields(kmaFields, t);
  const primaryLabel =
    kmaPrimaryLabelFromFields(kmaFields, t) ||
    (typeof t === 'function' ? skyStateLabel(slot.sky, slot.pty, slot.wet, t) : '');

  return {
    Icon: slot.Icon,
    tmp: slot.tmp ?? null,
    iconProps: slot.iconProps,
    sky: slot.sky,
    pty: slot.pty,
    wet: slot.wet,
    pop: slot.pop ?? null,
    pcpAmt: slot.pcpAmt ?? null,
    reh: slot.reh ?? null,
    wsd: slot.wsd ?? null,
    snoAmt: slot.snoAmt ?? null,
    source: slot.source,
    fcstDate: slot.date,
    fcstTime: slot.time,
    kmaFields,
    apiLines,
    primaryLabel,
    stateLabel: primaryLabel,
    reg: weatherData?.reg ?? null,
    regLabel: weatherData?.regLabel ?? null,
    afsSummary: weatherData?.afsDs ? summarizeAfsDs(weatherData.afsDs) : '',
  };
}
import axios from '@/lib/axiosConfig';
import i18n from '@/lib/i18n';

/** 빠른 1회 시도 (다른 화면·테스트용) */
export function getGeoOnce() {
  return geoTryOnce({ enableHighAccuracy: false, maximumAge: 600000, timeoutMs: 3500 });
}

/**
 * 대시보드 날씨용: 먼저 캐시·저전력으로 빠르게 받고, 실패 시 고정밀·긴 시도.
 * 허용만 되어 있으면 서버에 lat/lng 전달 → 가장 가까운 단기 reg + 초단시 보조.
 */
/** Permissions API 로 위치 권한이 거절이면 getCurrentPosition 을 호출하지 않는다(일부 WebView 지연 방지). */
async function isGeolocationPermissionDenied() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return false;
  }
  try {
    const r = await navigator.permissions.query({ name: 'geolocation' });
    return r?.state === 'denied';
  } catch {
    return false;
  }
}

export async function getGeoForWeather() {
  if (await isGeolocationPermissionDenied()) {
    return null;
  }
  let p = await geoTryOnce({ enableHighAccuracy: false, maximumAge: 600000, timeoutMs: 4000 });
  if (p?.coords) return p;
  p = await geoTryOnce({ enableHighAccuracy: true, maximumAge: 120000, timeoutMs: 12000 });
  return p?.coords ? p : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 일부 모바일 브라우저·WebView 에서 geolocation 이 콜백 없이 멈추는 사례가 있어,
 * 전체 위치 조회에 벽시계 상한을 둔다. 초과 시 좌표 없이 단기구역 API만 호출한다.
 */
export async function getGeoForWeatherCapped(maxMs = 9000) {
  const pos = await Promise.race([getGeoForWeather(), delay(maxMs).then(() => null)]);
  return pos && pos.coords ? pos : null;
}

/**
 * 네트워크·타임아웃 등으로 본문을 못 받아도 네비 위젯을 {@code phase:'ready'} 로 두기 위한 최소 페이로드.
 * {@code configured:false} → 기존 idle 아이콘·캡션 분기로 이어져 클릭(패널)·지역 탭은 그대로 사용 가능.
 *
 * 백엔드가 응답하지 못한 경우(Heroku 30s 라우터 H12, 네트워크 단절, axios 자체 타임아웃 등)
 * 메시지를 비워두면 패널이 "이 구역은 기상청 API에서 예보 본문을 받지 못했습니다…" 라는 KMA 활용승인 안내처럼 보여서
 * 사용자에게 책임이 전가되는 듯한 인상을 준다. 게이트웨이 지연이 원인일 가능성을 명시하는 안내로 폴백한다.
 */
export function createNavWeatherFallbackData(message) {
  const o = {
    configured: false,
    navLoadFailed: true,
  };
  const m = message != null ? String(message).trim() : '';
  o.message = m ? m : i18n.t('travelWeather.navLoadFailedDefault');
  return o;
}

function extractApiErrorMessage(err) {
  const d = err?.response?.data;
  if (d && typeof d.message === 'string' && d.message.trim()) return d.message.trim();
  if (err?.code === 'ECONNABORTED') {
    return i18n.t('travelWeather.navLoadTimeout');
  }
  const st = err?.response?.status;
  if (st === 502 || st === 503 || st === 504) {
    return i18n.t('travelWeather.navLoadGateway', { status: st });
  }
  const parts = [];
  if (err?.code) parts.push(`code=${err.code}`);
  if (st != null) parts.push(`status=${st}`);
  if (err?.message) parts.push(err.message);
  else if (typeof err === 'string' && err) parts.push(err);
  if (d != null && typeof d !== 'string') {
    try {
      const keys = Object.keys(d);
      if (keys.length) parts.push(`bodyKeys=${keys.slice(0, 6).join(',')}`);
    } catch {}
  } else if (typeof d === 'string' && d) {
    const snip = d.length > 120 ? `${d.slice(0, 120)}…` : d;
    parts.push(`bodyText=${snip}`);
  }
  if (!parts.length) return '';
  return i18n.t('travelWeather.navLoadFailedDetail', { detail: parts.join(' · ') });
}

/**
 * Geolocation PositionOptions 의 timeout 은 iOS WebKit 등에서 무시되는 경우가 있어,
 * 성공/에러 콜백이 오지 않으면 Promise 가 영원히 pending 이 된다(네비 날씨 무한 로딩).
 * 반드시 벽시계 상한으로 resolve 한다.
 */
function geoTryOnce({ enableHighAccuracy, maximumAge, timeoutMs }) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const wallMs = Math.min(18_000, Math.max(timeoutMs + 2500, 6000));
    let wallTimer;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (wallTimer !== undefined) clearTimeout(wallTimer);
      resolve(value);
    };
    wallTimer = setTimeout(() => finish(null), wallMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => finish(p),
        () => finish(null),
        { enableHighAccuracy, maximumAge, timeout: timeoutMs }
      );
    } catch {
      finish(null);
    }
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
    const pcpRaw = raw.PCP ?? raw.pcp;
    if (pcpRaw != null && String(pcpRaw).trim() !== '') next.pcpAmt = String(pcpRaw).trim();
    const reh = toNum(raw.REH ?? raw.reh);
    if (reh != null) next.reh = reh;
    const wsd = toNum(raw.WSD ?? raw.wsd);
    if (wsd != null) next.wsd = wsd;
    const sno = raw.SNO ?? raw.sno;
    if (sno != null && String(sno).trim() !== '') next.snoAmt = String(sno).trim();
    const tmn = toNum(raw.TMN ?? raw.tmn);
    if (tmn != null) next.tmn = tmn;
    const tmx = toNum(raw.TMX ?? raw.tmx);
    if (tmx != null) next.tmx = tmx;
    next.kmaFields = mergeKmaFieldMaps(prev.kmaFields, extractKmaFieldsFromRaw(raw));
    map.set(key, next);
  }
  return Array.from(map.values()).sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    return c !== 0 ? c : a.time.localeCompare(b.time);
  });
}

/** 단기·초단기 API 행 → 통합 슬롯 (SKY·PTY·POP·PCP·REH·WSD 등) */
export function normalizeMergedWeatherRow(row) {
  if (!row || !row.date || !row.time) return null;
  return {
    date: row.date,
    time: row.time,
    pop: row.pop ?? null,
    pty: row.pty != null ? String(row.pty) : '0',
    sky: row.sky != null ? String(row.sky) : undefined,
    tmp: row.tmp ?? null,
    pcpAmt: row.pcpAmt ?? null,
    reh: row.reh ?? null,
    wsd: row.wsd ?? null,
    snoAmt: row.snoAmt ?? null,
    tmn: row.tmn ?? null,
    tmx: row.tmx ?? null,
    kmaFields: row.kmaFields && typeof row.kmaFields === 'object' ? row.kmaFields : {},
  };
}

/** 초단기 시각에 맞는 단기(3h) 슬롯 — SKY·POP 보강 (±3시간 이내) */
function findNearestShortRegRow(mergedShort, date, hour) {
  if (!Array.isArray(mergedShort) || !mergedShort.length) return null;
  let best = null;
  let bestDist = Infinity;
  for (const r of mergedShort) {
    if (r.date !== date) continue;
    const h = hourFromTime(r.time);
    if (h == null) continue;
    const d = Math.abs(h - hour);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return bestDist <= 3 ? best : null;
}

function mergeVsrtWithShortReg(vsrtRaw, mergedShort, date, time, hour) {
  const exact = mergedShort.find((r) => r.date === date && r.time === time);
  const near = exact || findNearestShortRegRow(mergedShort, date, hour);
  const ptyVsrt =
    vsrtRaw.PTY != null
      ? String(vsrtRaw.PTY)
      : vsrtRaw.pty != null
        ? String(vsrtRaw.pty)
        : null;
  const row = {
    date,
    time,
    pty: ptyVsrt != null && ptyVsrt !== '' ? ptyVsrt : near?.pty ?? '0',
    tmp: toNum(vsrtRaw.TMP ?? vsrtRaw.tmp ?? vsrtRaw.T1H ?? vsrtRaw.t1h) ?? near?.tmp ?? null,
    sky: near?.sky,
    pop: near?.pop ?? null,
    pcpAmt: near?.pcpAmt ?? null,
    reh: near?.reh ?? null,
    wsd: near?.wsd ?? null,
    snoAmt: near?.snoAmt ?? null,
    tmn: near?.tmn ?? null,
    tmx: near?.tmx ?? null,
    kmaFields: mergeKmaFieldMaps(
      near?.kmaFields,
      extractKmaFieldsFromRaw(vsrtRaw),
      extractKmaFieldsFromRaw({ fcstDate: date, fcstTime: time, ...vsrtRaw })
    ),
  };
  return normalizeMergedWeatherRow(row);
}

function rowHasMeasuredPrecip(row) {
  if (!row) return false;
  const raw = row.pcpAmt ?? row.PCP ?? row.pcp;
  if (raw == null || raw === '') return false;
  const s = String(raw).trim();
  if (!s || s === '0' || s === '강수없음') return false;
  return true;
}

/** 기상청 SKY·PTY → 한글 상태 (맑음 · 비 · 소나기 등) */
export function skyStateLabel(sky, pty, wet, t) {
  const ps = pty != null ? String(pty) : '0';
  if (wet || isWetPty(ps)) {
    if (isWetPty(ps)) {
      const name = kmaPtyName(ps, t);
      if (name) return name;
    }
    if (wet && !isWetPty(ps)) {
      return t('travelWeather.statePrecipLikely', '강수 가능');
    }
    return t('travelWeather.statePrecip', '강수');
  }
  const sk = sky != null ? String(sky) : '';
  if (sk !== '') {
    const name = kmaSkyName(sk, t);
    if (name) return name;
  }
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
  if (isWetPty(row.pty)) return true;
  if (rowHasMeasuredPrecip(row)) return true;
  return false;
}

/**
 * 칩·현재 시각 아이콘: 지금(또는 직전 발표 시각) 슬롯. 오늘 저녁 비 예보로 낮 맑음을 덮지 않음.
 */
export function pickGlyphWeatherSlot(timeline, now = new Date()) {
  const slots = timeline?.slots;
  if (!Array.isArray(slots) || !slots.length) return null;
  const nowParts = nowKstYyyymmddHour(now);

  const today = slots.filter((s) => s.date === nowParts.yyyymmdd);
  if (today.length) {
    let atOrBefore = null;
    for (const s of today) {
      if (s.hour <= nowParts.hour) atOrBefore = s;
    }
    if (atOrBefore) return atOrBefore;
    const next = today.find((s) => s.hour >= nowParts.hour);
    return next ?? today[0];
  }

  const upcoming = slots.filter((s) => {
    if (s.date > nowParts.yyyymmdd) return true;
    if (s.date < nowParts.yyyymmdd) return false;
    const h = hourFromTime(s.time);
    return h != null && h >= nowParts.hour;
  });
  return (upcoming.length ? upcoming : slots)[0];
}

/** 강수 슬롯 우선 — 네비 등 “오늘 비 소식” 강조용 (칩 아이콘에는 {@link pickGlyphWeatherSlot} 사용) */
export function pickDisplayWeatherSlot(timeline, now = new Date()) {
  const slots = timeline?.slots;
  if (!Array.isArray(slots) || !slots.length) return null;
  const nowParts = nowYyyymmddHour(now);

  const isWetSlot = (s) => s.wet || isWetPty(s.pty);

  const wetToday = slots.filter((s) => s.date === nowParts.yyyymmdd && isWetSlot(s));
  if (wetToday.length) return wetToday[0];

  const wetAny = slots.find(isWetSlot);
  if (wetAny) return wetAny;

  const upcoming = slots.filter((s) => {
    if (s.date > nowParts.yyyymmdd) return true;
    if (s.date < nowParts.yyyymmdd) return false;
    const h = hourFromTime(s.time);
    return h != null && h >= nowParts.hour;
  });
  return (upcoming.length ? upcoming : slots)[0];
}

/** 단기 개황(afsDs) 전체 문장 — series·vsrt 가 없을 때 아이콘 보강용 */
export function collectAfsDsPlainText(afsDs) {
  if (!afsDs || typeof afsDs !== 'object') return '';
  const chunks = [];
  const sum = String(afsDs.summary ?? '').trim();
  if (sum && sum !== '#') chunks.push(sum);
  if (Array.isArray(afsDs.sections)) {
    for (const sec of afsDs.sections) {
      const tx = String(sec?.text ?? '').trim();
      if (tx && tx !== '#' && !tx.includes('#7777END')) chunks.push(tx);
    }
  }
  return chunks.join('\n');
}

function afsDsStrongPrecipSignals(text) {
  const hasMm = /\d+\s*~\s*\d+\s*mm|\d+\s*mm|mm\s*\(/i.test(text);
  const hasShower = /소나기/.test(text);
  const hasThunder = /천둥|뇌우|우박/.test(text);
  const hasSnowFlurry = /눈날림/.test(text);
  const hasSnow =
    /(?:^|[^가-힣])눈(?:[^가-힣]|$)|진눈깨비|눈보라/.test(text) && !/눈구름/.test(text);
  const hasRainWord =
    /호우|폭우|강우|빗방울|강한\s*비|비가\s*오|비를\s*내|비\s*내리|우산/.test(text) ||
    /(?:^|[^가-힣])비(?:[^가-힣]|$)|비가|비를|비는|비\s|비,|비로|비와/.test(text) ||
    hasMm;
  const hasRainSnowMix = /비\s*또는\s*눈|눈\s*또는\s*비/.test(text);
  return {
    hasMm,
    hasShower,
    hasThunder,
    hasSnowFlurry,
    hasSnow,
    hasRainWord,
    hasRainSnowMix,
    any: hasRainWord || hasSnow || hasShower || hasThunder,
  };
}

/** afsDs 문장 중 “지금·오늘 낮/오후”에 해당하는 줄만 (저녁·내일 강수 언급으로 낮 맑음을 덮지 않음) */
function afsDsTextNearNow(afsDs, now = new Date()) {
  const text = collectAfsDsPlainText(afsDs);
  if (!text) return '';
  const hour = nowKstYyyymmddHour(now).hour;
  const chunks = text
    .split(/[\n。]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '#' && !s.includes('#7777END'));
  if (!chunks.length) return text;

  const near = chunks.filter((line) => {
    if (/내일|모레|글피|이번\s*주\s*말|주말\s*이후|다음\s*주/.test(line)) return false;
    if (hour >= 12 && hour < 18) {
      if (/밤|야간|새벽|오늘\s*밤|저녁\s*늦게/.test(line) && !/오후|낮|오늘\s*오후|지금|현재/.test(line)) {
        return false;
      }
    }
    if (hour >= 6 && hour < 12) {
      if (/오후|밤|야간|저녁/.test(line) && !/오전|아침|낮|지금|현재|오늘/.test(line)) return false;
    }
    return (
      /오늘|현재|지금|금일|당일|오전|오후|낮|아침|이\s*시간|초단기/.test(line) ||
      chunks.length <= 2
    );
  });

  return (near.length ? near : [chunks[0]]).join('\n');
}

/**
 * 기상청 단기 개황 한글 문장에서 강수 여부 추정.
 * series/vsrtHourly 없을 때만 보조. 멀리 있는 “비” 언급·저녁 예보로 낮 맑음을 덮지 않도록 보수적으로 판별.
 */
export function inferPrecipFromAfsDs(afsDs, now = new Date()) {
  const scope = afsDsTextNearNow(afsDs, now);
  if (!scope) return null;

  if (/강수\s*없|비\s*없|맑(?:음|게|다)|화창|쾌청|개(?:임|다)|해\s*비침|강수\s*확률\s*낮/i.test(scope)) {
    const sig = afsDsStrongPrecipSignals(scope);
    if (!sig.hasMm && !sig.hasShower && !sig.hasThunder) return null;
  }

  const sig = afsDsStrongPrecipSignals(scope);
  if (!sig.any) return null;

  let pty = '1';
  if (sig.hasShower || sig.hasThunder) pty = '4';
  else if (sig.hasRainSnowMix) pty = '2';
  else if (sig.hasSnowFlurry) pty = '7';
  else if (sig.hasSnow && !sig.hasRainWord) pty = '3';

  return {
    wet: true,
    pty,
    sky: '4',
    pop: sig.hasMm ? 80 : 55,
  };
}

function glyphPickFromPrecipHint(hint, t) {
  const row = {
    sky: hint.sky ?? '4',
    pty: hint.pty,
    pop: hint.pop ?? 60,
    wet: true,
  };
  const { Icon, iconProps } = iconForMergedRow(row);
  const stateLabel =
    typeof t === 'function' ? skyStateLabel(row.sky, row.pty, true, t) : null;
  return { Icon, tmp: null, stateLabel, iconProps };
}

export function buildWeatherGlyphPickFromPayload(weatherData, opts = {}) {
  if (weatherData == null || typeof weatherData !== 'object') {
    return { Icon: null, tmp: null, stateLabel: null };
  }
  const t = opts.t;
  const now = opts.now ?? new Date();

  const series = resolveSeriesForWeatherTimeline(weatherData);
  const tl = buildTravelWeatherTimeline(series, {
    maxSlots: opts.maxSlots ?? 8,
    vsrtHourly: weatherData?.vsrtHourly,
    skipVsrt: false,
    now,
  });
  const s = pickGlyphWeatherSlot(tl, now);

  if (s?.Icon) {
    return attachGlyphPickMeta(weatherData, { ...s, source: tl.source }, t);
  }

  const afsHint = inferPrecipFromAfsDs(weatherData.afsDs, now);
  if (afsHint?.wet) {
    const { yyyymmdd, hour } = nowKstYyyymmddHour(now);
    const slot = mergedRowToWeatherSlot(
      normalizeMergedWeatherRow({
        date: yyyymmdd,
        time: `${String(hour).padStart(2, '0')}00`,
        sky: afsHint.sky ?? '4',
        pty: afsHint.pty ?? '1',
        pop: afsHint.pop ?? null,
        kmaFields: extractKmaFieldsFromRaw({
          fcstDate: yyyymmdd,
          fcstTime: `${String(hour).padStart(2, '0')}00`,
          PTY: afsHint.pty ?? '1',
          SKY: afsHint.sky,
          POP: afsHint.pop,
        }),
      }),
      'afsDs'
    );
    if (slot) return attachGlyphPickMeta(weatherData, slot, t);
    return glyphPickFromPrecipHint(afsHint, t);
  }

  const skyCode = inferSkyCodeFromAfsDs(weatherData.afsDs, now);
  if (skyCode) {
    const { yyyymmdd, hour } = nowKstYyyymmddHour(now);
    const slot = mergedRowToWeatherSlot(
      normalizeMergedWeatherRow({
        date: yyyymmdd,
        time: `${String(hour).padStart(2, '0')}00`,
        sky: skyCode,
        pty: '0',
        kmaFields: { fcstDate: yyyymmdd, fcstTime: `${String(hour).padStart(2, '0')}00`, SKY: skyCode, PTY: '0' },
      }),
      'afsDs'
    );
    if (slot) return attachGlyphPickMeta(weatherData, slot, t);
  }

  return { Icon: null, tmp: null, stateLabel: null };
}

function nowYyyymmddHour(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { yyyymmdd: `${y}${m}${day}`, hour: d.getHours() };
}

/** 기상청 예보 시각(KST)과 맞추기 위한 “지금” 시각 */
export function nowKstYyyymmddHour(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    yyyymmdd: `${get('year')}${get('month')}${get('day')}`,
    hour: parseInt(get('hour'), 10),
  };
}

/** 캐시·정각 갱신용 KST 시각 버킷 (예: 2026052116) */
export function kstHourBucket(d = new Date()) {
  const { yyyymmdd, hour } = nowKstYyyymmddHour(d);
  return `${yyyymmdd}${String(hour).padStart(2, '0')}`;
}

/**
 * 기상청 SKY·PTY·강수량 → Lucide 아이콘 (API 코드 그대로 반영).
 * @returns {{ Icon: import('react').ComponentType, iconProps: { strokeWidth: number, color: string } }}
 */
export function weatherIconForMergedRow(row) {
  const ps = String(row?.pty ?? '0');
  const sk = row?.sky != null ? String(row.sky) : '';

  if (isRainyRow(row) && isWetPty(ps)) {
    switch (ps) {
      case '1':
        return { Icon: CloudRain, iconProps: { strokeWidth: 1.55, color: '#0ea5e9' } };
      case '2':
        return { Icon: CloudHail, iconProps: { strokeWidth: 1.55, color: '#7dd3fc' } };
      case '3':
        return { Icon: CloudSnow, iconProps: { strokeWidth: 1.6, color: '#e0f2fe' } };
      case '4':
        return { Icon: CloudLightning, iconProps: { strokeWidth: 1.5, color: '#fbbf24' } };
      case '5':
        return { Icon: CloudDrizzle, iconProps: { strokeWidth: 1.5, color: '#22d3ee' } };
      case '6':
        return { Icon: CloudHail, iconProps: { strokeWidth: 1.5, color: '#a5f3fc' } };
      case '7':
        return { Icon: CloudSnow, iconProps: { strokeWidth: 1.45, color: '#f1f5f9' } };
      default:
        return { Icon: CloudRain, iconProps: { strokeWidth: 1.55, color: '#38bdf8' } };
    }
  }

  if (isRainyRow(row)) {
    return { Icon: CloudRain, iconProps: { strokeWidth: 1.55, color: '#06b6d4' } };
  }

  switch (sk) {
    case '1':
      return { Icon: Sun, iconProps: { strokeWidth: 1.55, color: '#fbbf24' } };
    case '2':
      return { Icon: CloudSun, iconProps: { strokeWidth: 1.5, color: '#fde047' } };
    case '3':
      return { Icon: Cloud, iconProps: { strokeWidth: 1.55, color: '#cbd5e1' } };
    case '4':
      return { Icon: CloudFog, iconProps: { strokeWidth: 1.5, color: '#94a3b8' } };
    default:
      break;
  }

  return { Icon: CloudSun, iconProps: { strokeWidth: 1.5, color: '#e2e8f0' } };
}

function iconForMergedRow(row) {
  return weatherIconForMergedRow(row);
}

/** SKY 없이 초단기만 올 때 — 아이콘 모양으로 하늘 상태 문구 보강 */
export function stateLabelFromWeatherIcon(Icon, pick, t) {
  if (!Icon || typeof t !== 'function') return '';
  const ps = String(pick?.pty ?? '0');
  if (pick?.wet || isWetPty(ps)) {
    return skyStateLabel(pick?.sky, pick?.pty, pick?.wet, t);
  }
  if (Icon === Sun) return t('travelWeather.skyClear', '맑음');
  if (Icon === CloudSun) return t('travelWeather.skyPartlyCloud', '구름 조금');
  if (Icon === CloudFog) return t('travelWeather.skyOvercast', '흐림');
  if (Icon === Cloud) return t('travelWeather.skyMostlyCloud', '구름 많음');
  if (Icon === CloudRain) return t('travelWeather.ptyRain', '비');
  if (Icon === CloudDrizzle) return t('travelWeather.ptyDrizzle', '빗방울');
  if (Icon === CloudSnow || Icon === CloudHail) return t('travelWeather.ptySnow', '눈');
  if (Icon === CloudLightning) return t('travelWeather.ptyShower', '소나기');
  return t('travelWeather.skyPartlyCloud', '구름 조금');
}

/** afsDs 문장에서 맑음·구름·흐림 코드 추정 (series/vsrt 없을 때) */
function inferSkyCodeFromAfsDs(afsDs, now = new Date()) {
  const scope = afsDsTextNearNow(afsDs, now);
  if (!scope) return null;
  if (/강수|비가|비\s|눈|소나기|호우/.test(scope) && !/강수\s*없|비\s*없/.test(scope)) return null;
  if (/맑|화창|쾌청/.test(scope) && !/흐림|구름\s*많/.test(scope)) return '1';
  if (/흐림/.test(scope)) return '4';
  if (/구름\s*많|대체로\s*흐/.test(scope)) return '3';
  if (/구름/.test(scope)) return '2';
  return null;
}

/** 칩 툴팁 첫 줄 — stateLabel 없으면 SKY·PTY·아이콘에서 복원 */
export function resolveGlyphStateLabel(pick, t) {
  if (!pick || typeof t !== 'function') return '';
  if (pick.primaryLabel) return pick.primaryLabel;
  const unknown = t('travelWeather.skyUnknown', '하늘 상태 미제공');
  if (pick.stateLabel && pick.stateLabel !== unknown) return pick.stateLabel;
  if (pick.sky != null && pick.sky !== '') {
    return skyStateLabel(pick.sky, pick.pty, pick.wet, t);
  }
  if (pick.Icon) return stateLabelFromWeatherIcon(pick.Icon, pick, t);
  return '';
}

/** 칩·툴팁 — API 응답 필드·개황(afsDs)을 가능한 한 모두 표시 */
export function buildWeatherGlyphTooltip(pick, t) {
  if (!pick) return '';
  const parts = [];
  if (pick.regLabel) parts.push(pick.regLabel);
  else if (pick.reg) parts.push(`reg ${pick.reg}`);

  if (Array.isArray(pick.apiLines) && pick.apiLines.length) {
    parts.push(...pick.apiLines);
  } else {
    const label = resolveGlyphStateLabel(pick, t);
    if (label) parts.push(label);
    if (pick.tmp != null) parts.push(kmaFieldDisplayLine('TMP', pick.tmp, t));
    if (pick.pop != null) parts.push(kmaFieldDisplayLine('POP', pick.pop, t));
    if (pick.pcpAmt) parts.push(kmaFieldDisplayLine('PCP', pick.pcpAmt, t));
    if (pick.snoAmt) parts.push(kmaFieldDisplayLine('SNO', pick.snoAmt, t));
    if (pick.reh != null) parts.push(kmaFieldDisplayLine('REH', pick.reh, t));
    if (pick.wsd != null) parts.push(kmaFieldDisplayLine('WSD', pick.wsd, t));
    if (pick.sky != null && pick.sky !== '') parts.push(kmaFieldDisplayLine('SKY', pick.sky, t));
    if (pick.pty != null) parts.push(kmaFieldDisplayLine('PTY', pick.pty, t));
  }

  if (pick.afsSummary) parts.push(pick.afsSummary);

  if (pick.source === 'vsrt') {
    parts.push(t('travelWeather.navSourceVsrt', '초단기(1h)'));
  } else if (pick.source === 'shortReg') {
    parts.push(t('travelWeather.navSourceShort', '단기'));
  } else if (pick.source === 'afsDs') {
    parts.push(t('travelWeather.navSourceAfs', '단기 개황'));
  }
  return parts.join(' · ');
}

function mergedRowToWeatherSlot(row, source) {
  const norm = normalizeMergedWeatherRow(row);
  if (!norm) return null;
  const h = hourFromTime(norm.time);
  if (h == null) return null;
  const wet = isRainyRow(norm);
  const { Icon, iconProps } = weatherIconForMergedRow(norm);
  return {
    ...norm,
    hour: h,
    wet,
    Icon,
    iconProps,
    source,
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
      o.pty != null ||
      o.PCP != null ||
      o.pcp != null;
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
    const slots = [];
    for (const raw of vsrt.slice(0, maxSlots)) {
      const date = String(raw.fcstDate ?? '').replace(/\D/g, '');
      const timeRaw = String(raw.fcstTime ?? '').replace(/\D/g, '');
      const time = timeRaw.length >= 3 ? timeRaw.padStart(4, '0') : '';
      if (date.length !== 8 || time.length !== 4) continue;
      const h = hourFromTime(time);
      if (h == null) continue;
      const row = mergeVsrtWithShortReg(raw, mergedShort, date, time, h);
      if (!row) continue;
      const slot = mergedRowToWeatherSlot(row, 'vsrt');
      if (slot) slots.push(slot);
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
    const slot = mergedRowToWeatherSlot(row, 'shortReg');
    if (slot) slots.push(slot);
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
    const s = pickDisplayWeatherSlot(timeline) || slots[0];
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
  const tr = typeof t === 'function' ? t : (key, fallback) => i18n.t(key, fallback);
  return slots
    .slice(0, 8)
    .map((s) => {
      let p = `${s.hour}${tr('travelWeather.hourSuffix', '시')}`;
      if (s.tmp != null) {
        p += ` ${s.tmp}${tr('travelWeather.degreeSymbol', '°')}`;
      }
      if (typeof t === 'function') {
        p += ` ${skyStateLabel(s.sky, s.pty, s.wet, t)}`;
      } else if (s.wet) {
        p += ` ${tr('travelWeather.ariaTimelinePrecipVague', '비 또는 눈 가능')}`;
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

function mergedRowToSlot(row) {
  return mergedRowToWeatherSlot(row, 'shortReg');
}

function pickRepresentativeSlotForDay(slots) {
  if (!Array.isArray(slots) || !slots.length) return null;
  const wetSlots = slots.filter((s) => s.wet || isWetPty(s.pty));
  if (wetSlots.length) {
    return [...wetSlots].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))[0];
  }
  let best = slots[0];
  for (const s of slots) {
    if (Math.abs(s.hour - 15) < Math.abs(best.hour - 15)) best = s;
  }
  return best;
}

/** 다크·라이트 UI용 Lucide stroke (일별 스트립·칩 공통) */
export function weatherGlyphStrokeProps(Icon, theme = 'dark') {
  const strokeWidth = 1.85;
  const onLight = theme === 'light';
  if (onLight) {
    if (Icon === Sun) return { stroke: '#b45309', strokeWidth };
    if (Icon === CloudSun) return { stroke: '#78716c', strokeWidth };
    if (Icon === CloudFog || Icon === Cloud) return { stroke: '#64748b', strokeWidth };
    if (Icon === CloudRain || Icon === CloudDrizzle) return { stroke: '#0369a1', strokeWidth };
    if (Icon === CloudSnow || Icon === CloudHail) return { stroke: '#475569', strokeWidth };
    if (Icon === CloudLightning) return { stroke: '#a16207', strokeWidth };
    return { stroke: '#64748b', strokeWidth };
  }
  if (Icon === Sun) return { stroke: '#fde047', strokeWidth };
  if (Icon === CloudSun) return { stroke: '#fefce8', strokeWidth };
  if (Icon === CloudFog || Icon === Cloud) return { stroke: '#cbd5e1', strokeWidth };
  if (Icon === CloudRain || Icon === CloudDrizzle) return { stroke: '#e0f2fe', strokeWidth };
  if (Icon === CloudSnow || Icon === CloudHail) return { stroke: '#f8fafc', strokeWidth };
  if (Icon === CloudLightning) return { stroke: '#fef9c3', strokeWidth };
  return { stroke: '#f8fafc', strokeWidth };
}

/** 단기·초단기 시계열 → 날짜별 대표 아이콘·상태 (오늘·내일·…) */
export function buildDailyWeatherOutlook(weatherData, opts = {}) {
  if (weatherData == null || typeof weatherData !== 'object') return [];
  if (weatherData.configured === false) return [];

  const t = opts.t;
  const dayCount = opts.dayCount ?? 7;
  const now = opts.now ?? new Date();
  const nowParts = nowYyyymmddHour(now);
  const afsHint = inferPrecipFromAfsDs(weatherData.afsDs);

  const series = resolveSeriesForWeatherTimeline(weatherData);
  const merged = mergeSeriesBySlot(series);
  const byDate = new Map();

  for (const row of merged) {
    if (row.date < nowParts.yyyymmdd) continue;
    const slot = mergedRowToSlot(row);
    if (!slot) continue;
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date).push(slot);
  }

  const vsrtTl = buildTravelWeatherTimeline(series, {
    maxSlots: 48,
    vsrtHourly: weatherData?.vsrtHourly,
    skipVsrt: false,
    now,
  });
  for (const s of vsrtTl.slots || []) {
    if (s.date < nowParts.yyyymmdd) continue;
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    const list = byDate.get(s.date);
    const idx = list.findIndex((x) => x.hour === s.hour);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...s, Icon: s.Icon, iconProps: s.iconProps };
    } else {
      list.push(s);
    }
  }

  const dates = Array.from(byDate.keys()).sort().slice(0, dayCount);

  const outlook = dates
    .map((date) => {
      const slots = byDate.get(date).sort((a, b) => a.hour - b.hour);
      let pick = pickRepresentativeSlotForDay(slots);
      if (!pick?.Icon) return null;

      const dryToday =
        date === nowParts.yyyymmdd &&
        afsHint?.wet &&
        !(pick.wet || isWetPty(pick.pty));
      if (dryToday) {
        const fromAfs = glyphPickFromPrecipHint(afsHint, t);
        pick = {
          ...pick,
          Icon: fromAfs.Icon,
          iconProps: fromAfs.iconProps,
          wet: true,
          pty: afsHint.pty,
        };
      }

      const tmps = slots.map((s) => s.tmp).filter((x) => x != null && Number.isFinite(x));
      const stateLabel =
        typeof t === 'function' ? skyStateLabel(pick.sky, pick.pty, pick.wet, t) : '';
      const minTmp = tmps.length ? Math.min(...tmps) : pick.tmp;
      const maxTmp = tmps.length ? Math.max(...tmps) : pick.tmp;

      return {
        date,
        dayLabel:
          typeof t === 'function'
            ? dayLabel(date, t)
            : `${date.slice(4, 6)}/${date.slice(6, 8)}`,
        Icon: pick.Icon,
        iconProps: pick.iconProps,
        stateLabel,
        tmp: pick.tmp,
        minTmp,
        maxTmp,
        maxPop: Math.max(
          slots.reduce((m, s) => Math.max(m, s.pop ?? 0), 0),
          dryToday ? afsHint.pop ?? 0 : 0
        ),
        wetDay: slots.some((s) => s.wet || isWetPty(s.pty)) || dryToday,
      };
    })
    .filter(Boolean);

  if (outlook.length === 0 && afsHint?.wet) {
    const fromAfs = glyphPickFromPrecipHint(afsHint, t);
    return [
      {
        date: nowParts.yyyymmdd,
        dayLabel:
          typeof t === 'function' ? dayLabel(nowParts.yyyymmdd, t) : '오늘',
        Icon: fromAfs.Icon,
        iconProps: fromAfs.iconProps,
        stateLabel: fromAfs.stateLabel,
        tmp: null,
        minTmp: null,
        maxTmp: null,
        maxPop: afsHint.pop ?? 60,
        wetDay: true,
      },
    ];
  }

  return outlook;
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
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    setState({ phase: 'loading', data: null });
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    const GEO_CAP_MS = 9000;
    const WEATHER_REQ_MS = 26000;

    const settleReady = (data) => {
      if (!alive) return;
      setState({ phase: 'ready', data });
    };

    (async () => {
      try {
        const pos = await getGeoForWeatherCapped(GEO_CAP_MS);
        const withGeo = pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {};

        const fetchShortReg = async (params) =>
          axios.get('/api/v1/weather/short-reg', { params, timeout: WEATHER_REQ_MS });

        let res;
        try {
          res = await fetchShortReg(withGeo);
        } catch (e1) {
          if (Object.keys(withGeo).length > 0) {
            try {
              res = await fetchShortReg({});
            } catch {
              throw e1;
            }
          } else {
            throw e1;
          }
        }

        const body = res?.data;
        if (!alive) return;

        if (body && body.success === false) {
          const msg =
            typeof body.message === 'string' && body.message.trim()
              ? body.message.trim()
              : typeof body.code === 'string' && body.code.trim()
                ? body.code.trim()
                : '';
          settleReady(createNavWeatherFallbackData(msg));
          return;
        }

        const d = body?.data;
        if (d != null && typeof d === 'object') {
          settleReady(d);
        } else {
          settleReady(createNavWeatherFallbackData());
        }
      } catch (err) {
        if (!alive) return;
        // iOS WebView 에서 실제 무엇이 잘못됐는지 추적할 수 있도록 raw 에러를
        // window 에 dump. (Safari Web Inspector 의 콘솔에서 window.__lastWeatherError 로 확인)
        try {
          if (typeof window !== 'undefined') {
            window.__lastWeatherError = {
              at: new Date().toISOString(),
              code: err?.code,
              status: err?.response?.status,
              message: err?.message,
              dataType: typeof err?.response?.data,
              dataPreview:
                typeof err?.response?.data === 'string'
                  ? err.response.data.slice(0, 400)
                  : err?.response?.data || null,
              configUrl: err?.config?.url,
              configBaseURL: err?.config?.baseURL,
            };
          }
          // eslint-disable-next-line no-console
          console.error('[weather] short-reg request failed', err);
        } catch {}
        settleReady(createNavWeatherFallbackData(extractApiErrorMessage(err)));
      }
    })();

    return () => {
      alive = false;
    };
  }, [tick]);

  return { phase: state.phase, data: state.data, reload };
}
