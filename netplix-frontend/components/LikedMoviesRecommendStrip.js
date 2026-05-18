"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { fetchFavoriteRecommendations } from "@/lib/userFavoritesHub";

export default function LikedMoviesRecommendStrip() {
  const { t } = useTranslation();
  const router = useRouter();
  const [recs, setRecs] = useState([]);

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    fetchFavoriteRecommendations()
      .then(setRecs)
      .catch(() => setRecs([]));
  }, []);

  if (!recs.length) return null;

  return (
    <section style={{ margin: "24px 0", padding: "0 4px" }}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "1.1rem",
          marginBottom: 12,
          color: "#f1f5f9",
        }}
      >
        <Sparkles size={20} /> {t("favoritesHub.dashboardRecs")}
      </h2>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {recs.slice(0, 10).map((m) => (
          <button
            key={m.movieName}
            type="button"
            onClick={() =>
              router.push(
                `/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=movie`
              )
            }
            style={{
              flex: "0 0 100px",
              border: "none",
              padding: 0,
              background: "transparent",
              cursor: "pointer",
              textAlign: "center",
              color: "#fff",
            }}
          >
            <img
              src={
                m.posterPath
                  ? `https://image.tmdb.org/t/p/w342${m.posterPath}`
                  : "/no-poster-placeholder.png"
              }
              alt=""
              style={{ width: 100, height: 150, objectFit: "cover", borderRadius: 10 }}
            />
            <span style={{ fontSize: 11, display: "block", marginTop: 6 }}>{m.movieName}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
