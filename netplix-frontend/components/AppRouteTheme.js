"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * CTA로 이어지는 여행·탐색 구간: 쉘/바디를 밝은 "전환" 테마로.
 * 메인(/)·/dashboard(랭킹 허브)·로그인 등은 다크 유지. 상세(/dashboard/images)만 데이라이트.
 */
const TRAVEL_PREFIXES = [
  "/dashboard/images",
  "/cine-trip",
  "/wellness",
  "/crowd-radar",
  "/audio-guide",
  "/trekking",
  "/camping",
  "/photo-gallery",
  "/medical-tourism",
  "/pet-travel",
  "/related-spots",
  "/dvd-stores",
];

export function isTravelThemedPath(pathname) {
  if (!pathname) return false;
  return TRAVEL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function AppRouteTheme({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    const on = isTravelThemedPath(pathname);
    document.body.classList.toggle("app-theme-travel", on);
    document.querySelector(".app-shell")?.classList.toggle("app-theme-travel", on);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", on ? "#dce8f0" : "#141414");
  }, [pathname]);

  return children;
}
