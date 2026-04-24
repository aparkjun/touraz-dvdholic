'use client';
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Undo2 } from "lucide-react";
import axios from "@/lib/axiosConfig";
import { getMovieTitle, getPosterPath, getBackdropPath, getOverview, getTagline } from "@/lib/movieLang";
import CineTripCTA from "@/components/CineTripCTA";
import PhotoGalleryStrip from "@/components/PhotoGalleryStrip";
import TourGallerySection from "@/components/TourGallerySection";
import NearbyCampingStrip from "@/components/NearbyCampingStrip";

const baseUrl = "https://image.tmdb.org/t/p/original";
const palette = {
  text: "var(--ds-text)",
  textMuted: "var(--ds-text-muted)",
  border: "var(--ds-border)",
  panel: "var(--ds-panel)",
};

function ReviewCard({ review, palette, movieName, ct, onHelpful }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [localCount, setLocalCount] = useState(review.helpfulCount || 0);
  const [liked, setLiked] = useState(false);
  const hasFullReview = review.fullReview && review.fullReview.trim() !== "";

  const handleHelpful = async () => {
    if (liked) return;
    try {
      await axios.post(`/api/v1/movie/${encodeURIComponent(movieName)}/review/${review.reviewId}/helpful`);
      setLocalCount((c) => c + 1);
      setLiked(true);
      if (onHelpful) onHelpful();
    } catch {}
  };

  return (
    <div style={{
      padding: "12px 14px",
      marginBottom: "8px",
      backgroundColor: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      backdropFilter: "blur(12px)",
      transition: "background-color 0.2s",
    }}>
      {review.oneLiner && (
        <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "14px", fontWeight: 600, margin: "0 0 6px", wordBreak: "keep-all" }}>
          &ldquo;{review.oneLiner}&rdquo;
        </p>
      )}
      {hasFullReview && (
        <>
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            style={{
              padding: "5px 10px",
              background: "rgba(255,107,107,0.12)",
              border: "1px solid rgba(255,107,107,0.25)",
              borderRadius: "6px",
              color: "#ff8e6b",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {open ? t("movieImages.collapseReview") : t("movieImages.expandReview")}
          </button>
          {open && (
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: 1.7, margin: "8px 0 0", whiteSpace: "pre-line", wordBreak: "keep-all" }}>
              {review.fullReview}
            </p>
          )}
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
        <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}>
          {review.userId?.startsWith("anon_") ? t("movieImages.anonymous") : review.userId}
        </span>
        <button
          type="button"
          onClick={handleHelpful}
          disabled={liked}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 10px",
            background: liked ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${liked ? "rgba(255,107,107,0.35)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "8px",
            color: liked ? "#ff6b6b" : "rgba(255,255,255,0.4)",
            fontSize: "12px",
            fontWeight: 700,
            cursor: liked ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {liked ? "❤️" : "🤍"} {t("movieImages.helpful")} {localCount > 0 && localCount}
        </button>
      </div>
    </div>
  );
}

function MovieImagesContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const movieNameParam = searchParams.get("movieName");
  const contentTypeParam = searchParams.get("contentType") || "dvd";

  const [movie, setMovie] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    if (!movieNameParam) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    axios.get(`/api/v1/movie/${encodeURIComponent(movieNameParam)}/detail`)
      .then((res) => {
        if (res.data?.success && res.data.data) {
          setMovie({ ...res.data.data, contentType: contentTypeParam });
        }
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [movieNameParam, contentTypeParam]);

  const [likeCount, setLikeCount] = useState(0);
  const [unlikeCount, setUnlikeCount] = useState(0);
  const [mehCount, setMehCount] = useState(0);
  const [myVote, setMyVote] = useState(null);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [voteFeedback, setVoteFeedback] = useState(null);
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewOneLiner, setReviewOneLiner] = useState("");
  const [reviewFull, setReviewFull] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSort, setReviewSort] = useState("newest");
  const [reviewMsg, setReviewMsg] = useState(null);

  const movieName = movie?.movieName;
  const displayName = movie ? getMovieTitle(movie) : null;
  const posterPath = movie ? getPosterPath(movie) : null;
  const backdropPath = movie ? getBackdropPath(movie) : null;
  const contentType = movie?.contentType || "dvd";
  const ct = contentType;

  const hasPoster = !!posterPath;
  const hasBackdrop = !!backdropPath;
  const [activeTab, setActiveTab] = useState(hasPoster ? "poster" : "backdrop");

  useEffect(() => {
    if (hasPoster) setActiveTab("poster");
    else if (hasBackdrop) setActiveTab("backdrop");
  }, [hasPoster, hasBackdrop]);

  const refreshCounts = async (noCache = false) => {
    if (!movieName) return;
    const suffix = noCache ? `&_=${Date.now()}` : "";
    const results = await Promise.allSettled([
      axios.get(`/api/v1/movie/${encodeURIComponent(movieName)}/like-count?contentType=${ct}${suffix}`),
      axios.get(`/api/v1/movie/${encodeURIComponent(movieName)}/unlike-count?contentType=${ct}${suffix}`),
      axios.get(`/api/v1/movie/${encodeURIComponent(movieName)}/meh-count?contentType=${ct}${suffix}`),
      axios.get(`/api/v1/movie/${encodeURIComponent(movieName)}/my-vote?contentType=${ct}${suffix}`),
    ]);
    const likeVal = results[0].status === "fulfilled" && results[0].value.data?.success ? results[0].value.data.data : 0;
    const unlikeVal = results[1].status === "fulfilled" && results[1].value.data?.success ? results[1].value.data.data : 0;
    const mehVal = results[2].status === "fulfilled" && results[2].value.data?.success ? results[2].value.data.data : 0;
    const mv = results[3].status === "fulfilled" && results[3].value.data?.success ? results[3].value.data.data : null;
    setLikeCount(likeVal);
    setUnlikeCount(unlikeVal);
    setMehCount(mehVal);
    setMyVote(mv);
  };

  const showFeedback = (msg) => {
    setVoteFeedback(msg);
    setTimeout(() => setVoteFeedback(null), 2500);
  };

  useEffect(() => {
    if (!movieName) return;
    refreshCounts();
  }, [movieName, ct]);

  const loadReviews = async (sort) => {
    if (!movieName) return;
    const s = sort || reviewSort;
    try {
      const res = await axios.get(`/api/v1/movie/${encodeURIComponent(movieName)}/reviews?contentType=${ct}&sort=${s}`);
      if (res.data?.success) setReviews(res.data.data || []);
    } catch {}
  };

  useEffect(() => { loadReviews(); }, [movieName, ct, reviewSort]);

  const submitReview = async () => {
    if (!movieName) return;
    if (!reviewOneLiner.trim() && !reviewFull.trim()) {
      setReviewMsg(t("movieImages.reviewRequired"));
      setTimeout(() => setReviewMsg(null), 2500);
      return;
    }
    setReviewSaving(true);
    setReviewMsg(null);
    try {
      await axios.post(
        `/api/v1/movie/${encodeURIComponent(movieName)}/review?contentType=${ct}`,
        { oneLiner: reviewOneLiner.trim(), fullReview: reviewFull.trim(), isSpoiler: false }
      );
      setReviewOneLiner("");
      setReviewFull("");
      setReviewMsg(t("movieImages.reviewSubmitted"));
      setTimeout(() => setReviewMsg(null), 2500);
      await loadReviews();
    } catch (e) {
      setReviewMsg(t("movieImages.reviewSaveFailed", { msg: e.response?.data?.message || e.message }));
      setTimeout(() => setReviewMsg(null), 3000);
    } finally {
      setReviewSaving(false);
    }
  };

  const like = async () => {
    if (!movieName) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      await axios.post(`/api/v1/movie/${encodeURIComponent(movieName)}/like?contentType=${ct}`);
      await refreshCounts(true);
    } catch (e) {
      console.error("좋아요 실패:", e);
      const msg = e.response?.data?.message || e.message || t("movieImages.requestFailed");
      setVoteError(t("movieImages.likeFailed", { msg }));
    } finally {
      setVoteLoading(false);
    }
  };
  const unlike = async () => {
    if (!movieName) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      await axios.post(`/api/v1/movie/${encodeURIComponent(movieName)}/unlike?contentType=${ct}`);
      await refreshCounts(true);
    } catch (e) {
      console.error("싫어요 실패:", e);
      const msg = e.response?.data?.message || e.message || t("movieImages.requestFailed");
      setVoteError(t("movieImages.unlikeFailed", { msg }));
    } finally {
      setVoteLoading(false);
    }
  };

  const meh = async () => {
    if (!movieName) return;
    setVoteError(null);
    setVoteLoading(true);
    try {
      await axios.post(`/api/v1/movie/${encodeURIComponent(movieName)}/meh?contentType=${ct}`);
      await refreshCounts(true);
    } catch (e) {
      console.error("꿀꿀해 실패:", e);
      const msg = e.response?.data?.message || e.message || t("movieImages.requestFailed");
      setVoteError(t("movieImages.mehFailed", { msg }));
    } finally {
      setVoteLoading(false);
    }
  };

  const getYouTubeUrl = (m) => {
    if (!m) return "";
    if (m.trailerUrl && String(m.trailerUrl).trim() !== "") return m.trailerUrl;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent((m.movieName || "") + " " + t("movieImages.trailer"))}`;
  };

  const isCorruptedKorean = (text) => {
    if (!text) return false;
    return /[\u4E00-\u9FFF]/.test(text);
  };

  const getDisplayOverview = (overview) => {
    const noDesc = ct === "movie" ? t("movieImages.noOverviewMovie") : t("movieImages.noOverviewDvd");
    if (!overview || overview.trim() === "" || overview === "No description available.") return noDesc;
    if (isCorruptedKorean(overview)) return noDesc;
    return overview;
  };

  const formatGenreForDisplay = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    if (raw.length <= 28) return raw;
    return raw.split(",").map((i) => i.trim()).filter(Boolean).join(",\n");
  };

  const getOneLineMeta = (m) => {
    if (!m) return "";
    const parts = [];
    const year = (m.releaseDate || m.releasedAt || "").slice(0, 4);
    if (year) parts.push(year);
    if (m.runtime) parts.push(`${m.runtime}${t("movieImages.min")}`);
    if (m.certification) parts.push(m.certification);
    return parts.join(" · ");
  };

  const isRecentRelease = (m) => {
    const dateStr = m?.releaseDate || m?.releasedAt || "";
    const year = parseInt(dateStr.slice(0, 4), 10);
    return !isNaN(year) && year >= new Date().getFullYear() - 1;
  };

  const formatVoteCount = (n) => {
    if (!n || n <= 0) return null;
    if (n >= 10000) return `${(n / 10000).toFixed(1)}${t("movieImages.tenThousand")}`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}${t("movieImages.thousand")}`;
    return `${n.toLocaleString()}${t("movieImages.persons")}`;
  };

  const formatCurrency = (n) => {
    if (!n || n <= 0) return null;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  const BackButton = () => (
    <button
      type="button"
      onClick={() => router.back()}
      title={t("movieImages.backLabel")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "40px",
        padding: 0,
        background: "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "50%",
        color: "rgba(255,255,255,0.85)",
        cursor: "pointer",
        transition: "all 0.25s ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.3), rgba(91,140,255,0.3))";
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,59,92,0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))";
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      }}
    >
      <Undo2 size={20} strokeWidth={2.5} />
    </button>
  );

  if (detailLoading) {
    return (
      <div style={{ padding: "20px 16px 40px", color: palette.textMuted, minHeight: "100vh", background: "radial-gradient(125% 125% at 50% 90%, #000000 40%, #2b092b 100%)" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto 12px" }}>
          <BackButton />
        </div>
        <div style={{ textAlign: "center", paddingTop: "40px" }}>
          <div style={{ width: "40px", height: "40px", border: "3px solid rgba(255,59,92,0.2)", borderTopColor: "#ff3b5c", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
          <p>{t("movieImages.loadingDetail")}</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!movie || !movieName) {
    return (
      <div style={{ padding: "20px 16px 40px", color: palette.textMuted, minHeight: "100vh", background: "radial-gradient(125% 125% at 50% 90%, #000000 40%, #2b092b 100%)" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto 12px" }}>
          <BackButton />
        </div>
        <div style={{ textAlign: "center", paddingTop: "40px" }}>
          <p>{t("movieImages.movieNotFound")}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px 600px at 30% 0%, rgba(236, 72, 153, 0.10), transparent), radial-gradient(800px 400px at 80% 20%, rgba(139, 92, 246, 0.08), transparent), radial-gradient(125% 125% at 50% 90%, #000000 40%, #2b092b 100%)",
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: "960px", margin: "0 auto 12px" }}>
          <button
            type="button"
            onClick={() => router.back()}
            title={t("movieImages.backLabel")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              padding: 0,
              background: "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "50%",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
              transition: "all 0.25s ease",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.3), rgba(91,140,255,0.3))";
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,59,92,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))";
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
            }}
          >
            <Undo2 size={20} strokeWidth={2.5} />
          </button>
        </div>
      <h1 style={{ color: palette.text, fontSize: "22px", fontWeight: 800, marginBottom: "24px", textAlign: "center" }}>
        {displayName}
      </h1>

      {/* 포스터/배경 탭 */}
      {(hasPoster || hasBackdrop) && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
            maxWidth: "960px",
            margin: "0 auto 20px auto",
            borderBottom: `2px solid ${palette.border}`,
          }}
        >
          {hasPoster && (
            <button
              type="button"
              onClick={() => setActiveTab("poster")}
              style={{
                padding: "12px 24px",
                border: "none",
                borderBottom: activeTab === "poster" ? "3px solid #ff3b5c" : "3px solid transparent",
                marginBottom: "-2px",
                background: "transparent",
                color: activeTab === "poster" ? palette.text : palette.textMuted,
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("movieImages.poster")}
            </button>
          )}
          {hasBackdrop && (
            <button
              type="button"
              onClick={() => setActiveTab("backdrop")}
              style={{
                padding: "12px 24px",
                border: "none",
                borderBottom: activeTab === "backdrop" ? "3px solid #ff3b5c" : "3px solid transparent",
                marginBottom: "-2px",
                background: "transparent",
                color: activeTab === "backdrop" ? palette.text : palette.textMuted,
                fontSize: "15px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("movieImages.backdropImage")}
            </button>
          )}
        </div>
      )}

      {/* 이미지 영역 */}
      <div style={{ maxWidth: "960px", margin: "0 auto 24px" }}>
        {activeTab === "poster" && posterPath && (
          <img
            src={`${baseUrl}${posterPath}`}
            alt={`${movieName} ${t("movieImages.poster")}`}
            style={{ width: "100%", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
            draggable={false}
          />
        )}
        {activeTab === "backdrop" && backdropPath && (
          <img
            src={`${baseUrl}${backdropPath}`}
            alt={`${movieName} ${t("movieImages.backdrop")}`}
            style={{ width: "100%", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
            draggable={false}
          />
        )}
        {!posterPath && !backdropPath && (
          <img src="/no-poster-placeholder.png" alt={t("movieImages.noImage")} style={{ width: "100%", maxWidth: "400px", margin: "0 auto", display: "block", borderRadius: "12px" }} />
        )}
      </div>

      {/* 상세 정보 */}
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        {/* 한 줄 메타 + 배지 */}
        {(getOneLineMeta(movie) || movie.voteAverage >= 7.5 || isRecentRelease(movie)) && (
          <div style={{ padding: "10px 15px 12px", borderBottom: `1px solid ${palette.border}`, display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "12px" }}>
            {getOneLineMeta(movie) && <span style={{ color: palette.textMuted, fontSize: "13px", fontWeight: 500 }}>{getOneLineMeta(movie)}</span>}
            {movie.voteAverage >= 7.5 && <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(229, 193, 0, 0.2)", color: "#E5C100", border: "1px solid rgba(229, 193, 0, 0.4)" }}>⭐ {t("movieImages.highRating")}</span>}
            {isRecentRelease(movie) && <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, backgroundColor: "rgba(0, 200, 83, 0.2)", color: "#00C853", border: "1px solid rgba(0, 200, 83, 0.4)" }}>🆕 {t("movieImages.recent")}</span>}
          </div>
        )}

        {/* 태그라인 */}
        {getTagline(movie) && getTagline(movie).trim() !== "" && (
          <div style={{ padding: "8px 15px 12px", borderBottom: `1px solid ${palette.border}`, textAlign: "center", marginBottom: "12px" }}>
            <span style={{ color: palette.textMuted, fontSize: "14px", fontStyle: "italic" }}>"{getTagline(movie)}"</span>
          </div>
        )}

        {/* OTT */}
        <div style={{
          padding: "18px 15px",
          background: "linear-gradient(135deg, rgba(25,20,15,0.9), rgba(35,28,18,0.85))",
          border: "1px solid rgba(210,170,70,0.2)",
          borderLeft: "4px solid #D4A847",
          borderRadius: "10px",
          marginBottom: "12px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,220,100,0.04)",
        }}>
          <span style={{ color: "#FFD54F", fontSize: "15px", fontWeight: 800, marginBottom: "8px", display: "block", letterSpacing: "0.3px" }}>📺 {t("movieImages.ottPlatforms")}</span>
          {movie.ottProviders && movie.ottProviders.trim() ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
              {movie.ottProviders.split(/[,·]/).map((p, i) => (
                <span key={i} style={{ padding: "6px 12px", background: "rgba(210,170,70,0.12)", border: "1px solid rgba(210,170,70,0.2)", borderRadius: "6px", fontSize: "14px", fontWeight: 600, color: "#FFD54F" }}>{p.trim()}</span>
              ))}
            </div>
          ) : (
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", margin: "0 0 12px 0" }}>{t("movieImages.noOtt")}</p>
          )}
          {movie.movieName && (
            <a href={getYouTubeUrl(movie)} rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "inherit", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 4, backgroundColor: "#E62117", color: "#fff", fontSize: "10px", lineHeight: 1, paddingLeft: 2 }}>▶</span>
              <span style={{ color: "#fff", fontWeight: 600, letterSpacing: "-0.5px" }}>YouTube</span>
              <span style={{ color: "#FFD54F" }}>{t("movieImages.watchTrailer")}</span>
            </a>
          )}
        </div>

        {/* CineTrip CTA - 이 영화/DVD 로 여행가기 */}
        <CineTripCTA
          movieName={movieName}
          posterUrl={posterPath || backdropPath || ""}
          contentType={contentType}
        />

        {/* 한국관광공사 수상작 포토 - 이 영화 키워드로 교차 검색 */}
        {movieName && (
          <div style={{ padding: "0 15px", marginBottom: 12 }}>
            <PhotoGalleryStrip
              keyword={movieName}
              limit={10}
              title={`"${movieName}" 관련 관광 수상작`}
            />
          </div>
        )}

        {/* 관광사진갤러리 — PhotoGalleryService1 (영화명 키워드, 결과 없으면 자동 숨김) */}
        {movieName && (
          <div style={{ padding: "0 15px", marginBottom: 12 }}>
            <TourGallerySection
              keyword={movieName}
              title={t("tourGallery.movieSection")}
              subtitle={t("tourGallery.poweredBy")}
              limit={24}
            />
          </div>
        )}

        {/*
         * 근처 야영장(GoCamping) — 영화명 → 지역 키워드로 검색.
         * 결과 0건 또는 키 미승인 상태면 섹션 자체가 null 반환되어 숨겨짐.
         * "영화 본 그날 밤, 촬영지 근처에서 하루 더 묵기" 동선.
         */}
        {movieName && (
          <div style={{ padding: "0 15px", marginBottom: 12 }}>
            <NearbyCampingStrip
              keyword={movieName}
              title={t("nearbyCamping.movieSection")}
              subtitle={t("nearbyCamping.poweredBy")}
              limit={6}
            />
          </div>
        )}

        {/* 줄거리 */}
        <div style={{ padding: "15px", color: palette.text, fontSize: "13px", lineHeight: "1.6", borderBottom: `1px solid ${palette.border}`, textAlign: "center", marginBottom: "12px" }}>
          {getDisplayOverview(getOverview(movie))}
        </div>

        {/* 리뷰 섹션 (입력 + 기존 리뷰 목록) */}
        <div style={{
          padding: "0",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          marginBottom: "12px",
          backdropFilter: "blur(16px)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg, rgba(255,107,107,0.1), rgba(255,142,83,0.08))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ color: "#ff8e6b", fontSize: "15px", fontWeight: 800, display: "block" }}>✍️ {t("movieImages.writeReview")}</span>
          </div>

          <div style={{ padding: "16px 18px" }}>
            {reviewMsg && (
              <div style={{ padding: "8px 12px", marginBottom: "10px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, background: reviewMsg.includes("실패") ? "rgba(255,59,92,0.15)" : "rgba(0,200,83,0.15)", color: reviewMsg.includes("실패") ? "#ff6b6b" : "#4caf50" }}>
                {reviewMsg}
              </div>
            )}

            <div style={{ marginBottom: "10px" }}>
              <label style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>{t("movieImages.review")}</label>
              <input
                type="text"
                value={reviewOneLiner}
                onChange={(e) => setReviewOneLiner(e.target.value)}
                placeholder={t("movieImages.reviewPlaceholder")}
                maxLength={200}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "10px",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(255,107,107,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(255,107,107,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <button
                type="button"
                onClick={() => setSpoilerOpen((prev) => !prev)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  background: spoilerOpen
                    ? "rgba(255,107,107,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${spoilerOpen ? "rgba(255,107,107,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "10px",
                  color: spoilerOpen ? "#ff8e6b" : "rgba(255,255,255,0.4)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: "15px" }}>📝</span>
                {spoilerOpen ? t("movieImages.fullReviewCollapse") : t("movieImages.fullReviewExpand")}
              </button>

              <div style={{
                maxHeight: spoilerOpen ? "500px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.4s ease, opacity 0.3s ease",
                opacity: spoilerOpen ? 1 : 0,
              }}>
                <div style={{ marginTop: "10px" }}>
                  <textarea
                    value={reviewFull}
                    onChange={(e) => setReviewFull(e.target.value)}
                    placeholder={t("movieImages.fullReviewPlaceholder")}
                    rows={4}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      outline: "none",
                      resize: "vertical",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = "rgba(255,107,107,0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(255,107,107,0.1)"; }}
                    onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.boxShadow = "none"; }}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={submitReview}
              disabled={reviewSaving}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #ff6b6b, #ff8e53)",
                border: "none",
                borderRadius: "10px",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: reviewSaving ? "wait" : "pointer",
                opacity: reviewSaving ? 0.6 : 1,
                transition: "all 0.2s",
                boxShadow: "0 2px 12px rgba(255,107,107,0.3)",
                letterSpacing: "0.5px",
              }}
            >
              {reviewSaving ? t("movieImages.saving") : t("movieImages.submitReview")}
            </button>
          </div>
        </div>

        {/* 기존 리뷰 목록 */}
        {reviews.length > 0 && (
          <div style={{
            padding: "0",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            marginBottom: "12px",
            backdropFilter: "blur(16px)",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", flexWrap: "wrap", gap: "8px", background: "linear-gradient(135deg, rgba(255,107,107,0.08), rgba(255,142,83,0.06))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", fontWeight: 800 }}>
                💬 {t("movieImages.reviewCount", { count: reviews.length })}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {[{ key: "helpful", label: t("movieImages.helpfulSort") }, { key: "newest", label: t("movieImages.latestSort") }].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setReviewSort(opt.key)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: reviewSort === opt.key ? "1px solid rgba(255,107,107,0.4)" : "1px solid rgba(255,255,255,0.1)",
                      background: reviewSort === opt.key ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.04)",
                      color: reviewSort === opt.key ? "#ff6b6b" : "rgba(255,255,255,0.4)",
                      transition: "all 0.2s",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: "12px 18px 16px" }}>
              {reviews.map((r) => (
                <ReviewCard key={r.reviewId} review={r} palette={palette} movieName={movieName} ct={ct} onHelpful={() => loadReviews()} />
              ))}
            </div>
          </div>
        )}

        {/* 상세 정보 */}
        <div style={{ padding: "15px", backgroundColor: "#0f131c", borderRadius: "8px", marginBottom: "12px", fontFamily: "'D2Coding', 'D2 Coding', monospace" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
              <span style={{ padding: "5px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, color: "#fff", backgroundColor: "rgba(255,255,255,0.08)", border: `1px solid ${palette.border}` }}>{t("movieImages.contentType")}: {(movie.contentType || "-").toUpperCase()}</span>
              {typeof movie.isAdult === "boolean" && <span style={{ padding: "5px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 700, color: "#fff", backgroundColor: movie.isAdult ? "rgba(229, 9, 20, 0.35)" : "rgba(76, 175, 80, 0.25)", border: `1px solid ${palette.border}` }}>{movie.isAdult ? t("movieImages.adultRating") : t("movieImages.generalRating")}</span>}
            </div>
            {movie.voteAverage && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                  <span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>⭐ {t("movieImages.ratingLabel")}</span>
                  <span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.voteAverage.toFixed(1)} / 10 {formatVoteCount(movie.voteCount) && <span style={{ color: palette.textMuted, fontSize: "14px", marginLeft: "8px" }}>({formatVoteCount(movie.voteCount)} {t("movieImages.evaluation")})</span>}</span>
                </div>
              </div>
            )}
            {movie.releaseDate && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>📅 {ct === "movie" ? t("movieImages.releaseDateMovie") : t("movieImages.releaseDateDvd")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.releaseDate}</span></div>}
            {!movie.releaseDate && movie.releasedAt && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>📅 {t("movieImages.releasedAt")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.releasedAt}</span></div>}
            {movie.runtime && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>⏱️ {t("movieImages.runtimeLabel")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.runtime}{t("movieImages.min")}</span></div>}
            {movie.genre && <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🎭 {t("movieImages.genreLabel")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, whiteSpace: "pre-line", flex: 1, minWidth: 0 }}>{formatGenreForDisplay(movie.genre)}</span></div>}
            {movie.director && <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🎬 {t("movieImages.directorLabel")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.director}</span></div>}
            {movie.cast && <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🎭 {t("movieImages.castLabel")}</span><span style={{ color: "#fff", fontSize: "20px", lineHeight: 1.5, fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.cast}</span></div>}
            {movie.certification && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🔞 {t("movieImages.certificationLabel")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.certification}</span></div>}
            {movie.productionCountries && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🌍 {t("movieImages.productionCountries")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.productionCountries}</span></div>}
            {movie.productionCompanies && <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🏢 {t("movieImages.productionCompanies")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{movie.productionCompanies}</span></div>}
            {movie.budget != null && movie.budget > 0 && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>💰 {t("movieImages.budget")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{formatCurrency(movie.budget)}</span></div>}
            {movie.revenue != null && movie.revenue > 0 && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>📈 {t("movieImages.boxOffice")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{formatCurrency(movie.revenue)}</span></div>}
            {movie.collection && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>📚 {t("movieImages.collection")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.collection}</span></div>}
            {movie.spokenLanguages && <div style={{ display: "flex", alignItems: "flex-start", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🗣️ {t("movieImages.spokenLanguages")}</span><span style={{ color: "#fff", fontSize: "20px", fontWeight: 300, flex: 1, minWidth: 0, wordBreak: "break-word" }}>{movie.spokenLanguages}</span></div>}
            {movie.homepage && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🔗 {t("movieImages.homepageLabel")}</span><a href={movie.homepage} target="_blank" rel="noopener noreferrer" style={{ color: "#5C6BC0", fontSize: "18px", fontWeight: 600, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>{t("movieImages.visitLink")}</a></div>}
            {movie.originalTitle && movie.originalTitle !== movie.movieName && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>🌐 {t("movieImages.originalTitle")}</span><span style={{ color: "#fff", fontSize: "18px", fontWeight: 300, flex: 1, minWidth: 0 }}>{movie.originalTitle}</span></div>}
            {movie.imdbId && <div style={{ display: "flex", alignItems: "center", gap: "15px", width: "100%" }}><span style={{ color: "#fff", fontSize: "20px", fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>📎 IMDB</span><a href={`https://www.imdb.com/title/${movie.imdbId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#F5C518", fontSize: "14px", fontWeight: 600, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}>{t("movieImages.viewOnImdb")}</a></div>}
          </div>
        </div>

        {/* 좋아요/싫어요 */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          {voteError && (
            <div style={{ padding: "8px 12px", background: "rgba(255,59,92,0.2)", color: "#ff3b5c", borderRadius: "8px", fontSize: "13px", maxWidth: "100%" }}>
              {voteError}
            </div>
          )}
          {voteFeedback && (
            <div style={{ padding: "8px 12px", background: "rgba(0,200,83,0.2)", color: "#00C853", borderRadius: "8px", fontSize: "13px", maxWidth: "100%" }}>
              {voteFeedback}
            </div>
          )}
          {/* 좋아요/싫어요/꿀꿀해 각각 토글: 같은 버튼 다시 누르면 취소 */}
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-start", padding: "12px", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <button onClick={like} disabled={voteLoading} style={{ border: "none", background: "none", padding: 0, width: 48, height: 48, cursor: voteLoading ? "wait" : "pointer", opacity: voteLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="https://img.icons8.com/emoji/96/red-heart.png" alt={t("movieImages.like")} style={{ width: 48, height: 48, objectFit: "contain" }} />
            </button>
            <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{likeCount}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <button onClick={unlike} disabled={voteLoading} style={{ border: "none", background: "none", padding: 0, width: 48, height: 48, cursor: voteLoading ? "wait" : "pointer", opacity: voteLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="https://img.icons8.com/fluency/96/thumbs-down.png" alt={t("movieImages.dislike")} style={{ width: 48, height: 48, objectFit: "contain" }} />
            </button>
            <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{unlikeCount}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <button onClick={meh} disabled={voteLoading} style={{ border: "none", background: "none", padding: 0, width: 48, height: 48, cursor: voteLoading ? "wait" : "pointer", opacity: voteLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/kaonashi.png" alt={t("movieImages.meh")} style={{ width: 36, height: 36, objectFit: "contain" }} />
            </button>
            <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>{mehCount}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold", minWidth: 42, textAlign: "right" }}>{t("movieImages.like")}</span>
              <div style={{ width: 64, height: 10, backgroundColor: "#333", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${likeCount + unlikeCount + mehCount > 0 ? (likeCount / (likeCount + unlikeCount + mehCount)) * 100 : 0}%`, height: "100%", backgroundColor: "#ff0000", borderRadius: 4, transition: "none" }} />
              </div>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: "bold", minWidth: 20 }}>{likeCount}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold", minWidth: 42, textAlign: "right" }}>{t("movieImages.dislike")}</span>
              <div style={{ width: 64, height: 10, backgroundColor: "#333", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${likeCount + unlikeCount + mehCount > 0 ? (unlikeCount / (likeCount + unlikeCount + mehCount)) * 100 : 0}%`, height: "100%", backgroundColor: "#FFC107", borderRadius: 4, transition: "none" }} />
              </div>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: "bold", minWidth: 20 }}>{unlikeCount}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold", minWidth: 42, textAlign: "right" }}>{t("movieImages.meh")}</span>
              <div style={{ width: 64, height: 10, backgroundColor: "#333", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${likeCount + unlikeCount + mehCount > 0 ? (mehCount / (likeCount + unlikeCount + mehCount)) * 100 : 0}%`, height: "100%", backgroundColor: "#9c27b0", borderRadius: 4, transition: "none" }} />
              </div>
              <span style={{ color: "#fff", fontSize: "11px", fontWeight: "bold", minWidth: 20 }}>{mehCount}</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MovieImages() {
  return (
    <Suspense>
      <MovieImagesContent />
    </Suspense>
  );
}
