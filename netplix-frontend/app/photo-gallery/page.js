"use client";

/**
 * /photo-gallery — 관광사진 갤러리 독립 페이지.
 *
 * 데이터: GET /api/v1/tour-gallery?q=<keyword>&limit=<n>
 *   → 한국관광공사 PhotoGalleryService1 (galleryList1 / gallerySearchList1)
 *
 * 기능:
 *  - 검색창: 키워드로 갤러리 재조회 (엔터 또는 버튼)
 *  - 지역 단축 버튼: 서울·부산·제주 등을 원클릭으로 교체 검색
 *  - 보기 모드: 「사진만」 / 「사진 + 소리」(Odii 검색 결과와 연동, 라이트박스에서 재생)
 *  - TourGallerySection 재사용: keyword 가 빈 상태면 allowEmpty=true 로 전체 최신순 노출
 *
 * 접근 경로:
 *  - /dashboard → TrendingRegionsWidget 그리드의 "관광사진 갤러리" CTA 버튼
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Camera, Headphones, Image as ImageIcon } from "lucide-react";
import TourGallerySection from "@/components/TourGallerySection";
import AmbientBackdrop from "@/components/AmbientBackdrop";
import { resolveAreaCode } from "@/lib/regionAreaCode";

// 관광사진 DB 에서 히트율이 높은 대표 지역 키워드 (한국 광역 17곳).
// "경기도"/"경상남도" 같은 정식명보다 축약형이 PhotoGalleryService1 검색에 유리.
// keyword 필드는 PhotoGalleryService1 API 검색용 한글 고정값,
// code 필드는 i18n 라벨 키(common regionShortcuts) 조회에 사용한다.
const REGION_SHORTCUTS = [
  { keyword: "서울", code: "1" },
  { keyword: "부산", code: "6" },
  { keyword: "인천", code: "2" },
  { keyword: "대구", code: "4" },
  { keyword: "대전", code: "3" },
  { keyword: "광주", code: "5" },
  { keyword: "울산", code: "7" },
  { keyword: "세종", code: "8" },
  { keyword: "경기", code: "31" },
  { keyword: "강원", code: "32" },
  { keyword: "충북", code: "33" },
  { keyword: "충남", code: "34" },
  { keyword: "전북", code: "35" },
  { keyword: "전남", code: "36" },
  { keyword: "경북", code: "37" },
  { keyword: "경남", code: "38" },
  { keyword: "제주", code: "39" },
];

function PhotoGalleryInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [input, setInput] = useState(initialQ);
  const [keyword, setKeyword] = useState(initialQ);
  /** 사진만 보기 | 사진 + 관광공사 오디오 가이드(Odii) 연동 */
  const [layerMode, setLayerMode] = useState("photos");

  // URL 쿼리(?q=) 변경 시 내부 상태 동기화
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setInput(q);
    setKeyword(q);
  }, [searchParams]);

  const applyKeyword = (next) => {
    const v = (next || "").trim();
    setKeyword(v);
    const qs = v ? `?q=${encodeURIComponent(v)}` : "";
    router.replace(`/photo-gallery${qs}`);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    applyKeyword(input);
  };

  const sectionTitle = useMemo(
    () => (keyword
      ? t("photoGalleryPage.resultsFor", { keyword })
      : t("photoGalleryPage.latest")),
    [keyword, t]
  );

  const galleryWeatherRegionCode = useMemo(() => {
    const kw = keyword.trim();
    if (!kw) return null;
    const hit = REGION_SHORTCUTS.find((r) => r.keyword === kw);
    if (hit) return hit.code;
    return resolveAreaCode(kw);
  }, [keyword]);

  return (
    <div className="pgp-root">
      <style>{cssBlock}</style>
      <AmbientBackdrop palette={["#f472b6", "#a78bfa", "#fbbf24", "#22d3ee"]} intensity={0.9} />
      <header className="pgp-hero">
        <div className="pgp-hero-inner">
          <div className="pgp-tag">
            <Camera size={14} />
            <span>Korea Photo Gallery</span>
          </div>
          <h1 className="pgp-title">
            {t("photoGalleryPage.pageTitle")}
          </h1>
          <p className="pgp-sub">
            {layerMode === "sound"
              ? t("photoGalleryPage.pageSubtitleSound")
              : t("photoGalleryPage.pageSubtitle")}
          </p>

          <div
            className="pgp-layer"
            role="group"
            aria-label={t("photoGalleryPage.layerGroupAria")}
          >
            <button
              type="button"
              className={`pgp-layer-btn ${layerMode === "photos" ? "pgp-layer-active" : ""}`}
              onClick={() => setLayerMode("photos")}
            >
              <ImageIcon size={15} aria-hidden />
              {t("photoGalleryPage.layerPhotosOnly")}
            </button>
            <button
              type="button"
              className={`pgp-layer-btn ${layerMode === "sound" ? "pgp-layer-active" : ""}`}
              onClick={() => setLayerMode("sound")}
            >
              <Headphones size={15} aria-hidden />
              {t("photoGalleryPage.layerPhotosPlusSound")}
            </button>
          </div>

          {layerMode === "sound" && !keyword.trim() && (
            <p className="pgp-layer-banner" role="status">
              {t("photoGalleryPage.layerSoundPerPhoto")}
            </p>
          )}

          <form className="pgp-search" onSubmit={onSubmit} role="search">
            <Search size={16} className="pgp-search-icon" aria-hidden />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("photoGalleryPage.searchPlaceholder")}
              aria-label={t("photoGalleryPage.searchPlaceholder")}
              className="pgp-search-input"
            />
            <button type="submit" className="pgp-search-btn">
              {t("photoGalleryPage.searchBtn")}
            </button>
          </form>

          <div className="pgp-chips" role="group" aria-label={t("photoGalleryPage.shortcutsLabel")}>
            <button
              type="button"
              className={`pgp-chip ${keyword === "" ? "pgp-chip-active" : ""}`}
              onClick={() => applyKeyword("")}
            >
              {t("photoGalleryPage.allRegions")}
            </button>
            {REGION_SHORTCUTS.map((r) => (
              <button
                key={r.code}
                type="button"
                className={`pgp-chip ${keyword === r.keyword ? "pgp-chip-active" : ""}`}
                onClick={() => applyKeyword(r.keyword)}
              >
                {t(`regionShortcuts.${r.code}`, r.keyword)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="pgp-main">
        <TourGallerySection
          keyword={keyword}
          title={sectionTitle}
          subtitle={t("tourGallery.poweredBy")}
          limit={0}
          allowEmpty
          infinite
          pageSize={60}
          soundLayerEnabled={layerMode === "sound"}
          weatherRegionCode={galleryWeatherRegionCode}
        />
        {/* 섹션이 숨겨진(0건) 경우를 위한 빈 상태 안내 */}
        <NoResultsHint keyword={keyword} />
      </main>
    </div>
  );
}

// TourGallerySection 이 items 0건일 때 아무것도 렌더하지 않으므로
// 빈 상태의 친절한 안내는 여기서 별도로 표시.
function NoResultsHint({ keyword }) {
  const { t } = useTranslation();
  const [hasItems, setHasItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      try {
        const params = new URLSearchParams();
        if (keyword) params.set("q", keyword);
        params.set("limit", "1");
        const res = await fetch(`/api/v1/tour-gallery?${params.toString()}`);
        if (!res.ok) throw new Error("non-2xx");
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        if (!cancelled) setHasItems(list.length > 0);
      } catch {
        if (!cancelled) setHasItems(false);
      }
    }
    ping();
    return () => { cancelled = true; };
  }, [keyword]);

  if (hasItems !== false) return null;
  return (
    <div className="pgp-empty" role="status">
      <div className="pgp-empty-emoji" aria-hidden>📷</div>
      <div className="pgp-empty-title">
        {keyword
          ? t("photoGalleryPage.emptyForKeyword", { keyword })
          : t("photoGalleryPage.empty")}
      </div>
      <div className="pgp-empty-desc">
        {t("photoGalleryPage.emptyHint")}
      </div>
    </div>
  );
}

export default function PhotoGalleryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading…</div>}>
      <PhotoGalleryInner />
    </Suspense>
  );
}

const cssBlock = `
.pgp-root {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  overflow-x: hidden;
  background: transparent;
  color: #f5f5f5;
}
.pgp-hero {
  position: relative;
  z-index: 1;
  padding: 48px 20px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.pgp-main { position: relative; z-index: 1; }
.pgp-hero-inner { max-width: 1200px; margin: 0 auto; }
.pgp-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fbcfe8;
  background: rgba(244, 114, 182, 0.12);
  border: 1px solid rgba(244, 114, 182, 0.25);
  padding: 6px 10px;
  border-radius: 999px;
}
.pgp-title {
  margin: 14px 0 6px;
  font-size: clamp(24px, 4vw, 38px);
  font-weight: 900;
  letter-spacing: -0.01em;
  background: linear-gradient(90deg, #fda4af 0%, #fcd34d 50%, #c4b5fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  line-height: 1.15;
}
.pgp-sub {
  margin: 0 0 18px;
  color: #bdbdbd;
  font-size: 0.95rem;
  max-width: 760px;
  line-height: 1.5;
}
.pgp-layer {
  display: inline-flex;
  gap: 0;
  padding: 4px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.pgp-layer-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: #bbb;
  font-size: 0.84rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.pgp-layer-btn:hover {
  color: #fff;
}
.pgp-layer-active {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.22) 0%, rgba(167, 139, 250, 0.22) 100%);
  color: #fff;
  box-shadow: 0 2px 12px rgba(34, 211, 238, 0.15);
}
.pgp-layer-banner {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.88rem;
  color: #e0f2fe;
  background: rgba(34, 211, 238, 0.12);
  border: 1px solid rgba(34, 211, 238, 0.28);
  max-width: 720px;
  line-height: 1.45;
}
.pgp-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  padding: 6px 6px 6px 16px;
  max-width: 520px;
}
.pgp-search-icon { color: #bdbdbd; }
.pgp-search-input {
  flex: 1 1 auto;
  background: transparent;
  border: none;
  outline: none;
  color: #f5f5f5;
  font-size: 0.95rem;
  padding: 8px 0;
  min-width: 0;
}
.pgp-search-input::placeholder { color: #8a8a8a; }
.pgp-search-btn {
  flex: 0 0 auto;
  border: none;
  background: linear-gradient(135deg, #f472b6 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 8px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.pgp-search-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(167, 139, 250, 0.35); }

.pgp-chips {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pgp-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #dcdcdc;
  font-size: 0.82rem;
  padding: 6px 12px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.pgp-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.pgp-chip-active {
  background: linear-gradient(135deg, rgba(244,114,182,0.18) 0%, rgba(167,139,250,0.18) 100%);
  border-color: rgba(244, 114, 182, 0.5);
  color: #fff;
}

.pgp-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 20px 80px;
}
.pgp-empty {
  padding: 60px 20px;
  text-align: center;
  color: #cfcfcf;
}
.pgp-empty-emoji { font-size: 40px; }
.pgp-empty-title {
  margin-top: 8px;
  font-size: 1.05rem;
  font-weight: 700;
  color: #f5f5f5;
}
.pgp-empty-desc {
  margin-top: 6px;
  color: #a6a6a6;
  font-size: 0.9rem;
}
`;
