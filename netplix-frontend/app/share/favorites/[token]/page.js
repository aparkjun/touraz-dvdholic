"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { fetchFavoritesShare } from "@/lib/userFavoritesHub";
import { Heart } from "lucide-react";

export default function SharedFavoritesPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [hub, setHub] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetchFavoritesShare(token)
      .then(setHub)
      .catch(() => setError(t("favoritesHub.shareError")));
  }, [token, t]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #581c87 50%, #831843 100%)",
        padding: "32px 20px",
        color: "#f1f5f9",
      }}
    >
      <h1 style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Heart size={28} /> {t("favoritesHub.shareTitle")}
      </h1>
      {error && <p>{error}</p>}
      {!hub && !error && <p>{t("mypage.loadingLiked")}</p>}
      {hub?.stats && (
        <p style={{ marginBottom: 16, color: "#94a3b8" }}>
          {t("favoritesHub.statMovies", { count: hub.stats.movieCount })} ·{" "}
          {t("favoritesHub.statRegions", { count: hub.stats.totalRegions })}
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
        {(hub?.movies ?? []).map((card) => (
          <article
            key={`${card.movie?.movieName}-${card.contentType}`}
            style={{
              borderRadius: 12,
              overflow: "hidden",
              background: "rgba(255,255,255,0.08)",
            }}
          >
            <img
              src={
                card.movie?.posterPath
                  ? `https://image.tmdb.org/t/p/w342${card.movie.posterPath}`
                  : "/no-poster-placeholder.png"
              }
              alt=""
              style={{ width: "100%", height: 200, objectFit: "cover" }}
            />
            <p style={{ padding: 10, margin: 0, fontSize: 14, fontWeight: 600 }}>
              {card.movie?.movieName}
            </p>
            {card.memo && (
              <p style={{ padding: "0 10px 10px", margin: 0, fontSize: 12, color: "#94a3b8" }}>
                {card.memo}
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
