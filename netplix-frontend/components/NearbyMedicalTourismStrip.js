"use client";

/**
 * NearbyMedicalTourismStrip — 영화 상세 / DVD 매장 / cine-trip 지역 상세에서 공용으로 사용하는
 * "근처 K-의료관광 스팟" 미리보기 섹션 (MdclTursmService API 기반).
 *
 * <p>컨셉: "K-의료관광 · 외국인 환영"
 *  - 영화/드라마로 한국 문화를 접한 해외 시청자에게 한국 방문 시 이용 가능한
 *    성형·한방·건강검진·재활·미용 등 의료관광 클러스터를 노출
 *  - i18n 언어에 따라 lang=ko / lang=en 자동 전환
 *
 * <p>호출 우선순위:
 *  1) lat/lng → /api/v1/medical-tourism/nearby
 *  2) keyword → /api/v1/medical-tourism/search?q=
 *  3) 없으면 전체 미노출
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import axios from "@/src/axiosConfig";
import { Stethoscope, MapPin, Phone, ArrowRight, Globe2 } from "lucide-react";

export default function NearbyMedicalTourismStrip({
  lat,
  lng,
  keyword,
  radiusM = 20_000,
  limit = 6,
  title,
  subtitle,
  accent = "#0ea5e9",
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

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
          ? `/api/v1/medical-tourism/nearby`
          : `/api/v1/medical-tourism/search`;
        const params = useCoords
          ? { lang, lat, lon: lng, radius: radiusM, limit }
          : { lang, q: keyword.trim(), limit };
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
  }, [useCoords, useKeyword, lat, lng, keyword, radiusM, limit, lang]);

  if (!loading && !errored && items.length === 0) return null;
  if (!useCoords && !useKeyword) return null;

  const allHref = useCoords
    ? `/medical-tourism?nearby=true`
    : `/medical-tourism?q=${encodeURIComponent(keyword || "")}`;

  return (
    <section className="nmt-section" aria-label={title || t("nearbyMedicalTourism.title")}>
      <style>{cssBlock}</style>
      <div className="nmt-header">
        <div className="nmt-head-left">
          <Stethoscope size={16} style={{ color: accent }} />
          <h3 className="nmt-title">
            {title || t("nearbyMedicalTourism.title")}
            {!loading && items.length > 0 && (
              <span className="nmt-total" style={{ color: "#dc2626" }}>
                ({t("nearbyMedicalTourism.totalCount", { count: items.length })})
              </span>
            )}
          </h3>
          <span className="nmt-lang-badge" style={{ borderColor: accent, color: accent }}>
            <Globe2 size={10} /> {lang.toUpperCase()}
          </span>
        </div>
        <Link href={allHref} className="nmt-all" style={{ color: accent }}>
          {t("nearbyMedicalTourism.viewAll")} <ArrowRight size={14} />
        </Link>
      </div>
      {subtitle && <p className="nmt-sub">{subtitle}</p>}

      <div className="nmt-scroll">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="nmt-card nmt-sk">
                <div className="nmt-img nmt-sk-img" />
                <div className="nmt-body">
                  <div className="nmt-sk-line nmt-sk-line-lg" />
                  <div className="nmt-sk-line" />
                </div>
              </div>
            ))
          : items.map((s) => (
              <MedicalMiniCard key={s.id} spot={s} />
            ))}
      </div>
    </section>
  );
}

function MedicalMiniCard({ spot }) {
  const { t } = useTranslation();
  return (
    <article className="nmt-card">
      <div className="nmt-img">
        {spot.imageUrl ? (
          <img
            src={spot.imageUrl}
            alt={spot.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="nmt-img-placeholder">
            <Stethoscope size={28} />
          </div>
        )}
        {spot.distanceKm != null && (
          <span className="nmt-dist">
            {spot.distanceKm < 1
              ? `${Math.round(spot.distanceKm * 1000)}m`
              : `${spot.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="nmt-body">
        <div className="nmt-ctitle" title={spot.name || ""}>{spot.name}</div>
        {spot.address && (
          <div className="nmt-meta">
            <MapPin size={11} />
            <span>{spot.address}</span>
          </div>
        )}
        <div className="nmt-meta nmt-meta-sub">
          <Phone size={11} />
          <span>{spot.tel || t("nearbyMedicalTourism.phoneNone")}</span>
        </div>
      </div>
    </article>
  );
}

const cssBlock = `
.nmt-section { margin: 20px 0 8px; }
.nmt-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 8px; gap: 10px;
}
.nmt-head-left { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.nmt-title {
  display: inline-flex; align-items: center; gap: 6px;
  margin: 0; font-size: 1.05rem; font-weight: 700; color: inherit;
}
.nmt-total { font-size: 0.85rem; font-weight: 700; }
.nmt-lang-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.66rem; font-weight: 800;
  padding: 2px 7px; border-radius: 999px;
  border: 1px solid currentColor;
  background: rgba(14,165,233,0.08);
  letter-spacing: 0.04em;
}
.nmt-all {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.82rem; font-weight: 600; text-decoration: none;
  transition: transform 0.15s ease;
}
.nmt-all:hover { transform: translateX(3px); }
.nmt-sub { margin: -2px 4px 10px; font-size: 0.82rem; color: #9aa0a6; }

.nmt-scroll {
  display: flex; flex-wrap: nowrap;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 4px 14px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.nmt-scroll::-webkit-scrollbar { height: 6px; }
.nmt-scroll::-webkit-scrollbar-thumb {
  background: rgba(14,165,233,0.35); border-radius: 3px;
}

.nmt-card {
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
.nmt-card:hover {
  transform: translateY(-2px);
  border-color: rgba(14, 165, 233, 0.42);
  box-shadow: 0 10px 22px rgba(0,0,0,0.38);
}
.nmt-img {
  position: relative; width: 100%; padding-top: 60%;
  background: #0e0e0e; overflow: hidden;
}
.nmt-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.nmt-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(14,165,233,0.1) 0%, rgba(99,102,241,0.06) 100%);
}
.nmt-dist {
  position: absolute; top: 8px; left: 8px;
  background: rgba(14,165,233,0.9); color: #04182a;
  font-size: 0.7rem; font-weight: 800;
  padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.nmt-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.nmt-ctitle {
  font-size: 0.92rem; font-weight: 700; line-height: 1.3;
  color: #fff; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.nmt-meta {
  font-size: 0.76rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start; line-height: 1.35;
}
.nmt-meta-sub { color: #9ba3a0; }

.nmt-sk { cursor: default; }
.nmt-sk-img, .nmt-sk-line {
  background: linear-gradient(90deg, #1e2328 0%, #2c3238 50%, #1e2328 100%);
  background-size: 200% 100%;
  animation: nmt-shine 1.4s linear infinite;
  border-radius: 6px;
}
.nmt-sk-img { position: absolute; inset: 0; }
.nmt-sk-line { height: 9px; margin-top: 5px; width: 70%; }
.nmt-sk-line-lg { height: 13px; width: 85%; }
@keyframes nmt-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
