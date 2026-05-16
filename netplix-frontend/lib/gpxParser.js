/**
 * GPX 1.1 trkpt 좌표 추출 (두루누비 코스 GPX용).
 * @param {string} xml
 * @returns {{ lat: number, lng: number }[]}
 */
export function parseGpxTrackPoints(xml) {
  if (!xml || typeof xml !== 'string') return [];
  const points = [];
  const latLon = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/gi;
  let m;
  while ((m = latLon.exec(xml))) {
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
  }
  if (points.length === 0) {
    const lonLat = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"/gi;
    while ((m = lonLat.exec(xml))) {
      const lng = parseFloat(m[1]);
      const lat = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng });
    }
  }
  return points;
}

export function trackBounds(points) {
  if (!points?.length) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}
