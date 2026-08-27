"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 외부 사이트 뷰어에서 시스템/스와이프 뒤로가기가 iframe 히스토리에 먹히지 않고
 * 목록(returnPath)으로 돌아오게 한다.
 */
export default function useViewerBack(returnPath, fallback = "/dashboard") {
  const router = useRouter();
  const dest =
    returnPath && String(returnPath).startsWith("/") ? returnPath : fallback;

  const goBack = useCallback(() => {
    router.replace(dest);
  }, [router, dest]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onPop = () => {
      router.replace(dest);
    };
    const onAppBack = (e) => {
      e.preventDefault();
      router.replace(dest);
    };

    window.addEventListener("popstate", onPop);
    window.addEventListener("touraz-app-back", onAppBack);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("touraz-app-back", onAppBack);
    };
  }, [router, dest]);

  return goBack;
}
