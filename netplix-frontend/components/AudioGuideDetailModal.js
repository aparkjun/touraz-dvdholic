"use client";

/**
 * AudioGuideDetailModal — 관광지/이야기 오디오 가이드 상세 모달.
 *
 * <p>/audio-guide 페이지와 NearbyAudioGuideStrip 양쪽에서 공통 사용한다.
 *  - 카드 클릭 시 이 모달이 열려 큰 이미지 · 스크립트 전문 · 재생 컨트롤 제공
 *  - 좌표가 있으면 Google/Kakao Map 바로가기 제공
 *  - ESC 키 / 배경 클릭 / X 버튼으로 닫기
 *  - 모달이 닫힐 때 재생 자동 정지
 *
 * <p>Props:
 *  - item: AudioGuideItemResponse (모달에 표시할 대상)
 *  - onClose: 닫기 콜백 (필수)
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { attachAudioMediaSession } from "@/lib/audioMediaSession";
import {
  X,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  MapPin,
  Clock,
  Mic2,
  Globe2,
  ExternalLink,
  Tag,
  Radio,
  BookOpen,
  Square,
  Info,
  Loader2,
} from "lucide-react";

export default function AudioGuideDetailModal({ item, onClose }) {
  const { t, i18n } = useTranslation();
  const audioRef = useRef(null);
  const mediaSessionDetachRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  // --- TTS (Web Speech API) 상태 ---
  // Odii 공공 OpenAPI 는 audioUrl 을 외부 공개하지 않고 script(대본)만 내려주므로,
  // 오디오 파일이 없을 때 브라우저의 음성 합성(speechSynthesis)으로 스크립트를 읽어 준다.
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  // --- THEME 카드 → 연관 해설 이야기(STORY) 목록 상태 ---
  // Odii API 는 THEME 응답에 script 를 내려주지 않는다. 대신 STORY 가 tid 로 연결된다.
  // 이 모달이 THEME 아이템을 열면 연관 STORY 들을 불러와 각자 TTS 로 재생할 수 있게 한다.
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [activeStoryPaused, setActiveStoryPaused] = useState(false);

  // 리스트 응답은 lite(description 생략)로 내려오므로, STORY 상세에서만 필요한 script 를 지연 조회한다.
  const [loadedDesc, setLoadedDesc] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setTtsSupported(true);
    }
  }, []);

  // 새 item 이 열릴 때마다 오디오/TTS 리셋
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    setAudioError(false);
    setTtsPlaying(false);
    setTtsPaused(false);
    setActiveStoryId(null);
    setActiveStoryPaused(false);
    setLoadedDesc(null);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    }
    return () => {
      if (mediaSessionDetachRef.current) {
        try { mediaSessionDetachRef.current(); } catch (_) { /* noop */ }
        mediaSessionDetachRef.current = null;
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (_) { /* noop */ }
        audioRef.current = null;
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
      }
    };
  }, [item?.id]);

  // THEME 카드 → /api/v1/audio-guide/stories-by-theme 호출.
  // 언어 변경/다른 항목 열림 때마다 재조회. 서버는 캐시되어 있으므로 여러 번 불러도 저렴.
  useEffect(() => {
    if (!item || item.type !== "THEME" || !item.id) {
      setStories([]);
      return undefined;
    }
    let cancelled = false;
    setStoriesLoading(true);
    const effectiveLang = (i18n?.language || "ko").toLowerCase().startsWith("en") ? "en" : "ko";
    axios
      .get("/api/v1/audio-guide/stories-by-theme", {
        params: { themeId: item.id, lang: effectiveLang, limit: 30 },
      })
      .then((res) => {
        if (cancelled) return;
        const arr = res?.data?.data || res?.data || [];
        setStories(Array.isArray(arr) ? arr : []);
      })
      .catch(() => { if (!cancelled) setStories([]); })
      .finally(() => { if (!cancelled) setStoriesLoading(false); });
    return () => { cancelled = true; };
  }, [item?.id, item?.type, i18n?.language]);

  // STORY 카드 상세 조회: 리스트는 lite 로 내려오므로 description 이 없으면 여기서 보강.
  // THEME 카드는 원본 응답에도 script 가 없어 조회해도 받을 값이 없으므로 생략.
  useEffect(() => {
    if (!item || item.type !== "STORY" || !item.id) return undefined;
    if (item.description && String(item.description).trim()) return undefined;
    let cancelled = false;
    const effectiveLang = (i18n?.language || "ko").toLowerCase().startsWith("en") ? "en" : "ko";
    axios
      .get("/api/v1/audio-guide/detail", {
        params: { type: "story", lang: effectiveLang, id: item.id },
      })
      .then((res) => {
        if (cancelled) return;
        const d = res?.data?.data?.description;
        if (d) setLoadedDesc(String(d));
      })
      .catch(() => { /* noop */ });
    return () => { cancelled = true; };
  }, [item?.id, item?.type, item?.description, i18n?.language]);

  // ESC 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [item, onClose]);

  if (!item) return null;

  const hasAudio = !!item.audioUrl;
  // description 은 리스트 lite 응답에서 빠져 있을 수 있으므로 loadedDesc 로 보강.
  const effectiveDescription = (item.description && String(item.description).trim())
    ? String(item.description)
    : (loadedDesc && String(loadedDesc).trim()) ? String(loadedDesc) : "";
  const hasScript = !!effectiveDescription;
  const hasCoords = typeof item.latitude === "number" && typeof item.longitude === "number";

  // TTS 에 사용할 텍스트: 스크립트 우선, 없으면 제목 + 카테고리.
  const ttsText = hasScript
    ? effectiveDescription
    : [item.title, item.audioTitle, item.themeCategory].filter(Boolean).join(". ");
  const ttsLang = (() => {
    const raw = (item.language || i18n?.language || "ko").toLowerCase();
    return raw.startsWith("en") ? "en-US" : "ko-KR";
  })();

  const startTts = () => {
    if (!ttsSupported || !ttsText) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(ttsText);
      utter.lang = ttsLang;
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => { setTtsPlaying(false); setTtsPaused(false); };
      utter.onerror = () => { setTtsPlaying(false); setTtsPaused(false); };
      window.speechSynthesis.speak(utter);
      setTtsPlaying(true);
      setTtsPaused(false);
    } catch (_) { /* noop */ }
  };
  const pauseTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.pause(); setTtsPaused(true); } catch (_) { /* noop */ }
  };
  const resumeTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.resume(); setTtsPaused(false); } catch (_) { /* noop */ }
  };
  const stopTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    setTtsPlaying(false);
    setTtsPaused(false);
  };

  // --- 스토리 행별 TTS 핸들러 ---
  const playStoryTts = (story) => {
    if (!ttsSupported) return;
    const text = (story?.description && String(story.description).trim())
      ? String(story.description)
      : [story?.audioTitle, story?.title, story?.themeCategory].filter(Boolean).join(". ");
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const raw = (story?.language || i18n?.language || "ko").toLowerCase();
      utter.lang = raw.startsWith("en") ? "en-US" : "ko-KR";
      utter.rate = 1;
      utter.pitch = 1;
      utter.onend = () => { setActiveStoryId(null); setActiveStoryPaused(false); };
      utter.onerror = () => { setActiveStoryId(null); setActiveStoryPaused(false); };
      window.speechSynthesis.speak(utter);
      setActiveStoryId(story.id);
      setActiveStoryPaused(false);
    } catch (_) { /* noop */ }
  };
  const pauseStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.pause(); setActiveStoryPaused(true); } catch (_) { /* noop */ }
  };
  const resumeStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.resume(); setActiveStoryPaused(false); } catch (_) { /* noop */ }
  };
  const stopStoryTts = () => {
    if (!ttsSupported) return;
    try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
    setActiveStoryId(null);
    setActiveStoryPaused(false);
  };

  const togglePlay = () => {
    if (!hasAudio) return;
    if (!audioRef.current) {
      if (mediaSessionDetachRef.current) {
        try {
          mediaSessionDetachRef.current();
        } catch (_) {
          /* noop */
        }
        mediaSessionDetachRef.current = null;
      }
      const audio = new Audio(item.audioUrl);
      audio.muted = muted;
      audio.addEventListener("ended", () => {
        setPlaying(false);
        setProgress(audio.duration || 0);
      });
      audio.addEventListener("error", () => {
        setAudioError(true);
        setPlaying(false);
      });
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration || 0);
      });
      audio.addEventListener("timeupdate", () => {
        setProgress(audio.currentTime || 0);
      });
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audioRef.current = audio;
      mediaSessionDetachRef.current = attachAudioMediaSession(audio, {
        title: item.audioTitle || item.title,
        artworkUrl: item.imageUrl,
      });
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => setAudioError(true));
    }
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setProgress(0);
    audioRef.current.play().then(() => setPlaying(true)).catch(() => { /* noop */ });
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const next = Math.max(0, Math.min(duration, duration * ratio));
    audioRef.current.currentTime = next;
    setProgress(next);
  };

  const googleMapUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
    : null;
  const kakaoMapUrl = hasCoords
    ? `https://map.kakao.com/link/map/${encodeURIComponent(item.title || "")},${item.latitude},${item.longitude}`
    : null;

  const typeLabel = item.type === "STORY"
    ? t("audioGuide.tab.story", "이야기 조각")
    : t("audioGuide.tab.theme", "관광지 해설");

  return (
    <div
      className="agm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <style>{modalCss}</style>
      <div className="agm-modal">
        <button className="agm-close" onClick={onClose} aria-label="close">
          <X size={18} />
        </button>

        <div className="agm-hero">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.title || ""}
              className="agm-hero-img"
              referrerPolicy="no-referrer"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="agm-hero-fb">
              {item.type === "STORY" ? <BookOpen size={64} /> : <Radio size={64} />}
            </div>
          )}
          <div className="agm-hero-overlay" />
          <div className="agm-hero-meta">
            <span className="agm-type-badge">
              {item.type === "STORY" ? <BookOpen size={12} /> : <Radio size={12} />}
              {typeLabel}
            </span>
            {item.language && (
              <span className="agm-lang-badge">
                <Globe2 size={10} /> {String(item.language).toUpperCase()}
              </span>
            )}
            {item.distanceKm != null && (
              <span className="agm-dist-badge">
                <MapPin size={10} />
                {item.distanceKm < 1
                  ? `${Math.round(item.distanceKm * 1000)}m`
                  : `${item.distanceKm.toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>

        <div className="agm-body">
          <h2 className="agm-title">{item.title}</h2>
          {item.audioTitle && item.audioTitle !== item.title && (
            <p className="agm-subtitle">
              <Mic2 size={14} /> {item.audioTitle}
            </p>
          )}

          <div className="agm-meta-row">
            {item.themeCategory && (
              <span className="agm-meta-chip">
                <Tag size={12} /> {item.themeCategory}
              </span>
            )}
            {item.playTimeText && (
              <span className="agm-meta-chip">
                <Clock size={12} /> {formatPlayTime(item.playTimeText)}
              </span>
            )}
            {item.address && (
              <span className="agm-meta-chip agm-meta-addr">
                <MapPin size={12} /> {item.address}
              </span>
            )}
          </div>

          {hasAudio ? (
            <div className="agm-player">
              <div className="agm-player-top">
                <button
                  type="button"
                  className="agm-player-main"
                  onClick={togglePlay}
                  aria-label={playing ? "pause" : "play"}
                >
                  {playing ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <div className="agm-player-progress" onClick={seek}>
                  <div
                    className="agm-player-fill"
                    style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}
                  />
                </div>
                <span className="agm-player-time">
                  {formatSeconds(progress)} / {formatSeconds(duration)}
                </span>
                <button type="button" className="agm-player-aux" onClick={restart} aria-label="restart">
                  <SkipBack size={14} />
                </button>
                <button type="button" className="agm-player-aux" onClick={toggleMute}
                  aria-label={muted ? "unmute" : "mute"}>
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
              </div>
              {audioError && (
                <p className="agm-player-err">
                  {t("audioGuide.detail.audioErr", "오디오를 재생할 수 없어요. 원본 링크에서 열어보세요.")}
                  {" · "}
                  <a href={item.audioUrl} target="_blank" rel="noreferrer">
                    {t("audioGuide.detail.openAudio", "오디오 파일 열기")}
                  </a>
                </p>
              )}
            </div>
          ) : item.type === "THEME" && ttsSupported ? (
            // Odii API 는 THEME(관광지) 응답에 script 를 내려주지 않고,
            // STORY(이야기) 응답에만 해설 대본이 있다. 여러 STORY 가 tid 로 THEME 에 연결되므로
            // 이 관광지와 연결된 이야기들을 나열해 각자 TTS 재생 버튼을 제공한다.
            <div className="agm-theme-stories">
              <div className="agm-theme-stories-head">
                <div className="agm-theme-stories-title">
                  <Mic2 size={16} /> {t("audioGuide.detail.stories.title", "이 관광지의 해설 이야기")}
                </div>
                <div className="agm-theme-stories-sub">
                  {t("audioGuide.detail.stories.sub", "Odii 는 오디오 파일을 공개하지 않아요. 관련 해설 이야기를 골라 AI 음성으로 들어보세요.")}
                </div>
              </div>
              {storiesLoading ? (
                <div className="agm-stories-loading">
                  <Loader2 size={16} className="agm-spin" />
                  {t("audioGuide.detail.stories.loading", "연관 해설 이야기를 불러오는 중...")}
                </div>
              ) : stories.length === 0 ? (
                <div className="agm-stories-empty">
                  <Info size={14} />
                  {t("audioGuide.detail.stories.empty", "이 관광지에 연결된 해설 이야기를 찾지 못했어요. 서버 캐시가 준비되는 동안 잠시 후 다시 열어 주세요.")}
                </div>
              ) : (
                <ul className="agm-stories-list">
                  {stories.map((s) => {
                    const isActive = activeStoryId === s.id;
                    const isPlaying = isActive && !activeStoryPaused;
                    const label = s.audioTitle || s.title || "";
                    return (
                      <li key={s.id} className={`agm-story-row${isActive ? " active" : ""}`}>
                        <button
                          type="button"
                          className="agm-story-play"
                          onClick={() => {
                            if (!isActive) return playStoryTts(s);
                            if (activeStoryPaused) return resumeStoryTts();
                            return pauseStoryTts();
                          }}
                          aria-label={isPlaying ? "pause" : "play"}
                        >
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <div className="agm-story-meta">
                          <div className="agm-story-title">{label}</div>
                          <div className="agm-story-sub">
                            {s.playTimeText && (
                              <span><Clock size={10} /> {formatPlayTime(s.playTimeText)}</span>
                            )}
                            {s.themeCategory && (
                              <span><Tag size={10} /> {s.themeCategory}</span>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <button
                            type="button"
                            className="agm-story-stop"
                            onClick={stopStoryTts}
                            aria-label={t("audioGuide.detail.tts.stop", "정지")}
                          >
                            <Square size={12} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="agm-tts-meta">
                <Info size={11} />
                {t("audioGuide.detail.tts.note", "음성 품질은 사용 중인 브라우저/OS 에 따라 달라져요.")}
              </div>
            </div>
          ) : hasScript && ttsSupported ? (
            // Odii 공공 OpenAPI 가 audioUrl 을 비공개로 제공하므로,
            // 스크립트를 브라우저 내장 TTS 로 읽어 주는 fallback 플레이어.
            <div className="agm-tts">
              <div className="agm-tts-top">
                {!ttsPlaying ? (
                  <button type="button" className="agm-tts-main" onClick={startTts}
                    aria-label={t("audioGuide.detail.tts.start", "AI 음성으로 듣기")}>
                    <Play size={22} />
                  </button>
                ) : ttsPaused ? (
                  <button type="button" className="agm-tts-main" onClick={resumeTts}
                    aria-label={t("audioGuide.detail.tts.resume", "이어 듣기")}>
                    <Play size={22} />
                  </button>
                ) : (
                  <button type="button" className="agm-tts-main" onClick={pauseTts}
                    aria-label={t("audioGuide.detail.tts.pause", "일시정지")}>
                    <Pause size={22} />
                  </button>
                )}
                <div className="agm-tts-texts">
                  <div className="agm-tts-title">
                    <Mic2 size={14} /> {t("audioGuide.detail.tts.title", "AI 음성으로 해설 듣기")}
                  </div>
                  <div className="agm-tts-sub">
                    {t("audioGuide.detail.tts.sub", "Odii 는 오디오 파일을 외부에 공개하지 않아요. 브라우저 음성 합성으로 대본을 읽어 드려요.")}
                  </div>
                </div>
                {ttsPlaying && (
                  <button type="button" className="agm-tts-stop" onClick={stopTts}
                    aria-label={t("audioGuide.detail.tts.stop", "정지")}>
                    <Square size={14} />
                  </button>
                )}
              </div>
              <div className="agm-tts-meta">
                <Info size={11} />
                {t("audioGuide.detail.tts.note", "음성 품질은 사용 중인 브라우저/OS 에 따라 달라져요.")}
                {" · "}
                <span>{ttsLang}</span>
              </div>
            </div>
          ) : (
            <div className="agm-noaudio">
              <Mic2 size={14} />
              {t("audioGuide.detail.noAudio", "이 항목에는 오디오 파일이 제공되지 않아요.")}
            </div>
          )}

          {effectiveDescription && (
            <section className="agm-script">
              <h3>{t("audioGuide.detail.script", "해설 스크립트")}</h3>
              <p>{effectiveDescription}</p>
            </section>
          )}

          {hasCoords && (
            <div className="agm-map-actions">
              <a href={googleMapUrl} target="_blank" rel="noreferrer" className="agm-map-btn agm-map-google">
                <ExternalLink size={13} /> {t("audioGuide.detail.openGoogleMap", "구글 지도에서 보기")}
              </a>
              <a href={kakaoMapUrl} target="_blank" rel="noreferrer" className="agm-map-btn agm-map-kakao">
                <ExternalLink size={13} /> {t("audioGuide.detail.openKakaoMap", "카카오맵에서 보기")}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPlayTime(raw) {
  if (!raw) return "";
  // "122" 같은 순수 초 값이면 mm:ss 로 변환, "mm:ss" 면 그대로
  if (/^\d+$/.test(String(raw))) {
    const sec = parseInt(raw, 10);
    if (Number.isFinite(sec) && sec > 0) return formatSeconds(sec);
  }
  return String(raw);
}

function formatSeconds(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const modalCss = `
.agm-backdrop {
  position: fixed; inset: 0; z-index: 110;
  background: rgba(8, 4, 18, 0.75);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  overflow-y: auto;
}
.agm-modal {
  position: relative;
  width: min(780px, 100%);
  max-height: calc(100vh - 40px);
  background: linear-gradient(180deg, #14102a 0%, #0c0820 100%);
  border: 1px solid rgba(167, 139, 250, 0.35);
  border-radius: 16px;
  overflow: hidden;
  color: #f4f1ff;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
}
.agm-close {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(10, 5, 26, 0.75);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
}
.agm-close:hover { background: rgba(239,68,68,0.8); border-color: transparent; }

.agm-hero {
  position: relative; width: 100%; padding-top: 42%;
  background: #0d0820; overflow: hidden; flex-shrink: 0;
}
.agm-hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.agm-hero-fb {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.38);
  background: linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(251,191,36,0.12) 100%);
}
.agm-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(12,8,32,0.95) 100%);
}
.agm-hero-meta {
  position: absolute; left: 16px; bottom: 12px; right: 56px;
  display: flex; gap: 6px; flex-wrap: wrap;
}
.agm-type-badge, .agm-lang-badge, .agm-dist-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.72rem; font-weight: 800;
  padding: 4px 9px; border-radius: 999px;
  backdrop-filter: blur(6px);
}
.agm-type-badge { background: rgba(167,139,250,0.92); color: #1b0a38; }
.agm-lang-badge { background: rgba(10,5,26,0.6); color: #ddd6fe; border: 1px solid rgba(167,139,250,0.5); }
.agm-dist-badge { background: rgba(251,191,36,0.92); color: #2b1c00; }

.agm-body {
  padding: 18px 22px 22px;
  overflow-y: auto;
  min-height: 0;
}
.agm-title { margin: 0; font-size: 1.4rem; font-weight: 900; color: #fff; line-height: 1.25; }
.agm-subtitle {
  margin: 6px 0 0; color: #d4c7f5;
  font-size: 0.92rem; display: inline-flex; align-items: center; gap: 6px;
}

.agm-meta-row {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin: 12px 0 16px;
}
.agm-meta-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(167,139,250,0.14);
  border: 1px solid rgba(167,139,250,0.3);
  color: #e9d5ff;
  font-size: 0.78rem; font-weight: 600;
}
.agm-meta-addr { color: #fde68a; border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.1); }

.agm-player {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(167,139,250,0.3);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
}
.agm-player-top { display: flex; align-items: center; gap: 10px; }
.agm-player-main {
  width: 46px; height: 46px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-player-main:hover { filter: brightness(1.08); }
.agm-player-progress {
  flex: 1; height: 8px; border-radius: 4px;
  background: rgba(255,255,255,0.12);
  cursor: pointer; overflow: hidden;
  position: relative;
}
.agm-player-fill {
  height: 100%;
  background: linear-gradient(90deg, #a78bfa 0%, #f59e0b 100%);
  transition: width 0.2s linear;
}
.agm-player-time {
  font-size: 0.74rem; color: #cdc0ee; min-width: 82px; text-align: right;
  font-variant-numeric: tabular-nums;
}
.agm-player-aux {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.05);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-player-aux:hover { background: rgba(167,139,250,0.3); }
.agm-player-err { margin: 8px 0 0; color: #fca5a5; font-size: 0.82rem; }
.agm-player-err a { color: #fde68a; text-decoration: underline; }

.agm-noaudio {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px dashed rgba(255,255,255,0.15);
  color: #bda6ff; font-size: 0.85rem;
  margin-bottom: 16px;
}

.agm-tts {
  background: linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(251,191,36,0.1) 100%);
  border: 1px solid rgba(167,139,250,0.35);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.agm-tts-top { display: flex; align-items: center; gap: 12px; }
.agm-tts-main {
  width: 50px; height: 50px; border-radius: 50%;
  border: none; cursor: pointer; flex-shrink: 0;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(167,139,250,0.4);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.agm-tts-main:hover { transform: scale(1.06); box-shadow: 0 10px 24px rgba(167,139,250,0.55); }
.agm-tts-texts { flex: 1; min-width: 0; }
.agm-tts-title {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.95rem; font-weight: 800; color: #fff;
}
.agm-tts-sub {
  margin-top: 3px; font-size: 0.78rem; line-height: 1.45;
  color: #d8c7fd;
}
.agm-tts-stop {
  width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.35); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.agm-tts-stop:hover { background: rgba(239,68,68,0.85); border-color: transparent; }
.agm-tts-meta {
  margin-top: 10px; padding-top: 10px;
  border-top: 1px dashed rgba(167,139,250,0.25);
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.72rem; color: #c4b5fd;
}
.agm-tts-meta span { color: #fde68a; font-weight: 700; }

.agm-theme-stories {
  background: linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(251,191,36,0.08) 100%);
  border: 1px solid rgba(167,139,250,0.35);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
}
.agm-theme-stories-head { margin-bottom: 10px; }
.agm-theme-stories-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.95rem; font-weight: 800; color: #fff;
}
.agm-theme-stories-sub {
  margin-top: 3px; font-size: 0.78rem; line-height: 1.45;
  color: #d8c7fd;
}
.agm-stories-loading, .agm-stories-empty {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  color: #cbb7f7; font-size: 0.85rem;
  border: 1px dashed rgba(167,139,250,0.22);
  width: 100%;
  box-sizing: border-box;
}
.agm-stories-empty { color: #fde68a; border-color: rgba(251,191,36,0.3); }
.agm-spin { animation: agm-spin 1s linear infinite; }
@keyframes agm-spin { to { transform: rotate(360deg); } }

.agm-stories-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto;
}
.agm-story-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.agm-story-row:hover { background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.35); }
.agm-story-row.active {
  background: rgba(167,139,250,0.18);
  border-color: rgba(167,139,250,0.6);
  box-shadow: 0 0 0 2px rgba(167,139,250,0.15);
}
.agm-story-play {
  width: 34px; height: 34px; border-radius: 50%;
  flex-shrink: 0;
  border: none; cursor: pointer;
  background: linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%);
  color: #1b0a38;
  display: inline-flex; align-items: center; justify-content: center;
}
.agm-story-play:hover { filter: brightness(1.1); }
.agm-story-meta { flex: 1; min-width: 0; }
.agm-story-title {
  font-size: 0.88rem; font-weight: 700; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.agm-story-sub {
  margin-top: 2px; font-size: 0.72rem; color: #c4b5fd;
  display: inline-flex; gap: 10px; flex-wrap: wrap;
}
.agm-story-sub span { display: inline-flex; align-items: center; gap: 3px; }
.agm-story-stop {
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.3);
  background: rgba(0,0,0,0.35); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.agm-story-stop:hover { background: rgba(239,68,68,0.85); border-color: transparent; }

.agm-script {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 14px 16px 16px;
  margin-bottom: 16px;
}
.agm-script h3 {
  margin: 0 0 8px; font-size: 0.95rem; font-weight: 800;
  color: #c4b5fd;
}
.agm-script p {
  margin: 0; white-space: pre-wrap;
  line-height: 1.65; color: #e8e3f8; font-size: 0.92rem;
}

.agm-map-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.agm-map-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 8px 14px; border-radius: 999px;
  font-size: 0.82rem; font-weight: 700;
  text-decoration: none;
  transition: transform 0.15s ease, filter 0.15s ease;
}
.agm-map-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
.agm-map-google {
  background: linear-gradient(135deg, #34a853 0%, #1a73e8 100%);
  color: #fff;
}
.agm-map-kakao {
  background: linear-gradient(135deg, #fee500 0%, #f6c700 100%);
  color: #191919;
}

@media (max-width: 640px) {
  .agm-backdrop { padding: 0; }
  .agm-modal { max-height: 100vh; border-radius: 0; border: none; }
  .agm-hero { padding-top: 50%; }
  .agm-title { font-size: 1.15rem; }
  .agm-player-time { min-width: 70px; font-size: 0.7rem; }
}
`;
