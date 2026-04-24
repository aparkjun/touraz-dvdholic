"use client";

/**
 * useMedicalFavorites — /medical-tourism 페이지 즐겨찾기 상태 훅.
 *
 * 특징:
 *  - localStorage 에 "id[]" 가 아니라 "스팟 스냅샷 배열"을 저장한다.
 *    즐겨찾기 모드 전환 시 원본 목록에 없는 항목도 표시해야 하므로,
 *    name/address/lat/lon/imageUrl/tel/areaCode/category 등 렌더에 필요한
 *    핵심 필드를 함께 저장한다.
 *  - localStorage 가 사용 불가능한 환경(SSR, 권한 제한)에서도 안전하게 동작.
 *  - 저장 시 모든 창/탭이 'storage' 이벤트로 실시간 동기화.
 *  - v1 포맷: { id, name, address, zipcode, latitude, longitude, imageUrl,
 *             tel, category, areaCode, sigunguCode, language, savedAt }
 */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "touraz.medical.favorites.v1";

/** localStorage 안전 읽기. 파싱 실패하거나 접근 제한되면 빈 배열 반환. */
function readRaw() {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (!v) return [];
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function writeRaw(arr) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (_) {
    /* 용량 초과/권한 제한 시 조용히 포기 */
  }
}

/** 렌더에 필요한 필드만 추출해 스냅샷 객체 생성. 누락 필드는 null 로 남김. */
function toSnapshot(spot) {
  if (!spot || !spot.id) return null;
  return {
    id: spot.id,
    name: spot.name ?? null,
    address: spot.address ?? null,
    zipcode: spot.zipcode ?? null,
    latitude: spot.latitude ?? null,
    longitude: spot.longitude ?? null,
    imageUrl: spot.imageUrl ?? null,
    tel: spot.tel ?? null,
    category: spot.category ?? null,
    areaCode: spot.areaCode ?? null,
    sigunguCode: spot.sigunguCode ?? null,
    language: spot.language ?? null,
    savedAt: Date.now(),
  };
}

export function useMedicalFavorites() {
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readRaw());
    setHydrated(true);
    // 다른 탭/창에서 변경 감지
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setItems(readRaw());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isSaved = useCallback(
    (id) => items.some((x) => x.id === id),
    [items]
  );

  const add = useCallback((spot) => {
    const snap = toSnapshot(spot);
    if (!snap) return;
    setItems((prev) => {
      if (prev.some((x) => x.id === snap.id)) return prev;
      const next = [snap, ...prev];
      writeRaw(next);
      return next;
    });
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeRaw(next);
      return next;
    });
  }, []);

  const toggle = useCallback((spot) => {
    if (!spot?.id) return;
    setItems((prev) => {
      const exists = prev.some((x) => x.id === spot.id);
      if (exists) {
        const next = prev.filter((x) => x.id !== spot.id);
        writeRaw(next);
        return next;
      }
      const snap = toSnapshot(spot);
      if (!snap) return prev;
      const next = [snap, ...prev];
      writeRaw(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    writeRaw([]);
  }, []);

  return {
    items,
    count: items.length,
    hydrated,
    isSaved,
    add,
    remove,
    toggle,
    clearAll,
  };
}
