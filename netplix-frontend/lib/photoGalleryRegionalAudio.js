/**
 * 관광사진 갤러리 × 오디오 가이드(Odii) 연결용 규칙.
 *
 * - 한 지역(검색 키워드)마다 Odii 검색 결과 중 audioUrl 이 있는 항목만 사용.
 * - 지역 문자열로 안정적인 시작 인덱스를 정하고, 사진 그리드 인덱스만큼 순환해
 *   같은 지역 풀 안에서 사진마다 다른 트랙이 나가도록 한다.
 */

export function djb2Hash(str) {
  let h = 5381;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h << 5) + h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function filterPlayableAudioGuides(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.filter((x) => x && typeof x.audioUrl === "string" && x.audioUrl.trim());
}

/** id 기준 정렬로 Odii 응답 순서 흔들림에 덜 민감하게 */
export function sortAudioGuidesStable(items) {
  return [...items].sort((a, b) => String(a?.id ?? "").localeCompare(String(b?.id ?? "")));
}

/**
 * @param {Array} playable audioUrl 있는 항목만, 이미 정렬된 배열 권장
 * @param {string} regionKey 지역 검색어 (서울, 부산 …)
 * @param {number} photoIndex 갤러리 카드 인덱스
 */
export function pickRegionalAudioTrackIndex(playable, regionKey, photoIndex = 0) {
  if (!playable.length) return -1;
  const base = djb2Hash(regionKey) % playable.length;
  const off = Math.abs(parseInt(photoIndex, 10) || 0);
  return (base + off) % playable.length;
}
