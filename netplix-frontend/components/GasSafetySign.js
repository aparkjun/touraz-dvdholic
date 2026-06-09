"use client";

/**
 * GasSafetySign — 고속도로 전광판(VMS) 느낌의 LED 사인.
 *
 * 대시보드 음악 블록에서 정적 버튼 대신, 1초마다 메시지를 번갈아 보여준다:
 *   "여행가기전 가스점검꼭" → "📍 전라남도 여수시" → "가스사고 58건"(빨강) → "인명피해 0명"(파랑)
 *
 * GPS + 역지오코딩으로 현재 시군구를 잡아 그 지역 통계만 노출한다(위치 실패 시 전국 합계).
 * 탭하면 전체 시군구 상세 모달을 연다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { getDeviceLocation } from "@/lib/geolocation";
import { fetchGasSigungu, resolveMyRegion } from "@/lib/gasSafety";
import GasSafetyModal from "@/components/GasSafetyModal";

const FRAME_MS = 1000;

export default function GasSafetySign() {
  const [rows, setRows] = useState([]);
  const [region, setRegion] = useState(null);
  // 'loading' | 'ok' | 'denied' | 'unavailable'
  const [geoState, setGeoState] = useState("loading");
  const [resolving, setResolving] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [openModal, setOpenModal] = useState(false);

  const locRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchGasSigungu()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGeoState("loading");
    // 워치독: 위치 획득이 너무 오래 걸리면(아이폰 권한 프롬프트 무응답 등) 전국 합계로 넘어간다.
    const watchdog = setTimeout(() => {
      if (!cancelled) setGeoState((s) => (s === "loading" ? "unavailable" : s));
    }, 14000);
    getDeviceLocation({ timeout: 12000 })
      .then((loc) => {
        if (cancelled) return;
        if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
          locRef.current = { lat: loc.lat, lon: loc.lon };
          setGeoState("ok");
        } else {
          setGeoState("unavailable");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGeoState(e?.code === "PERMISSION_DENIED" ? "denied" : "unavailable");
        }
      })
      .finally(() => {
        clearTimeout(watchdog);
      });
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, []);

  useEffect(() => {
    if (geoState !== "ok" || !locRef.current || rows.length === 0) return;
    let cancelled = false;
    setResolving(true);
    resolveMyRegion(locRef.current, rows)
      .then((r) => {
        if (!cancelled) {
          setRegion(r);
          setResolving(false);
        }
      })
      .catch(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [geoState, rows]);

  const total = useMemo(
    () => rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0),
    [rows],
  );

  const frames = useMemo(() => {
    const title = { id: "title", kind: "title" };
    if (region) {
      const count = Number(region.count) || 0;
      const cas = region.casualties != null ? Number(region.casualties) : 0;
      return [
        title,
        { id: "region", kind: "region", text: region.region },
        { id: "count", kind: "stat", label: "가스사고", value: count, unit: "건", tone: "red" },
        { id: "cas", kind: "stat", label: "인명피해", value: cas, unit: "명", tone: "blue" },
      ];
    }
    if (geoState === "loading" || resolving) {
      return [title, { id: "loc", kind: "note", text: "위치 확인 중…" }];
    }
    if (total > 0) {
      return [
        title,
        { id: "nat", kind: "stat", label: "전국 가스사고", value: total, unit: "건", tone: "red" },
      ];
    }
    return [title];
  }, [region, geoState, resolving, total]);

  // 프레임 1초마다 순환. 프레임 구성이 바뀌면 처음부터.
  useEffect(() => {
    setFrameIdx(0);
    if (frames.length <= 1) return undefined;
    const id = setInterval(() => {
      setFrameIdx((i) => (i + 1) % frames.length);
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [frames]);

  const frame = frames[Math.min(frameIdx, frames.length - 1)] || frames[0];

  return (
    <div className="gss-wrap" style={{ marginLeft: "auto" }}>
      <style>{css}</style>
      <button
        type="button"
        className="gss-board js-fast-tap"
        onClick={() => setOpenModal(true)}
        aria-label="가스사고 발생통계 보기"
      >
        <span className="gss-scan" aria-hidden="true" />
        <span key={frame?.id + frameIdx} className="gss-frame">
          {renderFrame(frame)}
        </span>
      </button>
      {openModal && <GasSafetyModal onClose={() => setOpenModal(false)} />}
    </div>
  );
}

function renderFrame(frame) {
  if (!frame) return null;
  if (frame.kind === "title") {
    return (
      <span className="gss-title">
        <span className="gss-tline">여행가기전</span>
        <span className="gss-tline gss-blink">가스점검꼭</span>
      </span>
    );
  }
  if (frame.kind === "region") {
    return (
      <span className="gss-region">
        <span className="gss-pin">📍 현재위치</span>
        <span className="gss-rname">{frame.text}</span>
      </span>
    );
  }
  if (frame.kind === "note") {
    return <span className="gss-note">{frame.text}</span>;
  }
  // stat
  const toneClass = frame.tone === "blue" ? "gss-blue" : "gss-red";
  return (
    <span className="gss-stat">
      <span className="gss-label">{frame.label}</span>
      <span className={`gss-value ${toneClass}`}>
        {Number(frame.value).toLocaleString()}
        <em className="gss-unit">{frame.unit}</em>
      </span>
    </span>
  );
}

const css = `
.gss-wrap { display: inline-flex; }
.gss-board {
  position: relative;
  width: 168px; height: 50px;
  border-radius: 10px;
  border: 1px solid rgba(255,176,32,0.45);
  background:
    radial-gradient(120% 140% at 50% 0%, rgba(40,30,10,0.6) 0%, rgba(6,6,9,0.96) 70%);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.6);
  overflow: hidden;
  cursor: pointer;
  padding: 0 8px;
  display: flex; align-items: center; justify-content: center;
}
.gss-board:active { transform: scale(0.97); }

/* LED 스캔라인 질감 */
.gss-scan {
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
    0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.28) 3px);
  mix-blend-mode: multiply; opacity: 0.5;
}

.gss-frame {
  display: flex; align-items: center; justify-content: center;
  width: 100%; text-align: center;
  animation: gss-in 220ms ease-out;
  font-family: "Menlo", "Consolas", "Apple SD Gothic Neo", sans-serif;
}
@keyframes gss-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.gss-title { display: flex; flex-direction: column; line-height: 1.12; }
.gss-tline {
  font-size: 14px; font-weight: 900; letter-spacing: 0.04em;
  color: #ffce5a; text-shadow: 0 0 7px rgba(255,176,32,0.85);
}
.gss-blink { animation: gss-blink 1s steps(1,end) infinite; }
@keyframes gss-blink { 50% { opacity: 0.35; } }

.gss-region { display: flex; flex-direction: column; line-height: 1.15; gap: 1px; }
.gss-pin { font-size: 9px; font-weight: 800; color: #9be37a; letter-spacing: 0.06em; text-shadow: 0 0 6px rgba(74,222,100,0.6); }
.gss-rname { font-size: 13px; font-weight: 900; color: #fff4d6; text-shadow: 0 0 7px rgba(255,210,120,0.7); }

.gss-note { font-size: 12px; font-weight: 800; color: #c9bff0; letter-spacing: 0.03em; }

.gss-stat { display: flex; flex-direction: column; align-items: center; line-height: 1.05; }
.gss-label { font-size: 10px; font-weight: 800; color: #d8d2c4; letter-spacing: 0.05em; }
.gss-value {
  font-size: 24px; font-weight: 900; letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums; display: inline-flex; align-items: baseline; gap: 2px;
}
.gss-unit { font-size: 11px; font-weight: 800; font-style: normal; opacity: 0.9; }
.gss-red { color: #ff5a4d; text-shadow: 0 0 9px rgba(255,60,48,0.9), 0 0 2px rgba(255,60,48,0.9); }
.gss-blue { color: #5db4ff; text-shadow: 0 0 9px rgba(59,130,246,0.95), 0 0 2px rgba(59,130,246,0.9); }
`;
