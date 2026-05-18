"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Heart,
  MapPin,
  Camera,
  Headphones,
  Clapperboard,
  Share2,
  Route,
  Bell,
  Tag,
  Check,
  Sparkles,
  Stethoscope,
  Filter,
} from "lucide-react";
import {
  fetchFavoritesHub,
  patchFavoriteMeta,
  setVisit,
  syncTravelFavorites,
  createFavoritesShare,
  fetchFavoriteCourse,
  fetchFavoriteRecommendations,
  syncFavoriteNotifications,
  shareUrlFromToken,
  medicalToTravelSyncItems,
  kakaoMapRegionUrl,
} from "@/lib/userFavoritesHub";

const VOTE_FILTERS = ["like", "all", "meh", "unlike"];
const SORT_OPTIONS = [
  { id: "sortOrder", labelKey: "favoritesHub.sortOrder" },
  { id: "title", labelKey: "favoritesHub.sortTitle" },
  { id: "regions", labelKey: "favoritesHub.sortRegions" },
];

function posterUrl(movie) {
  if (!movie?.posterPath) return "/no-poster-placeholder.png";
  return `https://image.tmdb.org/t/p/w342${movie.posterPath}`;
}

export default function LikedMoviesHub() {
  const { t } = useTranslation();
  const router = useRouter();
  const [vote, setVote] = useState("like");
  const [sort, setSort] = useState("sortOrder");
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(false);
  const [recs, setRecs] = useState([]);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const [shareMsg, setShareMsg] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [activeTab, setActiveTab] = useState("movies");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await syncTravelFavorites(medicalToTravelSyncItems());
      const data = await fetchFavoritesHub(vote, sort);
      setHub(data);
      const recommendations = await fetchFavoriteRecommendations();
      setRecs(recommendations);
    } catch (e) {
      console.error("favorites hub", e);
    } finally {
      setLoading(false);
    }
  }, [vote, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = hub?.stats;
  const movies = hub?.movies ?? [];
  const travel = hub?.travel ?? [];

  const allSpots = useMemo(() => {
    const list = [];
    for (const card of movies) {
      for (const spot of card.spots ?? []) {
        list.push({ ...spot, movieName: card.movie?.movieName, contentType: card.contentType });
      }
    }
    return list;
  }, [movies]);

  const visitProgress = useMemo(() => {
    if (!allSpots.length) return 0;
    const v = allSpots.filter((s) => s.visited).length;
    return Math.round((v / allSpots.length) * 100);
  }, [allSpots]);

  const toggleSelectMovie = (name) => {
    setSelectedMovies((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : prev.length < 5 ? [...prev, name] : prev
    );
  };

  const runCourse = async () => {
    setCourseLoading(true);
    try {
      const names = selectedMovies.length ? selectedMovies : movies.map((m) => m.movie?.movieName).filter(Boolean);
      setCourse(await fetchFavoriteCourse(names));
    } finally {
      setCourseLoading(false);
    }
  };

  const saveMeta = async (card, patch) => {
    const movieId = card.movie?.movieName;
    if (!movieId) return;
    await patchFavoriteMeta(movieId, {
      contentType: card.contentType || "dvd",
      ...patch,
    });
    load();
  };

  const toggleVisit = async (visitKey, visited) => {
    await setVisit(visitKey, !visited);
    load();
  };

  const addTagToCard = async (card) => {
    const tag = tagInput.trim();
    if (!tag) return;
    const tags = [...new Set([...(card.tags ?? []), tag])];
    await saveMeta(card, { tags });
    setTagInput("");
  };

  const onShare = async () => {
    const token = await createFavoritesShare();
    if (!token) return;
    const url = shareUrlFromToken(token);
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg(t("favoritesHub.shareCopied"));
    } catch {
      setShareMsg(url);
    }
    setTimeout(() => setShareMsg(""), 4000);
  };

  const onNotifySync = async () => {
    const sent = await syncFavoriteNotifications();
    setShareMsg(t("favoritesHub.notifySynced", { count: sent }));
    setTimeout(() => setShareMsg(""), 4000);
  };

  if (loading && !hub) {
    return (
      <p style={{ color: "rgba(148,163,184,1)", textAlign: "center", padding: 24 }}>
        {t("mypage.loadingLiked")}
      </p>
    );
  }

  return (
    <div className="fav-hub">
      <style>{hubCss}</style>

      {stats && (
        <div className="fav-hub-stats">
          <span>{t("favoritesHub.statMovies", { count: stats.movieCount })}</span>
          <span>·</span>
          <span>{t("favoritesHub.statRegions", { count: stats.totalRegions })}</span>
          <span>·</span>
          <span>{t("favoritesHub.statVisited", { count: stats.visitedCount, pct: visitProgress })}</span>
        </div>
      )}

      <div className="fav-hub-toolbar">
        <div className="fav-hub-filters">
          <Filter size={16} aria-hidden />
          {VOTE_FILTERS.map((v) => (
            <button
              key={v}
              type="button"
              className={`fav-pill ${vote === v ? "fav-pill--on" : ""}`}
              onClick={() => setVote(v)}
            >
              {t(`favoritesHub.vote_${v}`)}
            </button>
          ))}
        </div>
        <select
          className="fav-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label={t("favoritesHub.sortLabel")}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.labelKey)}
            </option>
          ))}
        </select>
        <button type="button" className="fav-action" onClick={onShare}>
          <Share2 size={16} /> {t("favoritesHub.share")}
        </button>
        <button type="button" className="fav-action" onClick={onNotifySync}>
          <Bell size={16} /> {t("favoritesHub.notify")}
        </button>
      </div>
      {shareMsg && <p className="fav-msg">{shareMsg}</p>}

      <div className="fav-tabs">
        {["movies", "travel", "map", "course", "recs"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`fav-tab ${activeTab === tab ? "fav-tab--on" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`favoritesHub.tab_${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === "movies" && (
        <>
          {movies.length === 0 ? (
            <div className="fav-empty">
              <Heart size={40} />
              <p>{t("mypage.noLiked")}</p>
            </div>
          ) : (
            <div className="fav-grid">
              {movies.map((card) => {
                const name = card.movie?.movieName;
                const ct = card.contentType || "dvd";
                const selected = selectedMovies.includes(name);
                return (
                  <article key={`${name}-${ct}`} className="fav-card">
                    <button
                      type="button"
                      className={`fav-select ${selected ? "fav-select--on" : ""}`}
                      onClick={() => toggleSelectMovie(name)}
                      title={t("favoritesHub.pickForCourse")}
                    >
                      {selected ? <Check size={14} /> : null}
                    </button>
                    <button
                      type="button"
                      className="fav-poster"
                      onClick={() =>
                        router.push(
                          `/dashboard/images?movieName=${encodeURIComponent(name)}&contentType=${ct}`
                        )
                      }
                    >
                      <img src={posterUrl(card.movie)} alt="" />
                    </button>
                    <div className="fav-card-body">
                      <h3>{name}</h3>
                      <p className="fav-meta">
                        {t("favoritesHub.regions", { count: card.regionCount })}
                        {card.visitedCount > 0 &&
                          ` · ${t("favoritesHub.visitedShort", { count: card.visitedCount })}`}
                      </p>
                      <label className="fav-field">
                        <span>{t("favoritesHub.memo")}</span>
                        <input
                          type="text"
                          defaultValue={card.memo || ""}
                          placeholder={t("favoritesHub.memoPh")}
                          onBlur={(e) => {
                            if (e.target.value !== (card.memo || "")) {
                              saveMeta(card, { memo: e.target.value });
                            }
                          }}
                        />
                      </label>
                      <label className="fav-field">
                        <span>{t("favoritesHub.planned")}</span>
                        <input
                          type="date"
                          defaultValue={card.plannedDate || ""}
                          onChange={(e) =>
                            saveMeta(card, {
                              plannedDate: e.target.value || null,
                              clearPlannedDate: !e.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="fav-tags">
                        {(card.tags ?? []).map((tag) => (
                          <span key={tag} className="fav-tag">
                            <Tag size={10} /> {tag}
                          </span>
                        ))}
                        <input
                          type="text"
                          className="fav-tag-add"
                          placeholder={t("favoritesHub.tagPh")}
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTagToCard(card);
                            }
                          }}
                        />
                      </div>
                      <div className="fav-links">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/cine-trip?movie=${encodeURIComponent(name)}`)
                          }
                        >
                          <Clapperboard size={14} /> {t("favoritesHub.linkCine")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/photo-gallery?q=${encodeURIComponent(name)}`)
                          }
                        >
                          <Camera size={14} /> {t("favoritesHub.linkPhotos")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/audio-guide?q=${encodeURIComponent(name)}`)
                          }
                        >
                          <Headphones size={14} /> {t("favoritesHub.linkAudio")}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "travel" && (
        <div className="fav-travel">
          <p className="fav-travel-hint">{t("favoritesHub.travelHint")}</p>
          {travel.length === 0 ? (
            <p className="fav-muted">{t("favoritesHub.travelEmpty")}</p>
          ) : (
            <ul>
              {travel.map((item) => {
                let snap = {};
                try {
                  snap = JSON.parse(item.snapshotJson || "{}");
                } catch {
                  /* noop */
                }
                return (
                  <li key={`${item.itemType}-${item.itemId}`}>
                    <Stethoscope size={16} />
                    <span>{snap.name || item.itemId}</span>
                    {snap.address && <small>{snap.address}</small>}
                    <button
                      type="button"
                      onClick={() => router.push("/medical-tourism")}
                    >
                      {t("favoritesHub.open")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {activeTab === "map" && (
        <div className="fav-map">
          <p className="fav-muted">{t("favoritesHub.mapHint")}</p>
          {allSpots.length === 0 ? (
            <p>{t("favoritesHub.noSpots")}</p>
          ) : (
            <ul className="fav-spot-list">
              {allSpots.map((spot) => (
                <li key={spot.visitKey}>
                  <label>
                    <input
                      type="checkbox"
                      checked={spot.visited}
                      onChange={() => toggleVisit(spot.visitKey, spot.visited)}
                    />
                    <span>
                      <strong>{spot.regionName}</strong>
                      <small>
                        {spot.movieName} · {spot.mappingType}
                      </small>
                    </span>
                  </label>
                  <a
                    href={kakaoMapRegionUrl(spot.regionName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fav-map-link"
                  >
                    <MapPin size={14} /> {t("favoritesHub.mapOpen")}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === "course" && (
        <div className="fav-course">
          <p>{t("favoritesHub.courseHint")}</p>
          <button type="button" className="fav-primary" onClick={runCourse} disabled={courseLoading}>
            <Route size={16} />
            {courseLoading ? t("favoritesHub.loading") : t("favoritesHub.courseBtn")}
          </button>
          {course && (
            <>
              <p className="fav-course-summary">{course.summary}</p>
              <ol>
                {(course.stops ?? []).map((stop, i) => (
                  <li key={`${stop.areaCode}-${i}`}>
                    <span className="fav-stop-num">{i + 1}</span>
                    <div>
                      <strong>{stop.regionName}</strong>
                      <small>
                        {stop.movieName} · {stop.mappingType}
                      </small>
                      {stop.evidence && <p>{stop.evidence}</p>}
                      <a href={kakaoMapRegionUrl(stop.regionName)} target="_blank" rel="noopener noreferrer">
                        {t("favoritesHub.mapOpen")}
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {activeTab === "recs" && (
        <div className="fav-recs">
          <p className="fav-muted">
            <Sparkles size={16} /> {t("favoritesHub.recsHint")}
          </p>
          <div className="fav-rec-grid">
            {recs.map((m) => (
              <button
                key={m.movieName}
                type="button"
                className="fav-rec-card"
                onClick={() =>
                  router.push(
                    `/dashboard/images?movieName=${encodeURIComponent(m.movieName)}&contentType=movie`
                  )
                }
              >
                <img src={posterUrl(m)} alt="" />
                <span>{m.movieName}</span>
              </button>
            ))}
          </div>
          {recs.length === 0 && <p>{t("favoritesHub.recsEmpty")}</p>}
        </div>
      )}
    </div>
  );
}

const hubCss = `
.fav-hub { color: #f1f5f9; }
.fav-hub-stats {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
  padding: 12px 16px; margin-bottom: 12px;
  background: rgba(255,255,255,0.06); border-radius: 12px; font-size: 0.9rem;
}
.fav-hub-toolbar {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px;
}
.fav-hub-filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.fav-pill {
  padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(236,72,153,0.35);
  background: transparent; color: #e2e8f0; font-size: 0.8rem; cursor: pointer;
}
.fav-pill--on { background: linear-gradient(135deg,#ec4899,#8b5cf6); border-color: transparent; }
.fav-sort {
  padding: 6px 10px; border-radius: 8px; background: rgba(0,0,0,0.35);
  color: #fff; border: 1px solid rgba(255,255,255,0.15);
}
.fav-action {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(236,72,153,0.4);
  background: rgba(236,72,153,0.12); color: #fbcfe8; cursor: pointer; font-size: 0.82rem;
}
.fav-msg { color: #67e8f9; font-size: 0.85rem; margin: 0 0 8px; }
.fav-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.fav-tab {
  padding: 8px 14px; border-radius: 10px; border: none;
  background: rgba(255,255,255,0.06); color: #cbd5e1; cursor: pointer; font-size: 0.85rem;
}
.fav-tab--on { background: linear-gradient(135deg,rgba(236,72,153,0.35),rgba(139,92,246,0.35)); color: #fff; }
.fav-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}
.fav-card {
  position: relative; border-radius: 16px; overflow: hidden;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(236,72,153,0.2);
}
.fav-select {
  position: absolute; top: 8px; left: 8px; z-index: 2;
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.6); background: rgba(0,0,0,0.4);
  color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.fav-select--on { background: #10b981; border-color: #10b981; }
.fav-poster { width: 100%; padding: 0; border: none; cursor: pointer; display: block; }
.fav-poster img { width: 100%; height: 180px; object-fit: cover; display: block; }
.fav-card-body { padding: 12px; }
.fav-card-body h3 { margin: 0 0 6px; font-size: 1rem; }
.fav-meta { font-size: 0.78rem; color: #94a3b8; margin: 0 0 8px; }
.fav-field { display: block; margin-bottom: 8px; font-size: 0.75rem; color: #94a3b8; }
.fav-field input {
  display: block; width: 100%; margin-top: 4px; padding: 6px 8px;
  border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.25); color: #fff; font-size: 0.85rem;
}
.fav-tags { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 8px; }
.fav-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 999px; background: rgba(139,92,246,0.25); font-size: 0.72rem;
}
.fav-tag-add {
  flex: 1; min-width: 80px; padding: 4px 8px; border-radius: 8px;
  border: 1px dashed rgba(255,255,255,0.2); background: transparent; color: #fff; font-size: 0.75rem;
}
.fav-links { display: flex; flex-wrap: wrap; gap: 6px; }
.fav-links button {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.2); color: #e2e8f0; font-size: 0.72rem; cursor: pointer;
}
.fav-empty { text-align: center; padding: 40px; color: #94a3b8; }
.fav-travel ul { list-style: none; padding: 0; margin: 0; }
.fav-travel li {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 12px; margin-bottom: 8px; border-radius: 12px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
}
.fav-travel li small { color: #94a3b8; flex: 1 1 100%; }
.fav-travel button {
  margin-left: auto; padding: 4px 10px; border-radius: 8px;
  border: 1px solid rgba(236,72,153,0.4); background: transparent; color: #f9a8d4; cursor: pointer;
}
.fav-muted { color: #94a3b8; font-size: 0.85rem; }
.fav-spot-list { list-style: none; padding: 0; margin: 0; }
.fav-spot-list li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px; margin-bottom: 6px; border-radius: 10px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
}
.fav-spot-list label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; flex: 1; }
.fav-spot-list strong { display: block; }
.fav-spot-list small { color: #94a3b8; }
.fav-map-link {
  display: inline-flex; align-items: center; gap: 4px; color: #67e8f9; font-size: 0.8rem;
  text-decoration: none; white-space: nowrap;
}
.fav-primary {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 10px; border: none; cursor: pointer;
  background: linear-gradient(135deg,#ec4899,#8b5cf6); color: #fff; font-weight: 600;
}
.fav-course ol { list-style: none; padding: 0; margin: 16px 0 0; }
.fav-course li {
  display: flex; gap: 12px; padding: 12px; margin-bottom: 8px;
  background: rgba(255,255,255,0.05); border-radius: 12px;
}
.fav-stop-num {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: #8b5cf6; display: flex; align-items: center; justify-content: center; font-weight: 700;
}
.fav-rec-grid {
  display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;
}
.fav-rec-card {
  flex: 0 0 120px; border: none; padding: 0; background: transparent; cursor: pointer; text-align: center; color: #fff;
}
.fav-rec-card img { width: 120px; height: 170px; object-fit: cover; border-radius: 12px; }
.fav-rec-card span { display: block; font-size: 0.75rem; margin-top: 6px; }
`;
