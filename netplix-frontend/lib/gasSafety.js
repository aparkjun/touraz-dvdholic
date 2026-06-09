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

/**
 * GPS(위성/플러그인)로 좌표를 못 받을 때의 최후 폴백: 공인 IP 기반 대략 위치.
 * iOS 네이티브에서 위치 권한/플러그인 문제로 좌표가 안 잡혀도 시군구를 추정하기 위함.
 * HTTPS·CORS 허용 무료 서비스 사용. 실패 시 null. (통신사 게이트웨이 IP 라 정확도는 도시 단위)
 */
export async function getIpGeo() {
  const endpoints = [
    "https://ipapi.co/json/",
    "https://ipwho.is/",
  ];
  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      let res;
      try {
        res = await fetch(url, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) continue;
      const j = await res.json();
      const lat = Number(j.latitude ?? j.lat);
      const lon = Number(j.longitude ?? j.lon ?? j.lng);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return { lat, lon, approx: true };
      }
    } catch (_) {
      /* 다음 엔드포인트 시도 */
    }
  }
  return null;
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

async function fetchJsonCapped(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 좌표 → 행정구역 계층(시도 + 시·군·구 후보 이름들) 역지오코딩.
 * 1순위 BigDataCloud(키 불필요·CORS·한국 행정구역 계층 정확), 2순위 Nominatim.
 * 섬/넓은 군처럼 중심좌표 최근접이 틀리는 경우(예: 거문도=여수시 삼산면)를 바로잡기 위함.
 */
async function reverseAdminNames(loc) {
  // 1) BigDataCloud — localityInfo.administrative 로 도/시군구/읍면동 계층을 한국어로 제공.
  const bdc = await fetchJsonCapped(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.lat}` +
      `&longitude=${loc.lon}&localityLanguage=ko`,
    8000,
  );
  if (bdc) {
    const sido = String(bdc.principalSubdivision || "").trim();
    const names = [];
    const admin = bdc.localityInfo && bdc.localityInfo.administrative;
    if (Array.isArray(admin)) {
      for (const a of admin) {
        if (a && a.name) names.push(String(a.name).trim());
      }
    }
    if (bdc.city) names.push(String(bdc.city).trim());
    if (bdc.locality) names.push(String(bdc.locality).trim());
    const parts = names.filter(Boolean);
    if (sido || parts.length) return { sido, parts };
  }

  // 2) Nominatim 폴백
  const nom = await fetchJsonCapped(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${loc.lat}` +
      `&lon=${loc.lon}&accept-language=ko&addressdetails=1&zoom=10`,
    8000,
  );
  if (nom) {
    const a = nom.address || {};
    const sido = String(a.province || a.state || a.region || "").trim();
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
    if (sido || parts.length) return { sido, parts };
  }

  return null;
}

/** 좌표 → 역지오코딩 행정구역명 → 스냅샷 시군구 행 매칭. 실패 시 null(호출부가 중심좌표 폴백). */
export async function reverseMatchRegion(loc, rows) {
  const info = await reverseAdminNames(loc);
  if (!info) return null;
  const { sido, parts } = info;
  if (parts.length === 0 && !sido) return null;

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
