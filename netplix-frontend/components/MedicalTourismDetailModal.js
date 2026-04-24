"use client";

/**
 * MedicalTourismDetailModal — /medical-tourism 카드 클릭 시 열리는 상세 오버레이.
 *
 * <p>설계 배경: K-의료관광 페이지는 외국인 환자를 1차 타깃으로 하므로,
 * 카드 자체는 "훑어보기" 용도로 두고, 클릭 시 "행동(Action)"을 바로 실행할 수
 * 있는 모달을 제공한다. 즉 "보는 콘텐츠 → 행동하는 콘텐츠"로 전환한다.
 *
 * <p>제공 액션:
 *  - 📞 전화걸기 (tel:) — 한국 번호는 +82 국제 포맷으로 자동 변환해 해외 로밍에서도 작동
 *  - 🧭 경로 안내 — Google Maps dir/ 딥링크 (내 위치 있으면 origin 포함)
 *  - 🗺️ 지도에서 보기 — 좌표 우선, 없으면 주소로 Google Maps 검색
 *  - 📋 공유하기 — Web Share API → 클립보드 폴백
 *
 * <p>접근성:
 *  - role="dialog", aria-modal="true", aria-labelledby 로 스크린리더 지원
 *  - Escape 키 / 배경 클릭 닫기
 *  - 포커스 트랩은 1차 스코프에서 생략 (2차에서 재검토)
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useMedicalFavorites } from "@/lib/useMedicalFavorites";
import { areaLabel, resolveAreaCode } from "@/lib/regionAreaCode";
import {
  X,
  Phone,
  MapPin,
  Navigation,
  Share2,
  Map as MapIcon,
  Copy,
  Check,
  Globe2,
  Stethoscope,
  Ruler,
  Mail,
  Heart,
  Headphones,
  Leaf,
  Film,
  Activity,
} from "lucide-react";

/**
 * 한국 전화번호를 국제(+82) 포맷으로 변환한다.
 * 숫자와 +만 남기고, 선두 0 을 +82 로 치환. 이미 +로 시작하면 원본 유지.
 * 비어있거나 변환 불가하면 null.
 */
function toIntlPhone(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    return trimmed.replace(/[^\d+]/g, "");
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("82")) return `+${digits}`;
  if (digits.startsWith("0")) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

/**
 * Google Maps 경로/탐색 URL 생성기.
 * origin 이 있으면 dir 모드로 양끝 좌표를 넘기고, 없으면 destination 만 넘긴다.
 * 좌표가 없으면 주소 기반 검색 URL.
 */
function buildMapsUrl({ spot, userPos, mode }) {
  const hasCoords = spot?.latitude != null && spot?.longitude != null;
  const destCoord = hasCoords ? `${spot.latitude},${spot.longitude}` : null;
  const destText = spot?.address
    ? encodeURIComponent(spot.address)
    : spot?.name
    ? encodeURIComponent(spot.name)
    : null;

  if (mode === "directions") {
    const params = new URLSearchParams();
    params.set("api", "1");
    if (destCoord) params.set("destination", destCoord);
    else if (destText) params.set("destination", destText);
    if (userPos?.lat != null && userPos?.lon != null) {
      params.set("origin", `${userPos.lat},${userPos.lon}`);
    }
    params.set("travelmode", "transit");
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  // "view" 모드: 단순 보기
  if (destCoord) {
    return `https://www.google.com/maps/search/?api=1&query=${destCoord}`;
  }
  if (destText) {
    return `https://www.google.com/maps/search/?api=1&query=${destText}`;
  }
  return null;
}

export default function MedicalTourismDetailModal({ spot, userPos, onClose }) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");

  const { isSaved, toggle, hydrated: favHydrated } = useMedicalFavorites();
  const saved = favHydrated && spot ? isSaved(spot.id) : false;

  // 교차 네비게이션용 지역명 도출: spot.areaCode 우선, 없으면 address 파싱.
  // 광역 시·도 레벨이 가장 넓게 매칭되므로 쿼리 적중률이 높다.
  const regionInfo = useMemo(() => {
    if (!spot) return { label: "", code: null };
    let code = spot.areaCode != null ? String(spot.areaCode) : null;
    if (!code && spot.address) code = resolveAreaCode(spot.address);
    const label = code ? areaLabel(code) : (spot.address || "").split(/\s+/)[0] || "";
    return { label, code };
  }, [spot]);

  const intlPhone = useMemo(() => toIntlPhone(spot?.tel), [spot?.tel]);
  const directionsUrl = useMemo(
    () => buildMapsUrl({ spot, userPos, mode: "directions" }),
    [spot, userPos]
  );
  const viewUrl = useMemo(
    () => buildMapsUrl({ spot, userPos, mode: "view" }),
    [spot, userPos]
  );
  const kakaoMapUrl = useMemo(() => {
    if (!spot) return null;
    if (spot.address) return `https://map.kakao.com/link/search/${encodeURIComponent(spot.address)}`;
    if (spot.name) return `https://map.kakao.com/link/search/${encodeURIComponent(spot.name)}`;
    return null;
  }, [spot]);

  const langBadge = useMemo(() => {
    const raw = (spot?.language || i18n?.language || "ko").toLowerCase();
    return raw.startsWith("en") ? "EN" : "KO";
  }, [spot?.language, i18n?.language]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    // 바디 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleShare = async () => {
    setShareError("");
    const shareText = [
      spot?.name,
      spot?.address,
      intlPhone || spot?.tel,
      viewUrl,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) {
        await navigator.share({
          title: spot?.name || "K-Medical Tourism",
          text: spot?.address || "",
          url: viewUrl || window.location.href,
        });
        return;
      }
    } catch (e) {
      // 사용자가 share 다이얼로그를 취소한 경우. 조용히 폴백 없이 종료.
      if (e?.name === "AbortError") return;
    }
    // 폴백: 클립보드 복사
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (_) {
      setShareError(
        t(
          "medicalTourism.detail.shareFail",
          "공유에 실패했어요. 주소를 직접 복사해 주세요."
        )
      );
    }
  };

  if (!spot) return null;

  return (
    <div
      className="mtd-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mtd-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <style>{cssBlock}</style>
      <div className="mtd-modal">
        <button
          type="button"
          className="mtd-close"
          onClick={onClose}
          aria-label={t("medicalTourism.detail.close", "닫기")}
        >
          <X size={20} />
        </button>

        {/* 즐겨찾기 토글: 닫기 버튼 옆에 원형 하트 버튼으로 배치 */}
        <button
          type="button"
          className={`mtd-fav ${saved ? "mtd-fav-on" : ""}`}
          onClick={() => toggle(spot)}
          aria-pressed={saved}
          aria-label={
            saved
              ? t("medicalTourism.detail.unfav", "즐겨찾기 해제")
              : t("medicalTourism.detail.fav", "즐겨찾기에 저장")
          }
        >
          <Heart size={18} fill={saved ? "currentColor" : "none"} />
        </button>

        <div className="mtd-hero">
          {spot.imageUrl ? (
            <img
              src={spot.imageUrl}
              alt={spot.name || ""}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="mtd-hero-fallback">
              <Stethoscope size={56} />
            </div>
          )}
          <div className="mtd-hero-grad" />
          <div className="mtd-hero-badges">
            {spot.category && (
              <span className="mtd-badge mtd-badge-cat">
                <Stethoscope size={11} />
                {spot.category}
              </span>
            )}
            <span className="mtd-badge mtd-badge-lang">
              <Globe2 size={11} />
              {langBadge}
            </span>
            {spot.distanceKm != null && (
              <span className="mtd-badge mtd-badge-dist">
                <Ruler size={11} />
                {spot.distanceKm < 1
                  ? `${Math.round(spot.distanceKm * 1000)}m`
                  : `${spot.distanceKm.toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>

        <div className="mtd-content">
          <h2 id="mtd-title" className="mtd-title">
            {spot.name}
          </h2>

          <ul className="mtd-info">
            {spot.address && (
              <li className="mtd-info-item">
                <MapPin size={14} />
                <span>{spot.address}</span>
                {spot.zipcode && <span className="mtd-zip">({spot.zipcode})</span>}
              </li>
            )}
            {spot.tel && (
              <li className="mtd-info-item">
                <Phone size={14} />
                {intlPhone ? (
                  <a href={`tel:${intlPhone}`} className="mtd-tel-link">
                    {spot.tel}
                    <span className="mtd-tel-intl">· {intlPhone}</span>
                  </a>
                ) : (
                  <span>{spot.tel}</span>
                )}
              </li>
            )}
          </ul>

          {/*
           * 4개 액션 버튼: 전화·경로·지도·공유.
           * 외국인 환자 관점에서 가장 자주 필요한 행동을 모달 하단에 원탭으로 배치.
           */}
          <div className="mtd-actions">
            {intlPhone ? (
              <a href={`tel:${intlPhone}`} className="mtd-act mtd-act-call">
                <Phone size={16} />
                <span>{t("medicalTourism.detail.call", "전화걸기")}</span>
              </a>
            ) : (
              <button type="button" className="mtd-act mtd-act-call" disabled>
                <Phone size={16} />
                <span>{t("medicalTourism.detail.call", "전화걸기")}</span>
              </button>
            )}
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mtd-act mtd-act-dir"
              >
                <Navigation size={16} />
                <span>{t("medicalTourism.detail.directions", "경로 안내")}</span>
              </a>
            ) : (
              <button type="button" className="mtd-act mtd-act-dir" disabled>
                <Navigation size={16} />
                <span>{t("medicalTourism.detail.directions", "경로 안내")}</span>
              </button>
            )}
            {viewUrl ? (
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mtd-act mtd-act-map"
              >
                <MapIcon size={16} />
                <span>{t("medicalTourism.detail.viewMap", "지도에서 보기")}</span>
              </a>
            ) : (
              <button type="button" className="mtd-act mtd-act-map" disabled>
                <MapIcon size={16} />
                <span>{t("medicalTourism.detail.viewMap", "지도에서 보기")}</span>
              </button>
            )}
            <button
              type="button"
              className={`mtd-act mtd-act-share ${copied ? "mtd-act-ok" : ""}`}
              onClick={handleShare}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              <span>
                {copied
                  ? t("medicalTourism.detail.copied", "복사됨")
                  : t("medicalTourism.detail.share", "공유하기")}
              </span>
            </button>
          </div>

          {kakaoMapUrl && (
            <a
              href={kakaoMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mtd-kakao"
            >
              <MapIcon size={14} />
              {t("medicalTourism.detail.kakao", "카카오맵으로 열기")}
            </a>
          )}

          {shareError && <div className="mtd-error">{shareError}</div>}

          {/*
           * 4종 교차 네비게이션 칩: 같은 지역의 다른 여행 컨텍스트로 연결.
           * K-의료관광 방문객이 "시술 전/후 시간 활용" 으로 즉시 이동할 수 있게 한다.
           *   - 🎧 오디오가이드: 이동 시간에 귀로 듣는 도시 소개
           *   - 🧘 웰니스: 시술 전후 회복 · 힐링 스팟
           *   - 🎬 Cine-Trip: 대기 시간에 촬영지 투어
           *   - 📊 혼잡도: 붐비지 않는 날짜 고르기
           * 지역명을 얻지 못한 경우(드문 케이스)는 전역 페이지로 연결한다.
           */}
          {regionInfo.label && (
            <div className="mtd-cross">
              <div className="mtd-cross-head">
                <span className="mtd-cross-region">{regionInfo.label}</span>
                <span className="mtd-cross-sub">
                  {t(
                    "medicalTourism.detail.crossHint",
                    "시술 전후 시간, 이 지역을 다르게 즐겨 보세요"
                  )}
                </span>
              </div>
              <div className="mtd-cross-chips">
                <Link
                  href={`/audio-guide?q=${encodeURIComponent(regionInfo.label)}`}
                  className="mtd-chip mtd-chip-audio"
                  onClick={onClose}
                >
                  <Headphones size={13} />
                  <span>{t("medicalTourism.detail.crossAudio", "이동길 오디오 가이드")}</span>
                </Link>
                <Link
                  href={`/wellness?q=${encodeURIComponent(regionInfo.label)}`}
                  className="mtd-chip mtd-chip-wellness"
                  onClick={onClose}
                >
                  <Leaf size={13} />
                  <span>{t("medicalTourism.detail.crossWellness", "시술 전후 힐링")}</span>
                </Link>
                <Link
                  href={`/cine-trip?q=${encodeURIComponent(regionInfo.label)}`}
                  className="mtd-chip mtd-chip-cine"
                  onClick={onClose}
                >
                  <Film size={13} />
                  <span>{t("medicalTourism.detail.crossCine", "대기시간 촬영지 투어")}</span>
                </Link>
                {regionInfo.code && (
                  <Link
                    href={`/crowd-radar?area=${encodeURIComponent(regionInfo.code)}`}
                    className="mtd-chip mtd-chip-crowd"
                    onClick={onClose}
                  >
                    <Activity size={13} />
                    <span>{t("medicalTourism.detail.crossCrowd", "한가한 날 고르기")}</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="mtd-hint">
            <Mail size={12} />
            {t(
              "medicalTourism.detail.hint",
              "외국인 환자 코디네이터 연결은 해당 의료기관 대표번호로 문의해 주세요."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const cssBlock = `
.mtd-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(10, 6, 20, 0.72);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
  animation: mtd-fade-in 0.22s ease-out;
}
@keyframes mtd-fade-in { from { opacity: 0; } to { opacity: 1; } }

.mtd-modal {
  position: relative;
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 32px);
  overflow: hidden auto;
  border-radius: 20px;
  background: linear-gradient(180deg, #15101f 0%, #0c0818 100%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  color: #f3f4f6;
  animation: mtd-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes mtd-pop {
  from { opacity: 0; transform: translateY(18px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.mtd-close {
  position: absolute;
  top: 12px; right: 12px;
  z-index: 3;
  width: 36px; height: 36px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.15s;
}
.mtd-close:hover { background: rgba(239,68,68,0.8); border-color: transparent; }

.mtd-fav {
  position: absolute;
  top: 12px; right: 56px;
  z-index: 3;
  width: 36px; height: 36px;
  border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  color: #fecaca;
  border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.15s, color 0.15s, transform 0.15s;
}
.mtd-fav:hover { transform: scale(1.08); background: rgba(239,68,68,0.35); }
.mtd-fav-on {
  background: rgba(239,68,68,0.9);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 0 0 3px rgba(239,68,68,0.2);
}

.mtd-hero {
  position: relative;
  width: 100%; height: 220px;
  overflow: hidden;
  background: linear-gradient(135deg, #dc2626 0%, #7c2d12 100%);
}
.mtd-hero img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.mtd-hero-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: rgba(255,255,255,0.55);
}
.mtd-hero-grad {
  position: absolute; inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(12,8,24,0.85) 100%);
}
.mtd-hero-badges {
  position: absolute;
  left: 14px; bottom: 12px;
  display: flex; gap: 6px; flex-wrap: wrap;
}
.mtd-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 0.7rem; font-weight: 800;
  letter-spacing: 0.03em;
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.2);
  backdrop-filter: blur(6px);
}
.mtd-badge-cat  { background: rgba(239,68,68,0.45); border-color: rgba(254,202,202,0.5); }
.mtd-badge-lang { background: rgba(59,130,246,0.45); border-color: rgba(191,219,254,0.5); }
.mtd-badge-dist { background: rgba(16,185,129,0.45); border-color: rgba(167,243,208,0.5); }

.mtd-content {
  padding: 18px 20px 22px;
}

.mtd-title {
  margin: 2px 0 12px;
  font-size: 1.35rem;
  font-weight: 900;
  letter-spacing: -0.2px;
  color: #fff;
  line-height: 1.3;
}

.mtd-info { list-style: none; padding: 0; margin: 0 0 18px; display: flex; flex-direction: column; gap: 8px; }
.mtd-info-item {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 0.9rem; line-height: 1.45;
  color: #cbd5e1;
}
.mtd-info-item > svg { flex: 0 0 auto; margin-top: 3px; color: #fca5a5; }
.mtd-zip { color: #94a3b8; margin-left: 4px; font-size: 0.82rem; }
.mtd-tel-link {
  color: #fecaca;
  text-decoration: none;
  font-weight: 700;
}
.mtd-tel-link:hover { color: #fff; text-decoration: underline; }
.mtd-tel-intl { color: #94a3b8; font-weight: 500; font-size: 0.82rem; margin-left: 6px; }

/* 4개 액션 버튼 그리드 */
.mtd-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.mtd-act {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 11px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #f3f4f6;
  font-size: 0.85rem;
  font-weight: 800;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.12s ease, background 0.15s, border-color 0.15s;
}
.mtd-act:hover:not(:disabled) { transform: translateY(-2px); }
.mtd-act:disabled { opacity: 0.4; cursor: not-allowed; }

.mtd-act-call  { background: linear-gradient(135deg, rgba(239,68,68,0.28), rgba(239,68,68,0.12)); border-color: rgba(254,202,202,0.35); }
.mtd-act-call:hover:not(:disabled) { background: linear-gradient(135deg, rgba(239,68,68,0.5), rgba(239,68,68,0.28)); }

.mtd-act-dir   { background: linear-gradient(135deg, rgba(59,130,246,0.28), rgba(59,130,246,0.12)); border-color: rgba(191,219,254,0.35); }
.mtd-act-dir:hover:not(:disabled) { background: linear-gradient(135deg, rgba(59,130,246,0.5), rgba(59,130,246,0.28)); }

.mtd-act-map   { background: linear-gradient(135deg, rgba(16,185,129,0.28), rgba(16,185,129,0.12)); border-color: rgba(167,243,208,0.35); }
.mtd-act-map:hover:not(:disabled) { background: linear-gradient(135deg, rgba(16,185,129,0.5), rgba(16,185,129,0.28)); }

.mtd-act-share { background: linear-gradient(135deg, rgba(167,139,250,0.28), rgba(167,139,250,0.12)); border-color: rgba(221,214,254,0.35); }
.mtd-act-share:hover:not(:disabled) { background: linear-gradient(135deg, rgba(167,139,250,0.5), rgba(167,139,250,0.28)); }
.mtd-act-ok { background: linear-gradient(135deg, rgba(16,185,129,0.5), rgba(16,185,129,0.28)) !important; border-color: rgba(167,243,208,0.6) !important; color: #d1fae5 !important; }

.mtd-kakao {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(252,225,69,0.12);
  border: 1px solid rgba(252,225,69,0.35);
  color: #fde68a;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
  transition: background 0.15s;
}
.mtd-kakao:hover { background: rgba(252,225,69,0.22); color: #fff; }

.mtd-error {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(252,165,165,0.35);
  color: #fecaca;
  font-size: 0.78rem;
}

/* 4종 교차 네비게이션 칩: 모달 하단, 힌트 위 */
.mtd-cross {
  margin-top: 18px;
  padding: 12px 12px 10px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));
  border: 1px solid rgba(255,255,255,0.08);
}
.mtd-cross-head {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  margin-bottom: 8px;
}
.mtd-cross-region {
  font-size: 0.82rem;
  font-weight: 900;
  color: #fff;
  background: rgba(239,68,68,0.3);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(252,165,165,0.4);
}
.mtd-cross-sub { font-size: 0.72rem; color: #94a3b8; }
.mtd-cross-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.mtd-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  text-decoration: none;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05);
  transition: transform 0.12s ease, background 0.15s, border-color 0.15s;
  cursor: pointer;
}
.mtd-chip:hover { transform: translateY(-1px); }
.mtd-chip-audio    { background: rgba(167,139,250,0.18); border-color: rgba(221,214,254,0.3); color: #ddd6fe; }
.mtd-chip-audio:hover    { background: rgba(167,139,250,0.4); color: #fff; }
.mtd-chip-wellness { background: rgba(45,212,191,0.18); border-color: rgba(153,246,228,0.3); color: #99f6e4; }
.mtd-chip-wellness:hover { background: rgba(45,212,191,0.4); color: #fff; }
.mtd-chip-cine     { background: rgba(251,191,36,0.18); border-color: rgba(253,224,71,0.3); color: #fde68a; }
.mtd-chip-cine:hover     { background: rgba(251,191,36,0.4); color: #fff; }
.mtd-chip-crowd    { background: rgba(244,114,182,0.18); border-color: rgba(249,168,212,0.3); color: #fbcfe8; }
.mtd-chip-crowd:hover    { background: rgba(244,114,182,0.4); color: #fff; }

.mtd-hint {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(255,255,255,0.08);
  display: inline-flex; align-items: flex-start; gap: 5px;
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.45;
}
.mtd-hint > svg { flex: 0 0 auto; margin-top: 2px; }

@media (max-width: 480px) {
  .mtd-hero { height: 180px; }
  .mtd-title { font-size: 1.2rem; }
  .mtd-actions { grid-template-columns: 1fr 1fr; }
  .mtd-fav { right: 52px; width: 34px; height: 34px; }
  .mtd-close { width: 34px; height: 34px; }
}
`;
