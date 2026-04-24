"use client";

/**
 * /medical-tourism — 한국관광공사 의료관광정보(MdclTursmService) 기반 K-의료관광 탐색 페이지.
 *
 * 컨셉: "K-의료관광 · 외국인 환영"
 * 영화/DVD 로 한국 문화를 접한 해외 시청자에게, 한국 방문 시 이용 가능한
 * 성형·한방·건강검진·재활·미용·척추·치과 등 K-의료관광 클러스터를 동일 앱에서 노출한다.
 * 서비스 언어(ko/en)에 맞춰 langDivCd 를 자동 전송하여 다국어 콘텐츠를 제공한다.
 *
 * 데이터 소스:
 *  - GET /api/v1/medical-tourism?lang=ko|en&limit=0        (areaBasedList)
 *  - GET /api/v1/medical-tourism/nearby?lang&lat&lon&radius(locationBasedList)
 *  - GET /api/v1/medical-tourism/search?lang&q=<keyword>   (searchKeyword)
 *
 * UI 구성:
 *  - 상단 hero: 검색창 + "내 주변 의료관광 찾기" 버튼 + 현재 언어 뱃지
 *  - 의료 테마 칩 (성형 · 한방 · 건강검진 · 재활 · 미용 · 척추 · 치과)
 *  - 17개 광역 지역 칩
 *  - 지도 모드: Leaflet + OSM (사용자 위치 파란 마커 + 의료 스팟 레드 마커)
 *  - 리스트 모드: 카드 그리드 + 무한 스크롤
 *
 * 교차 접점:
 *  - 햄버거 메뉴 "내 주변 의료관광" → /medical-tourism?nearby=true
 *  - 대시보드 CTA → /medical-tourism
 *  - 영화 상세 / cine-trip 지역 / DVD 매장 → NearbyMedicalTourismStrip
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import {
  Stethoscope,
  Globe2,
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

// Leaflet SSR 이슈 방지: 클라이언트에서만 로딩.
let L, MapContainer, TileLayer, Marker, Popup, useMap;
let medIcon, blueIcon;
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

  // 레드 톤 마커 (의료 · K-Medical 아이덴티티)
  medIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
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

const REGION_SHORTCUTS = [
  "서울", "부산", "인천", "대구", "대전",
  "광주", "울산", "세종", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북",
  "경남", "제주",
];

/** K-의료관광 특화 키워드. MdclTursmService searchKeyword 에서 히트율이 높은 대표 분야. */
const THEME_SHORTCUTS = [
  { key: "성형",       ko: "성형",       en: "Plastic Surgery" },
  { key: "한방",       ko: "한방",       en: "Korean Medicine" },
  { key: "건강검진",   ko: "건강검진",   en: "Health Checkup" },
  { key: "재활",       ko: "재활",       en: "Rehabilitation" },
  { key: "미용",       ko: "미용",       en: "Aesthetic" },
  { key: "척추",       ko: "척추",       en: "Spine" },
  { key: "치과",       ko: "치과",       en: "Dental" },
];

function MedicalTourismInner() {
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

  const [nearbyMode, setNearbyMode] = useState(false);
  const [userPos, setUserPos] = useState(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [locSource, setLocSource] = useState("");

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const activeLang = (i18n?.language || "ko").toLowerCase().startsWith("en") ? "en" : "ko";

  useEffect(() => {
    if (nearbyMode) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErrored(false);
        const url = keyword.trim()
          ? `/api/v1/medical-tourism/search?lang=${activeLang}&q=${encodeURIComponent(keyword.trim())}&limit=0`
          : `/api/v1/medical-tourism?lang=${activeLang}&limit=0`;
        const res = await axios.get(url);
        if (cancelled) return;
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
  }, [keyword, nearbyMode, activeLang]);

  const applyKeyword = useCallback((next) => {
    const v = (next || "").trim();
    setKeyword(v);
    setSearchInput(v);
    setNearbyMode(false);
    const qs = v ? `?q=${encodeURIComponent(v)}` : "";
    router.replace(`/medical-tourism${qs}`);
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
      const res = await axios.get(`/api/v1/medical-tourism/nearby`, {
        params: { lang: activeLang, lat, lon, radius: rMeters, limit: 0 },
      });
      const data = Array.isArray(res?.data?.data) ? res.data.data : [];
      setSpots(data);
      setVisibleCount(Math.min(PAGE_SIZE, data.length));
      if (data.length === 0) {
        setNearbyError(t("medicalTourism.noNearbyRadius", { radius: rKm }));
      }
    } catch (e) {
      setNearbyError(t("medicalTourism.nearbyFetchFailed"));
    } finally {
      setNearbyLoading(false);
    }
  }, [t, activeLang]);

  const fallbackToIp = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("ip fallback");
      const d = await res.json();
      if (d.latitude && d.longitude) {
        setLocSource(t("medicalTourism.ipLocation"));
        setUserPos({ lat: d.latitude, lon: d.longitude });
        fetchNearby(d.latitude, d.longitude, radiusKm);
        return;
      }
    } catch (_) {}
    setNearbyLoading(false);
    setNearbyError(t("medicalTourism.locationUnavailable"));
  }, [fetchNearby, radiusKm, t]);

  const handleNearby = useCallback(() => {
    setNearbyLoading(true);
    setNearbyMode(true);
    setNearbyError("");
    setLocSource("");
    setKeyword("");
    setSearchInput("");
    router.replace(`/medical-tourism?nearby=true`);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fallbackToIp();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocSource(t("medicalTourism.gpsLocation"));
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

  const handleRadiusChange = (r) => {
    setRadiusKm(r);
    if (nearbyMode && userPos) fetchNearby(userPos.lat, userPos.lon, r);
  };

  const exitNearby = () => {
    setNearbyMode(false);
    setUserPos(null);
    setNearbyError("");
    setLocSource("");
    router.replace(`/medical-tourism`);
    setKeyword("");
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
    return t("medicalTourism.totalCount", { count: spots.length });
  }, [loading, nearbyLoading, spots.length, t]);

  const lang = i18n?.language || "ko";

  return (
    <div className="mt-root">
      <style>{cssBlock}</style>

      <header className="mt-hero">
        <div className="mt-hero-inner">
          <div className="mt-tag">
            <Stethoscope size={14} />
            <span>K-Medical Tourism · Global</span>
            <span className="mt-hero-lang">
              <Globe2 size={11} /> {(i18n?.language || "ko").toLowerCase().startsWith("en") ? "EN" : "KO"}
            </span>
          </div>
          <h1 className="mt-title">{t("medicalTourism.pageTitle")}</h1>
          <p className="mt-sub">{t("medicalTourism.pageSubtitle")}</p>

          <form className="mt-search" onSubmit={onSubmit} role="search">
            <Search size={16} className="mt-search-icon" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("medicalTourism.searchPlaceholder")}
              className="mt-search-input"
              aria-label={t("medicalTourism.searchPlaceholder")}
            />
            <button type="submit" className="mt-search-btn">
              {t("medicalTourism.searchBtn")}
            </button>
          </form>

          <button
            type="button"
            onClick={handleNearby}
            disabled={nearbyLoading}
            className={`mt-nearby-btn ${nearbyMode ? "mt-nearby-btn-active" : ""}`}
          >
            <LocateFixed
              size={16}
              style={nearbyLoading ? { animation: "mt-spin 1s linear infinite" } : {}}
            />
            {nearbyLoading ? t("medicalTourism.locating") : t("medicalTourism.findNearbyBtn")}
          </button>

          <div className="mt-theme-chips" role="group" aria-label={t("medicalTourism.themeLabel")}>
            {THEME_SHORTCUTS.map((th) => (
              <button
                key={th.key}
                type="button"
                className={`mt-theme-chip ${keyword === th.key ? "mt-theme-chip-active" : ""}`}
                onClick={() => applyKeyword(th.key)}
              >
                {lang.startsWith("en") ? th.en : th.ko}
              </button>
            ))}
          </div>

          <div className="mt-chips" role="group" aria-label={t("medicalTourism.shortcutsLabel")}>
            <button
              type="button"
              className={`mt-chip ${keyword === "" && !nearbyMode ? "mt-chip-active" : ""}`}
              onClick={() => applyKeyword("")}
            >
              {t("medicalTourism.allRegions")}
            </button>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r}
                type="button"
                className={`mt-chip ${keyword === r ? "mt-chip-active" : ""}`}
                onClick={() => applyKeyword(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {nearbyMode && (
        <div className="mt-nearby-panel">
          <div className="mt-nearby-top">
            <div className="mt-nearby-info">
              <Navigation size={14} />
              <span>{t("medicalTourism.myLocationSearch")}</span>
              {locSource && <span className="mt-nearby-src">({locSource})</span>}
            </div>
            <button type="button" onClick={exitNearby} className="mt-nearby-close" aria-label={t("medicalTourism.exit")}>
              <X size={16} />
            </button>
          </div>
          <div className="mt-nearby-radius">
            <Ruler size={14} />
            <span>{t("medicalTourism.radiusLabel")}</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`mt-radius-chip ${radiusKm === r ? "mt-radius-chip-active" : ""}`}
                onClick={() => handleRadiusChange(r)}
              >
                {r}km
              </button>
            ))}
          </div>
          {nearbyError && <div className="mt-nearby-error">{nearbyError}</div>}
        </div>
      )}

      <div className="mt-toolbar">
        <div className="mt-toolbar-left">
          {headerCountLabel && (
            <span className="mt-total">{headerCountLabel}</span>
          )}
        </div>
        <div className="mt-toolbar-right">
          <button
            type="button"
            className={`mt-view-btn ${viewMode === "list" ? "mt-view-btn-active" : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <ListIcon size={14} /> {t("medicalTourism.list")}
          </button>
          <button
            type="button"
            className={`mt-view-btn ${viewMode === "map" ? "mt-view-btn-active" : ""}`}
            onClick={() => setViewMode("map")}
            aria-pressed={viewMode === "map"}
          >
            <MapIcon size={14} /> {t("medicalTourism.map")}
          </button>
        </div>
      </div>

      <main className="mt-main">
        {viewMode === "map" ? (
          <div className="mt-map-wrap">
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
                    <Popup>{t("medicalTourism.myLocation")}</Popup>
                  </Marker>
                )}
                {mappable.map((s) => (
                  <Marker key={s.id} position={[s.latitude, s.longitude]} icon={medIcon}>
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
              <div className="mt-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`sk-${i}`} className="mt-card mt-skeleton">
                    <div className="mt-img mt-sk-img" />
                    <div className="mt-body">
                      <div className="mt-sk-line mt-sk-line-lg" />
                      <div className="mt-sk-line" />
                      <div className="mt-sk-line mt-sk-line-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : errored ? (
              <EmptyState icon="⚠️" title={t("medicalTourism.error")} desc={t("medicalTourism.errorHint")} />
            ) : spots.length === 0 ? (
              <EmptyState
                icon="🧘"
                title={nearbyMode ? t("medicalTourism.nearbyEmpty") : t("medicalTourism.empty")}
                desc={t("medicalTourism.emptyHint")}
              />
            ) : (
              <>
                <div className="mt-grid">
                  {spots.slice(0, visibleCount).map((s) => (
                    <MedicalTourismCard key={s.id} spot={s} />
                  ))}
                </div>
                {visibleCount < spots.length && (
                  <div className="mt-more">
                    <div ref={sentinelRef} aria-hidden className="mt-sentinel" />
                    <button
                      type="button"
                      className="mt-more-btn"
                      onClick={() => setVisibleCount((c) => Math.min(c + PAGE_SIZE, spots.length))}
                    >
                      {t("medicalTourism.loadMore", { shown: visibleCount, total: spots.length })}
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
        📞 {spot.tel || t("medicalTourism.phoneNone")}
      </div>
    </div>
  );
}

function MedicalTourismCard({ spot }) {
  const { t } = useTranslation();
  const mapUrl = spot.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent(spot.address)}`
    : null;
  return (
    <article className="mt-card">
      <div className="mt-img">
        {spot.imageUrl ? (
          <img
            src={spot.imageUrl}
            alt={spot.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="mt-img-placeholder">
            <Stethoscope size={36} />
          </div>
        )}
        {spot.distanceKm != null && (
          <span className="mt-dist-badge">
            {spot.distanceKm < 1
              ? `${Math.round(spot.distanceKm * 1000)}m`
              : `${spot.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="mt-body">
        <div className="mt-ctitle" title={spot.name || ""}>{spot.name}</div>
        {spot.address && (
          <div className="mt-meta">
            <MapPin size={12} />
            {mapUrl ? (
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-addr-link">
                {spot.address}
              </a>
            ) : (
              <span>{spot.address}</span>
            )}
          </div>
        )}
        <div className="mt-meta mt-meta-sub">
          <Phone size={12} />
          <span>{spot.tel || t("medicalTourism.phoneNone")}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div className="mt-empty" role="status">
      <div className="mt-empty-emoji" aria-hidden>{icon}</div>
      <div className="mt-empty-title">{title}</div>
      {desc && <div className="mt-empty-desc">{desc}</div>}
    </div>
  );
}

export default function MedicalTourismPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading…</div>}>
      <MedicalTourismInner />
    </Suspense>
  );
}

const cssBlock = `
.mt-root {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(14, 165, 233, 0.18) 0%, transparent 60%),
    radial-gradient(1000px 400px at 100% 0%, rgba(139, 92, 246, 0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0a0d10 0%, #101420 100%);
  color: #f5f5f5;
}
.mt-hero {
  padding: 40px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.mt-hero-inner { max-width: 1200px; margin: 0 auto; }
.mt-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800;
  letter-spacing: 0.18em; text-transform: uppercase;
  color: #bae6fd;
  background: rgba(14, 165, 233, 0.14);
  border: 1px solid rgba(14, 165, 233, 0.28);
  padding: 6px 10px; border-radius: 999px;
}
.mt-hero-lang {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 800;
  padding: 2px 7px; border-radius: 999px;
  background: rgba(255,255,255,0.12); color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  letter-spacing: 0.06em;
}
.mt-title {
  margin: 14px 0 6px;
  font-size: clamp(22px, 4vw, 36px);
  font-weight: 900;
  letter-spacing: -0.01em;
  background: linear-gradient(90deg, #a7f3d0 0%, #c4b5fd 50%, #fbcfe8 100%);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  line-height: 1.15;
}
.mt-sub {
  margin: 0 0 16px;
  color: #c6c6c6; font-size: 0.95rem;
  max-width: 760px; line-height: 1.5;
}
.mt-search {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px; padding: 6px 6px 6px 16px;
  max-width: 520px; margin-bottom: 10px;
}
.mt-search-icon { color: #bdbdbd; }
.mt-search-input {
  flex: 1 1 auto; background: transparent; border: none; outline: none;
  color: #f5f5f5; font-size: 0.95rem; padding: 8px 0; min-width: 0;
}
.mt-search-input::placeholder { color: #8a8a8a; }
.mt-search-btn {
  flex: 0 0 auto; border: none;
  background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%);
  color: #fff; font-weight: 700; font-size: 0.88rem;
  padding: 8px 16px; border-radius: 999px; cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.mt-search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4); }

.mt-nearby-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(14, 165, 233, 0.1);
  border: 1px solid rgba(14, 165, 233, 0.28);
  color: #7dd3fc;
  padding: 10px 16px; border-radius: 999px;
  font-weight: 700; font-size: 0.9rem; cursor: pointer;
  transition: all 0.2s ease;
}
.mt-nearby-btn:hover { background: rgba(14, 165, 233, 0.18); }
.mt-nearby-btn-active {
  background: linear-gradient(135deg, #059669, #7c3aed);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 14px rgba(139, 92, 246, 0.35);
}
.mt-nearby-btn:disabled { cursor: wait; opacity: 0.85; }

.mt-theme-chips {
  margin-top: 16px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.mt-theme-chip {
  background: rgba(14,165,233,0.08);
  border: 1px solid rgba(14,165,233,0.22);
  color: #a7f3d0;
  font-size: 0.82rem; font-weight: 700;
  padding: 6px 14px;
  border-radius: 999px; cursor: pointer;
  transition: all 0.15s ease;
}
.mt-theme-chip:hover {
  background: rgba(14,165,233,0.18);
  color: #fff;
  transform: translateY(-1px);
}
.mt-theme-chip-active {
  background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%);
  color: #fff; border-color: transparent;
  box-shadow: 0 4px 12px rgba(139,92,246,0.3);
}

.mt-chips {
  margin-top: 12px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.mt-chip {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.82rem;
  padding: 6px 12px; border-radius: 999px; cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.mt-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
.mt-chip-active {
  background: linear-gradient(135deg, rgba(14,165,233,0.25) 0%, rgba(139,92,246,0.2) 100%);
  border-color: rgba(14,165,233,0.55);
  color: #fff;
}

.mt-nearby-panel {
  max-width: 1200px; margin: 16px auto 0; padding: 12px 16px;
  background: rgba(14,165,233,0.08);
  border: 1px solid rgba(14,165,233,0.22);
  border-radius: 12px;
}
.mt-nearby-top { display: flex; justify-content: space-between; align-items: center; }
.mt-nearby-info { display: flex; align-items: center; gap: 6px; color: #7dd3fc; font-weight: 700; font-size: 0.9rem; }
.mt-nearby-src { font-size: 0.72rem; color: rgba(255,255,255,0.4); font-weight: 400; }
.mt-nearby-close { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 4px; }
.mt-nearby-radius {
  display: flex; flex-wrap: wrap; align-items: center;
  gap: 8px; margin-top: 10px;
  font-size: 0.85rem; color: rgba(255,255,255,0.7);
}
.mt-radius-chip {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.8rem; padding: 4px 10px;
  border-radius: 999px; cursor: pointer;
}
.mt-radius-chip-active {
  background: linear-gradient(135deg, #059669, #7c3aed);
  color: #fff; border-color: transparent;
}
.mt-nearby-error { margin-top: 8px; color: #fda4af; font-size: 0.82rem; }

.mt-toolbar {
  max-width: 1200px; margin: 16px auto 0;
  padding: 0 16px;
  display: flex; justify-content: space-between; align-items: center;
  gap: 10px; flex-wrap: wrap;
}
.mt-total { color: #dc2626; font-weight: 800; font-size: 1rem; }
.mt-toolbar-right { display: inline-flex; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 999px; padding: 3px; }
.mt-view-btn {
  background: transparent; border: none; color: rgba(255,255,255,0.65);
  font-size: 0.82rem; font-weight: 600; padding: 6px 12px;
  border-radius: 999px; cursor: pointer;
  display: inline-flex; align-items: center; gap: 4px;
  transition: all 0.2s ease;
}
.mt-view-btn-active { background: linear-gradient(135deg, #0ea5e9, #8b5cf6); color: #fff; }

.mt-main { max-width: 1200px; margin: 0 auto; padding: 20px 16px 60px; }
.mt-map-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.35); }
.mt-map-wrap .leaflet-container img { max-width: none !important; max-height: none !important; height: auto; }

.mt-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}
@media (min-width: 560px) { .mt-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 900px) { .mt-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1200px) { .mt-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }

.mt-card {
  background: rgba(20, 22, 28, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; overflow: hidden;
  color: #f1f1f1;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  display: flex; flex-direction: column;
}
.mt-card:hover {
  transform: translateY(-3px);
  border-color: rgba(14, 165, 233, 0.35);
  box-shadow: 0 10px 24px rgba(0,0,0,0.4);
}
.mt-img {
  position: relative; width: 100%; padding-top: 62%;
  background: #0e0e0e; overflow: hidden;
}
.mt-img img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.mt-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(139,92,246,0.04) 100%);
}
.mt-dist-badge {
  position: absolute; top: 10px; left: 10px;
  background: rgba(14, 165, 233, 0.85);
  color: #04241c;
  font-size: 0.72rem; font-weight: 800;
  padding: 4px 10px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.mt-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.mt-ctitle {
  font-size: 0.98rem; font-weight: 700; line-height: 1.3; color: #fff;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.mt-meta {
  font-size: 0.82rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start;
  line-height: 1.4;
}
.mt-meta-sub { color: #9ba3a0; }
.mt-addr-link {
  color: #c6c6c6; text-decoration: none;
  border-bottom: 1px dotted rgba(255,255,255,0.25);
}
.mt-addr-link:hover { color: #7dd3fc; border-bottom-color: rgba(110,231,183,0.5); }

.mt-skeleton { cursor: default; }
.mt-sk-img, .mt-sk-line {
  background: linear-gradient(90deg, #1e2228 0%, #2a2f36 50%, #1e2228 100%);
  background-size: 200% 100%;
  animation: mt-shine 1.4s linear infinite;
  border-radius: 6px;
}
.mt-sk-img { position: absolute; inset: 0; }
.mt-sk-line { height: 10px; margin-top: 6px; width: 70%; }
.mt-sk-line-lg { height: 14px; width: 85%; }
.mt-sk-line-sm { width: 45%; }

.mt-more {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  margin: 20px 0 4px;
}
.mt-sentinel { width: 1px; height: 1px; }
.mt-more-btn {
  background: rgba(255,255,255,0.08);
  color: #f1f1f1;
  border: 1px solid rgba(255,255,255,0.16);
  padding: 10px 18px; border-radius: 999px;
  font-size: 0.88rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.mt-more-btn:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.28); }

.mt-empty { padding: 60px 20px; text-align: center; color: #cfcfcf; }
.mt-empty-emoji { font-size: 40px; }
.mt-empty-title { margin-top: 8px; font-size: 1.05rem; font-weight: 700; color: #f5f5f5; }
.mt-empty-desc { margin-top: 6px; color: #a6a6a6; font-size: 0.9rem; }

@keyframes mt-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes mt-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
`;
