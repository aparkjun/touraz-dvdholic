'use client';
import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Search, Sparkles } from "lucide-react";
import axios from "@/lib/axiosConfig";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { Capacitor } from "@capacitor/core";
import { showBanner, getTrackingStatus } from "@/lib/admob";
import { getMovieTitle, getPosterPath, getBackdropPath } from "@/lib/movieLang";
import useDragScrollAll from "@/lib/useDragScroll";
import TrendingRegionsWidget from "@/components/TrendingRegionsWidget";

function CategorySentinel({ cat, isLoadingMore, loadMoreCategory, palette }) {
  const sentinelRef = useRef(null);
  const hasFired = useRef(false);

  useEffect(() => {
    hasFired.current = false;
  }, [cat.id]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || isLoadingMore) return;
    hasFired.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasFired.current) {
          hasFired.current = true;
          loadMoreCategory(cat);
        }
      },
      { root: el.parentElement, rootMargin: "0px 200px 0px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cat, isLoadingMore, loadMoreCategory]);

  // IntersectionObserver 를 위한 보이지 않는 sentinel. 빨간 로딩 스피너는 제거.
  return (
    <div
      ref={sentinelRef}
      aria-hidden="true"
      style={{
        width: "1px",
        minWidth: "1px",
        flexShrink: 0,
        background: "transparent",
      }}
    />
  );
}

function DvdBadge({ size = 40 }) {
  return (
    <img
      src="/icons/dvd-spin.gif"
      alt="DVD"
      draggable={false}
      style={{
        position: "absolute",
        top: "6px",
        right: "6px",
        width: `${size}px`,
        height: `${size}px`,
        filter: "drop-shadow(0 2px 10px rgba(139,92,246,0.75)) drop-shadow(0 0 4px rgba(255,255,255,0.5))",
        zIndex: 2,
        pointerEvents: "none",
        userSelect: "none",
      }}
    />
  );
}

function MovieBadge({ size = 40 }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "6px",
        right: "6px",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(253,224,71,0.85) 60%, rgba(245,158,11,0.6) 100%)",
        boxShadow: "0 0 14px 2px rgba(245,158,11,0.85), 0 0 0 2px rgba(255,255,255,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <img
        src="/icons/movie-reel.gif"
        alt="Movie"
        draggable={false}
        style={{
          width: `${Math.round(size * 0.86)}px`,
          height: `${Math.round(size * 0.86)}px`,
          objectFit: "contain",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </div>
  );
}

function ContentBadge({ contentType, size }) {
  if (contentType === "dvd") return <DvdBadge size={size} />;
  if (contentType === "movie") return <MovieBadge size={size} />;
  return null;
}

// 최근 배치(새벽 2~3시 KST)로 새로 추가된 아이템인지 판정.
// 백엔드에서 firstSeenAt 값을 받아, 지난 30시간 이내에 처음 등장한 경우 NEW 처리.
// Jackson(JSR310) 미적용 환경에서는 [yyyy, M, d, H, m, s(, nano)] 배열 형태로 오므로 함께 처리한다.
const NEW_WINDOW_MS = 30 * 60 * 60 * 1000; // 30h

function parseFirstSeenAt(raw) {
  if (raw == null) return NaN;
  if (Array.isArray(raw)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = raw;
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return NaN;
    // 백엔드는 서버 로컬시(KST) 기준 LocalDateTime. UTC 로 간주하면 9시간 오차가 생기지만,
    // 30시간 윈도우 안에서는 판정 결과가 동일하므로 문제 없음.
    return Date.UTC(y, mo - 1, d, h, mi, s);
  }
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  return NaN;
}

function isNewItem(item) {
  if (!item) return false;
  const raw = item.firstSeenAt ?? item.first_seen_at;
  const ts = parseFirstSeenAt(raw);
  if (!Number.isFinite(ts)) return false;
  const delta = Date.now() - ts;
  return delta >= 0 && delta <= NEW_WINDOW_MS;
}

function NewBadge() {
  return (
    <div
      aria-label="NEW"
      style={{
        position: "absolute",
        top: "6px",
        left: "6px",
        zIndex: 3,
        padding: "2px 8px",
        borderRadius: "6px",
        background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
        color: "#fff",
        fontSize: "11px",
        fontWeight: 800,
        letterSpacing: "0.5px",
        boxShadow: "0 0 10px 1px rgba(239,68,68,0.7), 0 0 0 1.5px rgba(255,255,255,0.9)",
        textShadow: "0 1px 1px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        userSelect: "none",
        lineHeight: 1.2,
      }}
    >
      NEW
    </div>
  );
}

function DashboardContent() {
  const isNative = typeof window !== "undefined" && Capacitor?.isNativePlatform?.();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();

  // 카카오 OAuth2 로그인 성공 후 리다이렉트 시 URL에 token이 있으면 저장하고 URL 정리
  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    if (token) {
      localStorage.setItem("token", token);
      if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
      router.replace(pathname); // 쿼리 제거 (주소창에서 토큰 제거)
      window.dispatchEvent(new CustomEvent("token-stored"));
    }
  }, [searchParams, router, pathname]);

  const [page, setPage] = useState(0);
  const [movies, setMovies] = useState([]);
  const [hasNext, setHasNext] = useState(false);
  const [imageTabStates, setImageTabStates] = useState({}); // 각 영화별 이미지 탭 상태
  const [contentType, setContentType] = useState("dvd"); // "dvd" 또는 "movie"
  const [listError, setListError] = useState(null); // 목록 로드 실패 시 메시지
  const [listLoading, setListLoading] = useState(false);
  const lastListRequestRef = useRef({ type: "dvd", page: 0 }); // 응답 경쟁 방지: 마지막 요청 타입/페이지만 반영
  const contentTopRef = useRef(null);
  const dashboardRef = useRef(null);
  useDragScrollAll(dashboardRef);

  // Netflix 스타일 카테고리 정의: { id, title, contentType, genre, filter }
  const CATEGORIES = [
    { id: "popular-dvd", title: t("dashboard.categories.popular-dvd"), contentType: "dvd", genre: null },
    { id: "popular-movie", title: t("dashboard.categories.popular-movie"), contentType: "movie", genre: null },
    { id: "korean", title: t("dashboard.categories.korean"), contentType: "all", genre: null, filter: "korean" },
    { id: "classics", title: t("dashboard.categories.classics"), contentType: "all", genre: null, filter: "classics" },
    { id: "new-releases", title: t("dashboard.categories.new-releases"), contentType: "all", genre: null, filter: "new" },
    { id: "action", title: t("dashboard.categories.action"), contentType: "all", genre: "Action" },
    { id: "comedy", title: t("dashboard.categories.comedy"), contentType: "all", genre: "Comedy" },
    { id: "romance", title: t("dashboard.categories.romance"), contentType: "all", genre: "Romance" },
    { id: "mystery-thriller", title: t("dashboard.categories.mystery-thriller"), contentType: "all", genre: "Mystery|Thriller" },
    { id: "sf-fantasy", title: t("dashboard.categories.sf-fantasy"), contentType: "all", genre: "Science Fiction|Fantasy" },
    { id: "horror", title: t("dashboard.categories.horror"), contentType: "all", genre: "Horror" },
    { id: "crime", title: t("dashboard.categories.crime"), contentType: "all", genre: "Crime" },
    { id: "family", title: t("dashboard.categories.family"), contentType: "all", genre: "Family|Animation" },
    { id: "drama", title: t("dashboard.categories.drama"), contentType: "all", genre: "Drama" },
    { id: "anime", title: t("dashboard.categories.anime"), contentType: "all", genre: "Animation", filter: "japanese" },
    { id: "music", title: t("dashboard.categories.music"), contentType: "all", genre: "Music" },
    { id: "western", title: t("dashboard.categories.western"), contentType: "all", genre: "Western" },
    { id: "documentary", title: t("dashboard.categories.documentary"), contentType: "all", genre: "Documentary" },
    { id: "war-history", title: t("dashboard.categories.war-history"), contentType: "all", genre: "War|History" },
    { id: "collection", title: t("dashboard.categories.collection"), contentType: "all", genre: null, filter: "collection" },
    { id: "blockbuster", title: t("dashboard.categories.blockbuster"), contentType: "all", genre: null, filter: "blockbuster" },
    { id: "hidden-gems", title: t("dashboard.categories.hidden-gems"), contentType: "all", genre: null, filter: "hidden" },
    { id: "korean-dvd", title: t("dashboard.categories.korean-dvd"), contentType: "dvd", genre: null, filter: "korean" },
    { id: "action-dvd", title: t("dashboard.categories.action-dvd"), contentType: "dvd", genre: "Action" },
    { id: "comedy-dvd", title: t("dashboard.categories.comedy-dvd"), contentType: "dvd", genre: "Comedy" },
    { id: "drama-dvd", title: t("dashboard.categories.drama-dvd"), contentType: "dvd", genre: "Drama" },
    { id: "romance-dvd", title: t("dashboard.categories.romance-dvd"), contentType: "dvd", genre: "Romance" },
    { id: "thriller-dvd", title: t("dashboard.categories.thriller-dvd"), contentType: "dvd", genre: "Mystery|Thriller" },
    { id: "horror-dvd", title: t("dashboard.categories.horror-dvd"), contentType: "dvd", genre: "Horror" },
    { id: "sf-dvd", title: t("dashboard.categories.sf-dvd"), contentType: "dvd", genre: "Science Fiction|Fantasy" },
    { id: "anime-dvd", title: t("dashboard.categories.anime-dvd"), contentType: "dvd", genre: "Animation" },
  ];

  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasNext, setSearchHasNext] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [promptQuery, setPromptQuery] = useState("");
  const [promptResults, setPromptResults] = useState([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptResultsExpanded, setPromptResultsExpanded] = useState(false);
  const [promptTravelMode, setPromptTravelMode] = useState(false);
  const [ownerResults, setOwnerResults] = useState([]);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerResultsExpanded, setOwnerResultsExpanded] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { setIsLoggedIn(!!localStorage.getItem("token")); }, []);

  const [todayMovies, setTodayMovies] = useState([]);
  const [todayDvds, setTodayDvds] = useState([]);
  const [weekMovies, setWeekMovies] = useState([]);
  const [weekDvds, setWeekDvds] = useState([]);
  const [monthMovies, setMonthMovies] = useState([]);
  const [monthDvds, setMonthDvds] = useState([]);
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    const loadPopular = async () => {
      setPopularLoading(true);
      const base = getApiBaseUrl();
      const baseUrl = base ? base.replace(/\/$/, "") : "";
      const fetchP = (period, ct) => fetch(`${baseUrl}/api/v1/movie/popular?period=${period}&contentType=${ct}&limit=10`).then(r => r.json()).catch(() => null);
      try {
        const [tm, td, wm, wd, mm, md] = await Promise.all([
          fetchP("today", "movie"), fetchP("today", "dvd"),
          fetchP("week", "movie"), fetchP("week", "dvd"),
          fetchP("month", "movie"), fetchP("month", "dvd"),
        ]);
        if (tm?.success) setTodayMovies(tm.data || []);
        if (td?.success) setTodayDvds(td.data || []);
        if (wm?.success) setWeekMovies(wm.data || []);
        if (wd?.success) setWeekDvds(wd.data || []);
        if (mm?.success) setMonthMovies(mm.data || []);
        if (md?.success) setMonthDvds(md.data || []);
      } catch (err) {
        console.error("Popular fetch failed:", err);
      }
      setPopularLoading(false);
    };
    loadPopular();
  }, []);

  const [showAttModal, setShowAttModal] = useState(false);

  useEffect(() => { showBanner(); }, []);

  useEffect(() => {
    let cancelled = false;
    const checkAtt = async () => {
      if (localStorage.getItem("att_prompt_shown")) return;
      const status = await getTrackingStatus();
      if (!cancelled && status === "denied") {
        setShowAttModal(true);
        localStorage.setItem("att_prompt_shown", "1");
      }
    };
    checkAtt();
    return () => { cancelled = true; };
  }, []);

  // 뒤로가기 시 AI/주인장/검색 추천 결과 복원 (OpenAI 토큰 절약)
  useEffect(() => {
    try {
      const cachedSearch = sessionStorage.getItem("ds_search");
      if (cachedSearch) {
        const { keyword, results, hasNext } = JSON.parse(cachedSearch);
        if (keyword) {
          setSearchKeyword(keyword);
          setSearchResults(results || []);
          setSearchHasNext(!!hasNext);
        }
      }
      const cached = sessionStorage.getItem("ds_prompt");
      if (cached) {
        const { query, results, expanded } = JSON.parse(cached);
        if (results?.length) {
          setPromptQuery(query || "");
          setPromptResults(results);
          setPromptResultsExpanded(!!expanded);
        }
      }
      const cachedOwner = sessionStorage.getItem("ds_owner");
      if (cachedOwner) {
        const { results, expanded } = JSON.parse(cachedOwner);
        if (results?.length) {
          setOwnerResults(results);
          setOwnerResultsExpanded(!!expanded);
        }
      }
    } catch {}
  }, []);

  const [categoriesData, setCategoriesData] = useState({});
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [loadingMore, setLoadingMore] = useState({});
  const [contentTotals, setContentTotals] = useState(null); // { movieTotal, dvdTotal } from GET /api/v1/movie/totals

  const fetchCategoryPage = useCallback(async (cat, pageNum) => {
    const base = getApiBaseUrl();
    const baseUrl = base ? base.replace(/\/$/, "") : "";
    const params = new URLSearchParams({ contentType: cat.contentType || "all", page: String(pageNum) });
    if (cat.genre) params.set("genre", cat.genre);
    if (cat.filter) params.set("filter", cat.filter);
    const url = `${baseUrl}/api/v1/movie/category/search?${params}`;
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
    const json = await res.json();
    const movies = (json?.success && json?.data?.movies) ? json.data.movies : [];
    const hasNext = Boolean(json?.data?.hasNext);
    const totalCount = json?.data?.totalCount ?? null;
    return { movies, hasNext, totalCount };
  }, []);

  // 대시보드 진입 시 카테고리별 목록 자동 로드 (Netflix 스타일) + 실패 시 재시도 지원
  const loadCategories = async () => {
    setCategoriesError(null);
    setCategoriesLoading(true);
    try {
      const results = await Promise.all(CATEGORIES.map(async (cat) => {
        const { movies, hasNext, totalCount } = await fetchCategoryPage(cat, 0);
        return { [cat.id]: { movies, hasNext, page: 0, totalCount } };
      }));
      const merged = results.reduce((acc, r) => ({ ...acc, ...r }), {});
      setCategoriesData(merged);
    } catch (err) {
      setCategoriesError(t("dashboard.categoriesLoadError"));
      setCategoriesData({});
    } finally {
      setCategoriesLoading(false);
    }
  };

  // 총 콘텐츠 수 전용 API (DB 기준, 배치 반영값)
  const loadContentTotals = async () => {
    const base = getApiBaseUrl();
    const baseUrl = base ? base.replace(/\/$/, "") : "";
    try {
      const res = await fetch(`${baseUrl}/api/v1/movie/totals`);
      const json = await res.json();
      if (json?.success && json?.data) {
        setContentTotals({
          movieTotal: json.data.movieTotal ?? 0,
          dvdTotal: json.data.dvdTotal ?? 0,
        });
      }
    } catch {
      setContentTotals(null);
    }
  };

  useEffect(() => {
    loadCategories();
    loadContentTotals();
  }, []);

  const fetchSearch = async (keyword, pageNum) => {
    if (!keyword || !keyword.trim()) return;
    const base = getApiBaseUrl();
    const baseUrl = base ? base.replace(/\/$/, "") : "";
    const res = await fetch(`${baseUrl}/api/v1/movie/keyword/search?q=${encodeURIComponent(keyword.trim())}&page=${pageNum}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const json = await res.json();
    const movies = (json?.success && json?.data?.movies) ? json.data.movies : [];
    const hasNext = Boolean(json?.data?.hasNext);
    return { movies, hasNext };
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) return;
    setSearchLoading(true);
    const { movies, hasNext } = await fetchSearch(searchKeyword, 0);
    setSearchResults(movies);
    setSearchHasNext(hasNext);
    setSearchPage(0);
    setSearchLoading(false);
    try { sessionStorage.setItem("ds_search", JSON.stringify({ keyword: searchKeyword.trim(), results: movies, hasNext })); } catch {}
  };

  // AI 프롬프트 추천 (로그인 없이 호출 가능)
  const fetchPromptRecommend = async () => {
    const q = (promptQuery || "").trim();
    if (!q) return;
    setPromptLoading(true);
    setPromptResults([]);
    setPromptResultsExpanded(false);
    try {
      const base = getApiBaseUrl();
      const baseUrl = base ? base.replace(/\/$/, "") : "";
      const params = new URLSearchParams({ q, contentType: "movie" });
      if (promptTravelMode) params.append("mode", "travel");
      const url = `${baseUrl}/api/v1/movie/recommend/prompt?${params}`;
      const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      const list = (json?.success && Array.isArray(json?.data)) ? json.data : [];
      setPromptResults(list);
      try { sessionStorage.setItem("ds_prompt", JSON.stringify({ query: q, results: list, expanded: false })); } catch {}
    } catch (e) {
      setPromptResults([]);
    } finally {
      setPromptLoading(false);
    }
  };

  const OWNER_PRESETS = t("dashboard.ownerPresets", { returnObjects: true });

  const fetchOwnerRecommend = async (query) => {
    if (!query || !query.trim()) return;
    setOwnerLoading(true);
    setOwnerResults([]);
    setOwnerResultsExpanded(false);
    try {
      const base = getApiBaseUrl();
      const baseUrl = base ? base.replace(/\/$/, "") : "";
      const params = new URLSearchParams({ q: query.trim(), contentType: "dvd", limit: "15" });
      const url = `${baseUrl}/api/v1/movie/recommend/owner?${params}`;
      const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      const list = (json?.success && Array.isArray(json?.data)) ? json.data : [];
      setOwnerResults(list);
      try { sessionStorage.setItem("ds_owner", JSON.stringify({ results: list, expanded: false })); } catch {}
    } catch (e) {
      setOwnerResults([]);
    } finally {
      setOwnerLoading(false);
    }
  };

  const categoriesDataRef = useRef(categoriesData);
  categoriesDataRef.current = categoriesData;

  const loadMoreCategory = useCallback(async (cat) => {
    const current = categoriesDataRef.current[cat.id];
    if (!current?.hasNext) return;
    setLoadingMore((prev) => {
      if (prev[cat.id]) return prev;
      return { ...prev, [cat.id]: true };
    });
    const nextPage = (current.page || 0) + 1;
    try {
      const { movies: newMovies, hasNext } = await fetchCategoryPage(cat, nextPage);
      setCategoriesData((prev) => ({
        ...prev,
        [cat.id]: {
          movies: [...(prev[cat.id]?.movies || []), ...newMovies],
          hasNext,
          page: nextPage,
          totalCount: prev[cat.id]?.totalCount,
        },
      }));
    } finally {
      setLoadingMore((prev) => ({ ...prev, [cat.id]: false }));
    }
  }, [fetchCategoryPage]);

  // DVD 목록 (Popular DVD Select) - 기존 API 호환
  const loadDvdList = async (pageNum) => {
    const requestId = { type: "dvd", page: pageNum };
    lastListRequestRef.current = requestId;
    setListError(null);
    setListLoading(true);
    const base = getApiBaseUrl();
    const url = base ? `${base.replace(/\/$/, "")}/api/v1/movie/search?page=${pageNum}` : `/api/v1/movie/search?page=${pageNum}`;
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      if (lastListRequestRef.current !== requestId) return;
      if (!res.ok) {
        setMovies([]);
        setHasNext(false);
        setListError(t("dashboard.dvdListLoadError", { status: res.status }));
        return;
      }
      const data = json?.data;
      if (json?.success && data && Array.isArray(data.movies)) {
        setContentType("dvd");
        setMovies(data.movies);
        setHasNext(Boolean(data.hasNext));
        setPage(pageNum);
      } else {
        setMovies([]);
        setHasNext(false);
      }
    } catch (err) {
      if (lastListRequestRef.current !== requestId) return;
      setMovies([]);
      setHasNext(false);
      setListError(t("dashboard.dvdListNetworkError"));
    } finally {
      if (lastListRequestRef.current === requestId) setListLoading(false);
    }
  };

  // 영화 목록 (Popular MOVIE Select)
  const loadMovieList = async (pageNum) => {
    const requestId = { type: "movie", page: pageNum };
    lastListRequestRef.current = requestId;
    setListError(null);
    setListLoading(true);
    const base = getApiBaseUrl();
    const url = base ? `${base.replace(/\/$/, "")}/api/v1/movie/playing/search?page=${pageNum}` : `/api/v1/movie/playing/search?page=${pageNum}`;
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
      const json = await res.json();
      if (lastListRequestRef.current !== requestId) return;
      if (!res.ok) {
        setMovies([]);
        setHasNext(false);
        setListError(t("dashboard.movieListLoadError", { status: res.status }));
        return;
      }
      const data = json?.data;
      if (json?.success && data && Array.isArray(data.movies)) {
        setContentType("movie");
        setMovies(data.movies);
        setHasNext(Boolean(data.hasNext));
        setPage(pageNum);
      } else {
        setMovies([]);
        setHasNext(false);
      }
    } catch (err) {
      if (lastListRequestRef.current !== requestId) return;
      setMovies([]);
      setHasNext(false);
      setListError(t("dashboard.movieListNetworkError"));
    } finally {
      if (lastListRequestRef.current === requestId) setListLoading(false);
    }
  };

  const getMovies = loadDvdList;
  const getPlayingMovies = loadMovieList;

  const scrollToContentTop = () => {
    if (contentTopRef.current) {
      contentTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getYouTubeUrl = (movie) => {
    if (!movie) return "";
    if (movie.trailerUrl && String(movie.trailerUrl).trim() !== "") {
      return movie.trailerUrl;
    }
    const query = `${movie.movieName || ""} ${t("dashboard.trailer")}`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  };

  const handlePrevPage = () => {
    if (page > 0) {
      const prevPage = page - 1;
      setPage(prevPage);
      scrollToContentTop();
      if (contentType === "dvd") {
        getMovies(prevPage);
      } else {
        getPlayingMovies(prevPage);
      }
    }
  };

  const handleNextPage = () => {
    if (hasNext) {
      const nextPage = page + 1;
      setPage(nextPage);
      scrollToContentTop();
      if (contentType === "dvd") {
        getMovies(nextPage);
      } else {
        getPlayingMovies(nextPage);
      }
    }
  };

  // 이미지 탭 전환
  const toggleImageTab = (movieName, tab) => {
    setImageTabStates((prev) => ({
      ...prev,
      [movieName]: tab,
    }));
  };

  // 현재 활성화된 이미지 탭 가져오기
  const getActiveTab = (movieName) => {
    return imageTabStates[movieName] || "poster";
  };

  // 깨진 한글을 감지하는 함수 (CJK 한자가 포함되어 있으면 깨진 것으로 판단)
  const isCorruptedKorean = (text) => {
    if (!text) return false;
    // CJK Unified Ideographs 범위 (U+4E00 ~ U+9FFF)
    // 정상적인 한글 설명에는 중국 한자가 없어야 함
    const cjkPattern = /[\u4E00-\u9FFF]/;
    return cjkPattern.test(text);
  };

  // 설명 텍스트를 표시하는 함수
  const getDisplayOverview = (overview, ct = contentType) => {
    const noDescMessage = ct === "movie" 
      ? t("dashboard.noOverviewMovie") 
      : t("dashboard.noOverviewDvd");
    
    // overview가 없거나 비어있는 경우
    if (!overview || overview.trim() === "") {
      return noDescMessage;
    }
    if (overview === "No description available.") {
      return noDescMessage;
    }
    if (isCorruptedKorean(overview)) {
      return noDescMessage;
    }
    return overview;
  };
  const formatGenreForDisplay = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    // 짧은 장르 문자열은 한 줄 유지, 길어질 때만 쉼표 기준 줄바꿈
    if (raw.length <= 28) return raw;
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",\n");
  };

  // Netflix 스타일 한 줄 메타: "2024 · 2시간 15분 · 15세 관람가"
  const getOneLineMeta = (movie) => {
    const parts = [];
    const year = (movie.releaseDate || movie.releasedAt || "").slice(0, 4);
    if (year) parts.push(year);
    if (movie.runtime) parts.push(`${movie.runtime}${t("dashboard.min")}`);
    if (movie.certification) parts.push(movie.certification);
    return parts.join(" · ");
  };

  // 1년 이내 개봉/발매 여부 (최신 배지용)
  const isRecentRelease = (movie) => {
    const dateStr = movie.releaseDate || movie.releasedAt || "";
    const year = parseInt(dateStr.slice(0, 4), 10);
    const now = new Date().getFullYear();
    return !isNaN(year) && year >= now - 1;
  };

  // 평점 참여 인원 포맷 (1.2만 명)
  const formatVoteCount = (n) => {
    if (!n || n <= 0) return null;
    if (n >= 10000) return `${(n / 10000).toFixed(1)}${t("dashboard.tenThousand")}`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}${t("dashboard.thousand")}`;
    return t("dashboard.voteCountSmall", { count: n.toLocaleString() });
  };

  const palette = {
    bg: "var(--ds-bg)",
    panel: "var(--ds-panel)",
    panelSoft: "var(--ds-panel-soft)",
    border: "var(--ds-border)",
    text: "var(--ds-text)",
    textMuted: "var(--ds-text-muted)",
    primary: "var(--ds-primary)",
    primarySoft: "var(--ds-primary-soft)",
    secondary: "var(--ds-secondary)",
    secondarySoft: "var(--ds-secondary-soft)",
  };
  const detailFontFamily =
    "'D2Coding', 'D2 Coding', monospace";

  const getSelectButtonStyle = (type) => {
    const active = contentType === type;
    const isMovie = type === "movie";
    const color = isMovie ? palette.secondary : palette.primary;
    const soft = isMovie ? palette.secondarySoft : palette.primarySoft;
    return {
      border: `1px solid ${active ? color : palette.border}`,
      background: active ? soft : "rgba(255,255,255,0.02)",
      color: palette.text,
      padding: "10px 16px",
      borderRadius: "12px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 700,
      letterSpacing: "0.2px",
      minWidth: "160px",
      transition: "all 0.2s ease",
      boxShadow: active ? `0 8px 24px ${soft}` : "none",
    };
  };

  const getPageButtonStyle = (enabled) => ({
    background: enabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
    color: enabled ? palette.text : "#6b7280",
    border: `1px solid ${enabled ? palette.border : "rgba(255,255,255,0.04)"}`,
    padding: "8px 14px",
    borderRadius: "10px",
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "13px",
    fontWeight: 600,
  });

  return (
    <div
      ref={dashboardRef}
      className="dashboard-page"
      style={{
        width: "100%",
        background:
          "radial-gradient(1200px 600px at 20% -10%, rgba(139, 92, 246, 0.10), transparent), radial-gradient(1000px 500px at 100% -20%, rgba(59, 130, 246, 0.10), transparent), radial-gradient(125% 125% at 50% 90%, #000000 40%, #0d1a36 100%)",
        minHeight: "100vh",
        padding: isNative ? "20px 12px 80px" : "20px 12px 28px",
        fontFamily: detailFontFamily,
        maxWidth: "100vw",
      }}
    >
      <div ref={contentTopRef} style={{ width: "100%", padding: "0 5px" }}>
        {/* Today's Popular - 오늘의 인기 MOVIE / DVD */}
        {!popularLoading && (todayMovies.length > 0 || todayDvds.length > 0) && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
            marginBottom: "24px",
          }}>
            {/* Today's MOVIE */}
            <div style={{
              background: "linear-gradient(160deg, rgba(30,20,10,0.95), rgba(15,12,8,0.98))",
              border: "1px solid rgba(218,165,32,0.2)", borderRadius: "14px",
              padding: "12px 10px", overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <span style={{ fontSize: "18px" }}>🎬</span>
                <div>
                  <h3 style={{ color: "#ffd700", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.todayMovie")}</h3>
                  <p style={{ color: "rgba(255,235,180,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.todayMovieSub")}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {todayMovies.map((m, idx) => (
                  <button key={`tm-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=movie`)} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "6px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(218,165,32,0.1)",
                    borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                    width: "100%", textAlign: "left",
                  }}>
                    <div style={{
                      position: "relative", width: "36px", height: "52px", borderRadius: "6px",
                      overflow: "hidden", flexShrink: 0, background: "#1a1a1a",
                    }}>
                      {getPosterPath(m) ? (
                        <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : <div style={{ width: "100%", height: "100%", background: "rgba(218,165,32,0.1)" }} />}
                      <div style={{
                        position: "absolute", top: "-1px", left: "-1px", width: "18px", height: "18px",
                        borderRadius: "0 0 6px 0", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: 800, color: idx < 3 ? "#000" : "#fff",
                        background: idx === 0 ? "linear-gradient(135deg, #ffd700, #ffaa00)"
                          : idx === 1 ? "linear-gradient(135deg, #c0c0c0, #9a9a9a)"
                          : idx === 2 ? "linear-gradient(135deg, #cd7f32, #a0522d)"
                          : "rgba(80,80,80,0.8)",
                      }}>{idx + 1}</div>
                    </div>
                    <span style={{
                      color: idx < 3 ? "#ffd700" : "rgba(255,235,180,0.8)", fontSize: "12px", fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                    }}>{getMovieTitle(m)}</span>
                  </button>
                ))}
                {todayMovies.length === 0 && (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", textAlign: "center", padding: "12px 0" }}>{t("dashboard.todayNoData")}</p>
                )}
              </div>
            </div>
            {/* Today's DVD */}
            <div style={{
              background: "linear-gradient(160deg, rgba(10,15,30,0.95), rgba(8,10,20,0.98))",
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: "14px",
              padding: "12px 10px", overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <span style={{ fontSize: "18px" }}>💿</span>
                <div>
                  <h3 style={{ color: "#818cf8", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.todayDvd")}</h3>
                  <p style={{ color: "rgba(180,190,255,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.todayDvdSub")}</p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {todayDvds.map((m, idx) => (
                  <button key={`td-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=dvd`)} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "6px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.1)",
                    borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                    width: "100%", textAlign: "left",
                  }}>
                    <div style={{
                      position: "relative", width: "36px", height: "52px", borderRadius: "6px",
                      overflow: "hidden", flexShrink: 0, background: "#1a1a1a",
                    }}>
                      {getPosterPath(m) ? (
                        <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : <div style={{ width: "100%", height: "100%", background: "rgba(99,102,241,0.1)" }} />}
                      <div style={{
                        position: "absolute", top: "-1px", left: "-1px", width: "18px", height: "18px",
                        borderRadius: "0 0 6px 0", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: 800, color: idx < 3 ? "#000" : "#fff",
                        background: idx === 0 ? "linear-gradient(135deg, #ffd700, #ffaa00)"
                          : idx === 1 ? "linear-gradient(135deg, #c0c0c0, #9a9a9a)"
                          : idx === 2 ? "linear-gradient(135deg, #cd7f32, #a0522d)"
                          : "rgba(80,80,80,0.8)",
                      }}>{idx + 1}</div>
                    </div>
                    <span style={{
                      color: idx < 3 ? "#818cf8" : "rgba(180,190,255,0.8)", fontSize: "12px", fontWeight: 600,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0,
                    }}>{getMovieTitle(m)}</span>
                  </button>
                ))}
                {todayDvds.length === 0 && (
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", textAlign: "center", padding: "12px 0" }}>{t("dashboard.todayNoData")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CineTrip - 오늘 뜨는 지역 (관광 검색량 기반) */}
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "center" }}>
          <TrendingRegionsWidget limit={5} />
        </div>

        {/* This Week's / This Month's Popular */}
        {!popularLoading && (weekMovies.length > 0 || weekDvds.length > 0 || monthMovies.length > 0 || monthDvds.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px" }}>
            {/* This Week's MOVIE */}
            {weekMovies.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
                borderRadius: "14px", padding: "14px 10px", overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #FFA500)", boxShadow: "0 0 12px rgba(255,215,0,0.3)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🎞️</span>
                  <div>
                    <h3 style={{ color: "#ffd700", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.weekMovie")}</h3>
                    <p style={{ color: "rgba(255,235,180,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.weekMovieSub")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {weekMovies.map((m, idx) => (
                    <button key={`wm-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=movie`)} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "8px",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                      width: "100%", textAlign: "left",
                    }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "24px", height: "24px", borderRadius: "50%", fontWeight: 700, fontSize: "11px", flexShrink: 0,
                        color: idx < 3 ? "#1a1a1a" : "#a0a0a0",
                        background: idx === 0 ? "linear-gradient(135deg, #FFD700, #FFA500)" : idx === 1 ? "linear-gradient(135deg, #C0C0C0, #A8A8A8)" : idx === 2 ? "linear-gradient(135deg, #CD7F32, #B87333)" : "rgba(255,255,255,0.1)",
                        boxShadow: idx < 3 ? `0 2px 8px rgba(${idx === 0 ? "255,215,0" : idx === 1 ? "192,192,192" : "205,127,50"},0.4)` : "none",
                      }}>{idx + 1}</div>
                      <div style={{ width: "36px", height: "52px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {getPosterPath(m) ? <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(218,165,32,0.1)" }} />}
                      </div>
                      <span style={{ color: idx < 3 ? "#ffd700" : "rgba(255,235,180,0.8)", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{getMovieTitle(m)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* This Week's DVD */}
            {weekDvds.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
                borderRadius: "14px", padding: "14px 10px", overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #9333EA, #7C3AED)", boxShadow: "0 0 12px rgba(147,51,234,0.3)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>💿</span>
                  <div>
                    <h3 style={{ color: "#a78bfa", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.weekDvd")}</h3>
                    <p style={{ color: "rgba(180,190,255,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.weekDvdSub")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {weekDvds.map((m, idx) => (
                    <button key={`wd-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=dvd`)} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "8px",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                      width: "100%", textAlign: "left",
                    }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "24px", height: "24px", borderRadius: "50%", fontWeight: 700, fontSize: "11px", flexShrink: 0,
                        color: idx < 3 ? "#1a1a1a" : "#a0a0a0",
                        background: idx === 0 ? "linear-gradient(135deg, #FFD700, #FFA500)" : idx === 1 ? "linear-gradient(135deg, #C0C0C0, #A8A8A8)" : idx === 2 ? "linear-gradient(135deg, #CD7F32, #B87333)" : "rgba(255,255,255,0.1)",
                        boxShadow: idx < 3 ? `0 2px 8px rgba(${idx === 0 ? "255,215,0" : idx === 1 ? "192,192,192" : "205,127,50"},0.4)` : "none",
                      }}>{idx + 1}</div>
                      <div style={{ width: "36px", height: "52px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {getPosterPath(m) ? <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(147,51,234,0.1)" }} />}
                      </div>
                      <span style={{ color: idx < 3 ? "#a78bfa" : "rgba(180,190,255,0.8)", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{getMovieTitle(m)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* This Month's MOVIE */}
            {monthMovies.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
                borderRadius: "14px", padding: "14px 10px", overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #FFD700, #FFA500)", boxShadow: "0 0 12px rgba(255,215,0,0.3)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>🏆</span>
                  <div>
                    <h3 style={{ color: "#ffd700", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.monthMovie")}</h3>
                    <p style={{ color: "rgba(255,235,180,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.monthMovieSub")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {monthMovies.map((m, idx) => (
                    <button key={`mm-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=movie`)} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "8px",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                      width: "100%", textAlign: "left",
                    }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "24px", height: "24px", borderRadius: "50%", fontWeight: 700, fontSize: "11px", flexShrink: 0,
                        color: idx < 3 ? "#1a1a1a" : "#a0a0a0",
                        background: idx === 0 ? "linear-gradient(135deg, #FFD700, #FFA500)" : idx === 1 ? "linear-gradient(135deg, #C0C0C0, #A8A8A8)" : idx === 2 ? "linear-gradient(135deg, #CD7F32, #B87333)" : "rgba(255,255,255,0.1)",
                        boxShadow: idx < 3 ? `0 2px 8px rgba(${idx === 0 ? "255,215,0" : idx === 1 ? "192,192,192" : "205,127,50"},0.4)` : "none",
                      }}>{idx + 1}</div>
                      <div style={{ width: "36px", height: "52px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {getPosterPath(m) ? <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(218,165,32,0.1)" }} />}
                      </div>
                      <span style={{ color: idx < 3 ? "#ffd700" : "rgba(255,235,180,0.8)", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{getMovieTitle(m)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* This Month's DVD */}
            {monthDvds.length > 0 && (
              <div style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%)",
                borderRadius: "14px", padding: "14px 10px", overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", position: "relative",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #9333EA, #7C3AED)", boxShadow: "0 0 12px rgba(147,51,234,0.3)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "18px" }}>⭐</span>
                  <div>
                    <h3 style={{ color: "#a78bfa", fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>{t("dashboard.monthDvd")}</h3>
                    <p style={{ color: "rgba(180,190,255,0.5)", fontSize: "10px", margin: 0 }}>{t("dashboard.monthDvdSub")}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {monthDvds.map((m, idx) => (
                    <button key={`md-${m.movieName}-${idx}`} type="button" onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=dvd`)} style={{
                      display: "flex", alignItems: "center", gap: "10px", padding: "8px",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                      width: "100%", textAlign: "left",
                    }}>
                      <div style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "24px", height: "24px", borderRadius: "50%", fontWeight: 700, fontSize: "11px", flexShrink: 0,
                        color: idx < 3 ? "#1a1a1a" : "#a0a0a0",
                        background: idx === 0 ? "linear-gradient(135deg, #FFD700, #FFA500)" : idx === 1 ? "linear-gradient(135deg, #C0C0C0, #A8A8A8)" : idx === 2 ? "linear-gradient(135deg, #CD7F32, #B87333)" : "rgba(255,255,255,0.1)",
                        boxShadow: idx < 3 ? `0 2px 8px rgba(${idx === 0 ? "255,215,0" : idx === 1 ? "192,192,192" : "205,127,50"},0.4)` : "none",
                      }}>{idx + 1}</div>
                      <div style={{ width: "36px", height: "52px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}>
                        {getPosterPath(m) ? <img src={`https://image.tmdb.org/t/p/w185${getPosterPath(m)}`} alt={getMovieTitle(m)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: "rgba(147,51,234,0.1)" }} />}
                      </div>
                      <span style={{ color: idx < 3 ? "#a78bfa" : "rgba(180,190,255,0.8)", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{getMovieTitle(m)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 검색 바 - Magic 스타일 */}
        <div
          style={{
            marginBottom: "24px",
            position: "relative",
            display: "flex",
            alignItems: "stretch",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", paddingLeft: "14px", color: "rgba(255,255,255,0.5)" }}>
            <Search size={20} strokeWidth={2} />
          </div>
          <input
            type="text"
            placeholder={t("dashboard.searchPlaceholder")}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "14px 12px 14px 8px",
              border: "none",
              background: "transparent",
              color: "#fff",
              fontSize: "15px",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searchLoading}
            style={{
              margin: "6px",
              padding: "10px 20px",
              background: searchKeyword.trim()
                ? "linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)"
                : "rgba(255,255,255,0.08)",
              color: searchKeyword.trim() ? "#fff" : "rgba(255,255,255,0.4)",
              border: "none",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              cursor: searchLoading ? "wait" : "pointer",
              boxShadow: searchKeyword.trim() ? "0 4px 16px rgba(236, 72, 153, 0.4)" : "none",
              transition: "all 0.25s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
            onMouseEnter={(e) => {
              if (!searchLoading && searchKeyword.trim()) {
                e.currentTarget.style.transform = "scale(1.02)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(236, 72, 153, 0.5)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = searchKeyword.trim() ? "0 4px 16px rgba(236, 72, 153, 0.4)" : "none";
            }}
          >
            <Search size={16} />
            {searchLoading ? t("dashboard.searching") : t("dashboard.search")}
          </button>
        </div>

        {/* 검색 결과 */}
        {searchKeyword.trim() && (
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ color: palette.text, fontSize: "18px", fontWeight: 700, marginBottom: "12px", textAlign: "center" }}>
              {t("dashboard.searchResultsTitle")}
            </h3>
            {searchResults.length > 0 ? (
              <div className="dashboard-scroll-row" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", flexWrap: "nowrap" }}>
                {searchResults.map((item, idx) => {
                  const ct = item.contentType || "dvd";
                  const cat = { id: "search", contentType: ct };
                  return (
                    <div
                      key={`search-${item.movieName}-${idx}`}
                      className="dash-card"
                      style={{ background: palette.panel }}
                    >
                      <button
                        type="button"
                        style={{ width: "100%", margin: 0, padding: 0, border: "none", background: "none", cursor: "pointer", display: "block", position: "relative" }}
                        onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(item.movieName)}&contentType=${ct}`)}
                      >
                        {getPosterPath(item) ? (
                          <img src={`https://image.tmdb.org/t/p/w342${getPosterPath(item)}`} alt={getMovieTitle(item)} draggable={false} className="dash-card-img" />
                        ) : (
                          <img src="/no-poster-placeholder.png" alt="No Image" className="dash-card-img" />
                        )}
                        {isNewItem(item) && <NewBadge />}
                        <ContentBadge contentType={ct} />
                      </button>
                      <button
                        type="button"
                        style={{ width: "100%", padding: "8px", border: "none", background: "transparent", color: palette.text, fontSize: "13px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}
                        onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(item.movieName)}&contentType=${ct}`)}
                      >
                        {getMovieTitle(item)}
                      </button>
                    </div>
                  );
                })}
                <div style={{ flex: "1 1 0", minWidth: "20px", flexShrink: 0 }} aria-hidden="true" />
              </div>
            ) : !searchLoading && (
              <div style={{ color: palette.textMuted, padding: "20px", textAlign: "center" }}>{t("dashboard.noResults")}</div>
            )}
          </div>
        )}

        {categoriesLoading && (
          <div className="mb-3 p-3 rounded text-center" style={{ color: palette.text, background: "rgba(255,255,255,0.03)", border: `1px solid ${palette.border}` }}>
            {t("dashboard.loadingContents")}
          </div>
        )}
        {categoriesError && !categoriesLoading && (
          <div className="mb-3 p-4 rounded text-center" style={{ color: palette.text, background: "rgba(255,255,255,0.03)", border: `1px solid ${palette.border}` }}>
            <p style={{ marginBottom: "12px", color: palette.textMuted }}>{categoriesError}</p>
            <button
              type="button"
              onClick={loadCategories}
              className="btn btn-primary"
              style={{ padding: "8px 20px", borderRadius: "8px", fontWeight: 600 }}
            >
              {t("dashboard.retry")}
            </button>
          </div>
        )}

        {/* AI 프롬프트 추천 - Magic 스타일 카드 + 멋진 버튼 */}
        <div
          style={{
            marginBottom: "24px",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,215,0,0.12)",
            background: "linear-gradient(145deg, rgba(30,27,75,0.6) 0%, rgba(15,23,42,0.8) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ padding: "16px 18px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ color: "#fbbf24", display: "flex", alignItems: "center" }}>
                <Sparkles size={20} strokeWidth={2} />
              </div>
              <h3 style={{ color: palette.text, fontSize: "17px", fontWeight: 700, margin: 0 }}>
                {t("dashboard.aiRecommend")}
              </h3>
            </div>
            <p style={{ color: palette.textMuted, fontSize: "12px", marginBottom: "12px", lineHeight: 1.4 }}>
              {t("dashboard.aiRecommendDesc")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <button
                type="button"
                onClick={() => setPromptTravelMode((v) => !v)}
                title="한국관광공사 지역 지표를 AI 추천 컨텍스트로 주입"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: promptTravelMode
                    ? "1px solid rgba(139, 92, 246, 0.6)"
                    : "1px solid rgba(255,255,255,0.12)",
                  background: promptTravelMode
                    ? "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(139,92,246,0.25), rgba(236,72,153,0.25))"
                    : "rgba(255,255,255,0.04)",
                  color: promptTravelMode ? "#fff" : "rgba(255,255,255,0.65)",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <span style={{ fontSize: "13px" }}>{promptTravelMode ? "🌏" : "🧭"}</span>
                {promptTravelMode ? "여행 모드 ON" : "여행 모드"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: "12px",
                overflow: "hidden",
                border: promptTravelMode
                  ? "1px solid rgba(139, 92, 246, 0.5)"
                  : "1px solid rgba(255,215,0,0.2)",
                background: "rgba(0,0,0,0.25)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
                transition: "border-color 0.2s ease",
              }}
            >
              <input
                type="text"
                value={promptQuery}
                onChange={(e) => setPromptQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchPromptRecommend()}
                placeholder={t("dashboard.aiRecommendPlaceholder")}
                maxLength={200}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "12px 8px",
                  border: "none",
                  background: "transparent",
                  color: palette.text,
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={fetchPromptRecommend}
                disabled={promptLoading || !promptQuery.trim()}
                style={{
                  padding: "10px 14px",
                  border: "none",
                  background: "transparent",
                  cursor: promptLoading || !promptQuery.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "opacity 0.2s ease",
                  color: promptQuery.trim() && !promptLoading
                    ? "#fbbf24"
                    : "rgba(255,255,255,0.3)",
                  fontSize: "18px",
                  fontWeight: 700,
                  letterSpacing: "2px",
                  flexShrink: 0,
                  opacity: promptLoading ? 0.6 : 1,
                }}
              >
                {promptLoading ? (
                  <Sparkles size={16} />
                ) : (
                  "···"
                )}
              </button>
            </div>

          </div>
          {promptLoading && (
            <div style={{ color: palette.textMuted, padding: "16px", textAlign: "center", fontSize: "14px" }}>{t("dashboard.aiSearching")}</div>
          )}
          {!promptLoading && promptResults.length > 0 && (() => {
            const showMore = promptResults.length > 10 && !promptResultsExpanded;
            const listToShow = showMore ? promptResults.slice(0, 10) : promptResults;
            const restCount = promptResults.length - 10;
            return (
              <div className="dashboard-scroll-row" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", WebkitOverflowScrolling: "touch", flexWrap: "nowrap" }}>
                {listToShow.map((item, idx) => {
                  const m = item.movie || item;
                  const reason = item.reason || "";
                  const ct = m.contentType || "movie";
                  const regionCtx = item.regionContext || null;
                  return (
                    <div
                      key={`prompt-${m.movieName}-${idx}`}
                      style={{
                        flex: "0 0 auto",
                        width: "160px",
                        minWidth: "160px",
                        borderRadius: "10px",
                        overflow: "hidden",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                        background: palette.panel,
                        border: "1px solid rgba(255, 215, 0, 0.25)",
                      }}
                    >
                      <button
                        type="button"
                        style={{ width: "100%", margin: 0, padding: 0, border: "none", background: "none", cursor: "pointer", display: "block", position: "relative" }}
                        onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=${ct}`)}
                      >
                        {getPosterPath(m) ? (
                          <img src={`https://image.tmdb.org/t/p/w342${getPosterPath(m)}`} alt={getMovieTitle(m)} draggable={false} style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
                        ) : (
                          <img src="/no-poster-placeholder.png" alt="No Image" style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }} />
                        )}
                        {isNewItem(m) && <NewBadge />}
                        <ContentBadge contentType={ct} />
                      </button>
                      <div style={{ padding: "8px" }}>
                        <button
                          type="button"
                          style={{ width: "100%", padding: 0, border: "none", background: "transparent", color: palette.text, fontSize: "13px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" }}
                          onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=${ct}`)}
                        >
                          {getMovieTitle(m)}
                        </button>
                        {reason && (
                          <p style={{ margin: "4px 0 0", color: palette.textMuted, fontSize: "11px", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {reason}
                          </p>
                        )}
                        {regionCtx && (regionCtx.regionName || regionCtx.summary) && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (regionCtx.areaCode) {
                                router.push(`/cine-trip?area=${regionCtx.areaCode}`);
                              } else {
                                router.push(`/cine-trip`);
                              }
                            }}
                            style={{
                              marginTop: 6,
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18), rgba(236,72,153,0.18))",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#e9d5ff",
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={regionCtx.summary || regionCtx.regionName}
                          >
                            📍 {regionCtx.regionName}
                            {regionCtx.summary ? ` · ${regionCtx.summary}` : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {showMore && (
                  <button
                    type="button"
                    onClick={() => setPromptResultsExpanded(true)}
                    style={{
                      flex: "0 0 auto",
                      width: "160px",
                      minWidth: "160px",
                      height: "236px",
                      margin: 0,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      borderRadius: "14px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(251, 191, 36, 0.95)",
                      fontSize: "14px",
                      fontWeight: 700,
                      transition: "all 0.2s ease",
                      gap: "6px",
                    }}
                  >
                    <span>{t("dashboard.showMoreArrow")}</span>
                    <span style={{ fontSize: "13px", color: "rgba(251, 191, 36, 0.85)", fontWeight: 600 }}>
                      {listToShow.length} / {promptResults.length}
                    </span>
                  </button>
                )}
                <div style={{ flex: "1 1 0", minWidth: "20px", flexShrink: 0 }} aria-hidden="true" />
              </div>
            );
          })()}
          {!promptLoading && promptResults.length === 0 && promptQuery.trim() && (
            <div style={{ color: palette.textMuted, padding: "12px", textAlign: "center", fontSize: "13px" }}>{t("dashboard.aiNoResults")}</div>
          )}
        </div>

        {/* 주인장추천 - 독립 카드 */}
        <div
          style={{
            marginBottom: "24px",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,107,53,0.15)",
            background: "linear-gradient(145deg, rgba(40,15,5,0.7) 0%, rgba(15,23,42,0.85) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ padding: "16px 18px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "10px" }}>
              <span style={{ fontSize: "22px" }}>🎬</span>
              <h3 style={{ color: palette.text, fontSize: "17px", fontWeight: 700, margin: 0 }}>
                {t("dashboard.ownerRecommend")}
              </h3>
              <span style={{
                fontSize: "10px",
                color: "#ff6b35",
                background: "rgba(255,107,53,0.15)",
                padding: "2px 8px",
                borderRadius: "10px",
                fontWeight: 600,
              }}>
                TRENDING
              </span>
            </div>
            <p style={{ color: palette.textMuted, fontSize: "12px", marginBottom: "12px", lineHeight: 1.5, textAlign: "center" }}>
              {t("dashboard.ownerDesc")}
            </p>

            {/* 프리셋 질문 버튼들 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px", justifyContent: "center" }}>
              {OWNER_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => { if (!ownerLoading) fetchOwnerRecommend(preset); }}
                  disabled={ownerLoading}
                  style={{
                    background: "rgba(255,107,53,0.08)",
                    border: "1px solid rgba(255,107,53,0.2)",
                    borderRadius: "20px",
                    padding: "6px 14px",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: "12px",
                    cursor: ownerLoading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  💬 {preset.length > 22 ? preset.slice(0, 22) + "…" : preset}
                </button>
              ))}
            </div>

            {/* 자유 입력 필드 */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", justifyContent: "center" }}>
              <input
                type="text"
                value={ownerQuery}
                onChange={(e) => setOwnerQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ownerQuery.trim() && !ownerLoading) {
                    fetchOwnerRecommend(ownerQuery.trim());
                    setOwnerQuery("");
                  }
                }}
                placeholder={t("dashboard.ownerInputPlaceholder")}
                disabled={ownerLoading}
                style={{
                  flex: 1,
                  maxWidth: "340px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,107,53,0.3)",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  color: "#fff",
                  fontSize: "13px",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(255,107,53,0.6)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,107,53,0.3)"}
              />
              <button
                type="button"
                onClick={() => {
                  if (ownerQuery.trim() && !ownerLoading) {
                    fetchOwnerRecommend(ownerQuery.trim());
                    setOwnerQuery("");
                  }
                }}
                disabled={ownerLoading || !ownerQuery.trim()}
                style={{
                  background: ownerQuery.trim() ? "linear-gradient(135deg, #ff4e50, #f9d423)" : "rgba(255,255,255,0.08)",
                  border: "none",
                  borderRadius: "12px",
                  padding: "10px 18px",
                  color: ownerQuery.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: ownerQuery.trim() && !ownerLoading ? "pointer" : "not-allowed",
                  transition: "all 0.25s",
                  whiteSpace: "nowrap",
                }}
              >
                {t("dashboard.ownerGetRecommend")}
              </button>
            </div>

            {/* 주인장추천 메인 버튼 (랜덤) */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                className="owner-rec-btn"
                onClick={() => {
                  const randomPreset = OWNER_PRESETS[Math.floor(Math.random() * OWNER_PRESETS.length)];
                  if (!ownerLoading) fetchOwnerRecommend(randomPreset);
                }}
                disabled={ownerLoading}
              >
                <span>🎬 {ownerLoading ? t("dashboard.ownerSearching") : t("dashboard.ownerRandomBtn")}</span>
              </button>
            </div>
          </div>

          {/* 주인장추천 결과 */}
          {ownerLoading && (
            <div style={{ color: "#f7c948", padding: "16px", textAlign: "center", fontSize: "14px" }}>
              {t("dashboard.ownerLoading")}
            </div>
          )}
          {!ownerLoading && ownerResults.length > 0 && (() => {
            const showMore = ownerResults.length > 10 && !ownerResultsExpanded;
            const listToShow = showMore ? ownerResults.slice(0, 10) : ownerResults;
            const restCount = ownerResults.length - 10;
            return (
              <div style={{ padding: "0 8px 12px" }}>
                <div style={{ padding: "4px 10px 8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#f7c948", fontSize: "13px", fontWeight: 600 }}>🎬 {t("dashboard.ownerResult")}</span>
                </div>
                <div className="dashboard-scroll-row" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", WebkitOverflowScrolling: "touch", flexWrap: "nowrap" }}>
                  {listToShow.map((item, idx) => {
                    const m = item.movie || item;
                    const reason = item.reason || "";
                    const ct = m.contentType || "dvd";
                    return (
                      <div
                        key={`owner-${m.movieName}-${idx}`}
                        style={{ flex: "0 0 auto", width: "140px", cursor: "pointer", textAlign: "center" }}
                        onClick={() => router.push(`/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=${ct}`)}
                      >
                        <div style={{ position: "relative" }}>
                          {getPosterPath(m) ? (
                            <img
                              src={getPosterPath(m).startsWith("http") ? getPosterPath(m) : `https://image.tmdb.org/t/p/w300${getPosterPath(m)}`}
                              alt={getMovieTitle(m)}
                              style={{ width: "100%", borderRadius: "10px", marginBottom: "6px", boxShadow: "0 4px 12px rgba(255,107,53,0.2)" }}
                            />
                          ) : (
                            <div style={{
                              width: "100%", paddingTop: "150%", borderRadius: "10px",
                              background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(247,201,72,0.15))",
                              marginBottom: "6px",
                            }}>
                              <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: "12px", color: palette.textMuted }}>
                                No Image
                              </span>
                            </div>
                          )}
                          {isNewItem(m) && <NewBadge />}
                          <ContentBadge contentType={ct} />
                        </div>
                        <div style={{ fontSize: "12px", color: palette.text, fontWeight: 600, lineHeight: 1.3, marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {getMovieTitle(m)}
                        </div>
                        {reason && (
                          <div style={{
                            fontSize: "10px", color: "#f7c948", lineHeight: 1.3, overflow: "hidden",
                            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", fontStyle: "italic",
                          }}>
                            "{reason}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {showMore && (
                    <div
                      style={{ flex: "0 0 auto", width: "100px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                      onClick={() => setOwnerResultsExpanded(true)}
                    >
                      <span style={{ color: "#f7c948", fontSize: "13px", fontWeight: 600 }}>{t("dashboard.ownerShowMore", { count: restCount })}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Netflix 스타일 카테고리별 가로 스크롤 행 */}
        {!categoriesLoading && CATEGORIES.map((cat) => {
          const catData = categoriesData[cat.id];
          const catMovies = catData?.movies || [];
          const hasNext = catData?.hasNext ?? false;
          const isLoadingMore = loadingMore[cat.id];
          const totalCount = catData?.totalCount;
          const currentCount = catMovies.length;
          if (catMovies.length === 0) return null;
          return (
            <div key={cat.id} style={{ marginBottom: "24px" }}>
              <h3 style={{ color: palette.text, fontSize: "18px", fontWeight: 700, marginBottom: "12px", textAlign: "center" }}>
                {cat.title}
              </h3>
              <div
                className="dashboard-scroll-row"
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "auto",
                  overflowY: "hidden",
                  paddingBottom: "8px",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {catMovies.map((item, index) => {
                  const activeTab = getActiveTab(item.movieName);
                  const currentImagePath = activeTab === "poster" ? getPosterPath(item) : getBackdropPath(item);
                  const goToDetail = () => {
                    router.push(`/dashboard/images?movieName=${encodeURIComponent(item.movieName)}&contentType=${cat.contentType}`);
                  };
                  return (
                    <div
                      key={`${cat.id}-${item.movieName}-${index}`}
                      className="dash-card"
                      style={{ background: palette.panel }}
                    >
                      <button
                        type="button"
                        className="js-fast-tap"
                        style={{
                          width: "100%",
                          margin: 0,
                          padding: 0,
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          display: "block",
                          position: "relative",
                        }}
                        onClick={goToDetail}
                      >
                        {currentImagePath ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w342${currentImagePath}`}
                            alt={getMovieTitle(item)}
                            draggable={false}
                            className="dash-card-img"
                          />
                        ) : (
                          <img src="/no-poster-placeholder.png" alt="No Image" className="dash-card-img" />
                        )}
                        {isNewItem(item) && <NewBadge />}
                        <ContentBadge contentType={item.contentType} />
                      </button>
                      <button
                        type="button"
                        className="js-fast-tap"
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "none",
                          background: "transparent",
                          color: palette.text,
                          fontSize: "13px",
                          fontWeight: 600,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          cursor: "pointer",
                        }}
                        onClick={goToDetail}
                      >
                        {getMovieTitle(item)}
                      </button>
                    </div>
                  );
                })}
                {hasNext && (
                  <CategorySentinel
                    cat={cat}
                    isLoadingMore={isLoadingMore}
                    loadMoreCategory={loadMoreCategory}
                    palette={palette}
                  />
                )}
                {/* 100% 화면비율에서 오른쪽 여백을 채우는 spacer */}
                <div style={{ flex: "1 1 0", minWidth: "20px", flexShrink: 0 }} aria-hidden="true" />
              </div>
            </div>
          );
        })}

        {/* 총 편수: GET /api/v1/movie/totals (DB 기준, 배치 반영) */}
        {(() => {
          const movieTotal = contentTotals?.movieTotal ?? null;
          const dvdTotal = contentTotals?.dvdTotal ?? null;
          const sum = [movieTotal, dvdTotal].filter((n) => n != null).reduce((a, b) => a + b, 0);
          const hasCounts = movieTotal != null && dvdTotal != null;
          return hasCounts ? (
            <div
              style={{
                marginTop: "32px",
                marginBottom: "16px",
                padding: "14px 18px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                textAlign: "center",
                color: palette.textMuted,
                fontSize: "14px",
              }}
            >
              <span style={{ color: palette.text, fontWeight: 600 }}>{t("dashboard.totalContents")}</span>
              {" · "}
              {t("dashboard.contentSummary", { movieCount: movieTotal, dvdCount: dvdTotal })}
              <span style={{ marginLeft: "6px", fontSize: "12px", opacity: 0.85 }}>{t("dashboard.contentSummaryTotal", { sum })}</span>
              <div style={{ marginTop: "8px", fontSize: "12px", color: "#e53935" }}>
                {t("dashboard.batchUpdateDetail")}
              </div>
            </div>
          ) : null;
        })()}

        {/* Footer - 비 오는 거리 배경 이미지 (화면 좌우 꽉 채움) */}
        <footer
          className="dashboard-footer"
          style={{
            position: "relative",
            width: "100vw",
            marginLeft: "calc(-50vw + 50%)",
            minHeight: "320px",
            marginTop: "48px",
            marginBottom: "-28px",
            overflow: "hidden",
            backgroundImage: "url('/images/footer-bg.png')",
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
            backgroundRepeat: "no-repeat",
            borderRadius: 0,
            display: "flex",
            alignItems: "flex-start",
          }}
        >
          <div style={{ position: "relative", zIndex: 2, width: "100%", padding: "32px 24px", textAlign: "center" }}>
            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ fontSize: "clamp(24px, 5vw, 30px)", fontWeight: 700, margin: 0, marginBottom: "8px", background: "linear-gradient(90deg, #fbbf24, #f97316, #ef4444)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{t("dashboard.footer")}</h3>
              <p style={{ color: "#d1d5db", fontSize: "18px", fontWeight: 500, margin: 0 }}>{t("dashboard.footerAuthor")}</p>
            </div>
            <div style={{ marginTop: "32px", paddingTop: "24px" }}>
              <p style={{ color: "#6b7280", fontSize: "12px", margin: 0 }}>© 2025 Touraz Holic. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>


      {showAttModal && <AttTrackingModal onClose={() => setShowAttModal(false)} />}
    </div>
  );
}

function AttTrackingModal({ onClose }) {
  const { t } = useTranslation();

  const openSettings = async () => {
    try {
      const { App } = await import("@capacitor/app");
      await App.openUrl({ url: "app-settings:" });
    } catch {
      window.open("app-settings:", "_self");
    }
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
    }} onClick={onClose}>
      <div style={{
        background: "linear-gradient(160deg, rgba(30,20,10,0.98), rgba(15,12,8,0.99))",
        border: "1px solid rgba(218,165,32,0.3)", borderRadius: "20px",
        padding: "28px 24px", maxWidth: "340px", width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,215,0,0.08)",
        textAlign: "center",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🎬</div>
        <h3 style={{ color: "#ffd700", fontSize: "17px", fontWeight: 700, marginBottom: "12px" }}>
          {t("att.title")}
        </h3>
        <p style={{ color: "rgba(255,235,180,0.8)", fontSize: "14px", lineHeight: 1.6, marginBottom: "24px", whiteSpace: "pre-line" }}>
          {t("att.message")}
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 600,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)", cursor: "pointer",
          }}>
            {t("att.later")}
          </button>
          <button onClick={openSettings} style={{
            flex: 1, padding: "12px", borderRadius: "12px", fontSize: "14px", fontWeight: 700,
            background: "linear-gradient(135deg, #daa520, #ff8c00)", border: "none",
            color: "#fff", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(218,165,32,0.4)",
          }}>
            {t("att.goToSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
