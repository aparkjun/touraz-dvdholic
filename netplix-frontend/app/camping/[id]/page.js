"use client";

/**
 * /camping/[id] — 단일 야영장 상세 페이지 (한국관광공사 GoCamping).
 *
 * 데이터 소스:
 *  - GET /api/v1/camping/{id}          → CampingSiteResponse (상세 본문)
 *  - GET /api/v1/camping/{id}/images   → 이미지 갤러리 (imageList, 0건이면 섹션 숨김)
 *
 * 화면 구성:
 *  - 히어로: 대표 이미지 + 야영장명 + 분류 배지 + 입지 배지 + 거리(쿼리스트링 ?d=km 으로 전달 시)
 *  - 액션 바: 카카오맵·네이버맵 열기 / 홈페이지 / 전화 / 공유 (clipboard)
 *  - 본문: 한줄 소개, 긴 소개, 찾아오는 길, 주소, 연락처
 *  - 이미지 갤러리 (선택)
 *  - Leaflet 미니 지도 (위·경도 있을 때만)
 *  - 하단: 목록으로 돌아가기 + 영화·문화 컨텍스트(추후 확장 지점)
 *
 * 404 정책:
 *  - 백엔드가 404 반환 시(미존재/어댑터 미설정) 본 페이지가 자체 NotFoundCard 를 렌더 →
 *    Next.js 의 not-found 화면이 아니라, 사용자가 "왜 못 찾았는지" 안내 + 목록 복귀 동선 제공.
 */

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import {
  Tent,
  ArrowLeft,
  MapPin,
  Phone,
  ExternalLink,
  Share2,
  Navigation,
  Image as ImageIcon,
  Compass,
} from "lucide-react";

let L, MapContainer, TileLayer, Marker, Popup;
let greenIcon;
if (typeof window !== "undefined") {
  L = require("leaflet");
  const rl = require("react-leaflet");
  MapContainer = rl.MapContainer;
  TileLayer = rl.TileLayer;
  Marker = rl.Marker;
  Popup = rl.Popup;

  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
  greenIcon = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  });
}

/**
 * GoCamping homepage 필드 정규화 (자세한 케이스: app/camping/page.js 동명 함수 참조).
 * 백엔드가 1차 정규화하지만, 캐시/폴백 응답 대비 동일 로직 유지.
 */
function sanitizeHomepageUrl(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  if (s.includes("<") && s.includes(">")) {
    const m = s.match(/href\s*=\s*['"]([^'"]+)['"]/i);
    if (m) s = m[1].trim();
    else s = s.replace(/<[^>]+>/g, "").trim();
  }
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return s;
  if (lower.startsWith("www.") || s.includes(".")) {
    if (/\s/.test(s)) return null;
    if (!/^[A-Za-z0-9.\-_~:/?#@!$&'()*+,;=%]+$/.test(s)) return null;
    return `https://${s}`;
  }
  return null;
}

function CampingDetailInner() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params?.id || "").trim();
  const distanceParam = searchParams.get("d");

  const [mounted, setMounted] = useState(false);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errored, setErrored] = useState(false);
  const [images, setImages] = useState([]);
  const [imagesLoading, setImagesLoading] = useState(true);
  const [shareToast, setShareToast] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setNotFound(false);
        setErrored(false);
        const res = await axios.get(`/api/v1/camping/${encodeURIComponent(id)}`);
        if (cancelled) return;
        const data = res?.data?.data || null;
        if (!data) {
          setNotFound(true);
          setSite(null);
        } else {
          setSite(data);
        }
      } catch (e) {
        if (cancelled) return;
        if (e?.response?.status === 404) {
          setNotFound(true);
        } else {
          setErrored(true);
        }
        setSite(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        setImagesLoading(true);
        const res = await axios.get(`/api/v1/camping/${encodeURIComponent(id)}/images`);
        if (cancelled) return;
        const data = Array.isArray(res?.data?.data) ? res.data.data : [];
        setImages(data);
      } catch (_) {
        if (!cancelled) setImages([]);
      } finally {
        if (!cancelled) setImagesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const homepageHref = useMemo(() => sanitizeHomepageUrl(site?.homepage), [site?.homepage]);

  const kakaoMapUrl = useMemo(() => {
    if (!site) return null;
    if (site.latitude != null && site.longitude != null) {
      return `https://map.kakao.com/link/map/${encodeURIComponent(site.name || "")},${site.latitude},${site.longitude}`;
    }
    if (site.address) {
      return `https://map.kakao.com/link/search/${encodeURIComponent(site.address)}`;
    }
    return null;
  }, [site]);

  const naverMapUrl = useMemo(() => {
    if (!site) return null;
    const q = site.address || site.name || "";
    if (!q) return null;
    return `https://map.naver.com/v5/search/${encodeURIComponent(q)}`;
  }, [site]);

  const tags = useMemo(() => {
    if (!site?.induty) return [];
    return String(site.induty).split(/[,，、\/]/).map((s) => s.trim()).filter(Boolean);
  }, [site?.induty]);

  const onShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    const text = site?.name ? `${site.name} · ${url}` : url;
    try {
      if (navigator.share) {
        await navigator.share({ title: site?.name || "Camping", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 1800);
    } catch (_) {}
  }, [site?.name]);

  if (!id) {
    return (
      <NotFoundCard
        title={t("camping.detailNotFound")}
        desc={t("camping.detailNotFoundHint")}
      />
    );
  }

  return (
    <div className="cmd-root">
      <style>{cssBlock}</style>

      <div className="cmd-topbar">
        <button
          type="button"
          className="cmd-back"
          onClick={() => router.back()}
          aria-label={t("camping.backToList")}
        >
          <ArrowLeft size={16} />
          <span>{t("camping.backLink")}</span>
        </button>
        <Link href="/camping" className="cmd-back-list">
          <Tent size={14} />
          <span>{t("camping.pageTitle")}</span>
        </Link>
      </div>

      {loading ? (
        <DetailSkeleton message={t("camping.loadingDetail")} />
      ) : notFound ? (
        <NotFoundCard
          title={t("camping.detailNotFound")}
          desc={t("camping.detailNotFoundHint")}
        />
      ) : errored ? (
        <NotFoundCard
          title={t("camping.error")}
          desc={t("camping.errorHint")}
        />
      ) : site ? (
        <>
          {/* HERO */}
          <header className="cmd-hero">
            <div
              className="cmd-hero-bg"
              style={{
                backgroundImage: site.imageUrl ? `url(${site.imageUrl})` : "none",
              }}
              aria-hidden
            />
            <div className="cmd-hero-overlay" aria-hidden />
            <div className="cmd-hero-inner">
              <div className="cmd-tag">
                <Tent size={13} />
                <span>Korea GoCamping</span>
              </div>
              <h1 className="cmd-title">{site.name}</h1>
              {site.shortIntro && (
                <p className="cmd-sub">{site.shortIntro}</p>
              )}
              <div className="cmd-badge-row">
                {tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="cmd-badge">{tag}</span>
                ))}
                {site.lctCl && (
                  <span className="cmd-badge cmd-badge-loc">
                    <Compass size={11} /> {site.lctCl}
                  </span>
                )}
                {distanceParam && !Number.isNaN(Number(distanceParam)) && (
                  <span className="cmd-badge cmd-badge-dist">
                    <Navigation size={11} />
                    {Number(distanceParam) < 1
                      ? `${Math.round(Number(distanceParam) * 1000)}m`
                      : `${Number(distanceParam).toFixed(1)}km`}
                  </span>
                )}
              </div>
              {site.address && (
                <div className="cmd-hero-addr">
                  <MapPin size={14} />
                  <span>{site.address}</span>
                </div>
              )}
            </div>
          </header>

          {/* ACTION BAR */}
          <section className="cmd-actions" aria-label="actions">
            {kakaoMapUrl && (
              <a className="cmd-action" href={kakaoMapUrl} target="_blank" rel="noopener noreferrer">
                <MapPin size={14} />
                <span>{t("camping.openKakaoMap")}</span>
              </a>
            )}
            {naverMapUrl && (
              <a className="cmd-action" href={naverMapUrl} target="_blank" rel="noopener noreferrer">
                <Navigation size={14} />
                <span>{t("camping.openNaverMap")}</span>
              </a>
            )}
            {site.tel && (
              <a className="cmd-action" href={`tel:${String(site.tel).replace(/[^0-9+]/g, "")}`}>
                <Phone size={14} />
                <span>{site.tel}</span>
              </a>
            )}
            {homepageHref && (
              <a className="cmd-action" href={homepageHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                <span>{t("camping.homepage")}</span>
              </a>
            )}
            <button type="button" className="cmd-action cmd-action-ghost" onClick={onShare}>
              <Share2 size={14} />
              <span>{shareToast ? t("camping.shared") : t("camping.share")}</span>
            </button>
          </section>

          {/* BODY GRID */}
          <main className="cmd-grid">
            <section className="cmd-card">
              <h2 className="cmd-card-title">{t("camping.introTitle")}</h2>
              {site.longIntro || site.shortIntro ? (
                <p className="cmd-card-text cmd-card-pre">
                  {site.longIntro || site.shortIntro}
                </p>
              ) : (
                <p className="cmd-card-text cmd-card-text-muted">{t("camping.noIntro")}</p>
              )}
            </section>

            <section className="cmd-card">
              <h2 className="cmd-card-title">{t("camping.directionTitle")}</h2>
              {site.direction ? (
                <p className="cmd-card-text cmd-card-pre">{site.direction}</p>
              ) : (
                <p className="cmd-card-text cmd-card-text-muted">{t("camping.noDirection")}</p>
              )}
            </section>

            <section className="cmd-card">
              <h2 className="cmd-card-title">{t("camping.contactTitle")}</h2>
              <ul className="cmd-list">
                <li>
                  <Phone size={13} />
                  <span>{site.tel || t("camping.phoneNone")}</span>
                </li>
                <li>
                  <ExternalLink size={13} />
                  {homepageHref ? (
                    <a href={homepageHref} target="_blank" rel="noopener noreferrer" className="cmd-link">
                      {homepageHref}
                    </a>
                  ) : (
                    <span className="cmd-card-text-muted">—</span>
                  )}
                </li>
              </ul>
            </section>

            <section className="cmd-card">
              <h2 className="cmd-card-title">{t("camping.addressTitle")}</h2>
              <ul className="cmd-list">
                <li>
                  <MapPin size={13} />
                  <span>{site.address || "—"}</span>
                </li>
                {(site.doNm || site.sigunguNm) && (
                  <li>
                    <Compass size={13} />
                    <span>
                      {[site.doNm, site.sigunguNm].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                )}
                {site.zipcode && (
                  <li className="cmd-zip">
                    <span>{site.zipcode}</span>
                  </li>
                )}
              </ul>
            </section>
          </main>

          {/* GALLERY */}
          {(imagesLoading || images.length > 0) && (
            <section className="cmd-section">
              <h2 className="cmd-section-title">
                <ImageIcon size={16} />
                <span>{t("camping.galleryTitle")}</span>
                {!imagesLoading && images.length > 0 && (
                  <span className="cmd-section-count">· {images.length}</span>
                )}
              </h2>
              {imagesLoading ? (
                <div className="cmd-gallery cmd-gallery-skeleton">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`gsk-${i}`} className="cmd-gallery-item cmd-gallery-sk" />
                  ))}
                </div>
              ) : (
                <div className="cmd-gallery">
                  {images.map((url, i) => (
                    <a
                      key={`${url}-${i}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cmd-gallery-item"
                    >
                      <img
                        src={url}
                        alt={`${site.name} ${i + 1}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.parentElement.style.display = "none";
                        }}
                      />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* MAP */}
          {site.latitude != null && site.longitude != null && mounted && MapContainer && (
            <section className="cmd-section">
              <h2 className="cmd-section-title">
                <MapPin size={16} />
                <span>{t("camping.mapTitle")}</span>
              </h2>
              <div className="cmd-map">
                <MapContainer
                  center={[site.latitude, site.longitude]}
                  zoom={14}
                  style={{ width: "100%", height: "60vh", borderRadius: 14 }}
                  scrollWheelZoom
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[site.latitude, site.longitude]} icon={greenIcon}>
                    <Popup>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{site.name}</div>
                      {site.address && (
                        <div style={{ fontSize: 12, color: "#555" }}>📍 {site.address}</div>
                      )}
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </section>
          )}

          <footer className="cmd-footer">
            <Link href="/camping" className="cmd-footer-back">
              <ArrowLeft size={14} />
              <span>{t("camping.backToList")}</span>
            </Link>
          </footer>
        </>
      ) : null}
    </div>
  );
}

function DetailSkeleton({ message }) {
  return (
    <div className="cmd-skeleton-wrap" role="status" aria-live="polite">
      <div className="cmd-sk-hero" />
      <div className="cmd-sk-bar">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`sa-${i}`} className="cmd-sk-action" />
        ))}
      </div>
      <div className="cmd-sk-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={`sg-${i}`} className="cmd-sk-card" />
        ))}
      </div>
      <div className="cmd-sk-message">{message}</div>
    </div>
  );
}

function NotFoundCard({ title, desc }) {
  const { t } = useTranslation();
  return (
    <div className="cmd-empty" role="status">
      <div className="cmd-empty-emoji" aria-hidden>⛺</div>
      <div className="cmd-empty-title">{title}</div>
      {desc && <div className="cmd-empty-desc">{desc}</div>}
      <div className="cmd-empty-actions">
        <Link href="/camping" className="cmd-empty-cta">
          <ArrowLeft size={14} />
          <span>{t("camping.backToList")}</span>
        </Link>
      </div>
    </div>
  );
}

export default function CampingDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading…</div>}>
      <CampingDetailInner />
    </Suspense>
  );
}

const cssBlock = `
.cmd-root {
  min-height: 100vh;
  background:
    radial-gradient(1200px 500px at 10% -10%, rgba(34, 197, 94, 0.18) 0%, transparent 60%),
    radial-gradient(1000px 400px at 100% 0%, rgba(16, 185, 129, 0.14) 0%, transparent 60%),
    linear-gradient(180deg, #0b0f0b 0%, #101a12 100%);
  color: #f5f5f5;
}
.cmd-topbar {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 20px 0;
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
}
.cmd-back, .cmd-back-list {
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #dcdcdc;
  font-size: 0.82rem; font-weight: 600;
  padding: 7px 14px; border-radius: 999px;
  text-decoration: none; cursor: pointer;
  transition: background 0.15s ease;
}
.cmd-back:hover, .cmd-back-list:hover { background: rgba(255,255,255,0.12); color: #fff; }

.cmd-hero {
  position: relative;
  margin: 18px auto 0;
  max-width: 1100px;
  border-radius: 18px;
  overflow: hidden;
  min-height: 280px;
  isolation: isolate;
}
.cmd-hero-bg {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
  filter: blur(2px) saturate(1.05);
  transform: scale(1.06);
  z-index: -2;
  background-color: #0e1410;
}
.cmd-hero-overlay {
  position: absolute; inset: 0;
  background:
    linear-gradient(180deg, rgba(11,15,11,0.35) 0%, rgba(11,15,11,0.78) 100%),
    radial-gradient(800px 320px at 80% 0%, rgba(34, 197, 94, 0.22) 0%, transparent 60%);
  z-index: -1;
}
.cmd-hero-inner { padding: 36px 22px 28px; }
.cmd-tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
  color: #a7f3d0;
  background: rgba(34,197,94,0.16);
  border: 1px solid rgba(34,197,94,0.3);
  padding: 6px 10px; border-radius: 999px;
}
.cmd-title {
  margin: 14px 0 6px;
  font-size: clamp(24px, 4.4vw, 40px);
  font-weight: 900; letter-spacing: -0.01em; line-height: 1.15;
  color: #fff;
  text-shadow: 0 6px 22px rgba(0,0,0,0.45);
}
.cmd-sub {
  margin: 0 0 12px; max-width: 760px;
  color: #d8dcd8; font-size: 0.96rem; line-height: 1.5;
  text-shadow: 0 2px 8px rgba(0,0,0,0.45);
}
.cmd-badge-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cmd-badge {
  font-size: 0.74rem; color: #a7f3d0;
  background: rgba(34,197,94,0.16);
  border: 1px solid rgba(34,197,94,0.32);
  padding: 4px 10px; border-radius: 999px;
}
.cmd-badge-loc { color: #fde68a; background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.32); display: inline-flex; align-items: center; gap: 4px; }
.cmd-badge-dist { color: #93c5fd; background: rgba(59,130,246,0.16); border-color: rgba(59,130,246,0.32); display: inline-flex; align-items: center; gap: 4px; }
.cmd-hero-addr {
  margin-top: 14px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.9rem; color: #e5e7eb;
  background: rgba(0,0,0,0.32); padding: 8px 12px; border-radius: 999px;
  backdrop-filter: blur(4px);
}

.cmd-actions {
  max-width: 1100px; margin: 16px auto 0; padding: 0 20px;
  display: flex; flex-wrap: wrap; gap: 8px;
}
.cmd-action {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(14,165,233,0.14) 100%);
  border: 1px solid rgba(34,197,94,0.3);
  color: #f1f1f1; text-decoration: none;
  font-size: 0.84rem; font-weight: 600;
  padding: 9px 14px; border-radius: 999px;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.cmd-action:hover {
  transform: translateY(-1px);
  border-color: rgba(34,197,94,0.55);
}
.cmd-action-ghost {
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.12);
}

.cmd-grid {
  max-width: 1100px; margin: 22px auto 0; padding: 0 20px;
  display: grid; gap: 14px;
  grid-template-columns: repeat(1, minmax(0, 1fr));
}
@media (min-width: 760px) { .cmd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.cmd-card {
  background: rgba(20, 24, 22, 0.85);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px; padding: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.cmd-card-title {
  margin: 0 0 10px; font-size: 0.98rem; font-weight: 700;
  color: #a7f3d0; letter-spacing: 0.02em;
}
.cmd-card-text { margin: 0; color: #dcdcdc; font-size: 0.9rem; line-height: 1.6; }
.cmd-card-text-muted { color: #888; }
.cmd-card-pre { white-space: pre-wrap; }
.cmd-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.cmd-list li {
  display: inline-flex; align-items: flex-start; gap: 8px;
  font-size: 0.88rem; color: #dcdcdc; line-height: 1.45;
}
.cmd-list li svg { margin-top: 3px; color: #86efac; flex-shrink: 0; }
.cmd-link { color: #7dd3fc; text-decoration: none; word-break: break-all; }
.cmd-link:hover { color: #bae6fd; }
.cmd-zip { color: #9aa0a6; font-size: 0.82rem; }

.cmd-section {
  max-width: 1100px; margin: 28px auto 0; padding: 0 20px;
}
.cmd-section-title {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 1.05rem; font-weight: 700; color: #fff;
  margin: 0 0 12px;
}
.cmd-section-count { color: #86efac; font-weight: 600; font-size: 0.86rem; }

.cmd-gallery {
  display: grid; gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 560px) { .cmd-gallery { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 900px) { .cmd-gallery { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.cmd-gallery-item {
  position: relative;
  display: block; padding-top: 66%;
  background: #0e0e0e; border-radius: 10px; overflow: hidden;
  border: 1px solid rgba(255,255,255,0.05);
  transition: transform 0.18s ease, border-color 0.18s ease;
}
.cmd-gallery-item:hover { transform: translateY(-2px); border-color: rgba(34,197,94,0.4); }
.cmd-gallery-item img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.cmd-gallery-skeleton .cmd-gallery-item { animation: cmd-shine 1.4s linear infinite; background: linear-gradient(90deg, #1d1f1d 0%, #2a2d2a 50%, #1d1f1d 100%); background-size: 200% 100%; }
.cmd-gallery-sk { padding-top: 66%; }

.cmd-map {
  max-width: 1100px;
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
.cmd-map .leaflet-container img { max-width: none !important; max-height: none !important; height: auto; }

.cmd-footer {
  max-width: 1100px; margin: 36px auto 60px; padding: 0 20px;
  display: flex; justify-content: center;
}
.cmd-footer-back {
  display: inline-flex; align-items: center; gap: 6px;
  color: #c6c6c6; text-decoration: none;
  font-size: 0.88rem; font-weight: 600;
  padding: 10px 18px; border-radius: 999px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
}
.cmd-footer-back:hover { background: rgba(255,255,255,0.1); color: #fff; }

.cmd-empty {
  max-width: 720px; margin: 60px auto; padding: 40px 24px;
  background: rgba(20, 24, 22, 0.75);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  text-align: center;
}
.cmd-empty-emoji { font-size: 44px; }
.cmd-empty-title { margin-top: 10px; font-size: 1.1rem; font-weight: 800; color: #f5f5f5; }
.cmd-empty-desc { margin-top: 8px; color: #aaa; font-size: 0.9rem; line-height: 1.5; }
.cmd-empty-actions { margin-top: 18px; display: flex; justify-content: center; }
.cmd-empty-cta {
  display: inline-flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, #16a34a, #0ea5e9);
  color: #fff; text-decoration: none;
  font-weight: 700; font-size: 0.9rem;
  padding: 10px 18px; border-radius: 999px;
  box-shadow: 0 6px 16px rgba(16,185,129,0.3);
}

.cmd-skeleton-wrap { max-width: 1100px; margin: 18px auto; padding: 0 20px; }
.cmd-sk-hero {
  height: 260px; border-radius: 18px;
  background: linear-gradient(90deg, #1d1f1d 0%, #2a2d2a 50%, #1d1f1d 100%);
  background-size: 200% 100%; animation: cmd-shine 1.6s linear infinite;
}
.cmd-sk-bar { display: flex; gap: 8px; margin-top: 14px; }
.cmd-sk-action {
  flex: 0 0 110px; height: 36px; border-radius: 999px;
  background: linear-gradient(90deg, #1d1f1d 0%, #2a2d2a 50%, #1d1f1d 100%);
  background-size: 200% 100%; animation: cmd-shine 1.6s linear infinite;
}
.cmd-sk-grid {
  display: grid; gap: 14px; margin-top: 22px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.cmd-sk-card {
  height: 140px; border-radius: 14px;
  background: linear-gradient(90deg, #1d1f1d 0%, #2a2d2a 50%, #1d1f1d 100%);
  background-size: 200% 100%; animation: cmd-shine 1.6s linear infinite;
}
.cmd-sk-message {
  margin-top: 18px; text-align: center; color: #888; font-size: 0.86rem;
}

@keyframes cmd-shine {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;
