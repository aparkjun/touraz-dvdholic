/**
 * 관광사진 ↔ Odii 매칭 캐시.
 * 목록(화면에 보이는 장)을 미리 조회해, 사진 탭 시 즉시 재생 가능 여부를 알려준다.
 */
import axios from "@/lib/axiosConfig";
import {
  djb2Hash,
  filterPlayableAudioGuides,
  sortAudioGuidesStable,
  pickBestOdiiForGalleryPhoto,
  inferOdiiQueriesFromGalleryItem,
  resolveGallerySoundMatchKeyword,
  mergeAudioGuideItemsById,
  galleryMatchCorpus,
} from "@/lib/photoGalleryRegionalAudio";

/** @typedef {'pending'|'ready'|'none'|'noQueries'|'error'} GalleryOdiiMatchStatus */

/** @typedef {{ status: GalleryOdiiMatchStatus, track: object|null, matchKeyword: string }} GalleryOdiiMatchResult */

const sessionCache = new Map();
const inflight = new Map();

export function galleryOdiiItemKey(item) {
  const id = String(item?.galContentId ?? "").trim();
  if (id) return id;
  return `h:${djb2Hash(galleryMatchCorpus(item))}`;
}

function ck(lang, itemKey) {
  return `${lang}:${itemKey}`;
}

export function getGalleryOdiiMatch(lang, item, pageRegionKeyword = "") {
  if (!item) return null;
  const itemKey = galleryOdiiItemKey(item);
  return sessionCache.get(ck(lang, itemKey)) ?? null;
}

export function invalidateGalleryOdiiCache(lang) {
  if (!lang) {
    sessionCache.clear();
    inflight.clear();
    return;
  }
  const prefix = `${lang}:`;
  for (const key of [...sessionCache.keys()]) {
    if (key.startsWith(prefix)) sessionCache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
}

async function searchOdiiMerged(queries, lang, type, signal) {
  const batches = await Promise.all(
    queries.map(async (q) => {
      try {
        const res = await axios.get("/api/v1/audio-guide/search", {
          params: { type, lang, q, limit: 24 },
          signal,
          timeout: 12000,
        });
        return Array.isArray(res?.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    })
  );
  return batches.reduce(
    (acc, batch) => mergeAudioGuideItemsById(acc, batch),
    []
  );
}

/**
 * Odii API로 사진 1장에 대한 매칭 결과를 계산한다.
 * @returns {Promise<GalleryOdiiMatchResult>}
 */
export async function resolveGalleryOdiiMatch(
  item,
  pageRegionKeyword,
  lang,
  photoIndex = 0,
  { signal } = {}
) {
  const queries = inferOdiiQueriesFromGalleryItem(item, pageRegionKeyword);
  const matchKeyword = resolveGallerySoundMatchKeyword(item, pageRegionKeyword);

  if (!queries.length) {
    return { status: "noQueries", matchKeyword, track: null };
  }

  let merged = await searchOdiiMerged(queries, lang, "theme", signal);
  let playable = sortAudioGuidesStable(filterPlayableAudioGuides(merged));
  if (!playable.length) {
    merged = await searchOdiiMerged(queries, lang, "story", signal);
    playable = sortAudioGuidesStable(filterPlayableAudioGuides(merged));
  }

  if (!playable.length) {
    return { status: "none", matchKeyword, track: null };
  }

  const track = pickBestOdiiForGalleryPhoto(
    item,
    playable,
    matchKeyword,
    photoIndex
  );
  if (!track?.audioUrl) {
    return { status: "none", matchKeyword, track: null };
  }

  return { status: "ready", matchKeyword, track };
}

/**
 * 캐시 조회·없으면 조회 후 저장. 동일 키 중복 요청은 하나로 합친다.
 */
export function ensureGalleryOdiiMatch(
  lang,
  item,
  pageRegionKeyword,
  photoIndex = 0,
  { signal, onUpdate } = {}
) {
  if (!item) {
    return Promise.resolve({ status: "noQueries", matchKeyword: "", track: null });
  }

  const itemKey = galleryOdiiItemKey(item);
  const key = ck(lang, itemKey);
  const existing = sessionCache.get(key);
  if (existing && existing.status !== "pending") {
    return Promise.resolve(existing);
  }

  const running = inflight.get(key);
  if (running) {
    return running;
  }

  sessionCache.set(key, { status: "pending", matchKeyword: "", track: null });
  onUpdate?.();

  const promise = resolveGalleryOdiiMatch(
    item,
    pageRegionKeyword,
    lang,
    photoIndex,
    { signal }
  )
    .then((result) => {
      sessionCache.set(key, result);
      inflight.delete(key);
      onUpdate?.();
      return result;
    })
    .catch(() => {
      const err = { status: "error", matchKeyword: "", track: null };
      sessionCache.set(key, err);
      inflight.delete(key);
      onUpdate?.();
      return err;
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * 화면에 보이는 사진들만 백그라운드 매칭(전국 6천 장 전체 X).
 */
export async function prefetchGalleryOdiiBatch(
  items,
  pageRegionKeyword,
  lang,
  { photoIndexOffset = 0, concurrency = 4, signal, onUpdate } = {}
) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return;

  let ptr = 0;
  const workers = Math.min(concurrency, list.length);

  async function worker() {
    while (ptr < list.length) {
      if (signal?.aborted) return;
      const i = ptr++;
      const item = list[i];
      const key = ck(lang, galleryOdiiItemKey(item));
      const existing = sessionCache.get(key);
      if (existing && existing.status !== "pending") continue;

      await ensureGalleryOdiiMatch(lang, item, pageRegionKeyword, photoIndexOffset + i, {
        signal,
        onUpdate,
      });
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
}
