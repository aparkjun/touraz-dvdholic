"use client";

/**
 * GasSafetyModal — "여행가기전 가스점검꼭" 버튼이 여는 작은 모달.
 *
 * 행정안전부 생활안전지도(safemap.go.kr) 가스사고발생통계(IF_0064, XML)를
 * 백엔드 프록시(/api/v1/gas-safety/sigungu)로 받아 시군구 단위 발생건수를
 * 발생건수 내림차순으로 간결하게 보여준다(작은 박스 + 내부 스크롤).
 */

import { useEffect, useMemo, useState } from "react";
import axios from "@/lib/axiosConfig";
import { X, Flame, Search, Info, Loader2 } from "lucide-react";

export default function GasSafetyModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [rows, setRows] = useState([]);
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

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const kw = q.trim();
    if (!kw) return rows;
    return rows.filter((r) => String(r.region || "").includes(kw));
  }, [rows, q]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [rows],
  );

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
          <div className="gsm-sub">행정안전부 생활안전지도 · 시군구 단위</div>
        </div>

        {!loading && !error && rows.length > 0 && (
          <>
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
          </>
        )}

        <div className="gsm-body">
          {loading ? (
            <div className="gsm-state">
              <Loader2 size={16} className="gsm-spin" /> 불러오는 중...
            </div>
          ) : error ? (
            <div className="gsm-state gsm-state-warn">
              <Info size={14} /> 통계를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
            </div>
          ) : (
            <ul className="gsm-list">
              {filtered.map((r, i) => (
                <li key={`${r.region}-${i}`} className="gsm-row">
                  <span className="gsm-rank">{i + 1}</span>
                  <span className="gsm-region">{r.region}</span>
                  {r.casualties != null && (
                    <span className="gsm-cas">피해 {Number(r.casualties).toLocaleString()}</span>
                  )}
                  <span className="gsm-count">{Number(r.count).toLocaleString()}</span>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="gsm-state">검색 결과가 없어요.</li>
              )}
            </ul>
          )}
        </div>

        <div className="gsm-foot">
          여행 전, 가스밸브·중간밸브를 꼭 잠그고 점검하세요.
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
.gsm-total {
  margin: 0 16px 8px; font-size: 0.76rem; color: #fcd9b6;
}
.gsm-total b { color: #fb923c; font-weight: 800; }
.gsm-search {
  display: flex; align-items: center; gap: 6px;
  margin: 0 16px 8px; padding: 6px 10px;
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
.gsm-body { overflow-y: auto; padding: 0 8px 4px; min-height: 60px; }
.gsm-list { list-style: none; margin: 0; padding: 0; }
.gsm-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 8px;
  font-size: 0.84rem;
}
.gsm-row:nth-child(odd) { background: rgba(255,255,255,0.035); }
.gsm-rank {
  flex: 0 0 22px; text-align: center;
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
`;
