"use client";

/**
 * GasSafetyModal — "여행가기전 가스점검꼭" 버튼이 여는 작은 모달.
 *
 * 행정안전부 생활안전지도(safemap.go.kr) 가스사고발생통계(IF_0064)를
 * 백엔드 프록시(/api/v1/gas-safety/sigungu)로 받아온다(시군구별 발생건수+중심좌표).
 * GPS 로 현재 위치를 잡아, 좌표가 가장 가까운 "내 시군구" 하나만 크게 보여준다.
 * 위치 거부/실패 시 전체 시군구 목록(검색)으로 자연 폴백.
 */

import { useEffect, useMemo, useState } from "react";
import axios from "@/lib/axiosConfig";
import { resolveMyRegion, getCachedGeo, getIpGeo } from "@/lib/gasSafety";
import { getSharedGeo, subscribeSharedGeo } from "@/lib/sharedGeo";
import { ensureSharedLocation } from "@/lib/geolocation";
import { Capacitor } from "@capacitor/core";
import { X, Flame, Search, Info, Loader2, MapPin, ChevronDown } from "lucide-react";

export default function GasSafetyModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState([]);

  // 'loading' | 'ok' | 'denied' | 'unavailable'
  const [geoState, setGeoState] = useState("loading");
  const [userLoc, setUserLoc] = useState(null);
  const [myRegion, setMyRegion] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    axios
      .get("/api/v1/gas-safety/sigungu")
      .then((res) => {
        if (cancelled) return;
        const payload = res?.data;
        const ok = payload && typeof payload === "object" && payload.success !== false;
        const data = ok && Array.isArray(payload.data) ? payload.data : [];
        setRows(data);
        if (data.length === 0) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 위치: 공유 좌표(없으면 직전 세션 캐시) 즉시 사용 + 직접 확보 시도(Capacitor 플러그인,
  // iOS 네이티브 지원). 벽시계 상한이 있어 무한 "위치 확인 중" 없이 검색 목록으로 폴백.
  useEffect(() => {
    let cancelled = false;
    const immediate = getSharedGeo() || getCachedGeo();
    if (immediate) {
      setUserLoc(immediate);
      setGeoState("ok");
    } else {
      setGeoState("loading");
    }
    const unsub = subscribeSharedGeo((g) => {
      if (cancelled) return;
      setUserLoc(g);
      setGeoState("ok");
    });
    if (!immediate) {
      ensureSharedLocation({ maxMs: 9000 })
        .then(async (loc) => {
          if (cancelled) return;
          if (loc) {
            setUserLoc(loc);
            setGeoState("ok");
            return;
          }
          const ip = await getIpGeo();
          if (cancelled) return;
          if (ip) {
            setUserLoc({ lat: ip.lat, lon: ip.lon });
            setGeoState("ok");
          } else {
            setGeoState((s) => (s === "ok" ? s : "unavailable"));
          }
        })
        .catch(() => {
          if (!cancelled) setGeoState((s) => (s === "ok" ? s : "unavailable"));
        });
    }
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // rows 는 백엔드에서 발생건수 내림차순으로 정렬돼 온다 → 인덱스+1 = 전국 순위.
  const rankByRegion = useMemo(() => {
    const map = new Map();
    rows.forEach((r, i) => map.set(r.region, i + 1));
    return map;
  }, [rows]);

  // GPS 좌표 → 시군구 판정: 역지오코딩(정확) 우선, 실패 시 중심좌표 최근접으로 폴백.
  useEffect(() => {
    if (!userLoc || rows.length === 0) return;
    let cancelled = false;
    setResolving(true);
    (async () => {
      const region = await resolveMyRegion(userLoc, rows);
      if (!cancelled) {
        setMyRegion(region);
        setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userLoc, rows]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [rows],
  );

  const filtered = useMemo(() => {
    const kw = q.trim();
    if (!kw) return rows;
    return rows.filter((r) => String(r.region || "").includes(kw));
  }, [rows, q]);

  const dataReady = !loading && !error && rows.length > 0;
  const showMyCard = dataReady && geoState === "ok" && myRegion && !showAll;
  const geoBusy =
    geoState === "loading" || (geoState === "ok" && resolving && !myRegion);

  return (
    <div
      className="gsm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="가스사고 발생통계"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <style>{css}</style>
      <div className="gsm-modal">
        <button className="gsm-close" onClick={onClose} aria-label="close">
          <X size={16} />
        </button>

        <div className="gsm-head">
          <div className="gsm-title">
            <Flame size={15} /> 가스사고 발생통계
          </div>
          <div className="gsm-sub">행정안전부 생활안전지도 · 내 지역</div>
        </div>

        <div className="gsm-body">
          {loading ? (
            <div className="gsm-state">
              <Loader2 size={16} className="gsm-spin" /> 불러오는 중...
            </div>
          ) : error ? (
            <div className="gsm-state gsm-state-warn">
              <Info size={14} /> 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </div>
          ) : showMyCard ? (
            <>
              <div className="gsm-mycard">
                <div className="gsm-mycard-loc">
                  <MapPin size={13} /> 현재 위치
                </div>
                <div className="gsm-mycard-region">{myRegion.region}</div>
                <div className="gsm-mycard-stats">
                  <div className="gsm-stat">
                    <span className="gsm-stat-num">
                      {Number(myRegion.count).toLocaleString()}
                    </span>
                    <span className="gsm-stat-label">가스사고 발생</span>
                  </div>
                  <div className="gsm-stat">
                    <span className="gsm-stat-num gsm-stat-cas">
                      {myRegion.casualties != null
                        ? Number(myRegion.casualties).toLocaleString()
                        : 0}
                    </span>
                    <span className="gsm-stat-label">인명피해(명)</span>
                  </div>
                </div>
                <div className="gsm-mycard-meta">
                  전국 {rows.length}개 시군구 중{" "}
                  <b>{rankByRegion.get(myRegion.region) || "-"}위</b>
                  {" · "}전국 합계 {total.toLocaleString()}건
                </div>
              </div>
              <button className="gsm-allbtn" onClick={() => setShowAll(true)}>
                전체 시군구 보기 <ChevronDown size={13} />
              </button>
            </>
          ) : (
            <>
              {geoBusy && !showAll && (
                <div className="gsm-geo-note">
                  <Loader2 size={12} className="gsm-spin" /> 현재 위치 확인 중...
                </div>
              )}
              {!geoBusy && geoState !== "ok" && !showAll && (
                <div className="gsm-geo-note gsm-geo-warn">
                  <Info size={12} />{" "}
                  {geoState === "denied"
                    ? "위치 권한이 꺼져 있어요. 아래에서 지역을 검색하세요."
                    : "현재 위치를 확인할 수 없어요. 아래에서 지역을 검색하세요."}
                </div>
              )}
              <div className="gsm-total">
                전국 합계 <b>{total.toLocaleString()}</b>건 · {rows.length}개 시군구
              </div>
              <div className="gsm-search">
                <Search size={13} />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="지역 검색 (예: 강남)"
                  aria-label="지역 검색"
                />
              </div>
              <ul className="gsm-list">
                {filtered.map((r, i) => (
                  <li key={`${r.region}-${i}`} className="gsm-row">
                    <span className="gsm-rank">
                      {rankByRegion.get(r.region) || i + 1}
                    </span>
                    <span className="gsm-region">{r.region}</span>
                    {r.casualties != null && r.casualties > 0 && (
                      <span className="gsm-cas">
                        피해 {Number(r.casualties).toLocaleString()}
                      </span>
                    )}
                    <span className="gsm-count">
                      {Number(r.count).toLocaleString()}
                    </span>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="gsm-state">검색 결과가 없어요.</li>
                )}
              </ul>
            </>
          )}
        </div>

        <div className="gsm-foot">
          여행 전, 가스밸브·중간밸브를 꼭 잠그고 점검하세요.
          <span className="gsm-diag">
            {`v3 · native:${Capacitor?.isNativePlatform?.() ? "Y" : "N"} · geo:${geoState}${
              myRegion ? ` · ${myRegion.region}` : ""
            }`}
          </span>
        </div>
      </div>
    </div>
  );
}

const css = `
.gsm-backdrop {
  position: fixed; inset: 0; z-index: 130;
  background: rgba(8,4,18,0.72);
  backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center;
  padding: 18px;
}
.gsm-modal {
  position: relative;
  width: min(380px, 100%);
  max-height: min(72vh, 620px);
  background: linear-gradient(180deg, #1a1430 0%, #0d0a1f 100%);
  border: 1px solid rgba(251,146,60,0.4);
  border-radius: 14px;
  color: #f4f1ff;
  box-shadow: 0 24px 70px rgba(0,0,0,0.55);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.gsm-close {
  position: absolute; top: 9px; right: 9px;
  width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.22);
  background: rgba(10,5,26,0.7); color: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.gsm-close:hover { background: rgba(239,68,68,0.8); border-color: transparent; }
.gsm-head { padding: 14px 16px 8px; }
.gsm-title {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.98rem; font-weight: 900; color: #fff;
}
.gsm-title svg { color: #fb923c; }
.gsm-sub { margin-top: 3px; font-size: 0.72rem; color: #b9aee0; }
.gsm-body { overflow-y: auto; padding: 0 8px 4px; min-height: 80px; }

.gsm-mycard {
  margin: 4px 8px 10px; padding: 16px 14px;
  border-radius: 12px;
  background: linear-gradient(160deg, rgba(234,88,12,0.22) 0%, rgba(124,45,18,0.18) 100%);
  border: 1px solid rgba(251,146,60,0.45);
  text-align: center;
}
.gsm-mycard-loc {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.72rem; font-weight: 700; color: #fcd9b6;
}
.gsm-mycard-region {
  margin-top: 4px; font-size: 1.18rem; font-weight: 900; color: #fff;
  letter-spacing: -0.02em;
}
.gsm-mycard-stats {
  display: flex; justify-content: center; gap: 26px; margin-top: 12px;
}
.gsm-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.gsm-stat-num {
  font-size: 1.7rem; font-weight: 900; color: #fb923c; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.gsm-stat-num.gsm-stat-cas { color: #fca5a5; }
.gsm-stat-label { font-size: 0.68rem; color: #c9bff0; }
.gsm-mycard-meta {
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 0.72rem; color: #c9bff0;
}
.gsm-mycard-meta b { color: #fcd9b6; font-weight: 800; }

.gsm-allbtn {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  width: calc(100% - 16px); margin: 0 8px 6px; padding: 8px;
  border-radius: 9px; cursor: pointer;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.14);
  color: #d9d2f5; font-size: 0.78rem; font-weight: 700;
}
.gsm-allbtn:hover { background: rgba(255,255,255,0.1); }

.gsm-geo-note {
  display: flex; align-items: center; gap: 5px;
  margin: 4px 8px 8px; padding: 7px 10px; border-radius: 8px;
  font-size: 0.74rem; color: #c4b5fd;
  background: rgba(255,255,255,0.05);
}
.gsm-geo-warn { color: #fcd34d; }

.gsm-total {
  margin: 0 8px 8px; font-size: 0.76rem; color: #fcd9b6;
}
.gsm-total b { color: #fb923c; font-weight: 800; }
.gsm-search {
  display: flex; align-items: center; gap: 6px;
  margin: 0 8px 8px; padding: 6px 10px;
  border-radius: 9px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: #c4b5fd;
}
.gsm-search input {
  flex: 1; min-width: 0; border: none; outline: none;
  background: transparent; color: #f4f1ff; font-size: 0.82rem;
}
.gsm-search input::placeholder { color: #8a82ad; }
.gsm-list { list-style: none; margin: 0; padding: 0; }
.gsm-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 8px;
  font-size: 0.84rem;
}
.gsm-row:nth-child(odd) { background: rgba(255,255,255,0.035); }
.gsm-rank {
  flex: 0 0 26px; text-align: center;
  font-size: 0.7rem; font-weight: 800; color: #8a82ad;
  font-variant-numeric: tabular-nums;
}
.gsm-region { flex: 1; min-width: 0; color: #ece9fb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gsm-cas { flex: 0 0 auto; font-size: 0.7rem; color: #fca5a5; }
.gsm-count {
  flex: 0 0 auto; min-width: 42px; text-align: right;
  font-weight: 800; color: #fb923c;
  font-variant-numeric: tabular-nums;
}
.gsm-state {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 26px 14px; color: #c4b5fd; font-size: 0.84rem;
}
.gsm-state-warn { color: #fcd34d; }
.gsm-spin { animation: gsm-spin 1s linear infinite; }
@keyframes gsm-spin { to { transform: rotate(360deg); } }
.gsm-foot {
  padding: 9px 16px; font-size: 0.7rem; line-height: 1.4;
  color: #b9aee0;
  border-top: 1px solid rgba(255,255,255,0.08);
  background: rgba(251,146,60,0.07);
}
.gsm-diag {
  display: block; margin-top: 4px;
  font-size: 0.62rem; color: #7c739c; letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
`;
