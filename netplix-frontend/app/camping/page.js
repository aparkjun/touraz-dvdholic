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
import Link from "next/link";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { getDeviceLocation } from "@/lib/geolocation";
import AmbientBackdrop from "@/components/AmbientBackdrop";
import RegionWeatherGlyph from "@/components/RegionWeatherGlyph";
import { resolveAreaCode } from "@/lib/regionAreaCode";
import { MapServiceLinkButton } from "@/components/MapServiceLinkButton";
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

/**
 * 목록 페이지의 인메모리 + sessionStorage 캐시.
 *
 * <p>왜 필요한가: Next.js App Router 의 client component(`"use client"`) 는
 * 페이지 이동 시 컴포넌트 트리가 unmount 되어 state 가 모두 초기화된다.
 * 야영장 목록(전국 ~3,700개, ~3MB JSON)을 매번 다시 받아오면 뒤로가기 시
 * 사용자에게 3-4 초간 빈 화면(또는 스켈레톤)이 노출되어 "검은 화면" 인상이 남는다.
 *
 * 전략:
 *  - mount 시 sessionStorage 에서 같은 검색 컨텍스트(keyword/nearbyMode) 의 캐시가 있고
 *    TTL(5분) 이내면 즉시 hydrate → skeleton 자체를 건너뛰고 직전 화면 그대로 복원.
 *  - 카드 클릭 직전(상세로 이동 직전) 스크롤 위치를 캐시에 저장해 돌아왔을 때 복원.
 *  - keyword 변경 / 주변 모드 진입 시 캐시는 무시(검색 컨텍스트 다름).
 */
const LIST_CACHE_KEY = "camping_list_cache_v1";
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

function readListCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - (parsed.ts || 0) > LIST_CACHE_TTL_MS) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function writeListCache(payload) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      LIST_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), ...payload }),
    );
  } catch (_) {
    // sessionStorage 쿼터 초과/iOS private mode 등 → 무시
  }
}

function patchListCache(patch) {
  const cur = readListCache();
  if (!cur) return;
  writeListCache({ ...cur, ...patch });
}

// 고캠핑 키워드 검색 히트율이 좋은 광역 축약형
// keyword: GoCamping API 검색용 한글(고정), code: i18n 라벨용 광역 코드
const REGION_SHORTCUTS = [
  { keyword: "서울", code: "1" },
  { keyword: "부산", code: "6" },
  { keyword: "인천", code: "2" },
  { keyword: "대구", code: "4" },
  { keyword: "대전", code: "3" },
  { keyword: "광주", code: "5" },
  { keyword: "울산", code: "7" },
  { keyword: "세종", code: "8" },
  { keyword: "경기", code: "31" },
  { keyword: "강원", code: "32" },
  { keyword: "충북", code: "33" },
  { keyword: "충남", code: "34" },
  { keyword: "전북", code: "35" },
  { keyword: "전남", code: "36" },
  { keyword: "경북", code: "37" },
  { keyword: "경남", code: "38" },
  { keyword: "제주", code: "39" },
];

/**
 * GoCamping homepage 필드 정규화.
 * - HTML 앵커(`<a href="...">..</a>`) 가 그대로 내려올 때 href 추출
 * - 프로토콜 누락(`www.ezerpark.com`, `ezerpark.com`) 시 `https://` 보정
 * - URL 이 아니면 null 반환(섹션 자연 숨김) → 상대 경로 404 방지
 *
 * 백엔드가 1차 정규화하지만, 캐시된 옛 응답/직접 호출에도 대비해 동일 로직을 둔다.
 */
function sanitizeHomepageUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if (s.includes("<") && s.includes(">")) {
    const m = s.match(/href\s*=\s*['"]([^'"]+)['"]/i);
    if (m) s = m[1].trim();
    else s = s.replace(/<[^>]+>/g, "").trim();
  }
  if (!s) return null;

  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return s;
  if (lower.startsWith("www.") || s.includes(".")) {
    if (/\s/.test(s)) return null;
    if (!/^[A-Za-z0-9.\-_~:/?#@!$&'()*+,;=%]+$/.test(s)) return null;
    return `https://${s}`;
  }
  return null;
}

function CampingInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const autoNearbyTriggered = useRef(false);

  const initialKeyword = searchParams.get("q") || "";
  const initialNearbyParam = searchParams.get("nearby") === "true";
  // 같은 검색 컨텍스트(keyword + nearbyMode) 의 캐시가 있으면 즉시 hydrate.
  // SSR/CSR 첫 렌더 일치를 위해 lazy initializer 안에서만 sessionStorage 접근.
  const cacheHit = (() => {
    const c = readListCache();
    if (!c) return null;
    if (c.keyword !== initialKeyword) return null;
    // 주변 모드에서 hydration 은 캐시 keyword 는 비어있고 nearby 가 true 일 때만 의미가 있음.
    if (initialNearbyParam !== !!c.nearbyMode) return null;
    return c;
  })();

  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "map"
  const [sites, setSites] = useState(cacheHit?.sites || []);
  // 캐시 hit 이면 loading=false 로 초기 진입(스켈레톤 우회), 그 외에는 평소대로 true.
  const [loading, setLoading] = useState(!cacheHit);
  const [errored, setErrored] = useState(false);
  const [searchInput, setSearchInput] = useState(initialKeyword);
  const [keyword, setKeyword] = useState(initialKeyword);

  // 주변 모드 — 캐시가 nearby 모드였다면 그 상태를 그대로 복원해 GPS 재요청을 회피.
  const [nearbyMode, setNearbyMode] = useState(!!cacheHit?.nearbyMode);
  const [userPos, setUserPos] = useState(null);
  const [radiusKm, setRadiusKm] = useState(30);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [locSource, setLocSource] = useState("");

  // 무한스크롤
  const [visibleCount, setVisibleCount] = useState(
    cacheHit?.visibleCount && cacheHit.sites?.length
      ? Math.min(cacheHit.visibleCount, cacheHit.sites.length)
      : PAGE_SIZE,
  );
  const sentinelRef = useRef(null);
  // 캐시에서 복원해야 할 스크롤 Y. mount 후 1회 적용 후 null 처리.
  const pendingScrollRestore = useRef(cacheHit?.scrollY ?? null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 캐시 hydrate 직후 스크롤 위치 복원 (sites 가 DOM 에 그려진 다음 프레임).
  // html[data-scroll-behavior="smooth"] 가 적용되어 있어 두 인자 형태도 부드럽게 보일 수 있어
  // 일시적으로 scroll-behavior 를 auto 로 강제한 뒤 즉시 복원한다.
  useEffect(() => {
    if (!mounted) return;
    if (pendingScrollRestore.current == null) return;
    const y = pendingScrollRestore.current;
    pendingScrollRestore.current = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window === "undefined" || typeof document === "undefined") return;
        const html = document.documentElement;
        const prevBehavior = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        try {
          window.scrollTo({ top: y, left: 0, behavior: "instant" });
        } catch (_) {
          window.scrollTo(0, y);
        }
        // 다음 프레임에 원복 (사용자 수동 스크롤은 다시 smooth 로 동작).
        requestAnimationFrame(() => {
          html.style.scrollBehavior = prevBehavior;
        });
      });
    });
  }, [mounted]);

  // 데이터 로딩: keyword 변경 시 재호출. 주변 모드에서는 별도 경로.
  // 캐시 hit 이면 첫 렌더에서는 fetch 를 건너뛰고, 사용자가 keyword 를 바꾸면 그때 호출.
  const skipFetchOnceRef = useRef(!!cacheHit);
  useEffect(() => {
    // 첫 effect 실행에서 무조건 소비. nearbyMode bail 로 빠져도 다음 keyword 변경
    // 때는 정상 fetch 가 일어나도록 보장.
    const shouldSkip = skipFetchOnceRef.current;
    skipFetchOnceRef.current = false;
    if (nearbyMode) return undefined;
    if (shouldSkip) return undefined;
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
        writeListCache({
          keyword,
          nearbyMode: false,
          sites: data,
          visibleCount: Math.min(PAGE_SIZE, data.length),
          scrollY: 0,
        });
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

  const campingWeatherRegionCode = useMemo(() => {
    if (nearbyMode) return null;
    const kw = keyword.trim();
    if (!kw) return null;
    const hit = REGION_SHORTCUTS.find((r) => r.keyword === kw);
    if (hit) return hit.code;
    return resolveAreaCode(kw);
  }, [keyword, nearbyMode]);

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
      writeListCache({
        keyword: "",
        nearbyMode: true,
        sites: data,
        visibleCount: Math.min(PAGE_SIZE, data.length),
        scrollY: 0,
      });
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

  const handleNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyMode(true);
    setNearbyError("");
    setLocSource("");
    setKeyword("");
    setSearchInput("");
    router.replace(`/camping?nearby=true`);

    try {
      const { lat, lon } = await getDeviceLocation({ timeout: 15000 });
      setLocSource(t("camping.gpsLocation"));
      setUserPos({ lat, lon });
      fetchNearby(lat, lon, radiusKm);
    } catch (_) {
      fallbackToIp();
    }
  }, [fallbackToIp, fetchNearby, radiusKm, router, t]);

  // URL ?nearby=true 자동 진입 (햄버거 메뉴 링크 대응)
  // 캐시 hit + nearbyMode 인 경우 GPS/API 재요청을 생략하고 직전 결과를 그대로 보여준다.
  const skipAutoNearbyRef = useRef(!!cacheHit?.nearbyMode);
  useEffect(() => {
    if (!mounted) return;
    if (searchParams.get("nearby") === "true" && !autoNearbyTriggered.current) {
      autoNearbyTriggered.current = true;
      if (skipAutoNearbyRef.current) {
        skipAutoNearbyRef.current = false;
        return;
      }
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

  // visibleCount 변동 시 캐시 동기화 (사용자가 더 보기 / 무한스크롤로 늘려둔 상태도 복원).
  useEffect(() => {
    patchListCache({ visibleCount });
  }, [visibleCount]);

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
      <AmbientBackdrop palette={["#22c55e", "#10b981", "#f59e0b", "#06b6d4"]} intensity={0.9} />

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
                key={r.code}
                type="button"
                className={`cmp-chip ${keyword === r.keyword ? "cmp-chip-active" : ""}`}
                onClick={() => applyKeyword(r.keyword)}
              >
                {t(`regionShortcuts.${r.code}`, r.keyword)}
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
                    <CampingCard key={s.id} site={s} weatherRegionCode={campingWeatherRegionCode} />
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
  const homepageHref = sanitizeHomepageUrl(site.homepage);
  const detailHref = site.id
    ? `/camping/${encodeURIComponent(site.id)}${
        site.distanceKm != null ? `?d=${site.distanceKm}` : ""
      }`
    : null;
  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {detailHref ? (
          <Link href={detailHref} style={{ color: "#0e7490", textDecoration: "none" }}>
            {site.name}
          </Link>
        ) : (
          site.name
        )}
      </div>
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
      {homepageHref && (
        <a
          href={homepageHref}
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

function CampingCard({ site, weatherRegionCode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const mapUrl = site.address
    ? `https://map.kakao.com/link/search/${encodeURIComponent(site.address)}`
    : null;
  const homepageHref = sanitizeHomepageUrl(site.homepage);
  // 카드 전체를 상세 페이지로 이동시키는 클릭 가능 영역으로 만든다.
  // <Link>(=<a>) 로 감싸지 않는 이유: 카드 내부의 외부 링크(주소/홈페이지) 가 <a> 라서
  // 중첩 anchor 가 되어 HTML 무효 → 일부 브라우저에서 풀어버려 동작이 깨질 수 있음.
  // 대신 article + onClick + role/aria 로 접근성을 보강한다.
  const detailHref = site.id
    ? `/camping/${encodeURIComponent(site.id)}${
        site.distanceKm != null ? `?d=${site.distanceKm}` : ""
      }`
    : null;
  const goDetail = () => {
    if (!detailHref) return;
    // 상세로 떠나기 직전 현재 스크롤 위치를 캐시에 박아두면, 뒤로가기 진입 시
    // useEffect 가 그 좌표로 윈도우를 복원해 사용자 시야가 점프하지 않는다.
    if (typeof window !== "undefined") {
      patchListCache({ scrollY: window.scrollY || window.pageYOffset || 0 });
    }
    router.push(detailHref);
  };
  const onCardClick = () => goDetail();
  const onCardKeyDown = (e) => {
    if (!detailHref) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goDetail();
    }
  };
  const inner = (
    <>
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
        {weatherRegionCode && (
          <span
            className="cmp-weather-glyph"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <RegionWeatherGlyph regionCode={weatherRegionCode} size={18} variant="default" />
          </span>
        )}
      </div>
      <div className="cmp-body">
        <div className="cmp-ctitle" title={site.name || ""}>{site.name}</div>
        {site.induty && <div className="cmp-badges">{renderBadges(site.induty)}</div>}
        {site.address && (
          <div
            className="cmp-meta"
            style={{ flexWrap: "wrap", alignItems: "center", gap: 8 }}
          >
            <MapPin size={12} style={{ flexShrink: 0 }} />
            <span style={{ flex: "1 1 120px", minWidth: 0 }}>{site.address}</span>
            {mapUrl && (
              <MapServiceLinkButton
                href={mapUrl}
                brand="kakao"
                label={t("camping.openKakaoMap")}
                size="compact"
              />
            )}
          </div>
        )}
        <div className="cmp-meta cmp-meta-sub">
          <Phone size={12} />
          <span>{site.tel || t("camping.phoneNone")}</span>
        </div>
        {site.shortIntro && <p className="cmp-intro">{site.shortIntro}</p>}
        {homepageHref && (
          <a
            href={homepageHref}
            target="_blank"
            rel="noopener noreferrer"
            className="cmp-home"
            onClick={(e) => e.stopPropagation()}
          >
            {t("camping.homepage")} <ExternalLink size={11} />
          </a>
        )}
      </div>
    </>
  );

  if (detailHref) {
    return (
      <article
        className="cmp-card cmp-card-link"
        role="link"
        tabIndex={0}
        aria-label={site.name || ""}
        onClick={onCardClick}
        onKeyDown={onCardKeyDown}
      >
        {inner}
      </article>
    );
  }
  return <article className="cmp-card">{inner}</article>;
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

/**
 * Suspense fallback. 라우트 전환 도중(예: 상세 → 뒤로가기) Next.js 가 잠깐 노출하는
 * 화면. 이전 fallback 은 plain "Loading…" 텍스트라 어두운 body 배경(#09090b) 위에
 * "검은 화면" 처럼 보였음. 페이지 본문(.cmp-root) 과 동일한 그라데이션 + hero/스켈레톤
 * 자리표시자를 그려 시각적 점프 없이 매끄럽게 전환되도록 한다.
 */
function CampingRouteFallback() {
  return (
    <div className="cmp-root">
      <style>{cssBlock}</style>
      <header className="cmp-hero">
        <div className="cmp-hero-inner">
          <div className="cmp-tag">
            <Tent size={14} />
            <span>Korea GoCamping</span>
          </div>
          <div className="cmp-fallback-title cmp-sk-line cmp-sk-line-lg" />
          <div className="cmp-fallback-sub cmp-sk-line" />
        </div>
      </header>
      <div className="cmp-main">
        <div className="cmp-grid" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`fb-${i}`} className="cmp-card cmp-skeleton">
              <div className="cmp-img cmp-sk-img" />
              <div className="cmp-body">
                <div className="cmp-sk-line cmp-sk-line-lg" />
                <div className="cmp-sk-line" />
                <div className="cmp-sk-line cmp-sk-line-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampingPage() {
  return (
    <Suspense fallback={<CampingRouteFallback />}>
      <CampingInner />
    </Suspense>
  );
}

const cssBlock = `
.cmp-root {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  overflow-x: hidden;
  background: transparent;
  color: #f5f5f5;
}
.cmp-hero {
  position: relative;
  z-index: 1;
  padding: 40px 20px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.cmp-main {
  position: relative;
  z-index: 1;
}
.cmp-hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
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
  justify-content: center;
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
.cmp-card-link {
  text-decoration: none; color: inherit;
  cursor: pointer;
}
.cmp-card-link:focus-visible {
  outline: 2px solid #22c55e;
  outline-offset: 2px;
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
.cmp-weather-glyph {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
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
/* 라우트 전환 fallback 의 hero 자리표시자 (실제 hero 와 톤만 맞추는 dummy 라인) */
.cmp-fallback-title { height: 32px; max-width: 480px; margin: 16px 0 10px; border-radius: 8px; }
.cmp-fallback-sub { height: 14px; max-width: 360px; margin: 0; }

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
