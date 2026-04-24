"use client";

/**
 * NearbyCampingStrip — 영화 상세 / DVD 매장 / 지역 상세에서 공용으로 사용하는
 * "근처 야영장" 미리보기 섹션 (고캠핑 GoCamping API 기반).
 *
 * <p>호출 방식 (props 우선순위):
 *  1) lat/lng 가 제공되면 /api/v1/camping/nearby 로 좌표 기반 조회
 *  2) keyword 가 제공되면 /api/v1/camping/search?q=<keyword>
 *  3) 둘 다 없으면 아무것도 렌더하지 않음
 *
 * <p>결과 0건이면 섹션 자체를 숨겨 UX 공백을 없앰.
 * "전체 보기" 버튼은 /camping 으로 이동 (컨텍스트에 맞춘 쿼리 유지).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import axios from "@/src/axiosConfig";
import { Tent, MapPin, Phone, ExternalLink, ArrowRight } from "lucide-react";

export default function NearbyCampingStrip({
  lat,
  lng,
  keyword,
  radiusM = 20_000,
  limit = 6,
  title,
  subtitle,
  accent = "#22c55e",
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

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
          ? `/api/v1/camping/nearby`
          : `/api/v1/camping/search`;
        const params = useCoords
          ? { lat, lon: lng, radius: radiusM, limit }
          : { q: keyword.trim(), limit };
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
  }, [useCoords, useKeyword, lat, lng, keyword, radiusM, limit]);

  // 데이터 없으면 섹션 전체 숨김 (UX 공백 방지)
  if (!loading && !errored && items.length === 0) return null;
  if (!useCoords && !useKeyword) return null;

  const allHref = useCoords
    ? `/camping?nearby=true`
    : `/camping?q=${encodeURIComponent(keyword || "")}`;

  return (
    <section className="ncs-section" aria-label={title || t("nearbyCamping.title")}>
      <style>{cssBlock}</style>
      <div className="ncs-header">
        <div className="ncs-head-left">
          <Tent size={16} style={{ color: accent }} />
          <h3 className="ncs-title">
            {title || t("nearbyCamping.title")}
            {!loading && items.length > 0 && (
              <span className="ncs-total" style={{ color: "#dc2626" }}>
                ({t("nearbyCamping.totalCount", { count: items.length })})
              </span>
            )}
          </h3>
        </div>
        <Link href={allHref} className="ncs-all" style={{ color: accent }}>
          {t("nearbyCamping.viewAll")} <ArrowRight size={14} />
        </Link>
      </div>
      {subtitle && <p className="ncs-sub">{subtitle}</p>}

      <div className="ncs-scroll">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={`sk-${i}`} className="ncs-card ncs-sk">
                <div className="ncs-img ncs-sk-img" />
                <div className="ncs-body">
                  <div className="ncs-sk-line ncs-sk-line-lg" />
                  <div className="ncs-sk-line" />
                </div>
              </div>
            ))
          : items.map((s) => (
              <CampingMiniCard key={s.id} site={s} />
            ))}
      </div>
    </section>
  );
}

function CampingMiniCard({ site }) {
  const { t } = useTranslation();
  return (
    <article className="ncs-card">
      <div className="ncs-img">
        {site.imageUrl ? (
          <img
            src={site.imageUrl}
            alt={site.name || ""}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="ncs-img-placeholder">
            <Tent size={28} />
          </div>
        )}
        {site.distanceKm != null && (
          <span className="ncs-dist">
            {site.distanceKm < 1
              ? `${Math.round(site.distanceKm * 1000)}m`
              : `${site.distanceKm.toFixed(1)}km`}
          </span>
        )}
      </div>
      <div className="ncs-body">
        <div className="ncs-ctitle" title={site.name || ""}>{site.name}</div>
        {site.induty && <div className="ncs-induty">{site.induty}</div>}
        {site.address && (
          <div className="ncs-meta">
            <MapPin size={11} />
            <span>{site.address}</span>
          </div>
        )}
        <div className="ncs-meta ncs-meta-sub">
          <Phone size={11} />
          <span>{site.tel || t("nearbyCamping.phoneNone")}</span>
        </div>
        {site.homepage && (
          <a
            href={site.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="ncs-home"
            onClick={(e) => e.stopPropagation()}
          >
            {t("nearbyCamping.homepage")} <ExternalLink size={10} />
          </a>
        )}
      </div>
    </article>
  );
}

const cssBlock = `
.ncs-section { margin: 20px 0 8px; }
.ncs-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 8px; gap: 10px;
}
.ncs-head-left { display: inline-flex; align-items: center; gap: 6px; }
.ncs-title {
  display: inline-flex; align-items: center; gap: 6px;
  margin: 0; font-size: 1.05rem; font-weight: 700; color: inherit;
}
.ncs-total { font-size: 0.85rem; font-weight: 700; }
.ncs-all {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.82rem; font-weight: 600; text-decoration: none;
  transition: transform 0.15s ease;
}
.ncs-all:hover { transform: translateX(3px); }
.ncs-sub { margin: -2px 4px 10px; font-size: 0.82rem; color: #9aa0a6; }

.ncs-scroll {
  display: flex; flex-wrap: nowrap;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 4px 14px;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}
.ncs-scroll::-webkit-scrollbar { height: 6px; }
.ncs-scroll::-webkit-scrollbar-thumb {
  background: rgba(34,197,94,0.35); border-radius: 3px;
}

.ncs-card {
  flex: 0 0 240px;
  scroll-snap-align: start;
  background: rgba(20,24,22,0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; overflow: hidden;
  color: #f1f1f1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  display: flex; flex-direction: column;
}
.ncs-card:hover {
  transform: translateY(-2px);
  border-color: rgba(34, 197, 94, 0.35);
  box-shadow: 0 10px 22px rgba(0,0,0,0.38);
}
.ncs-img {
  position: relative; width: 100%; padding-top: 60%;
  background: #0e0e0e; overflow: hidden;
}
.ncs-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ncs-img-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.25);
  background: linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%);
}
.ncs-dist {
  position: absolute; top: 8px; left: 8px;
  background: rgba(34, 197, 94, 0.85); color: #042f1c;
  font-size: 0.7rem; font-weight: 800;
  padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(6px);
}

.ncs-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; }
.ncs-ctitle {
  font-size: 0.92rem; font-weight: 700; line-height: 1.3;
  color: #fff; overflow: hidden;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.ncs-induty { font-size: 0.72rem; color: #86efac; }
.ncs-meta {
  font-size: 0.76rem; color: #c6c6c6;
  display: inline-flex; gap: 4px; align-items: flex-start; line-height: 1.35;
}
.ncs-meta-sub { color: #9ba3a0; }
.ncs-home {
  display: inline-flex; align-items: center; gap: 3px;
  color: #7dd3fc; font-size: 0.74rem; text-decoration: none; margin-top: 2px;
}
.ncs-home:hover { color: #bae6fd; }

.ncs-sk { cursor: default; }
.ncs-sk-img, .ncs-sk-line {
  background: linear-gradient(90deg, #202320 0%, #2c302d 50%, #202320 100%);
  background-size: 200% 100%;
  animation: ncs-shine 1.4s linear infinite;
  border-radius: 6px;
}
.ncs-sk-img { position: absolute; inset: 0; }
.ncs-sk-line { height: 9px; margin-top: 5px; width: 70%; }
.ncs-sk-line-lg { height: 13px; width: 85%; }
@keyframes ncs-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
