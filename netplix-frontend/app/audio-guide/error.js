"use client";

/**
 * /audio-guide 전용 에러 바운더리.
 *
 * <p>Next.js 16 기본 글로벌 에러 UI("This page couldn't load")는 원인을 감추기 때문에,
 * 이 라우트에서 발생한 런타임 에러를 사용자 친화적 화면으로 노출하고 즉시 재시도할 수 있게 한다.
 *
 * <p>브라우저 콘솔에 스택 트레이스를 출력해 디버깅을 돕고, 표면에는 친절한 메시지와
 * "다시 시도" · "홈으로" 버튼을 제공한다.
 */

import { useEffect } from "react";
import Link from "next/link";

export default function AudioGuideError({ error, reset }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[audio-guide] render error:", error);
    }
  }, [error]);

  const title = error?.message || "페이지를 잠시 불러오지 못했어요.";
  const digest = error?.digest;

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background:
          "radial-gradient(ellipse at top, rgba(167,139,250,0.12), transparent 60%), #0b0620",
        color: "#f4f1ff",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          padding: "28px 28px 24px",
          borderRadius: 16,
          border: "1px solid rgba(167,139,250,0.3)",
          background: "linear-gradient(180deg, #14102a 0%, #0c0820 100%)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1 }}>🎧</div>
        <h1
          style={{
            margin: "12px 0 6px",
            fontSize: "1.25rem",
            fontWeight: 900,
            color: "#fff",
          }}
        >
          오디오 가이드 페이지가 잠시 멈췄어요
        </h1>
        <p style={{ margin: 0, color: "#cbb7f7", fontSize: "0.9rem", lineHeight: 1.55 }}>
          브라우저에 남은 이전 버전 캐시가 원인일 수 있어요. 강력 새로고침(Ctrl+Shift+R / Cmd+Shift+R)을 한번 눌러
          주시면 대부분 해결돼요.
        </p>

        <div
          style={{
            marginTop: 14,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.08)",
            border: "1px dashed rgba(239,68,68,0.35)",
            fontSize: "0.75rem",
            color: "#fca5a5",
            textAlign: "left",
            wordBreak: "break-word",
          }}
        >
          <strong>에러 메시지:</strong> {title}
          {digest && (
            <>
              <br />
              <strong>digest:</strong> {digest}
            </>
          )}
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => reset?.()}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontWeight: 800,
              background: "linear-gradient(135deg, #a78bfa 0%, #f59e0b 100%)",
              color: "#1b0a38",
            }}
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(167,139,250,0.5)",
              cursor: "pointer",
              fontWeight: 800,
              background: "rgba(10,5,26,0.6)",
              color: "#ddd6fe",
            }}
          >
            새로고침
          </button>
          <Link
            href="/dashboard"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              fontWeight: 800,
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              textDecoration: "none",
            }}
          >
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  );
}
