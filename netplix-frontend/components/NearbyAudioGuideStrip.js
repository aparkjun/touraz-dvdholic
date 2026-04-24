"use client";

/**
 * NearbyAudioGuideStrip — "Cine Audio Trail" 컨셉의 공용 오디오 가이드 미리보기 섹션.
 *
 * <p>영화 상세 / cine-trip 지역 상세 / DVD 매장 / 웰니스·의료관광 페이지 등에 공통 삽입.
 * 한국관광공사 관광지 오디오 가이드(Odii) API 기반으로 현지에서 이어폰으로 들을 수 있는
 * 관광지 오디오 해설·이야기 콘텐츠를 노출한다.
 *
 * <p>컨셉: "영화는 극장에서 · 이야기는 현지에서 귀로 듣기"
 *  - 정주행 후 눈 휴식, 귀로 소비하는 이동형 스토리텔링
 *  - 촬영지/DVD 반납길 동선에서 현장 해설을 이어폰으로 흘려 듣는 경험
 *
 * <p>호출 우선순위:
 *  1) lat/lng → /api/v1/audio-guide/nearby
 *  2) keyword → /api/v1/audio-guide/search?q=
 *  3) 둘 다 없으면 섹션 자체를 렌더하지 않는다.
 *
 * <p>재생 UX:
 *  - audioUrl 이 있는 경우 인라인 재생 버튼 제공 (카드 내 동시 1개 재생).
 *  - 그 외에는 관광지 이름/카테고리/주소/재생시간만 노출.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import axios from "@/src/axiosConfig";
import { Headphones, MapPin, Play, Pause, Clock, ArrowRight, Globe2, Mic2 } from "lucide-react";

export default function NearbyAudioGuideStrip({
  lat,
  lng,
  keyword,
  type = "theme", // "theme" | "story"
  radiusM = 20_000,
  limit = 6,
  title,
  subtitle,
  accent = "#a78bfa",
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const lang = (i18n?.language || "ko").toLowerCase().startsWith("en") ? "en" : "ko";
  const useCoords = typeof lat === "number" && typeof lng === "number"
    && !Number.isNaN(lat) && !Number.isNaN(lng);
  const useKeyword = !useCoords && !!(keyword && keyword.trim());

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!useCoords && !useKeyword) {
        setItems([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setErrored(false);
        const url = useCoords
          ? `/api/v1/audio-guide/nearby`
          : `/api/v1/audio-guide/search`;
        const params = useCoords
          ? { type, lang, lat, lon: lng, radius: radiusM, limit }
          : { type, lang, q: keyword.trim(), limit };
        const res = await axios.get(url, { params });
        if (cancelled) return;
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setItems(data);
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
    return () => { cancelled = true; };
  }, [useCoords, useKeyword, lat, lng, keyword, type, radiusM, limit, lang]);

  useEffect(() => () => {
    // 언마운트 시 재생 중지
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
  }, []);

  if (!loading && !errored && items.length === 0) return null;
  if (!useCoords && !useKeyword) return null;

  const togglePlay = (item) => {
    if (!item?.audioUrl) return;
    // 재생 중인 항목을 다시 누르면 정지
    if (playingId === item.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    // 다른 항목 재생 중이면 중지 후 새로 시작
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* noop */ }
      audioRef.current = null;
    }
    try {
      const audio = new Audio(item.audioUrl);
      audio.addEventListener("ended", () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
      });
      audio.addEventListener("error", () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setPlayingId(null);
        }
      });
      audio.play().catch(() => { /* autoplay block 등 */ });
      audioRef.current = audio;
      setPlayingId(item.id);
    } catch (_) { /* noop */ }
  };

  const allHref = useCoords
    ? `/audio-guide?nearby=true&type=${type}`
    : `/audio-guide?type=${type}&q=${encodeURIComponent(keyword || "")}`;

  return (
    <section className="nag-section" aria-label={title || t("nearbyAudioGuide.title")}>
      <style>{cssBlock}</style>
      <div className="nag-header">
        <div className="nag-head-left">
          <Headphones size={16} style={{ color: accent }} />
          <h3 className="nag-title">
            {title || t("nearbyAudioGuide.title")}
            {!loading && items.length > 0 && (
              <span className="nag-total" style={{ color: accent }}>
                ({t("nearbyAudioGuide.totalCount", { count: items.length })})
              </span>
            )}
          </h3>
          <span className="nag-lang-badge" style={{ borderColor: accent, color: accent }}>
            <Globe2 size={10} /> {lang.toUpperCase()}
          </span>
        </div>
        <Link href={allHref} className="nag-all" style={{ color: accent }}>
          {t("nearbyAudioGuide.viewAll")} <ArrowRight size={14} />
        </Link>
      </div>
      {subtitle && <p className="nag-sub">{subtitle}</p>}

      <div className="nag-scroll">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="nag-card nag-sk">
                <div className="nag-img nag-sk-img" />
                <div className="nag-body">
                  <div className="nag-sk-line nag-sk-line-lg" />
                  <div className="nag-sk-line" />
                </div>
              </div>
            ))
          : items.map((s) => (
              <AudioGuideMiniCard
                key={s.id}
                item={s}
                playing={playingId === s.id}
                onToggle={() => togglePlay(s)}
              />
            ))}
      </div>
    </section>
  );
}

function AudioGuideMiniCard({ item, playing, onToggle }) {
  const { t } = useTranslation();
  const hasAudio = !!item.audioUrl;
  return (
    <article className="nag-card">
      <div className="nag-img">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="nag-img-placeholder">
            <Mic2 size={28} />
          </div>
        )}
        {item.distanceKm != null && (
          <span className="nag-dist">
            {item.distanceKm < 1
              ? `${Math.round(item.distanceKm * 1000)}m`
              : `${item.distanceKm.toFixed(1)}km`}
          </span>
        )}
        {hasAudio && (
          <button
            type="button"
            className={`nag-play ${playing ? "nag-play-on" : ""}`}
            onClick={onToggle}
            aria-label={playing ? t("nearbyAudioGuide.pause") : t("nearbyAudioGuide.play")}
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
        )}
      </div>
      <div className="nag-body">
        <div className="nag-ctitle" title={item.title || ""}>{item.title}</div>
        {item.audioTitle && item.audioTitle !== item.title && (
          <div className="nag-atitle">{item.audioTitle}</div>
        )}
        {item.themeCategory && (
          <div className="nag-cat">#{item.themeCategory}</div>
        )}
        <div className="nag-meta-row">
          {item.playTimeText && (
            <span className="nag-meta">
              <Clock size={11} /> {item.playTimeText}
            </span>
          )}
          {item.address && (
            <span className="nag-meta nag-meta-addr" title={item.address}>
              <MapPin size={11} /> {item.address}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

const cssBlock = `
.nag-section { margin: 20px 0 8px; }
.nag-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 8px; gap: 10px;
}
.nag-head-left { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.nag-title {
  display: inline-flex; align-items: center; gap: 6px;
  margin: 0; font-size: 1.05rem; font-weight: 700; color: inherit;
}
.nag-total { font-size: 0.85rem; font-weight: 700; }
.nag-lang-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.66rem; font-weight: 800;
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid currentColor;
  background: rgba(167,139,250,0.08);
  letter-spacing: 0.04em;
}
.nag-all {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.82rem; font-weight: 600; text-decoration: none;
  transition: transform 0.15s ease;
}
.nag-all:hover { transform: translateX(3px); }
.nag-sub { margin: -2px 4px 10px; font-size: 0.82rem; color: #9aa0a6; }

.nag-scroll {
  display: flex; flex-wrap: nowrap;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 4px 14px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.nag-scroll::-webkit-scrollbar { height: 6px; }
.nag-scroll::-webkit-scrollbar-thumb {
  background: rgba(167,139,250,0.4); border-radius: 3px;
}

.nag-card {
  flex: 0 0 248px;
  scroll-snap-align: start;
  background: rgba(18,16,28,0.88);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; overflow: hidden;
  color: #f1f1f1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  display: flex; flex-direction: column;
}
.nag-card:hover {
  transform: translateY(-2px);
  border-color: rgba(167, 139, 250, 0.5);
  box-shadow: 0 10px 22px rgba(0,0,0,0.38);
}
.nag-img {
  position: relative; width: 100%; padding-top: 58%;
  background: #0e0b16; overflow: hidden;
}
.nag-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.nag-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.35);
  background: linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(251,191,36,0.08) 100%);
}
.nag-dist {
  position: absolute; top: 8px; left: 8px;
  background: rgba(167,139,250,0.92); color: #1a0a35;
  font-size: 0.7rem; font-weight: 800;
  padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(6px);
}
.nag-play {
  position: absolute; right: 8px; bottom: 8px;
  width: 34px; height: 34px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(10,5,26,0.6);
  color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
  transition: transform 0.15s ease, background 0.15s ease;
}
.nag-play:hover { transform: scale(1.08); background: rgba(167,139,250,0.9); color: #0b0620; }
.nag-play-on { background: rgba(251,191,36,0.92); color: #2b1c00; border-color: rgba(251,191,36,0.9); }

.nag-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.nag-ctitle {
  font-size: 0.92rem; font-weight: 700; line-height: 1.3;
  color: #fff; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.nag-atitle {
  font-size: 0.78rem; color: #d4c7f5; line-height: 1.3;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}
.nag-cat { font-size: 0.72rem; color: #a78bfa; font-weight: 600; }
.nag-meta-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  margin-top: 2px;
}
.nag-meta {
  font-size: 0.72rem; color: #c6c6c6;
  display: inline-flex; gap: 3px; align-items: center; line-height: 1.35;
}
.nag-meta-addr {
  max-width: 140px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}

.nag-sk { cursor: default; }
.nag-sk-img, .nag-sk-line {
  background: linear-gradient(90deg, #1e1a2a 0%, #2c2640 50%, #1e1a2a 100%);
  background-size: 200% 100%;
  animation: nag-shine 1.4s linear infinite;
  border-radius: 6px;
}
.nag-sk-img { position: absolute; inset: 0; }
.nag-sk-line { height: 9px; margin-top: 5px; width: 70%; }
.nag-sk-line-lg { height: 13px; width: 85%; }
@keyframes nag-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
