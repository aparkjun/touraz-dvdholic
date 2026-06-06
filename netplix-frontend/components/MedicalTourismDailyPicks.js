"use client";

/**
 * MedicalTourismDailyPicks — /medical-tourism hero 아래 "오늘의 K-메디컬 3선" 큐레이션.
 *
 * <p>설계 목적: 페이지 첫 방문 시 "어디부터 봐야 할지" 모르는 외국인 환자에게
 * 데일리 로테이션으로 3곳의 이미지 큰 카드를 보여 준다. 날짜별로 결정적이라
 * 같은 날 여러 번 방문해도 같은 3곳이 노출되고, 매일 새로 바뀐다.
 *
 * <p>선택 로직:
 *  1) spots 에서 이미지·좌표를 가진 항목만 후보로 추림
 *  2) 후보가 부족하면 이미지 없는 항목도 보조로 보충
 *  3) dayOfYear 를 시드로 사용하는 mulberry32 PRNG 로 결정적 셔플
 *  4) 상위 3개 반환
 *
 * <p>표시 위치: Hero 바로 아래 (칩 위). 검색어·nearbyMode 가 활성인 경우는
 * 컨텍스트가 이미 존재하므로 표시하지 않는다 (page.js 에서 조건부 렌더).
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles, MapPin, Phone, Stethoscope, ChevronRight,
  Syringe, Smile, Leaf, Activity, HeartPulse, Bone,
} from "lucide-react";

/**
 * KTO 의료관광 데이터셋에는 시설 사진이 등록돼 있지 않다(detailCommon orgImage/thumbImage 공란).
 * 또 medClusterCd(category)도 응답에서 비어 오는 경우가 많아, 시설명 키워드로 진료분야를 추론해
 * 분야별 테마(그라데이션+아이콘+라벨)를 입힌다. 실제 imageUrl 이 있으면 사진을 우선 사용한다.
 */
const CATEGORY_THEMES = {
  plastic:  { Icon: Syringe,    grad: "linear-gradient(135deg,#fb7185 0%,#9333ea 100%)", ko: "성형·미용", en: "Plastic Surgery" },
  beauty:   { Icon: Sparkles,   grad: "linear-gradient(135deg,#f472b6 0%,#f59e0b 100%)", ko: "피부·뷰티", en: "Skin & Beauty" },
  dental:   { Icon: Smile,      grad: "linear-gradient(135deg,#22d3ee 0%,#3b82f6 100%)", ko: "치과",      en: "Dental" },
  herbal:   { Icon: Leaf,       grad: "linear-gradient(135deg,#34d399 0%,#0d9488 100%)", ko: "한방",      en: "Korean Medicine" },
  spine:    { Icon: Bone,       grad: "linear-gradient(135deg,#a78bfa 0%,#6366f1 100%)", ko: "재활·척추", en: "Spine & Rehab" },
  women:    { Icon: HeartPulse, grad: "linear-gradient(135deg,#f9a8d4 0%,#db2777 100%)", ko: "여성의료", en: "Women's Health" },
  general:  { Icon: Stethoscope,grad: "linear-gradient(135deg,#38bdf8 0%,#6d28d9 100%)", ko: "종합의료", en: "General Medical" },
};

function inferTheme(name) {
  const s = (name || "").toLowerCase();
  if (/성형|plastic|aesthetic|미용성형/.test(s)) return "plastic";
  if (/피부|derma|뷰티|beauty|미용|skin/.test(s)) return "beauty";
  if (/치과|dental|치아/.test(s)) return "dental";
  if (/한의원|한방|한의|korean medicine|oriental|herbal/.test(s)) return "herbal";
  if (/재활|rehab|척추|spine|정형|ortho|관절|joint|디스크/.test(s)) return "spine";
  if (/여성|women|산부인과|obgyn|ob\/gyn|womens?/.test(s)) return "women";
  return "general";
}

/**
 * 날짜를 시드로 하는 결정적 PRNG.
 * 같은 날에는 무조건 같은 3개, 다음날 바뀐다.
 */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function pickDaily(spots) {
  if (!Array.isArray(spots) || spots.length === 0) return [];
  const withImage = spots.filter((s) => s?.imageUrl && s?.id);
  const fallback = spots.filter((s) => !s?.imageUrl && s?.id);
  const pool = withImage.length >= 3 ? withImage : [...withImage, ...fallback];
  if (pool.length === 0) return [];

  // dayOfYear + year 을 시드로 → 같은 해 같은 날 고정
  const seed = dayOfYear() + new Date().getFullYear() * 1000;
  const rand = mulberry32(seed);
  const shuffled = [...pool]
    .map((s) => ({ s, k: rand() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.s);
  return shuffled.slice(0, 3);
}

export default function MedicalTourismDailyPicks({ spots, onOpen }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n?.language || "ko").toLowerCase();
  const picks = useMemo(() => pickDaily(spots), [spots]);

  if (picks.length === 0) return null;

  return (
    <section className="mtp-root" aria-label={t("medicalTourism.dailyPicks.aria", "오늘의 K-메디컬 3선")}>
      <style>{cssBlock}</style>
      <header className="mtp-head">
        <span className="mtp-badge">
          <Sparkles size={12} />
          {t("medicalTourism.dailyPicks.title", "오늘의 K-메디컬 3선")}
        </span>
        <span className="mtp-sub">
          {t("medicalTourism.dailyPicks.sub", "매일 바뀌는 외국인 환영 의료관광 큐레이션")}
        </span>
      </header>
      <div className="mtp-grid">
        {picks.map((s, i) => {
          const theme = CATEGORY_THEMES[inferTheme(s.name)] || CATEGORY_THEMES.general;
          const ThemeIcon = theme.Icon;
          const themeLabel = lang.startsWith("en") ? theme.en : theme.ko;
          return (
          <button
            key={s.id}
            type="button"
            className="mtp-card"
            onClick={() => onOpen?.(s)}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="mtp-img" style={s.imageUrl ? undefined : { backgroundImage: theme.grad }}>
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.name || ""}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <div className="mtp-img-themed">
                  <ThemeIcon size={46} strokeWidth={1.5} />
                  <span className="mtp-img-cat">{themeLabel}</span>
                </div>
              )}
              <span className="mtp-rank">#{i + 1}</span>
              <div className="mtp-grad" />
            </div>
            <div className="mtp-body">
              <div className="mtp-title" title={s.name || ""}>{s.name}</div>
              {s.address && (
                <div className="mtp-meta">
                  <MapPin size={11} />
                  <span>{s.address}</span>
                </div>
              )}
              {s.tel && (
                <div className="mtp-meta mtp-meta-sub">
                  <Phone size={11} />
                  <span>{s.tel}</span>
                </div>
              )}
              <span className="mtp-cta">
                {t("medicalTourism.dailyPicks.cta", "상세보기")}
                <ChevronRight size={12} />
              </span>
            </div>
          </button>
          );
        })}
      </div>
    </section>
  );
}

const cssBlock = `
.mtp-root {
  max-width: 1200px;
  margin: -6px auto 20px;
  padding: 0 16px;
}
.mtp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.mtp-badge {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(249,115,22,0.12));
  border: 1px solid rgba(252,165,165,0.35);
  color: #fecaca;
}
.mtp-sub { font-size: 0.78rem; color: #94a3b8; }

.mtp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
}

.mtp-card {
  position: relative;
  display: flex; flex-direction: column;
  text-align: left;
  cursor: pointer;
  padding: 0;
  background: rgba(20, 16, 36, 0.85);
  border: 1px solid rgba(252, 165, 165, 0.2);
  border-radius: 16px;
  overflow: hidden;
  color: inherit;
  font: inherit;
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
  transition: transform 0.22s ease, border-color 0.2s, box-shadow 0.2s;
  opacity: 0;
  animation: mtp-in 0.45s ease-out forwards;
}
@keyframes mtp-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.mtp-card:hover {
  transform: translateY(-4px);
  border-color: rgba(252, 165, 165, 0.6);
  box-shadow: 0 18px 36px rgba(239,68,68,0.22);
}
.mtp-card:focus-visible {
  outline: 2px solid rgba(239,68,68,0.7);
  outline-offset: 2px;
}

.mtp-img {
  position: relative; width: 100%; padding-top: 56%;
  background: linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(124,45,18,0.4) 100%);
  overflow: hidden;
}
.mtp-img img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.mtp-img-themed {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 8px;
  color: rgba(255,255,255,0.95);
  text-shadow: 0 1px 6px rgba(0,0,0,0.25);
}
.mtp-img-themed > svg { opacity: 0.92; }
.mtp-img-cat {
  font-size: 0.82rem; font-weight: 800; letter-spacing: 0.02em;
  padding: 3px 11px; border-radius: 999px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.3);
  backdrop-filter: blur(3px);
}
.mtp-grad {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(12,8,24,0.6) 100%);
  pointer-events: none;
}
.mtp-rank {
  position: absolute;
  top: 10px; left: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 0.7rem; font-weight: 900; letter-spacing: 0.04em;
  background: rgba(239,68,68,0.85);
  color: #fff;
  border: 1px solid rgba(254,202,202,0.55);
  backdrop-filter: blur(4px);
}

.mtp-body {
  padding: 12px 14px 14px;
  display: flex; flex-direction: column; gap: 5px;
}
.mtp-title {
  font-size: 0.98rem; font-weight: 800;
  color: #fff;
  line-height: 1.3;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.mtp-meta {
  display: inline-flex; align-items: flex-start; gap: 4px;
  font-size: 0.78rem; line-height: 1.4;
  color: #cbd5e1;
}
.mtp-meta > svg { flex: 0 0 auto; margin-top: 3px; color: #fca5a5; }
.mtp-meta-sub { color: #94a3b8; }
.mtp-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.mtp-cta {
  margin-top: 4px;
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 0.75rem;
  font-weight: 800;
  color: #fda4af;
  transition: color 0.15s, gap 0.15s;
}
.mtp-card:hover .mtp-cta { color: #fff; gap: 6px; }
`;
