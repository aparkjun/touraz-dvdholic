"use client";

import { Mic2 } from "lucide-react";

/**
 * 오디오·TTS 가 재생 중일 때 균형 이퀄라이저 GIF, 그 외에는 Mic2.
 * (public/icons/audio-playing.gif — Pillow 로 생성한 루프 GIF)
 */
export default function VoiceMicIcon({ active, size = 14, className = "" }) {
  const px = typeof size === "number" ? size : 14;
  if (active) {
    return (
      <img
        src="/icons/audio-playing.gif"
        width={px}
        height={px}
        alt=""
        className={className || undefined}
        aria-hidden
        draggable={false}
        style={{ display: "inline-block", verticalAlign: "middle", objectFit: "contain" }}
      />
    );
  }
  return <Mic2 size={px} className={className} />;
}
