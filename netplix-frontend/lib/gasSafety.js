/**
 * 가스사고 통계(시군구) 공용 유틸 — 모달과 LED 사인이 공유한다.
 *
 * - fetchGasSigungu(): 백엔드 프록시로 시군구별 통계(발생건수+중심좌표) 조회
 * - resolveMyRegion(): GPS 좌표 → (역지오코딩) → 내 시군구 행. 실패 시 중심좌표 최근접 폴백
 */

import axios from "@/lib/axiosConfig";

export async function fetchGasSigungu() {
  const res = await axios.get("/api/v1/gas-safety/sigungu");
  const payload = res?.data;
  const ok = payload && typeof payload === "object" && payload.success !== false;
  return ok && Array.isArray(payload.data) ? payload.data : [];
}

/**
 * 날씨 네비 위젯이 저장해 둔 마지막 좌표를 즉시 가져온다(localStorage).
 * iOS WebView 에서 위치 콜백이 지연될 때, 이미 확보된 좌표로 바로 내 시군구를 표시하기 위함.
 * 캐시 geo 는 {lat, lng} 형태(웹) — lon/lng 모두 허용.
 */
export function getCachedGeo() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = localStorage.getItem("touraz.weatherNav.v1");
    if (!raw) return null;
    const o = JSON.parse(raw);
    const g = o?.geo || {};
    const lat = Number(g.lat);
    const lon = Number(g.lng != null ? g.lng : g.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  } catch (_) {
    return null;
  }
}

export function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 좌표 → 가장 가까운 시군구(중심좌표 기준). 역지오코딩 실패 시 폴백용. */
export function nearestByCentroid(loc, rows) {
  let best = null;
  let bestD = Infinity;
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
    const d = haversineKm(loc.lat, loc.lon, r.lat, r.lon);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/**
 * 좌표 → 행정구역명(역지오코딩, OpenStreetMap Nominatim) → 스냅샷 시군구 행에 매칭.
 *
 * 섬/넓은 군처럼 중심좌표 최근접이 틀리는 경우를 바로잡는다(예: 거문도=여수시 삼산면).
 * Nominatim 은 무료·키 불필요·CORS 허용. 실패하면 null(호출부가 중심좌표 폴백).
 */
export async function reverseMatchRegion(loc, rows) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${loc.lat}` +
    `&lon=${loc.lon}&accept-language=ko&addressdetails=1&zoom=10`;
  // iOS 등에서 응답 지연 시 무한 대기를 막기 위해 7초 후 중단(→ 호출부가 중심좌표로 폴백).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;
  const j = await res.json();
  const a = j?.address || {};
  const sido = (a.province || a.state || a.region || "").trim();
  const parts = [
    a.city_district,
    a.borough,
    a.city,
    a.county,
    a.town,
    a.municipality,
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());
  if (parts.length === 0) return null;

  let pool = sido ? rows.filter((r) => String(r.region).startsWith(sido)) : rows;
  if (pool.length === 0) pool = rows;

  let best = null;
  let bestScore = 0;
  for (const r of pool) {
    let score = 0;
    for (const p of parts) {
      if (p && String(r.region).includes(p)) score += p.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore > 0 ? best : null;
}

/** GPS 좌표로 내 시군구 행을 해석(역지오코딩 우선, 실패 시 중심좌표 폴백). */
export async function resolveMyRegion(loc, rows) {
  if (!loc || !Array.isArray(rows) || rows.length === 0) return null;
  let region = null;
  try {
    region = await reverseMatchRegion(loc, rows);
  } catch (_) {
    region = null;
  }
  if (!region) region = nearestByCentroid(loc, rows);
  return region;
}
