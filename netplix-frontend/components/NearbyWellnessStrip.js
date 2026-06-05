"use client";

/**
 * NearbyWellnessStrip — 영화 상세 / DVD 매장 / cine-trip 지역 상세에서 공용으로 사용하는
 * "근처 힐링 스팟" 미리보기 섹션 (웰니스관광 WellnessTursmService API 기반).
 *
 * <p>컨셉: "정주행 번아웃 · 내 주변 힐링 스팟"
 * 영화/드라마 정주행 후 쌓인 눈·어깨·멘탈 피로를 풀어주는 온천·스파·힐링숲·템플스테이·명상·요가 추천.
 *
 * <p>호출 방식 (props 우선순위):
 *  1) lat/lng 가 제공되면 /api/v1/wellness/nearby 로 좌표 기반 조회
 *  2) keyword 가 제공되면 /api/v1/wellness/search?q=<keyword>
 *  3) genres 가 제공되면 장르→힐링 키워드 매핑 후 search (영화 상세 전용)
 *  4) 위 세 가지 모두 없으면 아무것도 렌더하지 않음
 *
 * <p>결과 0건이면 섹션 자체를 숨겨 UX 공백을 없앰.
 * "전체 보기" 버튼은 /wellness 으로 이동.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import axios from "@/src/axiosConfig";
import { Sparkles, MapPin, Phone, ArrowRight } from "lucide-react";

/**
 * 영화 장르 → 웰니스 키워드 매핑.
 * "정주행 번아웃" 컨셉에 맞춰 장르별 회복 페어링을 시도한다.
 *
 * TMDB 장르 ID 또는 한/영 장르 이름(대소문자 무관) 모두 수용.
 * 여러 장르 중 우선순위가 높은 하나를 선택 (공포 > 액션 > 멜로 > 다큐 > 그 외).
 */
export function genresToWellnessKeyword(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return "웰니스";

  const tags = genres.map((g) => {
    if (typeof g === "number") return String(g);
    if (typeof g === "string") return g.trim().toLowerCase();
    if (g && typeof g === "object") {
      return String(g.id ?? g.name ?? "").toLowerCase();
    }
    return "";
  });

  const has = (...keys) => keys.some((k) => tags.includes(String(k).toLowerCase()));

  // 공포/스릴러 → 온천 (심박 안정 + 따뜻한 물)
  if (has(27, 53, 9648, 80, "horror", "thriller", "mystery", "crime", "공포", "스릴러", "미스터리", "범죄")) {
    return "온천";
  }
  // 액션/어드벤처/전쟁 → 스파 (근육 피로 해소)
  if (has(28, 12, 10752, 37, "action", "adventure", "war", "western", "액션", "모험", "어드벤처", "전쟁", "서부")) {
    return "스파";
  }
  // 다큐/전기/역사 → 템플스테이 (사색 회복)
  if (has(99, 36, "documentary", "history", "다큐", "다큐멘터리", "역사", "전기")) {
    return "템플스테이";
  }
  // 멜로/로맨스 → 명상 (감정 회복)
  if (has(10749, 18, "romance", "drama", "melodrama", "로맨스", "멜로", "드라마")) {
    return "명상";
  }
  // SF/판타지 → 힐링숲 (현실 전환)
  if (has(878, 14, "science fiction", "sci-fi", "fantasy", "sf", "판타지")) {
    return "힐링숲";
  }
  // 코미디/가족/애니 → 자연휴양림 (편안한 분위기)
  if (has(35, 10751, 16, "comedy", "family", "animation", "코미디", "가족", "애니메이션")) {
    return "자연휴양림";
  }
  // 음악 → 요가 (리듬 회복)
  if (has(10402, "music", "음악")) {
    return "요가";
  }
  return "웰니스";
}

export default function NearbyWellnessStrip({
  lat,
  lng,
  keyword,
  genres,
  radiusM = 20_000,
  limit = 6,
  title,
  subtitle,
  accent = "#10b981",
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const useCoords = typeof lat === "number" && typeof lng === "number"
    && !Number.isNaN(lat) && !Number.isNaN(lng);
  const derivedKeyword = useMemo(() => {
    if (useCoords) return "";
    if (keyword && keyword.trim()) return keyword.trim();
    if (Array.isArray(genres) && genres.length > 0) return genresToWellnessKeyword(genres);
    return "";
  }, [useCoords, keyword, genres]);
  const useKeyword = !useCoords && !!derivedKeyword;

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
          ? `/api/v1/wellness/nearby`
          : `/api/v1/wellness/search`;
        const params = useCoords
          ? { lat, lon: lng, radius: radiusM, limit }
          : { q: derivedKeyword, limit };
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
  }, [useCoords, useKeyword, lat, lng, derivedKeyword, radiusM, limit]);

  if (!loading && !errored && items.length === 0) return null;
  if (!useCoords && !useKeyword) return null;

  const allHref = useCoords
    ? `/wellness?nearby=true`
    : `/wellness?q=${encodeURIComponent(derivedKeyword || "")}`;

  return (
    <section className="nws-section" aria-label={title || t("nearbyWellness.title")}>
      <style>{cssBlock}</style>
      <div className="nws-header">
        <div className="nws-head-left">
          <Sparkles size={16} style={{ color: accent }} />
          <h3 className="nws-title">
            {title || t("nearbyWellness.title")}
            {!loading && items.length > 0 && (
              <span className="nws-total" style={{ color: "#dc2626" }}>
                ({t("nearbyWellness.totalCount", { count: items.length })})
              </span>
            )}
          </h3>
        </div>
        <Link href={allHref} className="nws-all" style={{ color: accent }}>
          {t("nearbyWellness.viewAll")} <ArrowRight size={14} />
        </Link>
      </div>
      {useKeyword && derivedKeyword && !keyword && (
        <p className="nws-tag" style={{ color: accent }}>
          {t("nearbyWellness.autoTag", { keyword: derivedKeyword })}
        </p>
      )}
      {subtitle && <p className="nws-sub">{subtitle}</p>}

      <div className="nws-scroll js-drag-scroll">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="nws-card nws-sk">
                <div className="nws-img nws-sk-img" />
                <div className="nws-body">
                  <div className="nws-sk-line nws-sk-line-lg" />
                  <div className="nws-sk-line" />
                </div>
              </div>
            ))
          : items.map((s) => (
              <WellnessMiniCard key={s.id} spot={s} />
            ))}
      </div>
    </section>
  );
}

function WellnessMiniCard({ spot }) {
  const { t } = useTranslation();
  return (
    <article className="nws-card">
      <div className="nws-img">
        {spot.imageUrl ? (
          <img
            src={spot.imageUrl}
            alt={spot.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="nws-img-placeholder">
            <Sparkles size={28} />
          </div>
        )}
        {spot.distanceKm != null && (
          <span className="nws-dist">
            {spot.distanceKm < 1
              ? `${Math.round(spot.distanceKm * 1000)}m`
              : `${spot.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="nws-body">
        <div className="nws-ctitle" title={spot.name || ""}>{spot.name}</div>
        {spot.address && (
          <div className="nws-meta">
            <MapPin size={11} />
            <span>{spot.address}</span>
          </div>
        )}
        <div className="nws-meta nws-meta-sub">
          <Phone size={11} />
          <span>{spot.tel || t("nearbyWellness.phoneNone")}</span>
        </div>
      </div>
    </article>
  );
}

const cssBlock = `
.nws-section { margin: 20px 0 8px; }
.nws-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 8px; gap: 10px;
}
.nws-head-left { display: inline-flex; align-items: center; gap: 6px; }
.nws-title {
  display: inline-flex; align-items: center; gap: 6px;
  margin: 0; font-size: 1.05rem; font-weight: 700; color: inherit;
}
.nws-total { font-size: 0.85rem; font-weight: 700; }
.nws-all {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.82rem; font-weight: 600; text-decoration: none;
  transition: transform 0.15s ease;
}
.nws-all:hover { transform: translateX(3px); }
.nws-tag { margin: -4px 4px 4px; font-size: 0.78rem; font-weight: 700; }
.nws-sub { margin: -2px 4px 10px; font-size: 0.82rem; color: #9aa0a6; }

.nws-scroll {
  display: flex; flex-wrap: nowrap;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 4px 14px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.nws-scroll::-webkit-scrollbar { height: 6px; }
.nws-scroll::-webkit-scrollbar-thumb {
  background: rgba(16,185,129,0.35); border-radius: 3px;
}

.nws-card {
  flex: 0 0 240px;
  scroll-snap-align: start;
  background: rgba(18,22,26,0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; overflow: hidden;
  color: #f1f1f1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  display: flex; flex-direction: column;
}
.nws-card:hover {
  transform: translateY(-2px);
  border-color: rgba(16, 185, 129, 0.35);
  box-shadow: 0 10px 22px rgba(0,0,0,0.38);
}
.nws-img {
  position: relative; width: 100%; padding-top: 60%;
  background: #0e0e0e; overflow: hidden;
}
.nws-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.nws-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(139,92,246,0.04) 100%);
}
.nws-dist {
  position: absolute; top: 8px; left: 8px;
  background: rgba(16, 185, 129, 0.85); color: #04241c;
  font-size: 0.7rem; font-weight: 800;
  padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.nws-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.nws-ctitle {
  font-size: 0.92rem; font-weight: 700; line-height: 1.3;
  color: #fff; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.nws-meta {
  font-size: 0.76rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start; line-height: 1.35;
}
.nws-meta-sub { color: #9ba3a0; }

.nws-sk { cursor: default; }
.nws-sk-img, .nws-sk-line {
  background: linear-gradient(90deg, #1e2328 0%, #2c3238 50%, #1e2328 100%);
  background-size: 200% 100%;
  animation: nws-shine 1.4s linear infinite;
  border-radius: 6px;
}
.nws-sk-img { position: absolute; inset: 0; }
.nws-sk-line { height: 9px; margin-top: 5px; width: 70%; }
.nws-sk-line-lg { height: 13px; width: 85%; }
@keyframes nws-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
