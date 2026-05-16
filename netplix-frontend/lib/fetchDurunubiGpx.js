/**
 * 두루누비 GPX 로드 — 백엔드 프록시 → (네이티브) 직접 fetch → CORS 프록시 순 폴백.
 * Heroku 등 데이터센터 IP는 durunubi WAF에 막히므로 브라우저/외부 프록시 경로가 필요하다.
 */

import axios from '@/lib/axiosConfig';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

const DURUNUBI_HOST = 'www.durunubi.kr';
const DEFAULT_CORS_PROXY = 'https://api.codetabs.com/v1/proxy?quest=';

export function isAllowedDurunubiGpxUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.toLowerCase() === DURUNUBI_HOST;
  } catch {
    return false;
  }
}

export function looksLikeGpxXml(textHead) {
  const h = (textHead || '').trim().toLowerCase();
  return h.startsWith('<?xml') || h.startsWith('<gpx');
}

function corsProxyBase() {
  const fromEnv =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DURUNUBI_GPX_CORS_PROXY : '';
  return (fromEnv && String(fromEnv).trim()) || DEFAULT_CORS_PROXY;
}

const DURUNUBI_HEADERS = {
  Accept: 'application/gpx+xml, application/xml, text/xml, */*;q=0.8',
  Referer: 'https://www.durunubi.kr/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};

async function validateXml(xml) {
  if (!xml || xml.length < 200 || !looksLikeGpxXml(xml.slice(0, 512))) {
    throw new Error('gpx-invalid');
  }
  return xml;
}

async function fetchViaBackend(gpxUrl, name, signal, timeout) {
  const path = `/api/v1/tour/trekking/gpx?url=${encodeURIComponent(gpxUrl)}&name=${encodeURIComponent(name)}`;
  const res = await axios.get(path, { responseType: 'blob', signal, timeout });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.size < 200) throw new Error('backend-empty');
  const head = await blob.slice(0, Math.min(512, blob.size)).text();
  if (!looksLikeGpxXml(head)) throw new Error('backend-invalid');
  return blob.text();
}

async function fetchDirectClient(gpxUrl, signal, timeout) {
  if (Capacitor?.isNativePlatform?.()) {
    const res = await CapacitorHttp.get({
      url: gpxUrl,
      headers: DURUNUBI_HEADERS,
      responseType: 'text',
      connectTimeout: timeout,
      readTimeout: timeout,
    });
    const xml = typeof res.data === 'string' ? res.data : String(res.data ?? '');
    return validateXml(xml);
  }

  const res = await fetch(gpxUrl, {
    headers: DURUNUBI_HEADERS,
    signal,
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`direct-${res.status}`);
  return validateXml(await res.text());
}

async function fetchViaCorsProxy(gpxUrl, signal, timeout) {
  const base = corsProxyBase();
  const proxyUrl = base + encodeURIComponent(gpxUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort);
  }
  try {
    const res = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`proxy-${res.status}`);
    return validateXml(await res.text());
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * @param {string} gpxUrl — courseList 의 gpxpath (https://www.durunubi.kr/... 만 허용)
 * @returns {Promise<string>} GPX XML
 */
export async function fetchDurunubiGpxXml(gpxUrl, { name = 'durunubi-course', signal, timeout = 28000 } = {}) {
  if (!gpxUrl?.trim()) throw new Error('gpx-missing');
  if (!isAllowedDurunubiGpxUrl(gpxUrl)) throw new Error('gpx-host');

  const steps = [
    () => fetchViaBackend(gpxUrl, name, signal, timeout),
    () => fetchDirectClient(gpxUrl, signal, timeout),
    () => fetchViaCorsProxy(gpxUrl, signal, timeout),
  ];

  let lastErr;
  for (const step of steps) {
    try {
      return await step();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('gpx-fetch-failed');
}

export async function fetchDurunubiGpxBlob({ gpxUrl, name, signal, timeout } = {}) {
  const xml = await fetchDurunubiGpxXml(gpxUrl, { name, signal, timeout });
  return new Blob([xml], { type: 'application/gpx+xml' });
}
