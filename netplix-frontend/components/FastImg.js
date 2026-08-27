"use client";

import { cardImageUrl, fullImageUrl } from "@/lib/fastImage";

/**
 * 목록/카드용 img. 저용량 URL 을 먼저 요청하고, 실패 시 원본으로 한 번만 폴백한다.
 *
 * mode="card"  — KTO 썸네일 / TMDB w342 (기본)
 * mode="full"  — 원본(HTTPS 승격만)
 * mode="raw"   — 변환 없이 HTTPS 만
 */
export default function FastImg({
  src,
  alt = "",
  mode = "card",
  tmdbSize = "w342",
  priority = false,
  fallbackSrc,
  loading,
  decoding = "async",
  fetchPriority,
  referrerPolicy = "no-referrer",
  onError,
  ...rest
}) {
  const original = fullImageUrl(src);
  const optimized =
    mode === "full" || mode === "raw"
      ? original
      : cardImageUrl(src, { tmdbSize });
  const fallback = fullImageUrl(fallbackSrc) || original;
  const canFallback = Boolean(fallback && fallback !== optimized);
  const resolvedLoading = loading ?? (priority ? "eager" : "lazy");
  const resolvedFetchPriority =
    fetchPriority ?? (priority ? "high" : undefined);

  return (
    <img
      {...rest}
      src={optimized || fallback}
      alt={alt}
      loading={resolvedLoading}
      decoding={decoding}
      referrerPolicy={referrerPolicy}
      {...(resolvedFetchPriority ? { fetchPriority: resolvedFetchPriority } : {})}
      onError={(e) => {
        const el = e.currentTarget;
        if (canFallback && el.dataset.fb !== "1") {
          el.dataset.fb = "1";
          el.src = fallback;
          return;
        }
        onError?.(e);
      }}
    />
  );
}
