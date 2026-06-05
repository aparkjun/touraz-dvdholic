'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

/** 대시보드(AI 추천 등)와 동일: 처음 10개, 더보기 클릭 시 10개씩 추가 */
const PAGE_SIZE = 10;

export default function BatchNotificationPosters({ title, message, relatedId }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!relatedId) return null;
  let movies;
  try {
    movies = typeof relatedId === "string" ? JSON.parse(relatedId) : relatedId;
  } catch {
    return null;
  }
  if (!Array.isArray(movies) || movies.length === 0) return null;

  const ct = (title || "").includes("DVD") ? "dvd" : "movie";

  const parsedCount = (() => {
    if (!message) return null;
    const m = message.match(/(\d+)\s*편/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const totalCount = parsedCount && parsedCount >= movies.length ? parsedCount : movies.length;

  const display = movies.slice(0, visibleCount);
  const hasMore = visibleCount < movies.length;
  const nextBatch = hasMore ? Math.min(PAGE_SIZE, movies.length - visibleCount) : 0;

  const renderPoster = (m, i) => {
    const poster = m.poster && String(m.poster).trim() !== "";
    const posterSrc = poster ? `https://image.tmdb.org/t/p/w185${m.poster}` : null;
    return (
      <div
        key={i}
        style={{ flex: "0 0 auto", width: "80px", textAlign: "center", cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/dashboard/images?movieName=${encodeURIComponent(m.name)}&contentType=${ct}`);
        }}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={m.name}
            style={{
              width: "80px",
              height: "120px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <img
            src="/no-poster-placeholder.png"
            alt={m.name || "No Image"}
            style={{
              width: "80px",
              height: "120px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
            }}
          />
        )}
        <p
          style={{
            color: "rgba(200,200,220,0.85)",
            fontSize: "11px",
            marginTop: "4px",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.name}
        </p>
      </div>
    );
  };

  return (
    <div style={{ paddingTop: "14px" }}>
      <div
        className="dashboard-scroll-row js-drag-scroll"
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          paddingBottom: "6px",
          WebkitOverflowScrolling: "touch",
          flexWrap: "nowrap",
        }}
      >
        {display.map((m, i) => renderPoster(m, i))}
        {hasMore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setVisibleCount((v) => Math.min(v + PAGE_SIZE, movies.length));
            }}
            style={{
              flex: "0 0 auto",
              width: "80px",
              minWidth: "80px",
              height: "148px",
              margin: 0,
              padding: "6px 4px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(244, 114, 182, 0.95)",
              fontSize: "11px",
              fontWeight: 700,
              gap: "4px",
              lineHeight: 1.2,
            }}
          >
            <span>{t("dashboard.showMoreArrow")}</span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "rgba(244, 182, 210, 0.9)" }}>
              {display.length} / {totalCount}
            </span>
          </button>
        )}
        <div style={{ flex: "1 1 0", minWidth: "12px", flexShrink: 0 }} aria-hidden="true" />
      </div>
    </div>
  );
}
