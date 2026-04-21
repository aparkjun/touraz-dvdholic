'use client';
import React, { useEffect, useRef, useState, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { Search, MapPin, Phone, Clock, Package, ChevronLeft, ChevronRight, Store, LocateFixed, Navigation, X, Building2, Briefcase, CalendarClock, PauseCircle, Ruler, Map, List, Layers } from "lucide-react";
import CultureMapLayer from "@/components/CultureMapLayer";
let L, MapContainer, TileLayer, Marker, Popup, useMap;
let greenIcon, redIcon, blueIcon;

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

  redIcon = new L.Icon({
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

const PAGE_SIZE = 20;
const RADIUS_OPTIONS = [3, 5, 10, 20, 50, 100];
const KOREA_CENTER = [36.5, 127.5];
const DEFAULT_ZOOM = 7;

function DvdStoresContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const autoNearbyTriggered = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [showClosed, setShowClosed] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const [cultureLayer, setCultureLayer] = useState("off"); // off | stores | tourDemand | cultural | search

  const [nearbyMode, setNearbyMode] = useState(false);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [radius, setRadius] = useState(10);
  const [userPos, setUserPos] = useState(null);

  useEffect(() => {
    setMounted(true);
    fetchStores();
  }, []);

  const fetchStores = async (kw) => {
    setLoading(true);
    try {
      const url = kw
        ? `/api/v1/dvd-stores/search?keyword=${encodeURIComponent(kw)}`
        : "/api/v1/dvd-stores/all";
      const res = await axios.get(url);
      setStores(res.data?.data || []);
      setPage(0);
    } catch (e) {
      console.error("DVD 매장 조회 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setNearbyMode(false);
    setKeyword(searchInput.trim());
    fetchStores(searchInput.trim());
  };

  const fetchNearby = useCallback(async (lat, lon, r) => {
    setNearbyLoading(true);
    setNearbyError("");
    try {
      const res = await axios.get(`/api/v1/dvd-stores/nearby?lat=${lat}&lon=${lon}&radius=${r}`);
      const data = res.data?.data || [];
      setNearbyStores(data);
      setPage(0);
      if (data.length === 0) {
        setNearbyError(t("dvdStores.noNearbyRadius", { radius: r }));
      }
    } catch (e) {
      setNearbyError(t("dvdStores.nearbyFetchFailed"));
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const [locSource, setLocSource] = useState("");

  const fallbackToIp = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("IP API 실패");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setLocSource(t("dvdStores.ipLocation"));
        setUserPos({ lat: data.latitude, lon: data.longitude });
        fetchNearby(data.latitude, data.longitude, radius);
        return;
      }
    } catch (_) {}
    try {
      const res2 = await fetch("http://ip-api.com/json/?fields=lat,lon,status");
      const d2 = await res2.json();
      if (d2.status === "success" && d2.lat && d2.lon) {
        setLocSource(t("dvdStores.ipLocation"));
        setUserPos({ lat: d2.lat, lon: d2.lon });
        fetchNearby(d2.lat, d2.lon, radius);
        return;
      }
    } catch (_) {}
    setNearbyLoading(false);
    setNearbyError(t("dvdStores.locationUnavailable"));
  }, [fetchNearby, radius, t]);

  const handleNearby = () => {
    setNearbyLoading(true);
    setNearbyMode(true);
    setNearbyError("");
    setLocSource("");

    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocSource(t("dvdStores.gpsLocation"));
        setUserPos({ lat: latitude, lon: longitude });
        fetchNearby(latitude, longitude, radius);
      },
      () => {
        fallbackToIp();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  useEffect(() => {
    if (searchParams.get("nearby") === "true" && !autoNearbyTriggered.current) {
      autoNearbyTriggered.current = true;
      router.replace(pathname);
      handleNearby();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleRadiusChange = (r) => {
    setRadius(r);
    if (userPos) fetchNearby(userPos.lat, userPos.lon, r);
  };

  const exitNearby = () => {
    setNearbyMode(false);
    setNearbyStores([]);
    setNearbyError("");
    setUserPos(null);
  };

  const filtered = useMemo(() => {
    if (nearbyMode) return nearbyStores;
    if (showClosed) return stores;
    return stores.filter((s) => s.statusCode === "01");
  }, [stores, showClosed, nearbyMode, nearbyStores]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageStores = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const operatingCount = nearbyMode
    ? nearbyStores.length
    : stores.filter((s) => s.statusCode === "01").length;
  const closedCount = nearbyMode ? 0 : stores.length - operatingCount;

  const isLoading = nearbyMode ? nearbyLoading : loading;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px", minHeight: "100vh", background: "radial-gradient(1200px 600px at 20% -10%, rgba(249, 115, 22, 0.08), transparent), radial-gradient(800px 400px at 80% 10%, rgba(245, 158, 11, 0.06), transparent), radial-gradient(125% 125% at 50% 100%, #000000 40%, #2b0707 100%)" }}>
      <div style={{
        textAlign: "center",
        marginBottom: 28,
        padding: "24px 0 16px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <Store size={28} style={{ color: "#f59e0b" }} />
          <h1 style={{
            margin: 0,
            fontSize: "1.6rem",
            fontWeight: 700,
            background: "linear-gradient(135deg, #f59e0b, #f97316)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            {t("dvdStores.pageTitle")}
          </h1>
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", margin: 0 }}>
          {t("dvdStores.pageSubtitle")}
        </p>
      </div>

      {/* 검색 + 주변 찾기 */}
      <div style={{ maxWidth: 500, margin: "0 auto 12px" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={16} style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "rgba(255,255,255,0.35)",
            }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("dvdStores.searchPlaceholder")}
              style={{
                width: "100%", padding: "10px 12px 10px 36px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10, color: "#fff", fontSize: "0.9rem",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <button type="submit" style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            border: "none", borderRadius: 10, color: "#fff",
            fontWeight: 600, cursor: "pointer", fontSize: "0.9rem", whiteSpace: "nowrap",
          }}>
            {t("dvdStores.searchBtn")}
          </button>
        </form>

        <button
          onClick={handleNearby}
          disabled={nearbyLoading}
          style={{
            width: "100%",
            padding: "11px 16px",
            background: nearbyMode
              ? "linear-gradient(135deg, #f59e0b, #ea580c)"
              : "rgba(245,158,11,0.10)",
            border: nearbyMode ? "none" : "1px solid rgba(245,158,11,0.25)",
            borderRadius: 10,
            color: nearbyMode ? "#fff" : "#f59e0b",
            fontWeight: 600,
            cursor: nearbyLoading ? "wait" : "pointer",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "none",
            transition: "all 0.2s",
          }}
        >
          <LocateFixed size={18} style={nearbyLoading ? { animation: "spin 1s linear infinite" } : {}} />
          {nearbyLoading ? t("dvdStores.locating") : t("dvdStores.findNearbyDvd")}
        </button>
      </div>

      {/* 주변 모드 패널 */}
      {nearbyMode && (
        <div style={{
          maxWidth: 500, margin: "0 auto 14px",
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.18)",
          borderRadius: 12, padding: "12px 16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Navigation size={14} style={{ color: "#f59e0b" }} />
              <span style={{ color: "#f59e0b", fontSize: "0.85rem", fontWeight: 600 }}>
                {t("dvdStores.myLocationSearch")}
              </span>
              {locSource && (
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>
                  ({locSource})
                </span>
              )}
            </div>
            <button onClick={exitNearby} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.4)",
              cursor: "pointer", padding: 4, display: "flex",
            }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => handleRadiusChange(r)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: radius === r
                    ? "linear-gradient(135deg, #f59e0b, #ea580c)"
                    : "rgba(255,255,255,0.08)",
                  color: radius === r ? "#fff" : "rgba(255,255,255,0.5)",
                  fontSize: "0.8rem",
                  fontWeight: radius === r ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {r}km
              </button>
            ))}
          </div>

          {nearbyError && (
            <div style={{ color: "#f87171", fontSize: "0.82rem", marginTop: 8 }}>
              {nearbyError}
            </div>
          )}
        </div>
      )}

      {/* 통계 바 + 뷰 전환 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 14, padding: "0 4px", maxWidth: 500, margin: "0 auto 14px",
      }}>
        <div style={{ display: "flex", gap: 12, fontSize: "0.82rem", alignItems: "center" }}>
          {!nearbyMode && (
            <>
              <span style={{ color: "#f59e0b" }}>{t("dvdStores.operating")} {operatingCount}</span>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{t("dvdStores.closed")} {closedCount}</span>
              <span style={{ color: "rgba(255,255,255,0.5)" }}>{t("dvdStores.total", { count: stores.length })}</span>
            </>
          )}
          {nearbyMode && !nearbyLoading && nearbyStores.length > 0 && (
            <span style={{ color: "#f59e0b", fontSize: "0.82rem" }}>
              {t("dvdStores.nearbyCount", { radius, count: nearbyStores.length })}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!nearbyMode && (
            <label style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginRight: 8 }}>
              <input
                type="checkbox"
                checked={showClosed}
                onChange={(e) => { setShowClosed(e.target.checked); setPage(0); }}
                style={{ accentColor: "#f59e0b" }}
              />
              {t("dvdStores.includeClosed")}
            </label>
          )}
          <div style={{
            display: "flex", borderRadius: 8, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "6px 10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                background: viewMode === "list" ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.04)",
                color: viewMode === "list" ? "#f59e0b" : "rgba(255,255,255,0.4)",
                fontSize: "0.78rem", fontWeight: viewMode === "list" ? 600 : 400,
              }}
            >
              <List size={14} /> {t("dvdStores.listView")}
            </button>
            <button
              onClick={() => setViewMode("map")}
              style={{
                padding: "6px 10px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                background: viewMode === "map" ? "rgba(234,88,12,0.2)" : "rgba(255,255,255,0.04)",
                color: viewMode === "map" ? "#ea580c" : "rgba(255,255,255,0.4)",
                fontSize: "0.78rem", fontWeight: viewMode === "map" ? 600 : 400,
              }}
            >
              <Map size={14} /> {t("dvdStores.mapView")}
            </button>
          </div>
        </div>
      </div>

      {viewMode === "map" && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
          margin: "10px 0 14px", padding: "10px 12px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: "0.82rem", fontWeight: 600, marginRight: 4 }}>
            <Layers size={14} /> {t("cultureMap.title")}
          </div>
          {[
            { key: "off", label: "OFF" },
            { key: "stores", label: t("cultureMap.layerStores") },
            { key: "tourDemand", label: t("cultureMap.layerTourDemand") },
            { key: "cultural", label: t("cultureMap.layerCultural") },
            { key: "search", label: t("cultureMap.layerSearch") },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setCultureLayer(opt.key)}
              style={{
                padding: "5px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.1)",
                background: cultureLayer === opt.key ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.04)",
                color: cultureLayer === opt.key ? "#f59e0b" : "rgba(255,255,255,0.6)",
                fontSize: "0.75rem", cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
          <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.72rem", marginLeft: "auto" }}>
            {t("cultureMap.legendLow")} → {t("cultureMap.legendHigh")}
          </span>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
          {t("dvdStores.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>
          {nearbyMode
            ? nearbyError || t("dvdStores.noNearby")
            : keyword
              ? t("dvdStores.noSearchResults", { keyword })
              : t("dvdStores.noData")}
        </div>
      ) : viewMode === "map" ? (
        mounted ? <StoreMap stores={filtered} userPos={userPos} nearbyMode={nearbyMode} cultureLayer={cultureLayer} /> : <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.4)" }}>{t("dvdStores.loading")}</div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pageStores.map((store, idx) => (
              <StoreCard
                key={`${store.areaCode}-${store.managementNo}-${idx}`}
                store={store}
                showDistance={nearbyMode}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: 12, marginTop: 20, paddingBottom: 20,
            }}>
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                style={navBtnStyle(page === 0)}
              >
                <ChevronLeft size={18} />
              </button>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                style={navBtnStyle(page >= totalPages - 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .leaflet-container img { max-width: none !important; max-height: none !important; height: auto; }
        .leaflet-container { font-size: inherit; }
        .leaflet-tile-pane img { max-width: none !important; }
        .leaflet-control-zoom a { color: #333 !important; background: #fff !important; }
      `}</style>
    </div>
  );
}

function StoreCard({ store, showDistance }) {
  const { t } = useTranslation();
  const isOpen = store.statusCode === "01";
  const distText = showDistance && store.distance != null
    ? store.distance < 1
      ? `${Math.round(store.distance * 1000)}m`
      : `${store.distance.toFixed(1)}km`
    : null;

  const addr = store.roadAddress || store.jibunAddress;
  const mapUrl = addr
    ? `https://map.kakao.com/link/search/${encodeURIComponent(addr)}`
    : null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${isOpen ? "rgba(245,158,11,0.2)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontWeight: 600, fontSize: "0.95rem",
            color: isOpen ? "#fff" : "rgba(255,255,255,0.35)",
          }}>
            {store.businessName || t("dvdStores.unregistered")}
          </span>
          {distText && (
            <span style={{
              fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px",
              borderRadius: 6, background: "rgba(245,158,11,0.15)", color: "#f59e0b",
              whiteSpace: "nowrap",
            }}>
              {distText}
            </span>
          )}
        </div>
        <span style={{
          fontSize: "0.72rem", fontWeight: 600, padding: "2px 8px",
          borderRadius: 6,
          background: isOpen ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.12)",
          color: isOpen ? "#f59e0b" : "#ef4444",
          whiteSpace: "nowrap", flexShrink: 0, marginLeft: 8,
        }}>
          {store.statusName || (isOpen ? t("dvdStores.operating") : t("dvdStores.closed"))}
        </span>
      </div>

      {addr && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
          <MapPin size={14} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
          {mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.4,
                textDecoration: "none", borderBottom: "1px dotted rgba(255,255,255,0.2)",
              }}
            >
              {addr}
            </a>
          ) : (
            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
              {addr}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        {store.phone && (
          <InfoChip icon={<Phone size={12} />} text={store.phone} />
        )}
        {store.businessType && (
          <InfoChip icon={<Briefcase size={12} />} text={store.businessType} />
        )}
        {store.productInfo && (
          <InfoChip icon={<Package size={12} />} text={store.productInfo} />
        )}
        {store.licenseDate && (
          <InfoChip icon={<Clock size={12} />} text={`${t("dvdStores.license")} ${store.licenseDate}`} />
        )}
        {store.facilityArea && (
          <InfoChip icon={<Ruler size={12} />} text={`${store.facilityArea}㎡`} />
        )}
        {store.buildingUsage && (
          <InfoChip icon={<Building2 size={12} />} text={store.buildingUsage} />
        )}
        {store.floorTotal && (
          <InfoChip icon={<Building2 size={12} />} text={store.floorBelow ? t("dvdStores.floorInfoWithBasement", { total: store.floorTotal, below: store.floorBelow }) : t("dvdStores.floorInfo", { total: store.floorTotal })} />
        )}
        {store.dataUpdateDate && (
          <InfoChip icon={<CalendarClock size={12} />} text={`${t("dvdStores.updated")} ${store.dataUpdateDate.substring(0, 10)}`} />
        )}
      </div>

      {store.detailStatusName && store.detailStatusName !== store.statusName && (
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
            {t("dvdStores.detail")}: {store.detailStatusName}
          </span>
        </div>
      )}

      {store.suspendStartDate && (
        <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
          <PauseCircle size={12} style={{ color: "#f59e0b" }} />
          <span style={{ fontSize: "0.72rem", color: "#f59e0b" }}>
            {t("dvdStores.suspended")} {store.suspendStartDate}{store.suspendEndDate ? ` ~ ${store.suspendEndDate}` : " ~"}
          </span>
        </div>
      )}

      {store.gameName && (
        <div style={{ marginTop: 3 }}>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
            {t("dvdStores.games")}: {store.gameName}
          </span>
        </div>
      )}

      {(store.culturalBusinessType || store.previousGameBusinessType || store.surroundingEnv || store.licenseCancelDate) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 12px", marginTop: 4 }}>
          {store.culturalBusinessType && (
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{t("dvdStores.businessCategory")}: {store.culturalBusinessType}</span>
          )}
          {store.previousGameBusinessType && (
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{t("dvdStores.previousBusiness")}: {store.previousGameBusinessType}</span>
          )}
          {store.surroundingEnv && (
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>{t("dvdStores.surroundings")}: {store.surroundingEnv}</span>
          )}
          {store.licenseCancelDate && (
            <span style={{ fontSize: "0.72rem", color: "#ef4444" }}>{t("dvdStores.licenseCancelled")}: {store.licenseCancelDate}</span>
          )}
        </div>
      )}
    </div>
  );
}

function InfoChip({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ color: "rgba(255,255,255,0.3)", display: "flex" }}>{icon}</span>
      <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)" }}>{text}</span>
    </div>
  );
}

function FitBounds({ stores, userPos }) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
    const pts = stores
      .filter((s) => s.latitude && s.longitude)
      .map((s) => [s.latitude, s.longitude]);
    if (userPos) pts.push([userPos.lat, userPos.lon]);
    if (pts.length > 0) {
      map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
    }
  }, [stores, userPos, map]);
  return null;
}

function StoreMap({ stores, userPos, nearbyMode, cultureLayer = "off" }) {
  const { t } = useTranslation();
  const mappable = useMemo(
    () => stores.filter((s) => s.latitude && s.longitude),
    [stores]
  );

  const center = userPos
    ? [userPos.lat, userPos.lon]
    : mappable.length > 0
      ? [mappable[0].latitude, mappable[0].longitude]
      : KOREA_CENTER;

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
      <MapContainer
        center={center}
        zoom={nearbyMode ? 12 : DEFAULT_ZOOM}
        style={{ height: 520, width: "100%", background: "#f0ede6" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds stores={mappable} userPos={userPos} />

        {cultureLayer !== "off" && <CultureMapLayer layer={cultureLayer} />}

        {userPos && (
          <Marker position={[userPos.lat, userPos.lon]} icon={blueIcon}>
            <Popup>
              <strong>{t("dvdStores.myLocation")}</strong>
            </Popup>
          </Marker>
        )}

        {mappable.map((store, idx) => {
          const isOpen = store.statusCode === "01";
          const addr = store.roadAddress || store.jibunAddress || "";
          return (
            <Marker
              key={`${store.areaCode}-${store.managementNo}-${idx}`}
              position={[store.latitude, store.longitude]}
              icon={isOpen ? greenIcon : redIcon}
            >
              <Popup>
                <div style={{ minWidth: 180, maxWidth: 260 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                    {store.businessName || t("dvdStores.unregistered")}
                  </div>
                  <div style={{ fontSize: 12, color: isOpen ? "#d97706" : "#dc2626", fontWeight: 600, marginBottom: 4 }}>
                    {store.statusName || (isOpen ? t("dvdStores.operating") : t("dvdStores.closed"))}
                    {store.distance != null && (
                      <span style={{ color: "#ea580c", marginLeft: 6 }}>
                        {store.distance < 1 ? `${Math.round(store.distance * 1000)}m` : `${store.distance.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                  {addr && <div style={{ fontSize: 11, color: "#555", marginBottom: 2 }}>{addr}</div>}
                  {store.phone && <div style={{ fontSize: 11, color: "#555" }}>Tel: {store.phone}</div>}
                  {store.productInfo && <div style={{ fontSize: 11, color: "#555" }}>{t("dvdStores.productsLabel")}: {store.productInfo}</div>}
                  {store.businessType && <div style={{ fontSize: 11, color: "#555" }}>{t("dvdStores.businessType")}: {store.businessType}</div>}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {mappable.length < stores.length && (
        <div style={{
          padding: "6px 12px",
          background: "rgba(255,255,255,0.04)",
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.35)",
          textAlign: "center",
        }}>
          {t("dvdStores.mapCoordInfo", { shown: mappable.length, total: stores.length })}
        </div>
      )}
    </div>
  );
}

function navBtnStyle(disabled) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.12)",
    background: disabled ? "transparent" : "rgba(255,255,255,0.06)",
    color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
    cursor: disabled ? "default" : "pointer",
  };
}

export default function DvdStores() {
  return (
    <Suspense>
      <DvdStoresContent />
    </Suspense>
  );
}
