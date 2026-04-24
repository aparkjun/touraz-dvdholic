"use client";

/**
 * /camping — 한국관광공사 고캠핑(GoCamping) 기반 전국 야영장 탐색 페이지.
 *
 * 데이터 소스:
 *  - GET /api/v1/camping?limit=0              (전국 전체, basedList)
 *  - GET /api/v1/camping/nearby?lat&lon&radius (locationBasedList)
 *  - GET /api/v1/camping/search?q=<keyword>   (searchList)
 *
 * UI 구성:
 *  - 상단 hero: 검색창 + "내 주변 찾기" 버튼 + 반경 셀렉터 + 지도/리스트 토글
 *  - 17개 광역 지역 칩 (서울 ~ 제주)
 *  - 지도 모드: Leaflet 기반 OpenStreetMap 마커 (사용자 위치 파란 마커 + 야영장 녹색 마커)
 *  - 리스트 모드: 카드 그리드 + 무한 스크롤 (IntersectionObserver, 60개씩)
 *
 * 교차 접점:
 *  - 햄버거 메뉴의 "내 주변 야영장" → /camping?nearby=true
 *  - 대시보드 CTA → /camping
 *  - 영화/DVD/지역 상세에서 "근처 야영장" 섹션(NearbyCampingStrip) 클릭 → /camping?q=지역명
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import {
  Tent,
  Search,
  LocateFixed,
  Navigation,
  X,
  MapPin,
  Phone,
  List as ListIcon,
  Map as MapIcon,
  Ruler,
  ExternalLink,
} from "lucide-react";

// Leaflet SSR 이슈 방지: 클라이언트에서만 로딩.
let L, MapContainer, TileLayer, Marker, Popup, useMap;
let greenIcon, blueIcon;
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

  greenIcon = new L.Icon({
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

// 고캠핑 키워드 검색 히트율이 좋은 광역 축약형
const REGION_SHORTCUTS = [
  "서울", "부산", "인천", "대구", "대전",
  "광주", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북",
  "경남", "제주",
];

function CampingInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoNearbyTriggered = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [keyword, setKeyword] = useState(searchParams.get("q") || "");

  // 주변 모드
  const [nearbyMode, setNearbyMode] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [locSource, setLocSource] = useState("");

  // 무한스크롤
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 데이터 로딩: keyword 변경 시 재호출. 주변 모드에서는 별도 경로.
  useEffect(() => {
    if (nearbyMode) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrored(false);
        const url = keyword.trim()
          ? `/api/v1/camping/search?q=${encodeURIComponent(keyword.trim())}&limit=0`
          : `/api/v1/camping?limit=0`;
        const res = await axios.get(url);
        if (cancelled) return;
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setSites(data);
        setVisibleCount(Math.min(PAGE_SIZE, data.length));
      } catch (e) {
        if (!cancelled) {
          setErrored(true);
          setSites([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [keyword, nearbyMode]);

  const applyKeyword = useCallback((next) => {
    const v = (next || "").trim();
    setKeyword(v);
    setSearchInput(v);
    setNearbyMode(false);
    const qs = v ? `?q=${encodeURIComponent(v)}` : "";
    router.replace(`/camping${qs}`);
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
      const res = await axios.get(`/api/v1/camping/nearby`, {
        params: { lat, lon, radius: rMeters, limit: 0 },
      });
      const data = Array.isArray(res?.data?.data) ? res.data.data : [];
      setSites(data);
      setVisibleCount(Math.min(PAGE_SIZE, data.length));
      if (data.length === 0) {
        setNearbyError(t("camping.noNearbyRadius", { radius: rKm }));
      }
    } catch (e) {
      setNearbyError(t("camping.nearbyFetchFailed"));
    } finally {
      setNearbyLoading(false);
    }
  }, [t]);

  // IP 기반 폴백 (브라우저 GPS 거부 시)
  const fallbackToIp = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("ip fallback");
      const d = await res.json();
      if (d.latitude && d.longitude) {
        setLocSource(t("camping.ipLocation"));
        setUserPos({ lat: d.latitude, lon: d.longitude });
        fetchNearby(d.latitude, d.longitude, radiusKm);
        return;
      }
    } catch (_) {}
    setNearbyLoading(false);
    setNearbyError(t("camping.locationUnavailable"));
  }, [fetchNearby, radiusKm, t]);

  const handleNearby = useCallback(() => {
    setNearbyLoading(true);
    setNearbyMode(true);
    setNearbyError("");
    setLocSource("");
    setKeyword("");
    setSearchInput("");
    router.replace(`/camping?nearby=true`);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fallbackToIp();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocSource(t("camping.gpsLocation"));
        setUserPos({ lat: latitude, lon: longitude });
        fetchNearby(latitude, longitude, radiusKm);
      },
      () => fallbackToIp(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [fallbackToIp, fetchNearby, radiusKm, router, t]);

  // URL ?nearby=true 자동 진입 (햄버거 메뉴 링크 대응)
  useEffect(() => {
    if (!mounted) return;
    if (searchParams.get("nearby") === "true" && !autoNearbyTriggered.current) {
      autoNearbyTriggered.current = true;
      handleNearby();
    }
  }, [mounted, searchParams, handleNearby]);

  const handleRadiusChange = (r) => {
    setRadiusKm(r);
    if (nearbyMode && userPos) fetchNearby(userPos.lat, userPos.lon, r);
  };

  const exitNearby = () => {
    setNearbyMode(false);
    setUserPos(null);
    setNearbyError("");
    setLocSource("");
    router.replace(`/camping`);
    setKeyword("");
  };

  // 무한스크롤 센티넬 관측 (리스트 모드에서만)
  useEffect(() => {
    if (viewMode !== "list") return undefined;
    if (typeof window === "undefined") return undefined;
    if (!sentinelRef.current) return undefined;
    if (visibleCount >= sites.length) return undefined;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((c) => Math.min(c + PAGE_SIZE, sites.length));
          }
        }
      },
      { rootMargin: "600px 0px 600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [viewMode, visibleCount, sites.length]);

  const mappable = useMemo(
    () => sites.filter((s) => s.latitude != null && s.longitude != null),
    [sites]
  );

  const headerCountLabel = useMemo(() => {
    if (loading || nearbyLoading) return null;
    return t("camping.totalCount", { count: sites.length });
  }, [loading, nearbyLoading, sites.length, t]);

  return (
    <div className="cmp-root">
      <style>{cssBlock}</style>

      {/* HERO */}
      <header className="cmp-hero">
        <div className="cmp-hero-inner">
          <div className="cmp-tag">
            <Tent size={14} />
            <span>Korea GoCamping</span>
          </div>
          <h1 className="cmp-title">{t("camping.pageTitle")}</h1>
          <p className="cmp-sub">{t("camping.pageSubtitle")}</p>

          <form className="cmp-search" onSubmit={onSubmit} role="search">
            <Search size={16} className="cmp-search-icon" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("camping.searchPlaceholder")}
              className="cmp-search-input"
              aria-label={t("camping.searchPlaceholder")}
            />
            <button type="submit" className="cmp-search-btn">
              {t("camping.searchBtn")}
            </button>
          </form>

          <button
            type="button"
            onClick={handleNearby}
            disabled={nearbyLoading}
            className={`cmp-nearby-btn ${nearbyMode ? "cmp-nearby-btn-active" : ""}`}
          >
            <LocateFixed
              size={16}
              style={nearbyLoading ? { animation: "cmp-spin 1s linear infinite" } : {}}
            />
            {nearbyLoading ? t("camping.locating") : t("camping.findNearbyBtn")}
          </button>

          <div className="cmp-chips" role="group" aria-label={t("camping.shortcutsLabel")}>
            <button
              type="button"
              className={`cmp-chip ${keyword === "" && !nearbyMode ? "cmp-chip-active" : ""}`}
              onClick={() => applyKeyword("")}
            >
              {t("camping.allRegions")}
            </button>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r}
                type="button"
                className={`cmp-chip ${keyword === r ? "cmp-chip-active" : ""}`}
                onClick={() => applyKeyword(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 주변 모드 패널 */}
      {nearbyMode && (
        <div className="cmp-nearby-panel">
          <div className="cmp-nearby-top">
            <div className="cmp-nearby-info">
              <Navigation size={14} />
              <span>{t("camping.myLocationSearch")}</span>
              {locSource && <span className="cmp-nearby-src">({locSource})</span>}
            </div>
            <button type="button" onClick={exitNearby} className="cmp-nearby-close" aria-label={t("camping.exit")}>
              <X size={16} />
            </button>
          </div>
          <div className="cmp-nearby-radius">
            <Ruler size={14} />
            <span>{t("camping.radiusLabel")}</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`cmp-radius-chip ${radiusKm === r ? "cmp-radius-chip-active" : ""}`}
                onClick={() => handleRadiusChange(r)}
              >
                {r}km
              </button>
            ))}
          </div>
          {nearbyError && <div className="cmp-nearby-error">{nearbyError}</div>}
        </div>
      )}

      {/* 뷰 모드 + 총 개수 */}
      <div className="cmp-toolbar">
        <div className="cmp-toolbar-left">
          {headerCountLabel && (
            <span className="cmp-total">{headerCountLabel}</span>
          )}
        </div>
        <div className="cmp-toolbar-right">
          <button
            type="button"
            className={`cmp-view-btn ${viewMode === "list" ? "cmp-view-btn-active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <ListIcon size={14} /> {t("camping.list")}
          </button>
          <button
            type="button"
            className={`cmp-view-btn ${viewMode === "map" ? "cmp-view-btn-active" : ""}`}
            onClick={() => setViewMode("map")}
            aria-pressed={viewMode === "map"}
          >
            <MapIcon size={14} /> {t("camping.map")}
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="cmp-main">
        {viewMode === "map" ? (
          <div className="cmp-map-wrap">
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
                <FitBounds sites={mappable} userPos={userPos} />
                {userPos && (
                  <Marker position={[userPos.lat, userPos.lon]} icon={blueIcon}>
                    <Popup>{t("camping.myLocation")}</Popup>
                  </Marker>
                )}
                {mappable.map((s) => (
                  <Marker
                    key={s.id}
                    position={[s.latitude, s.longitude]}
                    icon={greenIcon}
                  >
                    <Popup>
                      <MarkerPopup site={s} />
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        ) : (
          <>
            {loading || nearbyLoading ? (
              <div className="cmp-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`sk-${i}`} className="cmp-card cmp-skeleton">
                    <div className="cmp-img cmp-sk-img" />
                    <div className="cmp-body">
                      <div className="cmp-sk-line cmp-sk-line-lg" />
                      <div className="cmp-sk-line" />
                      <div className="cmp-sk-line cmp-sk-line-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errored ? (
              <EmptyState icon="⚠️" title={t("camping.error")} desc={t("camping.errorHint")} />
            ) : sites.length === 0 ? (
              <EmptyState
                icon="⛺"
                title={nearbyMode ? t("camping.nearbyEmpty") : t("camping.empty")}
                desc={t("camping.emptyHint")}
              />
            ) : (
              <>
                <div className="cmp-grid">
                  {sites.slice(0, visibleCount).map((s) => (
                    <CampingCard key={s.id} site={s} />
                  ))}
                </div>
                {visibleCount < sites.length && (
                  <div className="cmp-more">
                    <div ref={sentinelRef} aria-hidden className="cmp-sentinel" />
                    <button
                      type="button"
                      className="cmp-more-btn"
                      onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, sites.length))}
                    >
                      {t("camping.loadMore", { shown: visibleCount, total: sites.length })}
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

// 지도 bounds 를 야영장 + 사용자 위치에 맞춰 자동 조정
function FitBounds({ sites, userPos }) {
  const map = useMap ? useMap() : null;
  useEffect(() => {
    if (!map || !L) return;
    const pts = [];
    sites.forEach((s) => {
      if (s.latitude != null && s.longitude != null) {
        pts.push([s.latitude, s.longitude]);
      }
    });
    if (userPos) pts.push([userPos.lat, userPos.lon]);
    if (pts.length === 0) return;
    try {
      const bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    } catch (_) {
      // no-op
    }
  }, [map, sites, userPos]);
  return null;
}

function MarkerPopup({ site }) {
  const { t } = useTranslation();
  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{site.name}</div>
      {site.address && (
        <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>
          📍 {site.address}
        </div>
      )}
      {site.induty && (
        <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
          {site.induty}
        </div>
      )}
      <div style={{ fontSize: 12 }}>
        📞 {site.tel || t("camping.phoneNone")}
      </div>
      {site.homepage && (
        <a
          href={site.homepage}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "#0ea5e9", marginTop: 4, display: "inline-block" }}
        >
          {t("camping.homepage")} ↗
        </a>
      )}
    </div>
  );
}

function CampingCard({ site }) {
  const { t } = useTranslation();
  const mapUrl = site.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent(site.address)}`
    : null;
  return (
    <article className="cmp-card">
      <div className="cmp-img">
        {site.imageUrl ? (
          <img
            src={site.imageUrl}
            alt={site.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="cmp-img-placeholder">
            <Tent size={36} />
          </div>
        )}
        {site.distanceKm != null && (
          <span className="cmp-dist-badge">
            {site.distanceKm < 1
              ? `${Math.round(site.distanceKm * 1000)}m`
              : `${site.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="cmp-body">
        <div className="cmp-ctitle" title={site.name || ""}>{site.name}</div>
        {site.induty && <div className="cmp-badges">{renderBadges(site.induty)}</div>}
        {site.address && (
          <div className="cmp-meta">
            <MapPin size={12} />
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="cmp-addr-link">
                {site.address}
              </a>
            ) : (
              <span>{site.address}</span>
            )}
          </div>
        )}
        <div className="cmp-meta cmp-meta-sub">
          <Phone size={12} />
          <span>{site.tel || t("camping.phoneNone")}</span>
        </div>
        {site.shortIntro && <p className="cmp-intro">{site.shortIntro}</p>}
        {site.homepage && (
          <a href={site.homepage} target="_blank" rel="noopener noreferrer" className="cmp-home">
            {t("camping.homepage")} <ExternalLink size={11} />
          </a>
        )}
      </div>
    </article>
  );
}

function renderBadges(induty) {
  // "일반야영장,자동차야영장,글램핑" → ["일반야영장","자동차야영장","글램핑"]
  const parts = String(induty).split(/[,，、\/]/).map((s) => s.trim()).filter(Boolean);
  return parts.slice(0, 3).map((p) => (
    <span key={p} className="cmp-badge">{p}</span>
  ));
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="cmp-empty" role="status">
      <div className="cmp-empty-emoji" aria-hidden>{icon}</div>
      <div className="cmp-empty-title">{title}</div>
      {desc && <div className="cmp-empty-desc">{desc}</div>}
    </div>
  );
}

export default function CampingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading…</div>}>
      <CampingInner />
    </Suspense>
  );
}

const cssBlock = `
.cmp-root {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(34, 197, 94, 0.18) 0%, transparent 60%),
    radial-gradient(1000px 400px at 100% 0%, rgba(16, 185, 129, 0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0b0f0b 0%, #101a12 100%);
  color: #f5f5f5;
}
.cmp-hero {
  padding: 40px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cmp-hero-inner { max-width: 1200px; margin: 0 auto; }
.cmp-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #a7f3d0;
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(34, 197, 94, 0.28);
  padding: 6px 10px;
  border-radius: 999px;
}
.cmp-title {
  margin: 14px 0 6px;
  font-size: clamp(22px, 4vw, 36px);
  font-weight: 900;
  letter-spacing: -0.01em;
  background: linear-gradient(90deg, #a7f3d0 0%, #fde68a 50%, #bae6fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  line-height: 1.15;
}
.cmp-sub {
  margin: 0 0 16px;
  color: #c6c6c6;
  font-size: 0.95rem;
  max-width: 760px;
  line-height: 1.5;
}
.cmp-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 6px 6px 6px 16px;
  max-width: 520px;
  margin-bottom: 10px;
}
.cmp-search-icon { color: #bdbdbd; }
.cmp-search-input {
  flex: 1 1 auto;
  background: transparent; border: none; outline: none;
  color: #f5f5f5; font-size: 0.95rem; padding: 8px 0; min-width: 0;
}
.cmp-search-input::placeholder { color: #8a8a8a; }
.cmp-search-btn {
  flex: 0 0 auto;
  border: none;
  background: linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%);
  color: #fff; font-weight: 700; font-size: 0.88rem;
  padding: 8px 16px; border-radius: 999px; cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.cmp-search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4); }

.cmp-nearby-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.28);
  color: #86efac;
  padding: 10px 16px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.cmp-nearby-btn:hover { background: rgba(34, 197, 94, 0.18); }
.cmp-nearby-btn-active {
  background: linear-gradient(135deg, #16a34a, #10b981);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
}
.cmp-nearby-btn:disabled { cursor: wait; opacity: 0.85; }

.cmp-chips {
  margin-top: 14px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.cmp-chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.82rem;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.cmp-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
.cmp-chip-active {
  background: linear-gradient(135deg, rgba(34,197,94,0.25) 0%, rgba(14,165,233,0.2) 100%);
  border-color: rgba(34,197,94,0.55);
  color: #fff;
}

.cmp-nearby-panel {
  max-width: 1200px; margin: 16px auto 0; padding: 12px 16px;
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.22);
  border-radius: 12px;
}
.cmp-nearby-top { display: flex; justify-content: space-between; align-items: center; }
.cmp-nearby-info { display: flex; align-items: center; gap: 6px; color: #86efac; font-weight: 700; font-size: 0.9rem; }
.cmp-nearby-src { font-size: 0.72rem; color: rgba(255,255,255,0.4); font-weight: 400; }
.cmp-nearby-close { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 4px; }
.cmp-nearby-radius {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px; margin-top: 10px;
  font-size: 0.85rem; color: rgba(255,255,255,0.7);
}
.cmp-radius-chip {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.8rem; padding: 4px 10px;
  border-radius: 999px; cursor: pointer;
}
.cmp-radius-chip-active {
  background: linear-gradient(135deg, #16a34a, #0ea5e9);
  color: #fff; border-color: transparent;
}
.cmp-nearby-error { margin-top: 8px; color: #fda4af; font-size: 0.82rem; }

.cmp-toolbar {
  max-width: 1200px; margin: 16px auto 0;
  padding: 0 16px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 10px; flex-wrap: wrap;
}
.cmp-total { color: #dc2626; font-weight: 800; font-size: 1rem; }
.cmp-toolbar-right { display: inline-flex; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 3px; }
.cmp-view-btn {
  background: transparent; border: none; color: rgba(255,255,255,0.65);
  font-size: 0.82rem; font-weight: 600; padding: 6px 12px;
  border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.2s ease;
}
.cmp-view-btn-active { background: linear-gradient(135deg, #22c55e, #0ea5e9); color: #fff; }

.cmp-main { max-width: 1200px; margin: 0 auto; padding: 20px 16px 60px; }
.cmp-map-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.cmp-map-wrap .leaflet-container img { max-width: none !important; max-height: none !important; height: auto; }

.cmp-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}
@media (min-width: 560px) { .cmp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 900px) { .cmp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .cmp-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.cmp-card {
  background: rgba(20, 24, 22, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; overflow: hidden;
  color: #f1f1f1;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  display: flex; flex-direction: column;
}
.cmp-card:hover {
  transform: translateY(-3px);
  border-color: rgba(34, 197, 94, 0.35);
  box-shadow: 0 10px 24px rgba(0,0,0,0.4);
}
.cmp-img {
  position: relative;
  width: 100%;
  padding-top: 62%;
  background: #0e0e0e;
  overflow: hidden;
}
.cmp-img img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.cmp-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%);
}
.cmp-dist-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(34, 197, 94, 0.85);
  color: #042f1c;
  font-size: 0.72rem; font-weight: 800;
  padding: 4px 10px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.cmp-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.cmp-ctitle {
  font-size: 0.98rem; font-weight: 700; line-height: 1.3; color: #fff;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.cmp-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.cmp-badge {
  font-size: 0.7rem; color: #a7f3d0;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.25);
  padding: 2px 8px; border-radius: 999px;
}
.cmp-meta {
  font-size: 0.82rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start;
  line-height: 1.4;
}
.cmp-meta-sub { color: #9ba3a0; }
.cmp-addr-link {
  color: #c6c6c6; text-decoration: none;
  border-bottom: 1px dotted rgba(255,255,255,0.25);
}
.cmp-addr-link:hover { color: #86efac; border-bottom-color: rgba(134,239,172,0.5); }
.cmp-intro {
  margin: 4px 0 0;
  font-size: 0.8rem; color: #9aa0a6; line-height: 1.5;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.cmp-home {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 4px; color: #7dd3fc; font-size: 0.78rem;
  text-decoration: none;
}
.cmp-home:hover { color: #bae6fd; }

.cmp-skeleton { cursor: default; }
.cmp-sk-img, .cmp-sk-line {
  background: linear-gradient(90deg, #202320 0%, #2c302d 50%, #202320 100%);
  background-size: 200% 100%;
  animation: cmp-shine 1.4s linear infinite;
  border-radius: 6px;
}
.cmp-sk-img { position: absolute; inset: 0; }
.cmp-sk-line { height: 10px; margin-top: 6px; width: 70%; }
.cmp-sk-line-lg { height: 14px; width: 85%; }
.cmp-sk-line-sm { width: 45%; }

.cmp-more {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin: 20px 0 4px;
}
.cmp-sentinel { width: 1px; height: 1px; }
.cmp-more-btn {
  background: rgba(255,255,255,0.08);
  color: #f1f1f1;
  border: 1px solid rgba(255,255,255,0.16);
  padding: 10px 18px; border-radius: 999px;
  font-size: 0.88rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.cmp-more-btn:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.28); }

.cmp-empty { padding: 60px 20px; text-align: center; color: #cfcfcf; }
.cmp-empty-emoji { font-size: 40px; }
.cmp-empty-title { margin-top: 8px; font-size: 1.05rem; font-weight: 700; color: #f5f5f5; }
.cmp-empty-desc { margin-top: 6px; color: #a6a6a6; font-size: 0.9rem; }

@keyframes cmp-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes cmp-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;
