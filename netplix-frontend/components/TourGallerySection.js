"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "@/src/axiosConfig";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { X, ChevronLeft, ChevronRight, Headphones, Play, Pause, Camera } from "lucide-react";
import useBackButtonClose from "@/lib/useBackButtonClose";
import { attachAudioMediaSession } from "@/lib/audioMediaSession";
import {
  getAudioGuideOdiiLang,
  defaultOdiiLangFromUiLang,
  subscribeAudioGuideOdiiLang,
} from "@/lib/audioGuideOdiiLang";
import {
  filterPlayableAudioGuides,
  sortAudioGuidesStable,
  pickBestOdiiForGalleryPhoto,
  buildOdiiSearchFallbackQueries,
  mergeAudioGuideItemsById,
} from "@/lib/photoGalleryRegionalAudio";

/**
 * 관광사진갤러리 섹션 (공용 컴포넌트).
 *
 * <p>백엔드: GET /api/v1/tour-gallery?q=<keyword>&limit=<n>
 *  - limit ≤ 0 이면 키워드/전체 캐시에서 잘라 내지 않고 가능한 만큼 전부 반환(서비스·어댑터 상한 내).
 *  - 키워드 첫 요청 시 백엔드가 1페이지만 즉시 돌리고 나머지는 백그라운드 적재할 수 있어,
 *    이 컴포넌트는 성공 직후 몇 차례 재조회해 건수가 늘면 목록을 합친다.
 *  - /cine-trip 지역 상세: keyword = 지역명
 *  - DVD 매장 상세: keyword = 시·도명
 *  - 영화 상세 등: keyword = 촬영지/지역명
 *
 * <p>선택: soundLayerEnabled + 검색 키워드가 있으면 Odii(/api/v1/audio-guide/search) 후보 중
 * 지역 문자열 해시로 시작점을 정하고, 사진 카드 인덱스만큼 순환해 트랙을 고른다.
 *
 * <p>정책:
 *  - 응답이 빈 배열이면 섹션 자체를 렌더링하지 않아 UX 공백을 없앰
 *  - 라이트박스: ESC 닫기 / ← → 이동 / 카드 클릭 열기
 *  - 반응형 그리드: 2(모바일) / 3(태블릿) / 4(데스크톱) 열
 *  - layout="rail": 한 줄 가로 스크롤(스와이프) — pet-travel 등 긴 페이지에서 세로 길이 절약
 *  - 스타일은 self-contained (외부 CSS 파일 오염 최소화)
 */
export default function TourGallerySection({
  keyword,
  title,
  subtitle,
  limit = 0,
  apiBase = "/api/v1/tour-gallery",
  accent = "#e50914", // netplix 레드 포인트
  /** "grid" | "rail" — rail 은 가로 스와이프 한 줄 레일 */
  layout = "grid",
  // keyword 가 비어 있어도 API 를 호출해 전체 갤러리 최신순을 노출.
  // 기본 false: 기존 접목 지점(영화·지역·매장)에서는 keyword 가 비면 섹션 자체를 숨김.
  allowEmpty = false,
  // 무한 스크롤 모드. 초기 pageSize 만 그리고, pageSize 씩 증가.
  // 그리드: 문서 세로 스크롤로 하단 센티넬이 보일 때. rail: 가로 레일 끝 스크롤에 반응.
  // 6,000장 규모 데이터에서 DOM 부담을 줄이기 위해 /photo-gallery 에서 켜 사용.
  infinite = false,
  pageSize = 60,
  /** 사진 클릭 시 관광공사 오디오 가이드(Odii)와 연동 */
  soundLayerEnabled = false,
  /** Odii 검색어. 미입력 시 keyword 와 동일하게 사용 */
  soundSearchKeyword,
}) {
  const { t, i18n } = useTranslation();
  const isRail = layout === "rail";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef(null);
  /** layout="rail" + infinite 일 때 가로 스크롤 컨테이너 (끝 도달 시 더 그리기) */
  const railRef = useRef(null);

  const [odiiLangRev, setOdiiLangRev] = useState(0);
  useEffect(() => subscribeAudioGuideOdiiLang(() => setOdiiLangRev((n) => n + 1)), []);

  const lang = getAudioGuideOdiiLang(defaultOdiiLangFromUiLang(i18n?.language));
  const effectiveSoundKeyword = useMemo(() => {
    const raw =
      soundSearchKeyword !== undefined && soundSearchKeyword !== null
        ? soundSearchKeyword
        : keyword;
    return String(raw || "").trim();
  }, [soundSearchKeyword, keyword]);

  const [audioItems, setAudioItems] = useState([]);
  const [audioLoading, setAudioLoading] = useState(false);
  const galleryAudioRef = useRef(null);
  const galleryMediaSessionDetachRef = useRef(null);
  const [playingCue, setPlayingCue] = useState(null);
  /** 오디오 play/pause 시 라이트박스 컨트롤 리렌더 */
  const [galleryAudioUiRev, setGalleryAudioUiRev] = useState(0);

  const stopGalleryAudio = useCallback(() => {
    if (galleryMediaSessionDetachRef.current) {
      try {
        galleryMediaSessionDetachRef.current();
      } catch {
        /* noop */
      }
      galleryMediaSessionDetachRef.current = null;
    }
    if (galleryAudioRef.current) {
      try {
        galleryAudioRef.current.pause();
      } catch {
        /* noop */
      }
      try {
        galleryAudioRef.current.src = "";
      } catch {
        /* noop */
      }
      galleryAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!soundLayerEnabled || !effectiveSoundKeyword) {
        setAudioItems([]);
        setAudioLoading(false);
        return;
      }
      try {
        setAudioLoading(true);
        const queries = buildOdiiSearchFallbackQueries(effectiveSoundKeyword);
        let merged = [];

        const fetchType = async (type) => {
          for (const q of queries) {
            if (cancelled) return;
            try {
              const res = await axios.get("/api/v1/audio-guide/search", {
                params: {
                  type,
                  lang,
                  q,
                  limit: 48,
                },
              });
              const data = Array.isArray(res?.data?.data) ? res.data.data : [];
              merged = mergeAudioGuideItemsById(merged, data);
              if (filterPlayableAudioGuides(merged).length > 0) return;
            } catch {
              /* 다음 쿼리 시도 */
            }
          }
        };

        await fetchType("theme");
        if (cancelled) return;
        if (!filterPlayableAudioGuides(merged).length) {
          await fetchType("story");
        }
        if (!cancelled) setAudioItems(merged);
      } catch {
        if (!cancelled) setAudioItems([]);
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [soundLayerEnabled, effectiveSoundKeyword, lang, odiiLangRev]);

  useEffect(() => () => stopGalleryAudio(), [stopGalleryAudio]);

  useEffect(() => {
    if (!soundLayerEnabled) {
      stopGalleryAudio();
      setPlayingCue(null);
      return;
    }
    if (selectedIndex === null) {
      stopGalleryAudio();
      setPlayingCue(null);
      return;
    }
    if (!effectiveSoundKeyword) {
      stopGalleryAudio();
      setPlayingCue({ kind: "noRegion" });
      return;
    }
    if (audioLoading) {
      stopGalleryAudio();
      setPlayingCue(null);
      return;
    }
    const playable = sortAudioGuidesStable(filterPlayableAudioGuides(audioItems));
    stopGalleryAudio();

    if (!playable.length) {
      setPlayingCue({
        kind: "empty",
        regionKey: effectiveSoundKeyword,
      });
      return;
    }

    const galleryItem =
      selectedIndex != null && items[selectedIndex]
        ? items[selectedIndex]
        : null;
    const track = pickBestOdiiForGalleryPhoto(
      galleryItem,
      playable,
      effectiveSoundKeyword,
      selectedIndex
    );

    setPlayingCue({
      kind: "playing",
      regionKey: effectiveSoundKeyword,
      track,
    });

    try {
      const audio = new Audio(track.audioUrl);
      audio.preload = "auto";

      const bumpUi = () => setGalleryAudioUiRev((n) => n + 1);
      audio.addEventListener("play", bumpUi);
      audio.addEventListener("pause", bumpUi);

      audio.addEventListener("ended", () => {
        if (galleryAudioRef.current === audio) {
          bumpUi();
          if (galleryMediaSessionDetachRef.current) {
            try {
              galleryMediaSessionDetachRef.current();
            } catch {
              /* noop */
            }
            galleryMediaSessionDetachRef.current = null;
          }
          galleryAudioRef.current = null;
          setPlayingCue((prev) =>
            prev?.kind === "playing"
              ? { ...prev, playbackEnded: true }
              : prev
          );
        }
      });
      audio.addEventListener("error", () => {
        if (galleryAudioRef.current === audio) {
          bumpUi();
          if (galleryMediaSessionDetachRef.current) {
            try {
              galleryMediaSessionDetachRef.current();
            } catch {
              /* noop */
            }
            galleryMediaSessionDetachRef.current = null;
          }
          galleryAudioRef.current = null;
          setPlayingCue({
            kind: "error",
            regionKey: effectiveSoundKeyword,
          });
        }
      });
      galleryAudioRef.current = audio;
      galleryMediaSessionDetachRef.current = attachAudioMediaSession(audio, {
        title: track.audioTitle || track.title,
        artworkUrl: track.imageUrl,
      });
      audio.play().catch(() => {
        if (galleryAudioRef.current === audio) {
          bumpUi();
          if (galleryMediaSessionDetachRef.current) {
            try {
              galleryMediaSessionDetachRef.current();
            } catch {
              /* noop */
            }
            galleryMediaSessionDetachRef.current = null;
          }
          galleryAudioRef.current = null;
          setPlayingCue({
            kind: "error",
            regionKey: effectiveSoundKeyword,
          });
        }
      });
    } catch {
      setPlayingCue({
        kind: "error",
        regionKey: effectiveSoundKeyword,
      });
    }
  }, [
    soundLayerEnabled,
    selectedIndex,
    effectiveSoundKeyword,
    audioLoading,
    audioItems,
    items,
    stopGalleryAudio,
  ]);

  const toggleGalleryPlayback = useCallback(() => {
    const a = galleryAudioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);
  useEffect(() => {
    let cancelled = false;
    const healTimers = [];

    async function run() {
      const hasKeyword = !!(keyword && keyword.trim());
      if (!hasKeyword && !allowEmpty) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrored(false);
        const params = hasKeyword ? { q: keyword, limit } : { limit };
        const res = await axios.get(apiBase, { params });
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data ?? [];
        const arr = Array.isArray(data) ? data : [];
        setItems(arr);
        setVisibleCount(infinite ? Math.min(pageSize, arr.length) : arr.length);

        // VisitKoreaGalleryHttpClient: 키워드 캐시 미스 시 1페이지만 동기 반환 후 백그라운드로 전체 적재.
        // limit=0 이라도 첫 응답 건수가 적을 수 있어, 잠시 후 재조회해 늘어난 캐시를 반영한다.
        if (hasKeyword && !cancelled) {
          const healParams = { q: keyword.trim(), limit };
          for (const delayMs of [2500, 8000, 16000]) {
            healTimers.push(
              setTimeout(async () => {
                if (cancelled) return;
                try {
                  const res2 = await axios.get(apiBase, { params: healParams });
                  if (cancelled) return;
                  const d2 = res2?.data?.data ?? res2?.data ?? [];
                  const arr2 = Array.isArray(d2) ? d2 : [];
                  if (arr2.length === 0) return;
                  setItems((prev) => (arr2.length > prev.length ? arr2 : prev));
                  setVisibleCount((vc) => Math.min(vc, arr2.length));
                } catch {
                  /* noop */
                }
              }, delayMs)
            );
          }
        }
      } catch (e) {
        if (!cancelled) {
          setErrored(true);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
      for (const t of healTimers) clearTimeout(t);
    };
  }, [keyword, limit, apiBase, allowEmpty, infinite, pageSize]);

  // 무한 스크롤(그리드): 하단 센티넬이 문서 뷰포트에 들어오면 visibleCount 증가.
  useEffect(() => {
    if (!infinite || isRail) return undefined;
    if (typeof window === "undefined") return undefined;
    if (!sentinelRef.current) return undefined;
    if (visibleCount >= items.length) return undefined;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisibleCount((c) => Math.min(c + pageSize, items.length));
          }
        }
      },
      { rootMargin: "600px 0px 600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [infinite, isRail, pageSize, items.length, visibleCount]);

  // 무한 스크롤(rail): 가로로 끝까지 밀면 남은 카드 chunk 로드 (세로 스크롤 없이도 동작).
  useEffect(() => {
    if (!infinite || !isRail || loading) return undefined;
    const el = railRef.current;
    if (!el) return undefined;
    const thresholdPx = 72;
    let raf = 0;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        setVisibleCount((c) => {
          if (c >= items.length) return c;
          if (
            el.scrollLeft + el.clientWidth >=
            el.scrollWidth - thresholdPx
          ) {
            return Math.min(c + pageSize, items.length);
          }
          return c;
        });
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [infinite, isRail, loading, pageSize, items.length]);

  const handleClose = useCallback(() => setSelectedIndex(null), []);

  // 라이트박스가 열린 상태에서 브라우저/모바일 "뒤로 가기" 가
  // 페이지 이동이 아니라 라이트박스 닫기로 동작하도록 history 항목을 관리.
  useBackButtonClose(selectedIndex !== null, handleClose);

  const handlePrev = useCallback(
    () => setSelectedIndex((p) => (p > 0 ? p - 1 : p)),
    []
  );
  const handleNext = useCallback(
    () =>
      setSelectedIndex((p) =>
        p !== null && p < items.length - 1 ? p + 1 : p
      ),
    [items.length]
  );

  useEffect(() => {
    if (selectedIndex === null) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [selectedIndex, handleClose, handlePrev, handleNext]);

  const totalLabel = useMemo(() => {
    if (loading) return null;
    return t("tourGallery.totalCount", { count: items.length });
  }, [items.length, loading, t]);

  // 데이터가 없고 로딩/에러도 끝났다면 섹션 전체 숨김
  if (!loading && !errored && items.length === 0) return null;
  // keyword 가 없는 경우: allowEmpty 모드가 아니면 숨김 (기존 접목 지점 호환 유지)
  if ((!keyword || !keyword.trim()) && !allowEmpty) return null;

  return (
    <section className="tg-section" aria-label={title || t("tourGallery.defaultTitle")}>
      <style>{cssBlock}</style>
      <div className="tg-header">
        <h2 className="tg-title">
          {title || t("tourGallery.defaultTitle")}
          {totalLabel && (
            <span className="tg-total" style={{ color: accent }}>
              ({totalLabel})
            </span>
          )}
        </h2>
        {subtitle && <p className="tg-sub">{subtitle}</p>}
        {soundLayerEnabled && effectiveSoundKeyword && (
          <p className="tg-sound-hint">
            <Headphones size={14} aria-hidden className="tg-sound-hint-ic" />
            <span>{t("photoGalleryPage.gallerySoundHint")}</span>
          </p>
        )}
      </div>

      <div
        ref={isRail ? railRef : undefined}
        className={
          isRail ? "tg-grid tg-grid--rail js-drag-scroll" : "tg-grid"
        }
      >
        {loading
          ? Array.from({ length: isRail ? 6 : 8 }).map((_, i) => (
              <div key={`sk-${i}`} className="tg-card tg-skeleton">
                <div className="tg-img tg-sk-img" />
                <div className="tg-body">
                  <div className="tg-sk-line tg-sk-line-lg" />
                  <div className="tg-sk-line" />
                  <div className="tg-sk-line tg-sk-line-sm" />
                </div>
              </div>
            ))
          : items.slice(0, visibleCount).map((item, index) => (
              <button
                type="button"
                key={`${item.galContentId || index}`}
                className="tg-card"
                onClick={() => setSelectedIndex(index)}
                aria-label={`${item.title || ""} ${item.photoLocation || ""}`.trim()}
              >
                <div className="tg-img">
                  {(item.thumbnailUrl || item.imageUrl) && (
                    <img
                      src={galleryImageSrc(item)}
                      alt={item.title || ""}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="tg-body">
                  <div className="tg-ctitle" title={item.title || ""}>
                    {item.title || t("tourGallery.untitled")}
                  </div>
                  {item.photoLocation && (
                    <div className="tg-meta">📍 {item.photoLocation}</div>
                  )}
                  {(item.photoMonth || item.photographer) && (
                    <div className="tg-meta tg-meta-sub">
                      {item.photoMonth ? `📅 ${formatMonth(item.photoMonth)} ` : ""}
                      {item.photographer ? `· 📷 ${item.photographer}` : ""}
                    </div>
                  )}
                </div>
              </button>
            ))}
      </div>

      {infinite && !loading && visibleCount < items.length && !isRail && (
        <div className="tg-more">
          <div ref={sentinelRef} aria-hidden className="tg-sentinel" />
          <button
            type="button"
            className="tg-more-btn"
            onClick={() =>
              setVisibleCount((c) => Math.min(c + pageSize, items.length))
            }
          >
            {t("tourGallery.loadMore", {
              shown: visibleCount,
              total: items.length,
            })}
          </button>
        </div>
      )}
      {infinite && !loading && visibleCount < items.length && isRail && (
        <div className="tg-more tg-more--railHint">
          <button
            type="button"
            className="tg-more-btn"
            onClick={() =>
              setVisibleCount((c) => Math.min(c + pageSize, items.length))
            }
          >
            {t("tourGallery.loadMore", {
              shown: visibleCount,
              total: items.length,
            })}
          </button>
        </div>
      )}

      {selectedIndex !== null && items[selectedIndex] && (
        <GalleryLightboxPortal>
          <Lightbox
            item={items[selectedIndex]}
            hasPrev={selectedIndex > 0}
            hasNext={selectedIndex < items.length - 1}
            onClose={handleClose}
            onPrev={handlePrev}
            onNext={handleNext}
            soundLayerEnabled={soundLayerEnabled}
            playingCue={playingCue}
            effectiveSoundKeyword={effectiveSoundKeyword}
            galleryAudioRef={galleryAudioRef}
            galleryAudioUiRev={galleryAudioUiRev}
            onToggleGalleryAudio={toggleGalleryPlayback}
          />
        </GalleryLightboxPortal>
      )}
    </section>
  );
}

function GalleryLightboxPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function galleryImageSrc(item) {
  return normalizeGalleryImageUrl(item?.imageUrl || item?.thumbnailUrl || "");
}

/** KTO 갤러리 이미지는 http 로 내려오는 경우가 많아 HTTPS 페이지에서 mixed-content 로 막힐 수 있음 */
function normalizeGalleryImageUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw;
}

function Lightbox({
  item,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  soundLayerEnabled,
  playingCue,
  effectiveSoundKeyword,
  galleryAudioRef,
  galleryAudioUiRev,
  onToggleGalleryAudio,
}) {
  const { t } = useTranslation();
  const [imageBroken, setImageBroken] = useState(false);
  const [imageSrc, setImageSrc] = useState(() => galleryImageSrc(item));

  useEffect(() => {
    setImageBroken(false);
    setImageSrc(galleryImageSrc(item));
  }, [item?.galContentId, item?.imageUrl, item?.thumbnailUrl]);

  const handleImageError = useCallback(() => {
    const raw = String(item?.imageUrl || item?.thumbnailUrl || "").trim();
    const https = normalizeGalleryImageUrl(raw);
    if (imageSrc === https && raw.startsWith("http://") && https !== raw) {
      setImageSrc(raw);
      return;
    }
    setImageBroken(true);
  }, [imageSrc, item?.imageUrl, item?.thumbnailUrl]);

  const audioGuideHref =
    effectiveSoundKeyword && effectiveSoundKeyword.trim()
      ? `/audio-guide?q=${encodeURIComponent(effectiveSoundKeyword.trim())}`
      : "/audio-guide";

  const cueBlock =
    soundLayerEnabled && playingCue ? (
      <div className="tg-lb-audio" data-audio-ui={galleryAudioUiRev}>
        {playingCue.kind === "playing" && playingCue.track && effectiveSoundKeyword && (
          <>
            <div className="tg-lb-audio-badge">
              <Headphones size={14} aria-hidden />
              <span>{t("photoGalleryPage.audioCueHead")}</span>
            </div>
            <div className="tg-lb-audio-primary">
              {t("photoGalleryPage.audioCuePrimary", {
                title:
                  playingCue.track.title ||
                  playingCue.track.audioTitle ||
                  "",
              })}
            </div>
            {playingCue.playbackEnded ? (
              <div className="tg-lb-audio-secondary tg-lb-audio-ended">
                {t("photoGalleryPage.audioEnded")}
              </div>
            ) : (
              <>
                <div className="tg-lb-audio-secondary">
                  {galleryAudioRef.current?.paused
                    ? t("photoGalleryPage.audioPausedLabel", {
                        audioTitle:
                          playingCue.track.audioTitle ||
                          playingCue.track.title ||
                          "",
                      })
                    : t("photoGalleryPage.audioCueSecondary", {
                        audioTitle:
                          playingCue.track.audioTitle ||
                          playingCue.track.title ||
                          "",
                      })}
                </div>
                {galleryAudioRef.current ? (
                  <div className="tg-lb-audio-controls">
                    <button
                      type="button"
                      className="tg-lb-audio-playbtn"
                      onClick={onToggleGalleryAudio}
                      aria-pressed={!galleryAudioRef.current.paused}
                      aria-label={
                        galleryAudioRef.current.paused
                          ? t("photoGalleryPage.resumeAudio")
                          : t("photoGalleryPage.pauseAudio")
                      }
                    >
                      {galleryAudioRef.current.paused ? (
                        <Play size={18} aria-hidden />
                      ) : (
                        <Pause size={18} aria-hidden />
                      )}
                      <span>
                        {galleryAudioRef.current.paused
                          ? t("photoGalleryPage.resumeAudio")
                          : t("photoGalleryPage.pauseAudio")}
                      </span>
                    </button>
                  </div>
                ) : null}
              </>
            )}
            <p className="tg-lb-audio-disclaimer">
              {t("photoGalleryPage.audioRegionalDisclaimer")}
            </p>
            <Link href={audioGuideHref} className="tg-lb-audio-link">
              {t("photoGalleryPage.openAudioGuide")}
            </Link>
          </>
        )}
        {playingCue.kind === "noRegion" && (
          <div className="tg-lb-audio-muted">{t("photoGalleryPage.audioCueNeedRegion")}</div>
        )}
        {playingCue.kind === "empty" && (
          <div className="tg-lb-audio-muted">{t("photoGalleryPage.audioCueEmpty")}</div>
        )}
        {playingCue.kind === "error" && (
          <div className="tg-lb-audio-muted">{t("photoGalleryPage.audioCueError")}</div>
        )}
      </div>
    ) : null;

  return (
    <div
      className="tg-lb-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || t("tourGallery.lightboxLabel")}
      onClick={onClose}
    >
      <div className="tg-lb-inner" onClick={(e) => e.stopPropagation()}>
        {imageBroken || !imageSrc ? (
          <div className="tg-lb-fallback" role="img" aria-label={item.title || ""}>
            <Camera size={42} strokeWidth={1.5} aria-hidden />
            <p>{t("tourGallery.imageUnavailable")}</p>
          </div>
        ) : (
          <img
            src={imageSrc}
            alt={item.title || ""}
            className="tg-lb-img"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        )}
        <div className="tg-lb-caption">
          <div className="tg-lb-title">{item.title}</div>
          <div className="tg-lb-meta">
            {item.photoLocation ? `📍 ${item.photoLocation}` : ""}
            {item.photoMonth ? ` · 📅 ${formatMonth(item.photoMonth)}` : ""}
            {item.photographer ? ` · 📷 ${item.photographer}` : ""}
          </div>
          {cueBlock}
        </div>
        <button
          className="tg-lb-btn tg-lb-close"
          onClick={onClose}
          aria-label={t("tourGallery.close")}
        >
          <X size={22} />
        </button>
        {hasPrev && (
          <button
            className="tg-lb-btn tg-lb-prev"
            onClick={onPrev}
            aria-label={t("tourGallery.prev")}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {hasNext && (
          <button
            className="tg-lb-btn tg-lb-next"
            onClick={onNext}
            aria-label={t("tourGallery.next")}
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>
    </div>
  );
}

// yyyyMM → "2024.06" 형태. 원본이 형식이 다르면 그대로 반환.
function formatMonth(ym) {
  if (!ym) return "";
  if (/^\d{6}$/.test(ym)) return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`;
  return ym;
}

const cssBlock = `
.tg-section {
  width: 100%;
  margin: 24px 0 8px;
}
.tg-header {
  padding: 0 4px 12px;
}
.tg-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: inherit;
}
.tg-total {
  font-size: 0.9rem;
  font-weight: 700;
}
.tg-sub {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #9aa0a6;
}
.tg-sound-hint {
  margin: 10px 4px 0;
  font-size: 0.82rem;
  color: #67e8f9;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 760px;
  line-height: 1.45;
}
.tg-sound-hint-ic {
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0.9;
}
.tg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 640px) {
  .tg-grid:not(.tg-grid--rail) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .tg-grid:not(.tg-grid--rail) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
/* 가로 스와이프 레일 (pet-travel 등) — 가로 제스처는 이 박스 안에서만 소비 */
.tg-grid.tg-grid--rail {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: visible;
  gap: 12px;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pinch-zoom;
  overscroll-behavior-x: contain;
  align-items: stretch;
  grid-template-columns: unset;
  padding-bottom: 4px;
}
.tg-grid.tg-grid--rail .tg-card,
.tg-grid.tg-grid--rail .tg-skeleton {
  flex: 0 0 auto;
  width: min(46vw, 200px);
  max-width: 220px;
  scroll-snap-align: start;
}
.tg-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  color: #f1f1f1;
  padding: 0;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}
.tg-card:hover {
  transform: translateY(-2px) scale(1.01);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
}
.tg-card:focus-visible {
  outline: 2px solid #e50914;
  outline-offset: 2px;
}
.tg-img {
  position: relative;
  width: 100%;
  padding-top: 66.67%;
  background: #0e0e0e;
  overflow: hidden;
}
.tg-img img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tg-body {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.tg-ctitle {
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  color: #f5f5f5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.tg-meta {
  font-size: 0.78rem;
  color: #bdbdbd;
}
.tg-meta-sub {
  color: #9a9a9a;
}

.tg-skeleton { cursor: default; }
.tg-sk-img, .tg-sk-line {
  background: linear-gradient(90deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%);
  background-size: 200% 100%;
  animation: tg-shine 1.4s linear infinite;
  border-radius: 6px;
}
.tg-sk-img {
  position: absolute;
  inset: 0;
}
.tg-sk-line {
  height: 10px;
  margin-top: 6px;
  width: 70%;
}
.tg-sk-line-lg { height: 14px; width: 85%; }
.tg-sk-line-sm { width: 45%; }
@keyframes tg-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.tg-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 18px 0 4px;
}
.tg-more--railHint {
  margin: 10px 0 2px;
  gap: 8px;
}
.tg-sentinel { width: 1px; height: 1px; }
.tg-more-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #f1f1f1;
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.tg-more-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(255, 255, 255, 0.28);
}

.tg-lb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.tg-lb-inner {
  position: relative;
  max-width: 92vw;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.tg-lb-img {
  max-width: 92vw;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}
.tg-lb-fallback {
  width: min(92vw, 720px);
  min-height: 240px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
  border-radius: 12px;
  background: rgba(30, 30, 30, 0.92);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #e5e7eb;
  text-align: center;
}
.tg-lb-fallback p {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #d1d5db;
}
.tg-lb-caption {
  margin-top: 10px;
  text-align: center;
  color: #e6e6e6;
  max-width: 92vw;
}
.tg-lb-title {
  font-size: 1rem;
  font-weight: 700;
}
.tg-lb-meta {
  margin-top: 2px;
  font-size: 0.85rem;
  color: #bdbdbd;
}
.tg-lb-audio {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(34, 211, 238, 0.07);
  border: 1px solid rgba(34, 211, 238, 0.25);
  text-align: left;
}
.tg-lb-audio-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #a5f3fc;
  margin-bottom: 8px;
}
.tg-lb-audio-primary {
  font-size: 0.95rem;
  font-weight: 700;
  color: #f0fdff;
  line-height: 1.35;
}
.tg-lb-audio-secondary {
  margin-top: 6px;
  font-size: 0.82rem;
  color: #c5fcf9;
  line-height: 1.45;
}
.tg-lb-audio-ended {
  color: #fde68a;
}
.tg-lb-audio-controls {
  margin-top: 12px;
}
.tg-lb-audio-playbtn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgba(253, 224, 71, 0.45);
  background: rgba(253, 224, 71, 0.12);
  color: #fef9c3;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.tg-lb-audio-playbtn:hover {
  background: rgba(253, 224, 71, 0.22);
  border-color: rgba(253, 224, 71, 0.65);
}
.tg-lb-audio-disclaimer {
  margin: 12px 0 0;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #a8a29e;
}
.tg-lb-audio-link {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #fde047;
  text-decoration: underline;
}
.tg-lb-audio-link:hover {
  color: #fef08a;
}
.tg-lb-audio-muted {
  font-size: 0.84rem;
  color: #d6d3d1;
  line-height: 1.45;
}
.tg-lb-btn {
  position: absolute;
  background: rgba(20, 20, 20, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}
.tg-lb-btn:hover {
  background: rgba(60, 60, 60, 0.95);
  transform: scale(1.05);
}
.tg-lb-close { top: -48px; right: 0; }
.tg-lb-prev  { left: -6px; top: 50%; transform: translateY(-50%); }
.tg-lb-next  { right: -6px; top: 50%; transform: translateY(-50%); }
@media (max-width: 640px) {
  .tg-lb-close { top: 4px; right: 4px; }
  .tg-lb-prev  { left: 4px; }
  .tg-lb-next  { right: 4px; }
}
`;
