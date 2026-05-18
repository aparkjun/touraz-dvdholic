import axios from "@/lib/axiosConfig";

const MEDICAL_KEY = "touraz.medical.favorites.v1";

export function readMedicalFavoritesLocal() {
  if (typeof window === "undefined") return [];
  try {
    const v = window.localStorage.getItem(MEDICAL_KEY);
    const arr = JSON.parse(v || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function medicalToTravelSyncItems() {
  return readMedicalFavoritesLocal().map((s) => ({
    itemType: "medical",
    itemId: String(s.id),
    snapshotJson: JSON.stringify(s),
  }));
}

export async function fetchFavoritesHub(vote = "like", sort = "sortOrder") {
  const res = await axios.get("/api/v1/user/me/favorites/hub", {
    params: { vote, sort },
  });
  return res.data?.data ?? null;
}

export async function patchFavoriteMeta(movieId, body) {
  await axios.patch(
    `/api/v1/user/me/favorites/movies/${encodeURIComponent(movieId)}`,
    body
  );
}

export async function setVisit(visitKey, visited = true) {
  await axios.put(
    `/api/v1/user/me/favorites/visits/${encodeURIComponent(visitKey)}`,
    null,
    { params: { visited } }
  );
}

export async function syncTravelFavorites(items) {
  const res = await axios.post("/api/v1/user/me/favorites/travel/sync", {
    items,
  });
  return res.data?.data ?? [];
}

export async function createFavoritesShare() {
  const res = await axios.post("/api/v1/user/me/favorites/share");
  return res.data?.data?.token ?? null;
}

export async function fetchFavoritesShare(token) {
  const res = await axios.get(`/api/v1/favorites/share/${encodeURIComponent(token)}`);
  return res.data?.data ?? null;
}

export async function fetchFavoriteCourse(movieNames) {
  const params = new URLSearchParams();
  if (movieNames?.length) {
    movieNames.forEach((n) => params.append("movieNames", n));
  }
  const qs = params.toString();
  const res = await axios.get(
    `/api/v1/user/me/favorites/course${qs ? `?${qs}` : ""}`
  );
  return res.data?.data ?? null;
}

export async function fetchFavoriteRecommendations() {
  const res = await axios.get("/api/v1/user/me/favorites/recommendations");
  return res.data?.data ?? [];
}

export async function syncFavoriteNotifications() {
  const res = await axios.post("/api/v1/user/me/favorites/notifications/sync");
  return res.data?.data?.sent ?? 0;
}

export function shareUrlFromToken(token) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/share/favorites/${token}`;
}

export function kakaoMapRegionUrl(regionName) {
  if (!regionName) return null;
  return `https://map.kakao.com/?q=${encodeURIComponent(regionName)}`;
}
