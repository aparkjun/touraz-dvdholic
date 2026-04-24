"use client";

/**
 * /audio-guide — "Cine Audio Trail" 한국관광공사 관광지 오디오 가이드(Odii) 전용 페이지.
 *
 * <p>컨셉: "영화는 극장에서 · 이야기는 현지에서 귀로 듣기"
 *  - 영화·DVD 로 본 배경지 답사 시 현장에서 이어폰으로 듣는 이동형 오디오 스토리텔링
 *  - 눈 피로(정주행 번아웃) 해소 → 귀 중심 미디어 소비
 *
 * <p>데이터 소스:
 *  - GET /api/v1/audio-guide?type=theme|story&lang=ko|en (Based)
 *  - GET /api/v1/audio-guide/nearby?type&lang&lat&lon&radius (LocationBased)
 *  - GET /api/v1/audio-guide/search?type&lang&q=            (Search)
 *
 * <p>UI 구성:
 *  - 상단 hero: 헤드폰 모티프, 언어 뱃지, 검색창, "내 주변 오디오 투어" 버튼
 *  - 탭: 관광지 해설 (THEME) / 이야기 조각 (STORY)
 *  - 카테고리/지역 칩: 즐겨 쓰이는 K-드라마·역사·자연·문화 키워드
 *  - 카드 그리드: 썸네일 + 인라인 재생 버튼 + 거리/재생시간 배지
 *  - 하단 고정 플레이어: 현재 재생 중인 트랙 표시 (제목/관광지/컨트롤)
 *
 * <p>교차 접점:
 *  - 햄버거 메뉴 "내 주변 오디오 가이드" → /audio-guide?nearby=true
 *  - 대시보드 8번째 CTA 전폭 배너 → /audio-guide
 *  - 영화 상세 / cine-trip 지역 / DVD 매장 → NearbyAudioGuideStrip
 */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import AudioGuideDetailModal from "@/components/AudioGuideDetailModal";
import {
  Headphones,
  Mic2,
  Globe2,
  Search,
  LocateFixed,
  X,
  MapPin,
  Clock,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Radio,
  BookOpen,
  Film,
  PackageCheck,
  Landmark,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 60;
const RADIUS_OPTIONS = [10, 30, 50]; // km

/**
 * 영화/DVD 답사 컨셉에 어울리는 상위 키워드 숏컷.
 * Odii 검색에서 자주 매칭되는 역사/문화/자연/K-드라마 관련 키워드.
 */
const THEME_SHORTCUTS = [
  { key: "역사",       ko: "역사",          en: "History" },
  { key: "문화",       ko: "문화",          en: "Culture" },
  { key: "자연",       ko: "자연",          en: "Nature" },
  { key: "궁궐",       ko: "궁궐",          en: "Palace" },
  { key: "사찰",       ko: "사찰",          en: "Temple" },
  { key: "민속",       ko: "민속",          en: "Folk" },
  { key: "드라마",     ko: "K-드라마",      en: "K-Drama" },
  { key: "영화",       ko: "영화",          en: "Film Location" },
];

const REGION_SHORTCUTS = [
  "서울", "부산", "인천", "대구", "대전",
  "광주", "울산", "경기", "강원",
  "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

function AudioGuidePageInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeLang = (i18n?.language || "ko").toLowerCase().startsWith("en") ? "en" : "ko";

  // URL -> state 동기화
  const initialType = (searchParams.get("type") || "theme").toLowerCase() === "story" ? "story" : "theme";
  const initialQ = searchParams.get("q") || "";
  const initialNearby = searchParams.get("nearby") === "true";

  const [type, setType] = useState(initialType);
  const [keyword, setKeyword] = useState(initialQ);
  const [keywordInput, setKeywordInput] = useState(initialQ);
  const [radiusKm, setRadiusKm] = useState(30);
  const [userCoords, setUserCoords] = useState(null); // { lat, lng }
  const [wantNearby, setWantNearby] = useState(initialNearby);
  const [nearbyStatus, setNearbyStatus] = useState("idle"); // idle | locating | ready | denied | error

  const [items, setItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // 인라인 오디오 재생 (동시 1개)
  const [playingId, setPlayingId] = useState(null);
  const [muted, setMuted] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [playDuration, setPlayDuration] = useState(0);
  const audioRef = useRef(null);
  const playingItemRef = useRef(null);

  // 카드 클릭 시 열리는 상세 모달 대상
  const [detailItem, setDetailItem] = useState(null);

  /*
   * 4대 코스 카드 "탭 = 즉시 재생" UX를 위한 플래그.
   * 카드 클릭 → 필터 적용 → 새 items 로드 → useEffect 에서 첫 번째 오디오를 자동 재생.
   *
   * activatedCourse 는 UX 피드백(토스트) 문구와 결과 스크롤 타깃팅에 활용.
   */
  const [autoplayArm, setAutoplayArm] = useState(false);
  const [activatedCourse, setActivatedCourse] = useState(null); // { title, sub }
  const [courseToast, setCourseToast] = useState(null); // { kind: 'playing'|'empty'|'noaudio'|'blocked', title }
  const resultsRef = useRef(null);

  /*
   * launchCourse 가 이미 items 를 채우고 재생까지 트리거한 경우,
   * 직후 load useEffect 가 동일한 (type, keyword, lang) 조합으로 한 번 더 fetch 하는 것을
   * 차단하기 위한 시그니처 마커. `type:lang:keyword` 또는 `nearby:radius:lat:lng` 포맷.
   */
  const skipNextLoadRef = useRef(null);

  // URL 동기화 helper
  const syncUrl = useCallback((next) => {
    const params = new URLSearchParams();
    if (next.type && next.type !== "theme") params.set("type", next.type);
    if (next.keyword) params.set("q", next.keyword);
    if (next.nearby) params.set("nearby", "true");
    const qs = params.toString();
    router.replace(qs ? `/audio-guide?${qs}` : "/audio-guide", { scroll: false });
  }, [router]);

  // 데이터 로드
  const load = useCallback(async () => {
    // launchCourse 가 이미 동일 조건으로 items 를 채웠다면 이 호출을 건너뛴다.
    // (사용자의 Play 제스처 컨텍스트를 이미 소비했기 때문에 여기서 다시 덮어쓰면
    //  Audio.play() 가 차단되거나 재생 중인 트랙이 중단될 수 있다.)
    const currentSig = wantNearby && userCoords
      ? `nearby:${radiusKm}:${userCoords.lat}:${userCoords.lng}:${type}:${activeLang}`
      : `${type}:${activeLang}:${keyword.trim()}`;
    if (skipNextLoadRef.current === currentSig) {
      skipNextLoadRef.current = null;
      return;
    }

    setLoading(true);
    setErrored(false);
    try {
      let url;
      let params;
      if (wantNearby && userCoords) {
        url = `/api/v1/audio-guide/nearby`;
        params = {
          type,
          lang: activeLang,
          lat: userCoords.lat,
          lon: userCoords.lng,
          radius: radiusKm * 1000,
          limit: 0,
        };
      } else if (keyword.trim()) {
        url = `/api/v1/audio-guide/search`;
        params = { type, lang: activeLang, q: keyword.trim(), limit: 0 };
      } else {
        url = `/api/v1/audio-guide`;
        params = { type, lang: activeLang, limit: 0 };
      }
      const res = await axios.get(url, { params });
      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      setItems(list);
      setVisibleCount(PAGE_SIZE);
    } catch (e) {
      setErrored(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type, activeLang, keyword, wantNearby, userCoords, radiusKm]);

  useEffect(() => { load(); }, [load]);

  // 무한 스크롤
  useEffect(() => {
    const onScroll = () => {
      if (visibleCount >= items.length) return;
      const bottom = window.scrollY + window.innerHeight;
      if (bottom >= document.body.scrollHeight - 260) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items.length, visibleCount]);

  // 내 주변
  const requestNearby = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setNearbyStatus("error");
      return;
    }
    setNearbyStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setNearbyStatus("ready");
        setWantNearby(true);
        setKeyword("");
        setKeywordInput("");
        syncUrl({ type, nearby: true });
      },
      () => { setNearbyStatus("denied"); },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }
    );
  };

  // 초기 내 주변 요청
  useEffect(() => {
    if (initialNearby && !userCoords) requestNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmitSearch = (e) => {
    e.preventDefault();
    const q = keywordInput.trim();
    setKeyword(q);
    setWantNearby(false);
    syncUrl({ type, keyword: q });
  };

  const clearSearch = () => {
    setKeyword("");
    setKeywordInput("");
    setWantNearby(false);
    syncUrl({ type });
  };

  const applyShortcutKeyword = (sc) => {
    const q = activeLang === "en" ? sc.en : sc.ko;
    setKeywordInput(q);
    setKeyword(q);
    setWantNearby(false);
    syncUrl({ type, keyword: q });
  };

  /*
   * 4대 시그니처 코스 카드 트리거 (키워드 체인 + 직접 재생).
   *
   * 배경:
   *  - Odii API 의 theme 탭은 "사찰"/"궁궐" 같은 일반명사로는 0건이 나오고,
   *    매칭되어도 audioUrl 을 내려주지 않는다.
   *  - story 탭은 대부분 audioUrl 이 살아있고 경복궁/창덕궁/불국사 등 구체 명으로
   *    풍부하게 매칭된다.
   *
   * 그래서 각 코스 카드는 type='story' 로 고정하고, 키워드 후보를 순차 시도한다.
   * 첫 번째로 결과가 나오는 쿼리를 화면에 세팅하고 사용자의 클릭 제스처 컨텍스트
   * 안에서 바로 Audio.play() 를 호출해 재생을 시작한다.
   */
  const launchCourse = async ({ kind, title, keywords }) => {
    stopPlayback();
    // 이전 autoplay 경로가 실행되지 않도록 차단 (kind === 'nearby' 경로는 별도 취급)
    setAutoplayArm(false);
    setActivatedCourse({ title });
    setCourseToast({ kind: "loading", title });

    // 결과 섹션으로 스크롤 (사용자 클릭 직후 즉각 피드백)
    setTimeout(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);

    if (kind === "nearby") {
      // DVD 반납길 코스: geolocation 권한 → userCoords 세팅 → load useEffect 가 발동.
      // autoplayArm 으로 첫 트랙 자동 재생 예약.
      setItems([]);
      setLoading(true);
      setWantNearby(false); // 일단 false → requestNearby 가 true 로 승격 (상태 변화 보장)
      setAutoplayArm(true);
      requestNearby();
      return;
    }

    // keyword 체인: story 탭 고정, 후보 키워드를 하나씩 시도
    setType("story");
    setWantNearby(false);
    setItems([]);
    setLoading(true);

    const tryList = Array.isArray(keywords) ? keywords : [keywords];
    try {
      for (const q of tryList) {
        if (!q) continue;
        const res = await axios.get(`/api/v1/audio-guide/search`, {
          params: { type: "story", lang: activeLang, q, limit: 0 },
        });
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (list.length === 0) continue;

        // 이 쿼리를 최종 선택: 화면 상태에 반영
        setItems(list);
        setVisibleCount(PAGE_SIZE);
        setKeywordInput(q);
        setKeyword(q);
        setLoading(false);
        syncUrl({ type: "story", keyword: q });
        // load useEffect 가 동일한 시그니처로 재fetch 하려는 걸 차단
        skipNextLoadRef.current = `story:${activeLang}:${q}`;

        // 첫 오디오 또는 대본 가진 트랙을 바로 재생
        const firstPlayable = list.find((x) => !!x?.audioUrl);
        if (firstPlayable) {
          try {
            togglePlay(firstPlayable);
            setCourseToast({ kind: "playing", title, name: firstPlayable.title });
          } catch (_) {
            setCourseToast({ kind: "blocked", title });
          }
        } else {
          setCourseToast({ kind: "noaudio", title, count: list.length });
        }
        return;
      }
      // 모든 후보 실패
      setItems([]);
      setLoading(false);
      setCourseToast({ kind: "empty", title });
    } catch (e) {
      setLoading(false);
      setErrored(true);
      setCourseToast({ kind: "empty", title });
    }
  };

  /*
   * DVD 반납길 코스 전용 자동재생: items 가 새로 로드되면 첫 audioUrl 을 재생.
   * keyword 체인 경로는 launchCourse 내부에서 이미 재생을 시작하므로 여기선 제외.
   */
  useEffect(() => {
    if (!autoplayArm) return;
    if (loading) return;
    const firstPlayable = items.find((x) => !!x?.audioUrl);
    if (firstPlayable) {
      togglePlay(firstPlayable);
      setCourseToast({ kind: "playing", title: activatedCourse?.title || "", name: firstPlayable.title });
    } else if (items.length > 0) {
      setCourseToast({ kind: "noaudio", title: activatedCourse?.title || "", count: items.length });
    } else {
      setCourseToast({ kind: "empty", title: activatedCourse?.title || "" });
    }
    setAutoplayArm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading, autoplayArm]);

  // 코스 토스트 자동 dismiss
  useEffect(() => {
    if (!courseToast) return;
    const ttl = courseToast.kind === "loading" ? 8000 : 5000;
    const h = setTimeout(() => setCourseToast(null), ttl);
    return () => clearTimeout(h);
  }, [courseToast]);

  const applyRegion = (region) => {
    setKeywordInput(region);
    setKeyword(region);
    setWantNearby(false);
    syncUrl({ type, keyword: region });
  };

  const switchType = (nextType) => {
    if (nextType === type) return;
    setType(nextType);
    syncUrl({ type: nextType, keyword, nearby: wantNearby });
    stopPlayback();
  };

  // === 재생 제어 ===
  const stopPlayback = () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current.src = "";
      audioRef.current = null;
    }
    playingItemRef.current = null;
    setPlayingId(null);
    setPlayProgress(0);
    setPlayDuration(0);
  };

  const togglePlay = (item) => {
    if (!item?.audioUrl) return;
    if (playingId === item.id && audioRef.current) {
      stopPlayback();
      return;
    }
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
    const audio = new Audio(item.audioUrl);
    audio.muted = muted;
    audio.addEventListener("ended", () => {
      if (audioRef.current === audio) stopPlayback();
    });
    audio.addEventListener("error", () => {
      if (audioRef.current === audio) stopPlayback();
    });
    audio.addEventListener("loadedmetadata", () => {
      if (audioRef.current === audio) setPlayDuration(audio.duration || 0);
    });
    audio.addEventListener("timeupdate", () => {
      if (audioRef.current === audio) setPlayProgress(audio.currentTime || 0);
    });
    audio.play().catch(() => { /* autoplay block 등 */ });
    audioRef.current = audio;
    playingItemRef.current = item;
    setPlayingId(item.id);
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => { /* noop */ });
  };

  useEffect(() => () => stopPlayback(), []);

  const currentPlaying = playingItemRef.current;
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  return (
    <div className="agp-root">
      <style>{agpCss}</style>

      {/* Hero */}
      <header className="agp-hero">
        <div className="agp-hero-inner">
          <div className="agp-hero-badge">
            <Headphones size={14} />
            <span>{t("audioGuide.hero.badge", "Cine Audio Trail · Odii")}</span>
            <span className="agp-lang-pill" style={{ borderColor: "#c4b5fd", color: "#e9d5ff" }}>
              <Globe2 size={10} /> {activeLang.toUpperCase()}
            </span>
          </div>
          <h1 className="agp-hero-title">
            {t("audioGuide.hero.title", "영화는 극장에서 · 이야기는 현지에서 귀로 듣기")}
          </h1>
          <p className="agp-hero-sub">
            {t("audioGuide.hero.sub",
              "눈은 쉬고 귀로 여행하세요. 한국관광공사 오디오 가이드로 관광지 해설과 숨은 이야기를 이어폰으로 현장에서 만날 수 있어요.")}
          </p>

          <form className="agp-search" onSubmit={onSubmitSearch}>
            <Search size={16} />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={t("audioGuide.search.placeholder", "관광지·이야기·키워드 검색 (예: 경복궁, 민속, K-드라마)")}
              aria-label={t("audioGuide.search.aria", "오디오 가이드 검색")}
            />
            {keyword && (
              <button type="button" className="agp-search-clear" onClick={clearSearch} aria-label="clear">
                <X size={14} />
              </button>
            )}
            <button type="submit" className="agp-search-submit">
              {t("audioGuide.search.submit", "검색")}
            </button>
          </form>

          <div className="agp-hero-actions">
            <button
              type="button"
              className={`agp-nearby-btn ${wantNearby ? "agp-nearby-on" : ""}`}
              onClick={requestNearby}
              disabled={nearbyStatus === "locating"}
            >
              <LocateFixed size={14} />
              {nearbyStatus === "locating"
                ? t("audioGuide.nearby.locating", "위치 확인 중…")
                : t("audioGuide.nearby.cta", "내 주변 오디오 투어")}
            </button>
            {wantNearby && userCoords && (
              <div className="agp-radius">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`agp-chip ${r === radiusKm ? "agp-chip-on" : ""}`}
                    onClick={() => setRadiusKm(r)}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            )}
            {nearbyStatus === "denied" && (
              <span className="agp-hint agp-hint-warn">
                {t("audioGuide.nearby.denied", "위치 권한이 거부되었어요. 브라우저 설정에서 허용해주세요.")}
              </span>
            )}
            {nearbyStatus === "error" && (
              <span className="agp-hint agp-hint-warn">
                {t("audioGuide.nearby.unsupported", "이 브라우저는 위치 기능을 지원하지 않아요.")}
              </span>
            )}
          </div>

          <div className="agp-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={type === "theme"}
              className={`agp-tab ${type === "theme" ? "agp-tab-on" : ""}`}
              onClick={() => switchType("theme")}
            >
              <Radio size={14} /> {t("audioGuide.tab.theme", "관광지 해설")}
            </button>
            <button
              role="tab"
              aria-selected={type === "story"}
              className={`agp-tab ${type === "story" ? "agp-tab-on" : ""}`}
              onClick={() => switchType("story")}
            >
              <BookOpen size={14} /> {t("audioGuide.tab.story", "이야기 조각")}
            </button>
          </div>
        </div>
      </header>

      {/*
       * Cine Audio Trail · 4대 시그니처 코스 큐레이션.
       * 대시보드 CTA 카피("촬영지 · DVD 반납길 · 궁궐 · 사찰의 숨은 이야기")와 1:1 대응하는
       * 대표 코스 카드 4장. 사용자가 카피와 페이지 구조를 연결 짓지 못한 UX 갭을 해소.
       *
       * 카드 클릭 시 동작:
       *  - 촬영지 코스: 카피에 맞춘 키워드(영화/드라마) 중 현 언어에 맞는 기본 키워드로 필터
       *  - DVD 반납길 코스: requestNearby() 호출 → 지오로케이션 기반 내 주변 오디오 가이드
       *  - 궁궐 / 사찰 코스: 각 전용 키워드로 테마 필터
       *
       * 현재 활성 코스는 시각적으로 하이라이트(outline + glow)해 사용자가 지금 어느
       * 스토리 무드에 있는지 즉시 파악 가능.
       */}
      <section className="agp-courses" aria-label={t("audioGuide.courses.aria", "Cine Audio Trail 4대 코스")}>
        <div className="agp-courses-head">
          <Sparkles size={14} />
          <span>{t("audioGuide.courses.title", "Cine Audio Trail · 4대 시그니처 코스")}</span>
        </div>
        <div className="agp-courses-grid">
          <CourseCard
            icon={<Film size={18} />}
            theme="film"
            title={t("audioGuide.courses.film.title", "촬영지 · Cine Set Trail")}
            desc={t(
              "audioGuide.courses.film.desc",
              "영화·K-드라마 속 그 장면, 그 장소. 감독이 왜 이 배경을 골랐는지 현장에서 귀로 듣기."
            )}
            active={!wantNearby && type === "story" && ["드라마","영화","촬영","로케","명장면"].includes(keyword)}
            actionLabel={t("audioGuide.courses.film.cta", "바로 재생")}
            onClick={() =>
              launchCourse({
                kind: "keyword",
                title: t("audioGuide.courses.film.title", "촬영지 · Cine Set Trail"),
                // Odii story 탭 키워드 커버리지에 맞춘 폴백 체인
                keywords: activeLang === "en"
                  ? ["drama", "film", "movie"]
                  : ["드라마", "영화", "촬영", "로케", "명장면"],
              })
            }
          />
          <CourseCard
            icon={<PackageCheck size={18} />}
            theme="dvd"
            title={t("audioGuide.courses.dvd.title", "DVD 반납길 · Return Route")}
            desc={t(
              "audioGuide.courses.dvd.desc",
              "DVD 반납 가는 길, 지금 내 위치 주변의 숨은 해설을 이어폰으로. GPS 기반 오디오 가이드."
            )}
            active={wantNearby}
            actionLabel={
              nearbyStatus === "locating"
                ? t("audioGuide.nearby.locating", "위치 확인 중…")
                : wantNearby
                ? t("audioGuide.courses.dvd.on", "내 주변 듣는 중")
                : t("audioGuide.courses.dvd.cta", "내 위치로 재생")
            }
            onClick={() =>
              launchCourse({
                kind: "nearby",
                title: t("audioGuide.courses.dvd.title", "DVD 반납길 · Return Route"),
              })
            }
            disabled={nearbyStatus === "locating"}
          />
          <CourseCard
            icon={<Landmark size={18} />}
            theme="palace"
            title={t("audioGuide.courses.palace.title", "궁궐 · Royal Whisper")}
            desc={t(
              "audioGuide.courses.palace.desc",
              "경복궁·창덕궁·덕수궁의 담장 너머 왕실 이야기. 걸으며 듣는 조선의 하루."
            )}
            active={!wantNearby && type === "story" && ["궁궐","경복궁","창덕궁","덕수궁","종묘","조선"].includes(keyword)}
            actionLabel={t("audioGuide.courses.palace.cta", "바로 재생")}
            onClick={() =>
              launchCourse({
                kind: "keyword",
                title: t("audioGuide.courses.palace.title", "궁궐 · Royal Whisper"),
                keywords: activeLang === "en"
                  ? ["palace", "royal", "Gyeongbok", "Changdeok"]
                  : ["경복궁", "창덕궁", "덕수궁", "종묘", "궁궐", "조선"],
              })
            }
          />
          <CourseCard
            icon={<Mic2 size={18} />}
            theme="temple"
            title={t("audioGuide.courses.temple.title", "사찰 · Mindful Path")}
            desc={t(
              "audioGuide.courses.temple.desc",
              "불국사·해인사·통도사… 스님의 발걸음을 따라가는 명상의 오디오 트레일."
            )}
            active={!wantNearby && type === "story" && ["사찰","불국사","해인사","통도사","석굴암","범어사"].includes(keyword)}
            actionLabel={t("audioGuide.courses.temple.cta", "바로 재생")}
            onClick={() =>
              launchCourse({
                kind: "keyword",
                title: t("audioGuide.courses.temple.title", "사찰 · Mindful Path"),
                keywords: activeLang === "en"
                  ? ["temple", "Bulguksa", "Haeinsa", "Tongdosa"]
                  : ["불국사", "해인사", "통도사", "석굴암", "범어사", "사찰"],
              })
            }
          />
        </div>
      </section>

      {/*
       * 코스 트리거 후 사용자 피드백 토스트.
       *   - loading : 결과 로딩 중 ("재생 준비 중…")
       *   - playing : 첫 오디오 재생 시작 ("{트랙명} 재생 중")
       *   - noaudio : 결과는 있으나 오디오 URL 없음 ("카드에서 원하는 항목을 눌러 재생")
       *   - empty   : 결과 0건 ("다른 코스를 시도")
       */}
      {courseToast && (
        <div className={`agp-course-toast agp-toast-${courseToast.kind}`} role="status">
          <span className="agp-toast-icon">
            {courseToast.kind === "playing" ? (
              <Play size={14} />
            ) : courseToast.kind === "loading" ? (
              <Headphones size={14} />
            ) : (
              <Volume2 size={14} />
            )}
          </span>
          <span className="agp-toast-body">
            {courseToast.kind === "loading" && (
              <>
                <b>{courseToast.title}</b>
                <span>{t("audioGuide.toast.loading", "오디오 가이드 찾는 중…")}</span>
              </>
            )}
            {courseToast.kind === "playing" && (
              <>
                <b>{courseToast.title}</b>
                <span>
                  {t("audioGuide.toast.playing", "재생 시작 ·")} {courseToast.name}
                </span>
              </>
            )}
            {courseToast.kind === "noaudio" && (
              <>
                <b>{courseToast.title}</b>
                <span>
                  {t(
                    "audioGuide.toast.noaudio",
                    "오디오 파일이 없는 항목만 있어요. 카드에서 ▶를 눌러 다른 트랙을 시도해 보세요."
                  )}
                </span>
              </>
            )}
            {courseToast.kind === "empty" && (
              <>
                <b>{courseToast.title}</b>
                <span>
                  {t(
                    "audioGuide.toast.empty",
                    "검색 결과가 없어요. 다른 코스나 지역 칩을 시도해 보세요."
                  )}
                </span>
              </>
            )}
            {courseToast.kind === "blocked" && (
              <>
                <b>{courseToast.title}</b>
                <span>
                  {t(
                    "audioGuide.toast.blocked",
                    "브라우저가 자동 재생을 차단했어요. 카드의 ▶ 를 눌러 시작해 주세요."
                  )}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            className="agp-toast-close"
            onClick={() => setCourseToast(null)}
            aria-label="close"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Chips */}
      <div className="agp-chips">
        <div className="agp-chips-row">
          <span className="agp-chips-label">{t("audioGuide.chips.theme", "테마")}</span>
          {THEME_SHORTCUTS.map((sc) => {
            const label = activeLang === "en" ? sc.en : sc.ko;
            const on = keyword === label;
            return (
              <button
                key={sc.key}
                type="button"
                className={`agp-chip ${on ? "agp-chip-on" : ""}`}
                onClick={() => applyShortcutKeyword(sc)}
              >
                #{label}
              </button>
            );
          })}
        </div>
        <div className="agp-chips-row">
          <span className="agp-chips-label">{t("audioGuide.chips.region", "지역")}</span>
          {REGION_SHORTCUTS.map((r) => {
            const on = keyword === r;
            return (
              <button
                key={r}
                type="button"
                className={`agp-chip ${on ? "agp-chip-on" : ""}`}
                onClick={() => applyRegion(r)}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <main className="agp-main" ref={resultsRef}>
        <div className="agp-meta">
          <span className="agp-meta-count">
            {loading
              ? t("audioGuide.loading", "오디오 가이드를 불러오는 중…")
              : t("audioGuide.count", "{{count}}개 결과", { count: items.length })}
          </span>
          {errored && (
            <span className="agp-meta-err">
              {t("audioGuide.error", "일시적인 오류가 있었어요. 잠시 후 다시 시도해주세요.")}
            </span>
          )}
        </div>

        <div className="agp-grid">
          {visibleItems.map((item) => (
            <AudioCard
              key={item.id}
              item={item}
              playing={playingId === item.id}
              onToggle={() => togglePlay(item)}
              onOpen={() => setDetailItem(item)}
            />
          ))}
          {loading && Array.from({ length: 8 }).map((_, i) => (
            <div key={`sk-${i}`} className="agp-card agp-sk">
              <div className="agp-sk-img" />
              <div className="agp-sk-body">
                <div className="agp-sk-line agp-sk-lg" />
                <div className="agp-sk-line" />
                <div className="agp-sk-line" style={{ width: "60%" }} />
              </div>
            </div>
          ))}
          {!loading && items.length === 0 && (
            <div className="agp-empty">
              <Headphones size={32} />
              <div>{t("audioGuide.empty.title", "조건에 맞는 오디오 가이드가 없어요")}</div>
              <div className="agp-empty-sub">
                {t("audioGuide.empty.sub", "검색어를 바꾸거나 다른 테마/지역을 눌러보세요.")}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 하단 고정 플레이어 */}
      {currentPlaying && playingId && (
        <div className="agp-player">
          <div className="agp-player-inner">
            <div className="agp-player-meta">
              {currentPlaying.imageUrl ? (
                <img
                  src={currentPlaying.imageUrl}
                  alt={currentPlaying.title}
                  className="agp-player-thumb"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="agp-player-thumb agp-player-thumb-fallback">
                  <Mic2 size={18} />
                </div>
              )}
              <div className="agp-player-texts">
                <div className="agp-player-title" title={currentPlaying.title}>
                  {currentPlaying.audioTitle || currentPlaying.title}
                </div>
                <div className="agp-player-sub" title={currentPlaying.title}>
                  {currentPlaying.title}
                </div>
              </div>
            </div>
            <div className="agp-player-progress">
              <span className="agp-player-time">{formatTime(playProgress)}</span>
              <div className="agp-player-bar">
                <div
                  className="agp-player-bar-fill"
                  style={{ width: playDuration > 0 ? `${(playProgress / playDuration) * 100}%` : "0%" }}
                />
              </div>
              <span className="agp-player-time">{formatTime(playDuration)}</span>
            </div>
            <div className="agp-player-ctrl">
              <button type="button" className="agp-player-btn" onClick={restart} aria-label="restart">
                <SkipBack size={16} />
              </button>
              <button type="button" className="agp-player-btn agp-player-btn-lg"
                onClick={() => togglePlay(currentPlaying)} aria-label="pause">
                <Pause size={18} />
              </button>
              <button type="button" className="agp-player-btn" onClick={toggleMute}
                aria-label={muted ? "unmute" : "mute"}>
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <button type="button" className="agp-player-btn agp-player-btn-close"
                onClick={stopPlayback} aria-label="close">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 카드 클릭 시 열리는 상세 모달 */}
      {detailItem && (
        <AudioGuideDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

/**
 * Cine Audio Trail 의 시그니처 코스 카드.
 * 4개 코스(촬영지/DVD 반납길/궁궐/사찰) 공통 레이아웃. 각 코스의 개성 테마 색상만 prop 으로 구분.
 *
 * active=true 인 카드는 상단 배지 + 외곽선 + glow 로 "지금 이 코스 듣는 중" 을 알린다.
 */
function CourseCard({ icon, theme, title, desc, active, actionLabel, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`agp-course agp-course-${theme} ${active ? "agp-course-active" : ""}`}
    >
      {active && (
        <span className="agp-course-live">
          <span className="agp-course-dot" /> NOW PLAYING
        </span>
      )}
      <span className="agp-course-icon">{icon}</span>
      <span className="agp-course-title">{title}</span>
      <span className="agp-course-desc">{desc}</span>
      <span className="agp-course-cta">
        {actionLabel}
        <ChevronRight size={14} />
      </span>
    </button>
  );
}

function AudioCard({ item, playing, onToggle, onOpen }) {
  const { t } = useTranslation();
  const hasAudio = !!item.audioUrl;
  // 카드 전체는 버튼 역할(상세 모달 열기). 내부 재생 버튼 클릭은 버블링 차단.
  const handleOpen = (e) => {
    e.preventDefault();
    onOpen?.();
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen?.();
    }
  };
  return (
    <article
      className={`agp-card ${playing ? "agp-card-on" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={onKeyDown}
      aria-label={`${item.title} ${t("audioGuide.detail.openAria", "상세 열기")}`}
    >
      <div className="agp-card-img">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="agp-card-img-fb">
            <Mic2 size={36} />
          </div>
        )}
        {item.distanceKm != null && (
          <span className="agp-card-dist">
            {item.distanceKm < 1
              ? `${Math.round(item.distanceKm * 1000)}m`
              : `${item.distanceKm.toFixed(1)}km`}
          </span>
        )}
        {hasAudio && (
          <button
            type="button"
            className={`agp-card-play ${playing ? "agp-card-play-on" : ""}`}
            onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
            aria-label={playing ? t("nearbyAudioGuide.pause", "일시정지") : t("nearbyAudioGuide.play", "재생")}
          >
            {playing ? <Pause size={22} /> : <Play size={22} />}
          </button>
        )}
      </div>
      <div className="agp-card-body">
        <div className="agp-card-title" title={item.title}>{item.title}</div>
        {item.audioTitle && item.audioTitle !== item.title && (
          <div className="agp-card-atitle">{item.audioTitle}</div>
        )}
        {item.themeCategory && <div className="agp-card-cat">#{item.themeCategory}</div>}
        <div className="agp-card-row">
          {item.playTimeText && (
            <span className="agp-card-meta">
              <Clock size={12} /> {formatMiniTime(item.playTimeText)}
            </span>
          )}
          {item.address && (
            <span className="agp-card-meta agp-card-addr" title={item.address}>
              <MapPin size={12} /> {item.address}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * playTimeText 는 서버에서 "122"(초) · "02:03" · "2분 3초" 등 다양한 형식이 올 수 있다.
 * - 순수 초 문자열이면 mm:ss 로 변환
 * - 이미 포맷된 문자열이면 그대로 노출
 * - 비어 있거나 파싱 실패 시 빈 문자열
 */
function formatMiniTime(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d+$/.test(s)) {
    const sec = parseInt(s, 10);
    if (Number.isFinite(sec) && sec > 0) return formatTime(sec);
  }
  return s;
}

export default function AudioGuidePage() {
  return (
    <Suspense fallback={
      <div className="agp-boot">
        <Headphones size={22} />
        <span>loading…</span>
      </div>
    }>
      <AudioGuidePageInner />
    </Suspense>
  );
}

const agpCss = `
.agp-root {
  min-height: 100vh;
  padding-bottom: 120px;
  color: #f5f5ff;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(167,139,250,0.22) 0%, transparent 60%),
    radial-gradient(1000px 400px at 100% 0%, rgba(251,191,36,0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0a0614 0%, #0a0614 40%, #100a1c 100%);
}

/* ===== Cine Audio Trail · 4대 시그니처 코스 ===== */
.agp-courses {
  max-width: 1200px;
  margin: 4px auto 20px;
  padding: 0 16px;
}
.agp-courses-head {
  display: inline-flex; align-items: center; gap: 6px;
  margin-bottom: 10px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.1);
  border: 1px solid rgba(250, 204, 21, 0.3);
  color: #fde68a;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.agp-courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.agp-course {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 16px 16px 14px;
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  font: inherit;
  min-height: 170px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background: linear-gradient(180deg, rgba(20,16,36,0.7), rgba(20,16,36,0.4));
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.agp-course:hover:not(:disabled) {
  transform: translateY(-3px);
  border-color: rgba(255,255,255,0.2);
}
.agp-course:disabled { opacity: 0.65; cursor: wait; }
.agp-course::before {
  content: "";
  position: absolute;
  top: -60px; right: -60px;
  width: 160px; height: 160px;
  border-radius: 50%;
  filter: blur(22px);
  opacity: 0.65;
  pointer-events: none;
  transition: opacity 0.25s;
}
.agp-course:hover::before { opacity: 0.9; }

.agp-course-film::before        { background: radial-gradient(circle, rgba(244,63,94,0.55), transparent 65%); }
.agp-course-dvd::before         { background: radial-gradient(circle, rgba(249,115,22,0.55), transparent 65%); }
.agp-course-palace::before      { background: radial-gradient(circle, rgba(250,204,21,0.55), transparent 65%); }
.agp-course-temple::before      { background: radial-gradient(circle, rgba(16,185,129,0.55), transparent 65%); }

.agp-course-film.agp-course-active  { border-color: rgba(244,63,94,0.7);  box-shadow: 0 18px 40px -18px rgba(244,63,94,0.55); }
.agp-course-dvd.agp-course-active   { border-color: rgba(249,115,22,0.7); box-shadow: 0 18px 40px -18px rgba(249,115,22,0.55); }
.agp-course-palace.agp-course-active{ border-color: rgba(250,204,21,0.7); box-shadow: 0 18px 40px -18px rgba(250,204,21,0.55); }
.agp-course-temple.agp-course-active{ border-color: rgba(16,185,129,0.7); box-shadow: 0 18px 40px -18px rgba(16,185,129,0.55); }

.agp-course-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  position: relative;
  z-index: 1;
}
.agp-course-film  .agp-course-icon { color: #fecdd3; background: rgba(244,63,94,0.18); }
.agp-course-dvd   .agp-course-icon { color: #fed7aa; background: rgba(249,115,22,0.18); }
.agp-course-palace.agp-course .agp-course-icon,
.agp-course-palace .agp-course-icon { color: #fde68a; background: rgba(250,204,21,0.18); }
.agp-course-temple .agp-course-icon { color: #a7f3d0; background: rgba(16,185,129,0.18); }

.agp-course-title {
  position: relative; z-index: 1;
  font-size: 1rem; font-weight: 800; letter-spacing: -0.2px;
  color: #fff;
}
.agp-course-desc {
  position: relative; z-index: 1;
  font-size: 0.82rem; line-height: 1.45;
  color: #cbd5e1;
  flex: 1;
}
.agp-course-cta {
  position: relative; z-index: 1;
  margin-top: auto;
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.78rem; font-weight: 800;
}
.agp-course-film  .agp-course-cta { color: #fda4af; }
.agp-course-dvd   .agp-course-cta { color: #fdba74; }
.agp-course-palace .agp-course-cta { color: #fcd34d; }
.agp-course-temple .agp-course-cta { color: #6ee7b7; }

.agp-course-live {
  position: absolute;
  top: 10px; right: 10px;
  z-index: 2;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.65rem; font-weight: 900; letter-spacing: 0.08em;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.25);
  backdrop-filter: blur(6px);
}
.agp-course-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px rgba(239,68,68,0.8);
  animation: agp-pulse 1.3s ease-in-out infinite;
}
@keyframes agp-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ===== 코스 토스트 (카드 클릭 후 피드백) ===== */
.agp-course-toast {
  position: fixed;
  left: 50%;
  bottom: 110px;
  transform: translateX(-50%);
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: min(520px, calc(100% - 32px));
  padding: 10px 12px 10px 14px;
  border-radius: 14px;
  background: rgba(15, 10, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 50px -20px rgba(0, 0, 0, 0.7);
  color: #f5f5ff;
  backdrop-filter: blur(10px);
  animation: agp-toast-in 0.25s ease-out;
}
@keyframes agp-toast-in {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
.agp-toast-playing { border-color: rgba(16, 185, 129, 0.6); box-shadow: 0 20px 50px -18px rgba(16, 185, 129, 0.45); }
.agp-toast-loading { border-color: rgba(167, 139, 250, 0.55); }
.agp-toast-noaudio { border-color: rgba(250, 204, 21, 0.55); }
.agp-toast-empty   { border-color: rgba(244, 63, 94, 0.55); }

.agp-toast-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  color: #fff;
  flex: 0 0 auto;
}
.agp-toast-playing .agp-toast-icon { color: #6ee7b7; background: rgba(16,185,129,0.2); }
.agp-toast-loading .agp-toast-icon { color: #c4b5fd; background: rgba(167,139,250,0.2); }
.agp-toast-noaudio .agp-toast-icon { color: #fde68a; background: rgba(250,204,21,0.2); }
.agp-toast-empty   .agp-toast-icon { color: #fda4af; background: rgba(244,63,94,0.2); }

.agp-toast-body {
  display: flex; flex-direction: column; gap: 2px;
  font-size: 0.82rem; line-height: 1.35;
  min-width: 0;
}
.agp-toast-body b { font-size: 0.78rem; color: #f5f5ff; font-weight: 800; }
.agp-toast-body span { color: #cbd5e1; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.agp-toast-close {
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: 0; color: #94a3b8; cursor: pointer;
  width: 22px; height: 22px;
  border-radius: 999px;
}
.agp-toast-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

.agp-boot { min-height: 40vh; display: inline-flex; gap: 10px; align-items: center; padding: 24px; color: #bda6ff; }

.agp-hero {
  padding: 48px 16px 22px;
}
.agp-hero-inner { max-width: 980px; margin: 0 auto; }
.agp-hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 11px; border-radius: 999px;
  background: rgba(167,139,250,0.15);
  border: 1px solid rgba(167,139,250,0.35);
  color: #e9d5ff; font-size: 0.78rem; font-weight: 700;
}
.agp-lang-pill {
  display: inline-flex; align-items: center; gap: 3px;
  margin-left: 6px;
  font-size: 0.66rem; font-weight: 800;
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid currentColor;
  background: rgba(0,0,0,0.3);
  letter-spacing: 0.04em;
}
.agp-hero-title {
  margin: 14px 0 6px;
  font-size: clamp(1.7rem, 3.3vw, 2.4rem);
  font-weight: 900; line-height: 1.2;
  background: linear-gradient(90deg, #c4b5fd 0%, #fde68a 55%, #f9a8d4 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.agp-hero-sub { margin: 0 0 20px; color: #cdc0ee; font-size: 0.98rem; line-height: 1.55; max-width: 720px; }

.agp-search {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(167,139,250,0.35);
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 14px;
  box-shadow: 0 8px 24px rgba(10, 4, 24, 0.4);
}
.agp-search svg { color: #c4b5fd; }
.agp-search input {
  flex: 1; background: transparent; border: none; outline: none;
  color: #fff; font-size: 0.95rem;
}
.agp-search input::placeholder { color: #9b8cc9; }
.agp-search-clear {
  background: rgba(255,255,255,0.1); border: none; border-radius: 50%;
  width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
  color: #fff; cursor: pointer;
}
.agp-search-submit {
  padding: 6px 14px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38; font-weight: 800; cursor: pointer;
  font-size: 0.88rem;
}
.agp-search-submit:hover { filter: brightness(1.06); }

.agp-hero-actions {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-bottom: 16px;
}
.agp-nearby-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 999px;
  border: 1px solid rgba(167,139,250,0.55);
  background: rgba(167,139,250,0.12);
  color: #e9d5ff; font-weight: 700; font-size: 0.88rem;
  cursor: pointer;
}
.agp-nearby-btn:hover { background: rgba(167,139,250,0.22); }
.agp-nearby-btn:disabled { opacity: 0.7; cursor: wait; }
.agp-nearby-on {
  background: linear-gradient(135deg, rgba(167,139,250,0.9) 0%, rgba(251,191,36,0.9) 100%);
  color: #200f3d; border-color: transparent;
}
.agp-radius { display: inline-flex; gap: 6px; }
.agp-hint { font-size: 0.82rem; }
.agp-hint-warn { color: #fca5a5; }

.agp-tabs {
  display: inline-flex; gap: 6px; margin-top: 4px;
  padding: 4px; border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
}
.agp-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 10px;
  border: none; background: transparent; cursor: pointer;
  color: #c8bce8; font-weight: 700; font-size: 0.9rem;
}
.agp-tab:hover { color: #fff; }
.agp-tab-on {
  background: linear-gradient(135deg, rgba(167,139,250,0.28) 0%, rgba(251,191,36,0.22) 100%);
  color: #fff; box-shadow: inset 0 0 0 1px rgba(167,139,250,0.55);
}

.agp-chips {
  max-width: 980px; margin: 0 auto; padding: 8px 16px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.agp-chips-row {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
}
.agp-chips-label {
  font-size: 0.75rem; font-weight: 800; color: #bda6ff;
  letter-spacing: 0.04em;
  margin-right: 4px;
}
.agp-chip {
  padding: 6px 12px; border-radius: 999px;
  border: 1px solid rgba(167,139,250,0.3);
  background: rgba(255,255,255,0.04);
  color: #d8cdef; font-size: 0.82rem; font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.agp-chip:hover { border-color: rgba(167,139,250,0.65); color: #fff; background: rgba(167,139,250,0.12); }
.agp-chip-on {
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38; border-color: transparent;
  font-weight: 800;
}

.agp-main {
  max-width: 1200px; margin: 0 auto; padding: 12px 16px 40px;
}
.agp-meta {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  margin-bottom: 14px; color: #bda6ff; font-size: 0.85rem;
}
.agp-meta-count { font-weight: 700; }
.agp-meta-err { color: #fca5a5; }

.agp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}
.agp-card {
  background: rgba(20,16,32,0.92);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; overflow: hidden;
  display: flex; flex-direction: column;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;
  outline: none;
}
.agp-card:focus-visible {
  border-color: #c4b5fd;
  box-shadow: 0 0 0 3px rgba(167,139,250,0.4);
}
.agp-card:hover {
  transform: translateY(-2px);
  border-color: rgba(167,139,250,0.55);
  box-shadow: 0 12px 26px rgba(0,0,0,0.4);
}
.agp-card-on {
  border-color: rgba(251,191,36,0.75);
  box-shadow: 0 0 0 1px rgba(251,191,36,0.5), 0 12px 26px rgba(251,191,36,0.25);
}
.agp-card-img {
  position: relative; width: 100%; padding-top: 60%;
  background: #0e0b18; overflow: hidden;
}
.agp-card-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.agp-card-img-fb {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.35);
  background: linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(251,191,36,0.1) 100%);
}
.agp-card-dist {
  position: absolute; top: 8px; left: 8px;
  background: rgba(167,139,250,0.92); color: #1a0a35;
  font-size: 0.72rem; font-weight: 800;
  padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(6px);
}
.agp-card-play {
  position: absolute; right: 10px; bottom: 10px;
  width: 42px; height: 42px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(10,5,26,0.72);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
  transition: transform 0.15s ease, background 0.15s ease;
}
.agp-card-play:hover { transform: scale(1.08); background: rgba(167,139,250,0.95); color: #0b0620; }
.agp-card-play-on { background: rgba(251,191,36,0.95); color: #2b1c00; border-color: rgba(251,191,36,0.9); }

.agp-card-body { padding: 11px 14px 14px; display: flex; flex-direction: column; gap: 4px; }
.agp-card-title {
  font-size: 0.98rem; font-weight: 800; line-height: 1.3;
  color: #fff; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.agp-card-atitle {
  font-size: 0.82rem; color: #d4c7f5;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}
.agp-card-cat { font-size: 0.75rem; color: #c4b5fd; font-weight: 700; }
.agp-card-row {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  margin-top: 4px;
}
.agp-card-meta {
  font-size: 0.75rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: center;
}
.agp-card-addr {
  max-width: 170px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}

.agp-empty {
  grid-column: 1 / -1;
  padding: 48px 20px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; color: #bda6ff; font-weight: 700;
  background: rgba(255,255,255,0.03);
  border: 1px dashed rgba(167,139,250,0.3);
  border-radius: 14px;
  text-align: center;
}
.agp-empty-sub { font-size: 0.85rem; color: #9b8cc9; font-weight: 500; }

.agp-sk {
  background: rgba(20,16,32,0.72);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px; overflow: hidden;
}
.agp-sk-img {
  position: relative; padding-top: 60%;
  background: linear-gradient(90deg, #1c1630 0%, #2a2340 50%, #1c1630 100%);
  background-size: 200% 100%;
  animation: agp-shine 1.4s linear infinite;
}
.agp-sk-body { padding: 11px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
.agp-sk-line {
  height: 10px; border-radius: 4px;
  background: linear-gradient(90deg, #1c1630 0%, #2a2340 50%, #1c1630 100%);
  background-size: 200% 100%;
  animation: agp-shine 1.4s linear infinite;
  width: 80%;
}
.agp-sk-lg { height: 14px; width: 90%; }
@keyframes agp-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.agp-player {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 10px 14px;
  background: rgba(10,6,22,0.94);
  border-top: 1px solid rgba(167,139,250,0.45);
  backdrop-filter: blur(14px);
  z-index: 40;
}
.agp-player-inner {
  max-width: 1200px; margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(160px, 1fr) 2fr auto;
  gap: 14px; align-items: center;
}
.agp-player-meta {
  display: flex; gap: 10px; align-items: center; min-width: 0;
}
.agp-player-thumb {
  width: 42px; height: 42px; object-fit: cover;
  border-radius: 8px; flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(167,139,250,0.5);
}
.agp-player-thumb-fallback {
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
}
.agp-player-texts { min-width: 0; }
.agp-player-title {
  font-size: 0.9rem; font-weight: 800; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.agp-player-sub {
  font-size: 0.75rem; color: #cdc0ee;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.agp-player-progress {
  display: flex; align-items: center; gap: 10px;
}
.agp-player-time { font-size: 0.7rem; color: #cdc0ee; min-width: 32px; }
.agp-player-bar {
  flex: 1; height: 6px; border-radius: 3px;
  background: rgba(255,255,255,0.1);
  overflow: hidden;
}
.agp-player-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa 0%, #f59e0b 100%);
  transition: width 0.25s linear;
}
.agp-player-ctrl { display: inline-flex; gap: 6px; align-items: center; }
.agp-player-btn {
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.06);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.agp-player-btn:hover { background: rgba(167,139,250,0.28); }
.agp-player-btn-lg {
  width: 42px; height: 42px;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38; border-color: transparent;
}
.agp-player-btn-lg:hover { filter: brightness(1.1); }
.agp-player-btn-close { background: rgba(239,68,68,0.16); border-color: rgba(239,68,68,0.45); }

@media (max-width: 720px) {
  .agp-hero { padding: 28px 14px 14px; }
  .agp-hero-title { font-size: 1.4rem; }
  .agp-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .agp-player-inner { grid-template-columns: 1fr; gap: 8px; }
  .agp-player-ctrl { justify-content: center; }
}
`;
