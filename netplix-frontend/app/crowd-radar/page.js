"use client";

/**
 * /crowd-radar — "Quiet Set Radar" 전국 관광지 30일 혼잡도 레이더.
 *
 * <p>컨셉: "영화는 왁자지껄했지만, 촬영지는 한가할 때 가자."
 *  - 한국관광공사 TatsCnctrRateService (공공데이터 15128555) — KT 빅데이터 기반 관광지 30일 집중률 예측
 *  - 17개 광역 대표 시군구를 한 번에 모아 한산한 순/혼잡한 순 랭킹
 *  - DVD 반납길·영화 촬영지 답사를 "인파 없는 날"로 스케줄링
 *
 * <p>데이터 소스:
 *  - GET /api/v1/cine-trip/concentration/overview
 *
 * <p>UI 구성:
 *  - Hero: 레이더 스크린 + 요약 지표
 *  - 날짜 프리셋 (오늘 / 이번 주말 / 다음 주 / 30일 전체)
 *  - 정렬 (한산한 순 / 혼잡한 순)
 *  - 지역 칩 (17개 광역 + 전체)
 *  - 관광지 카드 그리드 (30일 sparkline + 최저일 배지 + 영화 매칭 배지)
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import axios from "@/lib/axiosConfig";
import {
  Radar,
  MapPin,
  TrendingDown,
  TrendingUp,
  CalendarDays,
  Film,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from "lucide-react";

const AREA_LABEL = {
  "1": "서울",
  "2": "인천",
  "3": "대전",
  "4": "대구",
  "5": "광주",
  "6": "부산",
  "7": "울산",
  "8": "세종",
  "31": "경기",
  "32": "강원",
  "33": "충북",
  "34": "충남",
  "35": "경북",
  "36": "경남",
  "37": "전북",
  "38": "전남",
  "39": "제주",
};

const AREA_ORDER = ["1", "6", "2", "3", "4", "5", "7", "8", "31", "32", "33", "34", "35", "36", "37", "38", "39"];

/**
 * 관광지명(tAtsNm) → 영화/드라마 매칭 큐레이션.
 * Odii/KorService2 표준과 무관하게 대표적인 촬영지만 하드코딩.
 * key는 관광지명에 포함된 핵심 키워드(부분일치)로 매칭.
 */
const MOVIE_MATCH = [
  { keys: ["경복궁", "광화문"], items: ["궁", "해를 품은 달", "상속자들", "미스터 션샤인"] },
  { keys: ["창덕궁", "창경궁"], items: ["스캔들", "옷소매 붉은 끝동"] },
  { keys: ["덕수궁"], items: ["덕혜옹주", "미스터 션샤인"] },
  { keys: ["남이섬", "자라섬"], items: ["겨울연가"] },
  { keys: ["용두산", "부산타워"], items: ["국제시장", "친구"] },
  { keys: ["해운대", "광안"], items: ["해운대", "무뢰한", "부산행"] },
  { keys: ["감천문화마을"], items: ["변호인", "범죄와의 전쟁"] },
  { keys: ["전주한옥", "한옥마을", "경기전"], items: ["택시운전사", "범죄도시", "최종병기 활"] },
  { keys: ["경주", "불국사", "석굴암", "첨성대", "동궁과 월지"], items: ["경주", "리틀 포레스트"] },
  { keys: ["부여", "백제문화단지", "궁남지"], items: ["서동요", "쌍화점"] },
  { keys: ["여수", "오동도", "밤바다"], items: ["여수밤바다", "건축학개론"] },
  { keys: ["제주", "1100", "한라산", "성산일출봉", "우도"], items: ["건축학개론", "맨발의 친구들", "지슬"] },
  { keys: ["속초", "설악산"], items: ["1987", "브로커"] },
  { keys: ["강릉", "경포", "정동진"], items: ["모래시계", "연애의 온도"] },
  { keys: ["통영", "동피랑", "케이블카"], items: ["그대를 사랑합니다", "명량"] },
  { keys: ["청풍", "단양", "도담삼봉"], items: ["신과함께", "남한산성"] },
  { keys: ["대구 근대골목", "김광석"], items: ["브라더후드", "군함도"] },
  { keys: ["5.18", "금남로", "국립아시아문화전당"], items: ["택시운전사", "1987"] },
  { keys: ["세종"], items: ["시동"] },
];

function matchMovies(spotName) {
  if (!spotName) return [];
  const lowered = String(spotName);
  const out = [];
  for (const m of MOVIE_MATCH) {
    if (m.keys.some((k) => lowered.includes(k))) {
      for (const title of m.items) if (!out.includes(title)) out.push(title);
    }
  }
  return out;
}

function levelColor(rate) {
  if (rate == null) return "#555";
  if (rate < 30) return "#10b981";
  if (rate < 60) return "#f59e0b";
  if (rate < 85) return "#fb7185";
  return "#ef4444";
}

function levelLabel(rate, t) {
  if (rate == null) return "-";
  if (rate < 30) return t("crowdRadar.level.quiet", "여유");
  if (rate < 60) return t("crowdRadar.level.normal", "보통");
  if (rate < 85) return t("crowdRadar.level.busy", "혼잡");
  return t("crowdRadar.level.veryBusy", "매우 혼잡");
}

function toLocalDate(d) {
  if (!d) return null;
  if (Array.isArray(d)) return new Date(d[0], d[1] - 1, d[2]);
  const parsed = new Date(d);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function fmtMMDD(d) {
  if (!d) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${mm}.${dd} (${dow})`;
}

/**
 * overview 원본 rows(각각 1일치) → 관광지별 (spotKey) 그룹화.
 * spotKey = areaCode|signguCode|spotName
 */
function groupBySpot(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = [r.areaCode, r.signguCode, r.spotName].join("|");
    if (!map.has(key)) {
      map.set(key, {
        key,
        areaCode: r.areaCode,
        areaName: r.areaName,
        signguCode: r.signguCode,
        signguName: r.signguName,
        spotName: r.spotName,
        series: [],
      });
    }
    const entry = map.get(key);
    const d = toLocalDate(r.baseDate);
    if (d && typeof r.concentrationRate === "number") {
      entry.series.push({ date: d, rate: r.concentrationRate });
    }
  }
  for (const v of map.values()) {
    v.series.sort((a, b) => a.date - b.date);
    if (v.series.length > 0) {
      v.avgRate = v.series.reduce((s, x) => s + x.rate, 0) / v.series.length;
      v.minEntry = v.series.reduce((a, b) => (a.rate <= b.rate ? a : b));
      v.maxEntry = v.series.reduce((a, b) => (a.rate >= b.rate ? a : b));
    } else {
      v.avgRate = null;
      v.minEntry = null;
      v.maxEntry = null;
    }
    v.movies = matchMovies(v.spotName);
  }
  return Array.from(map.values());
}

const PRESETS = [
  { id: "today", ko: "오늘", en: "Today" },
  { id: "weekend", ko: "이번 주말", en: "This Weekend" },
  { id: "nextweek", ko: "다음 주", en: "Next Week" },
  { id: "all", ko: "30일 전체", en: "All 30 days" },
];

function rangeForPreset(id) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === "today") {
    return { start, end: start };
  }
  if (id === "weekend") {
    const day = start.getDay();
    const toSat = (6 - day + 7) % 7;
    const sat = new Date(start);
    sat.setDate(sat.getDate() + toSat);
    const sun = new Date(sat);
    sun.setDate(sun.getDate() + 1);
    return { start: sat, end: sun };
  }
  if (id === "nextweek") {
    const day = start.getDay();
    const toMon = ((8 - day) % 7) || 7;
    const mon = new Date(start);
    mon.setDate(mon.getDate() + toMon);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return { start: mon, end: sun };
  }
  return null;
}

export default function CrowdRadarPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEn = (i18n?.language || "ko").toLowerCase().startsWith("en");

  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [preset, setPreset] = useState("weekend");
  const [areaFilter, setAreaFilter] = useState("all");
  const [sortMode, setSortMode] = useState("quiet"); // quiet | busy

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await axios.get("/api/v1/cine-trip/concentration/overview");
        const data = res?.data?.data ?? [];
        if (alive) setRawRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[crowd-radar] fetch overview failed", e);
        if (alive) setErrorMsg(e?.message || "failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const spots = useMemo(() => groupBySpot(rawRows), [rawRows]);

  const filteredSpots = useMemo(() => {
    let s = spots;
    if (areaFilter !== "all") {
      s = s.filter((x) => x.areaCode === areaFilter);
    }
    return s;
  }, [spots, areaFilter]);

  const rankedSpots = useMemo(() => {
    const range = rangeForPreset(preset);
    const scored = filteredSpots.map((s) => {
      let scoreSeries = s.series;
      if (range && scoreSeries.length > 0) {
        scoreSeries = scoreSeries.filter(
          (p) => p.date >= range.start && p.date <= range.end
        );
      }
      let scored = null;
      if (scoreSeries.length > 0) {
        scored =
          scoreSeries.reduce((a, b) => a + b.rate, 0) / scoreSeries.length;
      }
      const minInRange = scoreSeries.length
        ? scoreSeries.reduce((a, b) => (a.rate <= b.rate ? a : b))
        : null;
      const maxInRange = scoreSeries.length
        ? scoreSeries.reduce((a, b) => (a.rate >= b.rate ? a : b))
        : null;
      return {
        ...s,
        scoreInRange: scored,
        minInRange,
        maxInRange,
      };
    });
    const filtered = scored.filter((x) => x.scoreInRange != null);
    filtered.sort((a, b) =>
      sortMode === "quiet"
        ? a.scoreInRange - b.scoreInRange
        : b.scoreInRange - a.scoreInRange
    );
    return filtered;
  }, [filteredSpots, preset, sortMode]);

  const stats = useMemo(() => {
    if (rankedSpots.length === 0) return null;
    const quietest = rankedSpots[0];
    const busiest = [...rankedSpots].sort(
      (a, b) => b.scoreInRange - a.scoreInRange
    )[0];
    const avg =
      rankedSpots.reduce((s, x) => s + x.scoreInRange, 0) /
      rankedSpots.length;
    return { quietest, busiest, avg, total: rankedSpots.length };
  }, [rankedSpots]);

  return (
    <div style={styles.page}>
      <div style={styles.bgGrid} aria-hidden />
      <div style={styles.bgRadarSweep} aria-hidden />

      <div style={styles.wrap}>
        <button
          onClick={() => router.back()}
          style={styles.backBtn}
          aria-label="back"
        >
          <ArrowLeft size={16} /> {t("common.back", "뒤로")}
        </button>

        <header style={styles.hero}>
          <div style={styles.heroRadar}>
            <Radar size={40} color="#67e8f9" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.tag}>
              <ShieldCheck size={12} /> Quiet Set Radar · KT Big Data · KTO 15128555
            </div>
            <h1 style={styles.title}>
              {t("crowdRadar.title", "조용한 촬영지 레이더")}
            </h1>
            <p style={styles.subtitle}>
              {t(
                "crowdRadar.subtitle",
                "영화는 왁자지껄했지만, 촬영지는 한가할 때 가자. 한국관광공사·KT 이동통신 빅데이터 기반 관광지 향후 30일 집중률 예측을 한 눈에 보고, 인파 없는 날·한산한 관광지를 골라 답사를 계획하세요."
              )}
            </p>
          </div>
        </header>

        {loading ? (
          <div style={styles.loadingBox}>
            <Loader2 size={28} className="cr-spin" color="#67e8f9" />
            <div style={{ marginTop: 10, color: "#bbb", fontSize: 14 }}>
              {t("crowdRadar.loading", "전국 관광지 30일 집중률을 수집 중이에요...")}
            </div>
          </div>
        ) : errorMsg ? (
          <div style={styles.errBox}>
            {t("crowdRadar.error", "레이더 신호를 수신하지 못했어요.")} ({errorMsg})
          </div>
        ) : (
          <>
            {stats && (
              <section style={styles.statsGrid}>
                <StatCard
                  icon={<TrendingDown size={18} color="#10b981" />}
                  label={t("crowdRadar.stats.quietest", "가장 한산한 촬영지")}
                  value={stats.quietest?.spotName || "-"}
                  sub={
                    stats.quietest?.minInRange
                      ? `${fmtMMDD(stats.quietest.minInRange.date)} · ${stats.quietest.minInRange.rate.toFixed(1)}`
                      : "-"
                  }
                  color="#10b981"
                />
                <StatCard
                  icon={<TrendingUp size={18} color="#ef4444" />}
                  label={t("crowdRadar.stats.busiest", "가장 붐비는 촬영지")}
                  value={stats.busiest?.spotName || "-"}
                  sub={
                    stats.busiest?.maxInRange
                      ? `${fmtMMDD(stats.busiest.maxInRange.date)} · ${stats.busiest.maxInRange.rate.toFixed(1)}`
                      : "-"
                  }
                  color="#ef4444"
                />
                <StatCard
                  icon={<CalendarDays size={18} color="#a5b4fc" />}
                  label={t("crowdRadar.stats.avg", "선택 구간 평균 집중률")}
                  value={`${stats.avg.toFixed(1)}`}
                  sub={`${stats.total}${t("crowdRadar.stats.spotCount", "개 촬영지 수집")}`}
                  color="#a5b4fc"
                />
              </section>
            )}

            <section style={styles.controls}>
              <div style={styles.chipRow}>
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    style={{
                      ...styles.chip,
                      ...(preset === p.id ? styles.chipActive : null),
                    }}
                  >
                    {isEn ? p.en : p.ko}
                  </button>
                ))}
              </div>

              <div style={styles.chipRow}>
                <button
                  onClick={() => setSortMode("quiet")}
                  style={{
                    ...styles.chip,
                    ...(sortMode === "quiet" ? styles.chipActiveQuiet : null),
                  }}
                >
                  <TrendingDown size={12} />{" "}
                  {t("crowdRadar.sort.quiet", "한산한 순")}
                </button>
                <button
                  onClick={() => setSortMode("busy")}
                  style={{
                    ...styles.chip,
                    ...(sortMode === "busy" ? styles.chipActiveBusy : null),
                  }}
                >
                  <TrendingUp size={12} />{" "}
                  {t("crowdRadar.sort.busy", "혼잡한 순")}
                </button>
              </div>

              <div style={styles.chipRow}>
                <button
                  onClick={() => setAreaFilter("all")}
                  style={{
                    ...styles.chip,
                    ...(areaFilter === "all" ? styles.chipActive : null),
                  }}
                >
                  {t("crowdRadar.area.all", "전국")}
                </button>
                {AREA_ORDER.map((code) => (
                  <button
                    key={code}
                    onClick={() => setAreaFilter(code)}
                    style={{
                      ...styles.chip,
                      ...(areaFilter === code ? styles.chipActive : null),
                    }}
                  >
                    {AREA_LABEL[code]}
                  </button>
                ))}
              </div>
            </section>

            {rankedSpots.length === 0 ? (
              <div style={styles.emptyBox}>
                {t(
                  "crowdRadar.empty",
                  "선택한 조건에 맞는 예측 데이터가 없어요."
                )}
              </div>
            ) : (
              <section style={styles.grid}>
                {rankedSpots.map((s, idx) => (
                  <SpotCard key={s.key} spot={s} rank={idx + 1} preset={preset} />
                ))}
              </section>
            )}

            <footer style={styles.footer}>
              {t(
                "crowdRadar.credit",
                "데이터: 한국관광공사 · KT 이동통신 빅데이터 기반 집중률 예측 (공공데이터포털 15128555)"
              )}
            </footer>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes cr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cr-sweep {
          0%   { transform: rotate(0deg); opacity: 0.7; }
          50%  { opacity: 0.35; }
          100% { transform: rotate(360deg); opacity: 0.7; }
        }
      `}</style>
      <style jsx global>{`
        .cr-spin { animation: cr-spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(15,23,42,0.75)",
        border: `1px solid ${color}44`,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#cbd5e1", fontSize: 12 }}>
        {icon}
        <span>{label}</span>
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={value}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: color }}>{sub}</div>
    </motion.div>
  );
}

function SpotCard({ spot, rank, preset }) {
  const series = spot.series;
  const color = levelColor(spot.scoreInRange);
  const maxRate = series.length ? Math.max(...series.map((x) => x.rate), 10) : 100;

  const range = rangeForPreset(preset);
  const isInRange = (d) => !range || (d >= range.start && d <= range.end);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(rank * 0.03, 0.6) }}
      style={{
        padding: 16,
        borderRadius: 14,
        background: "rgba(15,23,42,0.85)",
        border: "1px solid rgba(103,232,249,0.18)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: "4px 8px",
            borderRadius: 8,
            background: color + "22",
            color: color,
            border: `1px solid ${color}55`,
            whiteSpace: "nowrap",
          }}
        >
          #{rank} · {spot.scoreInRange != null ? spot.scoreInRange.toFixed(1) : "-"}
        </span>
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            minWidth: 0,
          }}
        >
          <MapPin size={11} />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {spot.areaName} · {spot.signguName}
          </span>
        </div>
      </div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 800,
          margin: 0,
          lineHeight: 1.25,
        }}
        title={spot.spotName}
      >
        {spot.spotName}
      </h3>

      <Sparkline series={series} isInRange={isInRange} maxRate={maxRate} />

      {spot.minEntry && (
        <div style={{ display: "flex", gap: 10, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ color: "#34d399" }}>
            <TrendingDown size={11} style={{ verticalAlign: "text-top" }} />{" "}
            {fmtMMDD(spot.minEntry.date)} · {spot.minEntry.rate.toFixed(1)}
          </span>
          <span style={{ color: "#f87171" }}>
            <TrendingUp size={11} style={{ verticalAlign: "text-top" }} />{" "}
            {fmtMMDD(spot.maxEntry.date)} · {spot.maxEntry.rate.toFixed(1)}
          </span>
        </div>
      )}

      {spot.movies.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 2,
            paddingTop: 10,
            borderTop: "1px dashed rgba(148,163,184,0.25)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#a5b4fc",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Film size={11} /> Cine match
          </span>
          {spot.movies.map((m) => (
            <span
              key={m}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 10,
                background: "rgba(165,180,252,0.12)",
                color: "#c7d2fe",
                border: "1px solid rgba(165,180,252,0.25)",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Sparkline({ series, isInRange, maxRate }) {
  if (!series || series.length === 0) return null;
  const W = 280;
  const H = 56;
  const padX = 2;
  const padY = 4;
  const step = series.length > 1 ? (W - 2 * padX) / (series.length - 1) : 0;

  const pts = series.map((p, i) => {
    const x = padX + i * step;
    const y = padY + (H - 2 * padY) * (1 - Math.min(1, p.rate / 100));
    return { x, y, p };
  });

  const path = pts.reduce(
    (acc, pt, i) => acc + (i === 0 ? `M${pt.x},${pt.y}` : ` L${pt.x},${pt.y}`),
    ""
  );
  const areaPath = path + ` L${padX + (series.length - 1) * step},${H - padY} L${padX},${H - padY} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="56"
      preserveAspectRatio="none"
      aria-hidden
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="cr-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#cr-area)" />
      <path
        d={path}
        fill="none"
        stroke="#67e8f9"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((pt, i) => {
        const rate = pt.p.rate;
        const color = levelColor(rate);
        const inRange = isInRange(pt.p.date);
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={inRange ? 2.2 : 1.2}
            fill={color}
            opacity={inRange ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    color: "#fff",
    background:
      "radial-gradient(1200px 600px at 0% 0%, rgba(34,211,238,0.10), transparent 60%),\n       radial-gradient(1000px 500px at 100% 100%, rgba(99,102,241,0.10), transparent 60%),\n       linear-gradient(180deg, #050712 0%, #0b1220 50%, #050712 100%)",
    overflowX: "hidden",
  },
  bgGrid: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(rgba(103,232,249,0.06) 1px, transparent 1px) 0 0 / 28px 28px,\n       linear-gradient(90deg, rgba(103,232,249,0.06) 1px, transparent 1px) 0 0 / 28px 28px",
    pointerEvents: "none",
    opacity: 0.4,
    zIndex: 0,
  },
  bgRadarSweep: {
    position: "absolute",
    top: -220,
    right: -220,
    width: 620,
    height: 620,
    background:
      "conic-gradient(from 0deg, rgba(34,211,238,0.35), transparent 25%, transparent 75%, rgba(34,211,238,0.35))",
    borderRadius: "50%",
    filter: "blur(2px)",
    animation: "cr-sweep 8s linear infinite",
    pointerEvents: "none",
    zIndex: 0,
  },
  wrap: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1120,
    margin: "0 auto",
    padding: "20px 18px 80px",
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.5)",
    color: "#a5f3fc",
    border: "1px solid rgba(103,232,249,0.35)",
    cursor: "pointer",
    marginBottom: 14,
  },
  hero: {
    display: "flex",
    gap: 18,
    alignItems: "flex-start",
    padding: 22,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(99,102,241,0.06) 55%, rgba(244,63,94,0.06) 100%)",
    border: "1px solid rgba(103,232,249,0.25)",
    marginBottom: 18,
    flexWrap: "wrap",
  },
  heroRadar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(99,102,241,0.18))",
    border: "1px solid rgba(103,232,249,0.35)",
    boxShadow: "0 12px 30px -12px rgba(34,211,238,0.55)",
    flexShrink: 0,
  },
  tag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    letterSpacing: "0.12em",
    color: "#67e8f9",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    margin: "6px 0 6px",
    background: "linear-gradient(90deg, #67e8f9 0%, #a5b4fc 55%, #fda4af 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    lineHeight: 1.2,
  },
  subtitle: { fontSize: 13.5, color: "#cbd5e1", lineHeight: 1.55, margin: 0 },
  loadingBox: {
    padding: 40,
    textAlign: "center",
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(103,232,249,0.18)",
  },
  errBox: {
    padding: 20,
    borderRadius: 12,
    color: "#fca5a5",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.3)",
    fontSize: 13,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 18,
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(103,232,249,0.14)",
    marginBottom: 18,
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    background: "rgba(30,41,59,0.6)",
    color: "#cbd5e1",
    border: "1px solid rgba(148,163,184,0.2)",
    cursor: "pointer",
  },
  chipActive: {
    background: "rgba(103,232,249,0.22)",
    color: "#e0f2fe",
    border: "1px solid rgba(103,232,249,0.5)",
  },
  chipActiveQuiet: {
    background: "rgba(16,185,129,0.22)",
    color: "#d1fae5",
    border: "1px solid rgba(16,185,129,0.5)",
  },
  chipActiveBusy: {
    background: "rgba(244,63,94,0.22)",
    color: "#fecdd3",
    border: "1px solid rgba(244,63,94,0.5)",
  },
  emptyBox: {
    padding: 30,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    borderRadius: 12,
    background: "rgba(15,23,42,0.5)",
    border: "1px dashed rgba(148,163,184,0.3)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
  footer: {
    marginTop: 40,
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 1.6,
  },
};
