"use client";

/**
 * /wellness — 한국관광공사 웰니스관광(WellnessTursmService) 기반 힐링 스팟 탐색 페이지.
 *
 * 컨셉: "정주행 번아웃 · 내 주변 힐링 스팟"
 * 영화/드라마 정주행 후 쌓인 눈·어깨·멘탈 피로를 풀어주는 온천·스파·힐링숲·템플스테이·명상 추천.
 *
 * 데이터 소스:
 *  - GET /api/v1/wellness?limit=0              (areaBasedList, 전국 전체)
 *  - GET /api/v1/wellness/nearby?lat&lon&radius (locationBasedList)
 *  - GET /api/v1/wellness/search?q=<keyword>   (searchKeyword)
 *
 * UI 구성:
 *  - 상단 hero: 검색창 + "내 주변 힐링 스팟 찾기" 버튼 + 지도/리스트 토글
 *  - 테마 칩 (온천 · 스파 · 템플스테이 · 힐링숲 · 명상 · 요가 · 자연휴양림)
 *  - 17개 광역 지역 칩
 *  - 지도 모드: Leaflet + OSM (사용자 위치 파란 마커 + 힐링 스팟 민트 마커)
 *  - 리스트 모드: 카드 그리드 + 무한 스크롤
 *
 * 교차 접점:
 *  - 햄버거 메뉴의 "내 주변 힐링 스팟" → /wellness?nearby=true
 *  - 대시보드 CTA → /wellness
 *  - 영화 상세(장르→자동키워드), DVD 매장(좌표), cine-trip(지역명) → NearbyWellnessStrip
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import {
  Sparkles,
  Search,
  LocateFixed,
  Navigation,
  X,
  MapPin,
  Phone,
  List as ListIcon,
  Map as MapIcon,
  Ruler,
} from "lucide-react";
import WellnessRecoveryCalendar from "@/components/WellnessRecoveryCalendar";

// Leaflet SSR 이슈 방지: 클라이언트에서만 로딩.
let L, MapContainer, TileLayer, Marker, Popup, useMap;
let mintIcon, blueIcon;
if (typeof window !== "undefined") {
  L = require("leaflet");
  const rl = require("react-leaflet");
  MapContainer = rl.MapContainer;
  TileLayer = rl.TileLayer;
  Marker = rl.Marker;
  Popup = rl.Popup;
  useMap = rl.useMap;

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });

  // 민트/그린 톤 마커 (웰니스 아이덴티티)
  mintIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  });
  blueIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  });
}

const KOREA_CENTER = [36.5, 127.5];
const DEFAULT_ZOOM = 7;
const RADIUS_OPTIONS = [10, 30, 50]; // km
const PAGE_SIZE = 60;
/** Heroku 웜업·공공 API(data.go.kr) 지연까지 고려해 넉넉히 둠. */
const WELLNESS_FETCH_TIMEOUT_MS = 120_000;

const REGION_SHORTCUTS = [
  "서울", "부산", "인천", "대구", "대전",
  "광주", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북",
  "경남", "제주",
];

/** 장르별 회복 페어링 컨셉과 일치하는 테마 키워드. KTO API 에서 히트율이 검증된 단어들. */
const THEME_SHORTCUTS = [
  { key: "온천",       ko: "온천",       en: "Hot Spring" },
  { key: "스파",       ko: "스파",       en: "Spa" },
  { key: "템플스테이", ko: "템플스테이", en: "Temple Stay" },
  { key: "힐링숲",     ko: "힐링숲",     en: "Healing Forest" },
  { key: "명상",       ko: "명상",       en: "Meditation" },
  { key: "요가",       ko: "요가",       en: "Yoga" },
  { key: "자연휴양림", ko: "자연휴양림", en: "Nature Retreat" },
];

function WellnessInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoNearbyTriggered = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");
  /** 집중률 캘린더 CTA 등: KorService 광역코드 기반 목록 (/api/v1/wellness?korArea=&korSigungu=) */
  const [korRegion, setKorRegion] = useState(null);

  const [nearbyMode, setNearbyMode] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [locSource, setLocSource] = useState("");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (nearbyMode) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrored(false);
        const url =
          korRegion && korRegion.area
            ? (() => {
                const p = new URLSearchParams({ limit: "0", korArea: korRegion.area });
                if (korRegion.sigungu) p.set("korSigungu", korRegion.sigungu);
                return `/api/v1/wellness?${p.toString()}`;
              })()
            : keyword.trim()
              ? `/api/v1/wellness/search?q=${encodeURIComponent(keyword.trim())}&limit=0`
              : `/api/v1/wellness?limit=0`;
        const fetchOnce = () => axios.get(url, { timeout: WELLNESS_FETCH_TIMEOUT_MS });
        let res;
        try {
          res = await fetchOnce();
        } catch (_) {
          await new Promise((r) => setTimeout(r, 600));
          res = await fetchOnce();
        }
        if (cancelled) return;
        if (res?.data?.success === false) {
          setErrored(true);
          setSpots([]);
          return;
        }
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setSpots(data);
        setVisibleCount(Math.min(PAGE_SIZE, data.length));
      } catch (e) {
        if (!cancelled) {
          setErrored(true);
          setSpots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [keyword, nearbyMode, korRegion]);

  const applyKeyword = useCallback((next) => {
    const v = (next || "").trim();
    setKeyword(v);
    setSearchInput(v);
    setKorRegion(null);
    setNearbyMode(false);
    const qs = new URLSearchParams();
    if (v) qs.set("q", v);
    router.replace(`/wellness${qs.toString() ? `?${qs.toString()}` : ""}`);
  }, [router]);

  const onSubmit = (e) => {
    e.preventDefault();
    applyKeyword(searchInput);
  };

  const fetchNearby = useCallback(async (lat, lon, rKm) => {
    setNearbyLoading(true);
    setNearbyError("");
    try {
      const rMeters = Math.round(rKm * 1000);
      const nearbyOnce = () =>
        axios.get(`/api/v1/wellness/nearby`, {
          params: { lat, lon, radius: rMeters, limit: 0 },
          timeout: WELLNESS_FETCH_TIMEOUT_MS,
        });
      let res;
      try {
        res = await nearbyOnce();
      } catch (_) {
        await new Promise((r) => setTimeout(r, 600));
        res = await nearbyOnce();
      }
      const data = Array.isArray(res?.data?.data) ? res.data.data : [];
      setSpots(data);
      setVisibleCount(Math.min(PAGE_SIZE, data.length));
      if (data.length === 0) {
        setNearbyError(t("wellness.noNearbyRadius", { radius: rKm }));
      }
    } catch (e) {
      setNearbyError(t("wellness.nearbyFetchFailed"));
    } finally {
      setNearbyLoading(false);
    }
  }, [t]);

  const fallbackToIp = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("ip fallback");
      const d = await res.json();
      if (d.latitude && d.longitude) {
        setLocSource(t("wellness.ipLocation"));
        setUserPos({ lat: d.latitude, lon: d.longitude });
        fetchNearby(d.latitude, d.longitude, radiusKm);
        return;
      }
    } catch (_) {}
    setNearbyLoading(false);
    setNearbyError(t("wellness.locationUnavailable"));
  }, [fetchNearby, radiusKm, t]);

  const handleNearby = useCallback(() => {
    setNearbyLoading(true);
    setNearbyMode(true);
    setNearbyError("");
    setLocSource("");
    setKeyword("");
    setSearchInput("");
    setKorRegion(null);
    router.replace(`/wellness?nearby=true`);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fallbackToIp();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocSource(t("wellness.gpsLocation"));
        setUserPos({ lat: latitude, lon: longitude });
        fetchNearby(latitude, longitude, radiusKm);
      },
      () => fallbackToIp(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [fallbackToIp, fetchNearby, radiusKm, router, t]);

  useEffect(() => {
    if (!mounted) return;
    if (searchParams.get("nearby") === "true" && !autoNearbyTriggered.current) {
      autoNearbyTriggered.current = true;
      handleNearby();
    }
  }, [mounted, searchParams, handleNearby]);

  /** 같은 페이지 내 클라이언트 이동 시 URL → state 동기화 */
  useEffect(() => {
    if (!mounted) return;
    if (searchParams.get("nearby") === "true") return;
    const qFromUrl = searchParams.get("q") ?? "";
    setKeyword(qFromUrl);
    setSearchInput(qFromUrl);
    const ka = searchParams.get("korArea");
    const ks = searchParams.get("korSigungu");
    if (ka != null && String(ka).trim() !== "") {
      setKorRegion({ area: String(ka).trim(), sigungu: ks != null && String(ks).trim() !== "" ? String(ks).trim() : "" });
    } else {
      setKorRegion(null);
    }
  }, [mounted, searchParams]);

  const handleRadiusChange = (r) => {
    setRadiusKm(r);
    if (nearbyMode && userPos) fetchNearby(userPos.lat, userPos.lon, r);
  };

  const exitNearby = () => {
    setNearbyMode(false);
    setUserPos(null);
    setNearbyError("");
    setLocSource("");
    router.replace(`/wellness`);
    setKeyword("");
    setSearchInput("");
    setKorRegion(null);
  };

  useEffect(() => {
    if (viewMode !== "list") return undefined;
    if (typeof window === "undefined") return undefined;
    if (!sentinelRef.current) return undefined;
    if (visibleCount >= spots.length) return undefined;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((c) => Math.min(c + PAGE_SIZE, spots.length));
          }
        }
      },
      { rootMargin: "600px 0px 600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [viewMode, visibleCount, spots.length]);

  const mappable = useMemo(
    () => spots.filter((s) => s.latitude != null && s.longitude != null),
    [spots]
  );

  const headerCountLabel = useMemo(() => {
    if (loading || nearbyLoading) return null;
    return t("wellness.totalCount", { count: spots.length });
  }, [loading, nearbyLoading, spots.length, t]);

  const lang = i18n?.language || "ko";

  return (
    <div className="wel-root">
      <style>{cssBlock}</style>

      <header className="wel-hero">
        <div className="wel-hero-inner">
          <div className="wel-tag">
            <Sparkles size={14} />
            <span>Korea Wellness · Recovery</span>
          </div>
          <h1 className="wel-title">{t("wellness.pageTitle")}</h1>
          <p className="wel-sub">{t("wellness.pageSubtitle")}</p>

          <form className="wel-search" onSubmit={onSubmit} role="search">
            <Search size={16} className="wel-search-icon" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("wellness.searchPlaceholder")}
              className="wel-search-input"
              aria-label={t("wellness.searchPlaceholder")}
            />
            <button type="submit" className="wel-search-btn">
              {t("wellness.searchBtn")}
            </button>
          </form>

          <button
            type="button"
            onClick={handleNearby}
            disabled={nearbyLoading}
            className={`wel-nearby-btn ${nearbyMode ? "wel-nearby-btn-active" : ""}`}
          >
            <LocateFixed
              size={16}
              style={nearbyLoading ? { animation: "wel-spin 1s linear infinite" } : {}}
            />
            {nearbyLoading ? t("wellness.locating") : t("wellness.findNearbyBtn")}
          </button>

          <div className="wel-theme-chips" role="group" aria-label={t("wellness.themeLabel")}>
            {THEME_SHORTCUTS.map((th) => (
              <button
                key={th.key}
                type="button"
                className={`wel-theme-chip ${keyword === th.key ? "wel-theme-chip-active" : ""}`}
                onClick={() => applyKeyword(th.key)}
              >
                {lang.startsWith("en") ? th.en : th.ko}
              </button>
            ))}
          </div>

          <div className="wel-chips" role="group" aria-label={t("wellness.shortcutsLabel")}>
            <button
              type="button"
              className={`wel-chip ${keyword === "" && !nearbyMode && !korRegion ? "wel-chip-active" : ""}`}
              onClick={() => applyKeyword("")}
            >
              {t("wellness.allRegions")}
            </button>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r}
                type="button"
                className={`wel-chip ${keyword === r ? "wel-chip-active" : ""}`}
                onClick={() => applyKeyword(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/*
       * 정주행 회복 캘린더 · 웰니스 × 관광지 집중률 크로스오버.
       * 지도 모드에서는 카드가 시야를 방해하지 않도록 숨김.
       * 내부적으로 영어 모드/데이터 없음일 때 자동 숨김.
       */}
      {viewMode !== "map" && !nearbyMode && (
        <div style={{ padding: "0 20px" }}>
          <WellnessRecoveryCalendar />
        </div>
      )}

      {nearbyMode && (
        <div className="wel-nearby-panel">
          <div className="wel-nearby-top">
            <div className="wel-nearby-info">
              <Navigation size={14} />
              <span>{t("wellness.myLocationSearch")}</span>
              {locSource && <span className="wel-nearby-src">({locSource})</span>}
            </div>
            <button type="button" onClick={exitNearby} className="wel-nearby-close" aria-label={t("wellness.exit")}>
              <X size={16} />
            </button>
          </div>
          <div className="wel-nearby-radius">
            <Ruler size={14} />
            <span>{t("wellness.radiusLabel")}</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`wel-radius-chip ${radiusKm === r ? "wel-radius-chip-active" : ""}`}
                onClick={() => handleRadiusChange(r)}
              >
                {r}km
              </button>
            ))}
          </div>
          {nearbyError && <div className="wel-nearby-error">{nearbyError}</div>}
        </div>
      )}

      <div className="wel-toolbar">
        <div className="wel-toolbar-left">
          {headerCountLabel && (
            <span className="wel-total">{headerCountLabel}</span>
          )}
        </div>
        <div className="wel-toolbar-right">
          <button
            type="button"
            className={`wel-view-btn ${viewMode === "list" ? "wel-view-btn-active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <ListIcon size={14} /> {t("wellness.list")}
          </button>
          <button
            type="button"
            className={`wel-view-btn ${viewMode === "map" ? "wel-view-btn-active" : ""}`}
            onClick={() => setViewMode("map")}
            aria-pressed={viewMode === "map"}
          >
            <MapIcon size={14} /> {t("wellness.map")}
          </button>
        </div>
      </div>

      <main className="wel-main">
        {viewMode === "map" ? (
          <div className="wel-map-wrap">
            {mounted && MapContainer && (
              <MapContainer
                center={userPos ? [userPos.lat, userPos.lon] : KOREA_CENTER}
                zoom={userPos ? 11 : DEFAULT_ZOOM}
                style={{ width: "100%", height: "70vh", borderRadius: 12 }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds spots={mappable} userPos={userPos} />
                {userPos && (
                  <Marker position={[userPos.lat, userPos.lon]} icon={blueIcon}>
                    <Popup>{t("wellness.myLocation")}</Popup>
                  </Marker>
                )}
                {mappable.map((s) => (
                  <Marker key={s.id} position={[s.latitude, s.longitude]} icon={mintIcon}>
                    <Popup>
                      <MarkerPopup spot={s} />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        ) : (
          <>
            {loading || nearbyLoading ? (
              <div className="wel-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`sk-${i}`} className="wel-card wel-skeleton">
                    <div className="wel-img wel-sk-img" />
                    <div className="wel-body">
                      <div className="wel-sk-line wel-sk-line-lg" />
                      <div className="wel-sk-line" />
                      <div className="wel-sk-line wel-sk-line-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errored ? (
              <EmptyState icon="⚠️" title={t("wellness.error")} desc={t("wellness.errorHint")} />
            ) : spots.length === 0 ? (
              <EmptyState
                icon="🧘"
                title={nearbyMode ? t("wellness.nearbyEmpty") : t("wellness.empty")}
                desc={t("wellness.emptyHint")}
              />
            ) : (
              <>
                <div className="wel-grid">
                  {spots.slice(0, visibleCount).map((s) => (
                    <WellnessCard key={s.id} spot={s} />
                  ))}
                </div>
                {visibleCount < spots.length && (
                  <div className="wel-more">
                    <div ref={sentinelRef} aria-hidden className="wel-sentinel" />
                    <button
                      type="button"
                      className="wel-more-btn"
                      onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, spots.length))}
                    >
                      {t("wellness.loadMore", { shown: visibleCount, total: spots.length })}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FitBounds({ spots, userPos }) {
  const map = useMap ? useMap() : null;
  useEffect(() => {
    if (!map || !L) return;
    const pts = [];
    spots.forEach((s) => {
      if (s.latitude != null && s.longitude != null) {
        pts.push([s.latitude, s.longitude]);
      }
    });
    if (userPos) pts.push([userPos.lat, userPos.lon]);
    if (pts.length === 0) return;
    try {
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } catch (_) {}
  }, [map, spots, userPos]);
  return null;
}

function MarkerPopup({ spot }) {
  const { t } = useTranslation();
  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{spot.name}</div>
      {spot.address && (
        <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
          📍 {spot.address}
        </div>
      )}
      <div style={{ fontSize: 12 }}>
        📞 {spot.tel || t("wellness.phoneNone")}
      </div>
    </div>
  );
}

function WellnessCard({ spot }) {
  const { t } = useTranslation();
  const mapUrl = spot.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent(spot.address)}`
    : null;
  return (
    <article className="wel-card">
      <div className="wel-img">
        {spot.imageUrl ? (
          <img
            src={spot.imageUrl}
            alt={spot.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="wel-img-placeholder">
            <Sparkles size={36} />
          </div>
        )}
        {spot.distanceKm != null && (
          <span className="wel-dist-badge">
            {spot.distanceKm < 1
              ? `${Math.round(spot.distanceKm * 1000)}m`
              : `${spot.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="wel-body">
        <div className="wel-ctitle" title={spot.name || ""}>{spot.name}</div>
        {spot.address && (
          <div className="wel-meta">
            <MapPin size={12} />
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="wel-addr-link">
                {spot.address}
              </a>
            ) : (
              <span>{spot.address}</span>
            )}
          </div>
        )}
        <div className="wel-meta wel-meta-sub">
          <Phone size={12} />
          <span>{spot.tel || t("wellness.phoneNone")}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="wel-empty" role="status">
      <div className="wel-empty-emoji" aria-hidden>{icon}</div>
      <div className="wel-empty-title">{title}</div>
      {desc && <div className="wel-empty-desc">{desc}</div>}
    </div>
  );
}

export default function WellnessPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading…</div>}>
      <WellnessInner />
    </Suspense>
  );
}

const cssBlock = `
.wel-root {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(16, 185, 129, 0.18) 0%, transparent 60%),
    radial-gradient(1000px 400px at 100% 0%, rgba(139, 92, 246, 0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0a0d10 0%, #101420 100%);
  color: #f5f5f5;
}
.wel-hero {
  padding: 40px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.wel-hero-inner { max-width: 1200px; margin: 0 auto; }
.wel-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: #a7f3d0;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.28);
  padding: 6px 10px; border-radius: 999px;
}
.wel-title {
  margin: 14px 0 6px;
  font-size: clamp(22px, 4vw, 36px);
  font-weight: 900;
  letter-spacing: -0.01em;
  background: linear-gradient(90deg, #a7f3d0 0%, #c4b5fd 50%, #fbcfe8 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  line-height: 1.15;
}
.wel-sub {
  margin: 0 0 16px;
  color: #c6c6c6; font-size: 0.95rem;
  max-width: 760px; line-height: 1.5;
}
.wel-search {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px; padding: 6px 6px 6px 16px;
  max-width: 520px; margin-bottom: 10px;
}
.wel-search-icon { color: #bdbdbd; }
.wel-search-input {
  flex: 1 1 auto; background: transparent; border: none; outline: none;
  color: #f5f5f5; font-size: 0.95rem; padding: 8px 0; min-width: 0;
}
.wel-search-input::placeholder { color: #8a8a8a; }
.wel-search-btn {
  flex: 0 0 auto; border: none;
  background: linear-gradient(135deg, #10b981 0%, #8b5cf6 100%);
  color: #fff; font-weight: 700; font-size: 0.88rem;
  padding: 8px 16px; border-radius: 999px; cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.wel-search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4); }

.wel-nearby-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.28);
  color: #6ee7b7;
  padding: 10px 16px; border-radius: 999px;
  font-weight: 700; font-size: 0.9rem; cursor: pointer;
  transition: all 0.2s ease;
}
.wel-nearby-btn:hover { background: rgba(16, 185, 129, 0.18); }
.wel-nearby-btn-active {
  background: linear-gradient(135deg, #059669, #7c3aed);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
}
.wel-nearby-btn:disabled { cursor: wait; opacity: 0.85; }

.wel-theme-chips {
  margin-top: 16px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.wel-theme-chip {
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.22);
  color: #a7f3d0;
  font-size: 0.82rem; font-weight: 700;
  padding: 6px 14px;
  border-radius: 999px; cursor: pointer;
  transition: all 0.15s ease;
}
.wel-theme-chip:hover {
  background: rgba(16,185,129,0.18);
  color: #fff;
  transform: translateY(-1px);
}
.wel-theme-chip-active {
  background: linear-gradient(135deg, #10b981 0%, #8b5cf6 100%);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 12px rgba(139,92,246,0.3);
}

.wel-chips {
  margin-top: 12px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.wel-chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.82rem;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.wel-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
.wel-chip-active {
  background: linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(139,92,246,0.2) 100%);
  border-color: rgba(16,185,129,0.55);
  color: #fff;
}

.wel-nearby-panel {
  max-width: 1200px; margin: 16px auto 0; padding: 12px 16px;
  background: rgba(16,185,129,0.08);
  border: 1px solid rgba(16,185,129,0.22);
  border-radius: 12px;
}
.wel-nearby-top { display: flex; justify-content: space-between; align-items: center; }
.wel-nearby-info { display: flex; align-items: center; gap: 6px; color: #6ee7b7; font-weight: 700; font-size: 0.9rem; }
.wel-nearby-src { font-size: 0.72rem; color: rgba(255,255,255,0.4); font-weight: 400; }
.wel-nearby-close { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 4px; }
.wel-nearby-radius {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px; margin-top: 10px;
  font-size: 0.85rem; color: rgba(255,255,255,0.7);
}
.wel-radius-chip {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.8rem; padding: 4px 10px;
  border-radius: 999px; cursor: pointer;
}
.wel-radius-chip-active {
  background: linear-gradient(135deg, #059669, #7c3aed);
  color: #fff; border-color: transparent;
}
.wel-nearby-error { margin-top: 8px; color: #fda4af; font-size: 0.82rem; }

.wel-toolbar {
  max-width: 1200px; margin: 16px auto 0;
  padding: 0 16px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 10px; flex-wrap: wrap;
}
.wel-total { color: #dc2626; font-weight: 800; font-size: 1rem; }
.wel-toolbar-right { display: inline-flex; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 3px; }
.wel-view-btn {
  background: transparent; border: none; color: rgba(255,255,255,0.65);
  font-size: 0.82rem; font-weight: 600; padding: 6px 12px;
  border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.2s ease;
}
.wel-view-btn-active { background: linear-gradient(135deg, #10b981, #8b5cf6); color: #fff; }

.wel-main { max-width: 1200px; margin: 0 auto; padding: 20px 16px 60px; }
.wel-map-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.wel-map-wrap .leaflet-container img { max-width: none !important; max-height: none !important; height: auto; }

.wel-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}
@media (min-width: 560px) { .wel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 900px) { .wel-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .wel-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.wel-card {
  background: rgba(20, 22, 28, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; overflow: hidden;
  color: #f1f1f1;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  display: flex; flex-direction: column;
}
.wel-card:hover {
  transform: translateY(-3px);
  border-color: rgba(16, 185, 129, 0.35);
  box-shadow: 0 10px 24px rgba(0,0,0,0.4);
}
.wel-img {
  position: relative; width: 100%; padding-top: 62%;
  background: #0e0e0e; overflow: hidden;
}
.wel-img img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.wel-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(139,92,246,0.04) 100%);
}
.wel-dist-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(16, 185, 129, 0.85);
  color: #04241c;
  font-size: 0.72rem; font-weight: 800;
  padding: 4px 10px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.wel-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.wel-ctitle {
  font-size: 0.98rem; font-weight: 700; line-height: 1.3; color: #fff;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.wel-meta {
  font-size: 0.82rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start;
  line-height: 1.4;
}
.wel-meta-sub { color: #9ba3a0; }
.wel-addr-link {
  color: #c6c6c6; text-decoration: none;
  border-bottom: 1px dotted rgba(255,255,255,0.25);
}
.wel-addr-link:hover { color: #6ee7b7; border-bottom-color: rgba(110,231,183,0.5); }

.wel-skeleton { cursor: default; }
.wel-sk-img, .wel-sk-line {
  background: linear-gradient(90deg, #1e2228 0%, #2a2f36 50%, #1e2228 100%);
  background-size: 200% 100%;
  animation: wel-shine 1.4s linear infinite;
  border-radius: 6px;
}
.wel-sk-img { position: absolute; inset: 0; }
.wel-sk-line { height: 10px; margin-top: 6px; width: 70%; }
.wel-sk-line-lg { height: 14px; width: 85%; }
.wel-sk-line-sm { width: 45%; }

.wel-more {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin: 20px 0 4px;
}
.wel-sentinel { width: 1px; height: 1px; }
.wel-more-btn {
  background: rgba(255,255,255,0.08);
  color: #f1f1f1;
  border: 1px solid rgba(255,255,255,0.16);
  padding: 10px 18px; border-radius: 999px;
  font-size: 0.88rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.wel-more-btn:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.28); }

.wel-empty { padding: 60px 20px; text-align: center; color: #cfcfcf; }
.wel-empty-emoji { font-size: 40px; }
.wel-empty-title { margin-top: 8px; font-size: 1.05rem; font-weight: 700; color: #f5f5f5; }
.wel-empty-desc { margin-top: 6px; color: #a6a6a6; font-size: 0.9rem; }

@keyframes wel-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes wel-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;
