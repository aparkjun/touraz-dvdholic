"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 여행·탐색 구간 테마:
 * - `/dashboard`, `/dashboard/*` — 밝은 데이라이트 전환 테마 (`app-theme-travel`).
 * - 그 외 TRAVEL_PREFIX 경로 — 시네마틱 다층 그라디언트 (`app-theme-travel-cinema` + data-travel-sector).
 * 메인(/), 로그인·회원가입, /admin 은 둘 다 끔.
 */
const TRAVEL_PREFIXES = [
  "/dashboard",
  "/cine-trip",
  "/film-scenic",
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

/** /dashboard 만 밝은 여행 전환 테마 — /dashboard, /dashboard/... */
export function isDashboardTravelPath(pathname) {
  if (!pathname) return false;
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/** 시네마틱 여행 쉘용 첫 경로 세그먼트 (예: cine-trip). 대시보드 구간은 null */
export function getTravelCinemaSector(pathname) {
  if (!pathname || !isTravelThemedPath(pathname)) return null;
  if (isDashboardTravelPath(pathname)) return null;
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg || null;
}

export default function AppRouteTheme({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    const dashTravel = isDashboardTravelPath(pathname) && isTravelThemedPath(pathname);
    const sector = getTravelCinemaSector(pathname);

    document.body.classList.toggle("app-theme-travel", dashTravel);
    document.body.classList.toggle("app-theme-travel-cinema", Boolean(sector));

    shell?.classList.toggle("app-theme-travel", dashTravel);
    shell?.classList.toggle("app-theme-travel-cinema", Boolean(sector));

    if (sector && shell) shell.setAttribute("data-travel-sector", sector);
    else shell?.removeAttribute("data-travel-sector");

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (dashTravel) meta.setAttribute("content", "#dce8f0");
      else if (sector === "pet-travel") meta.setAttribute("content", "#cfe8f5");
      else if (sector) meta.setAttribute("content", "#0f172a");
      else meta.setAttribute("content", "#141414");
    }
  }, [pathname]);

  return children;
}
