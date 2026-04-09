/* ── 히트맵 데이터: 실제 CSV 기반 ──
   모든 데이터는 /data/*.json에서 로드.
   선택한 상권 반경 내 포인트만 필터링 + 로컬 정규화.
*/

interface RawPoint { lat: number; lng: number; v: number; i: number; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoJSON = any;

// ── 거리 계산 (m) ──
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 반경 내 포인트 필터 + 로컬 정규화 ──
function filterAndNormalize(
  points: RawPoint[],
  centerLat: number,
  centerLng: number,
  radiusM: number,
): GeoJSON {
  // 반경 내 포인트만 필터
  const filtered = points.filter((p) =>
    haversine(centerLat, centerLng, p.lat, p.lng) <= radiusM,
  );

  if (filtered.length === 0) {
    return { type: "FeatureCollection", features: [] };
  }

  // 해당 영역 내에서 로컬 정규화 (0~1)
  const maxV = Math.max(...filtered.map((p) => p.v));

  return {
    type: "FeatureCollection",
    features: filtered.map((p) => ({
      type: "Feature",
      properties: {
        intensity: maxV > 0 ? p.v / maxV : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [p.lng, p.lat],
      },
    })),
  };
}

// ── JSON 캐시 ──
const cache: Record<string, RawPoint[]> = {};

async function loadJSON(path: string): Promise<RawPoint[]> {
  if (cache[path]) return cache[path];
  const res = await fetch(path);
  const data = await res.json();
  cache[path] = data;
  return data;
}

// ── 공개 API ──

/** 선택 상권 반경 내 유동인구 히트맵 */
export async function getTrafficHeatmap(
  lat: number, lng: number, radiusM: number,
): Promise<GeoJSON> {
  const pts = await loadJSON("/data/heatmap-traffic.json");
  return filterAndNormalize(pts, lat, lng, radiusM);
}

/** 선택 상권 반경 내 매출 히트맵 */
export async function getSalesHeatmap(
  lat: number, lng: number, radiusM: number,
): Promise<GeoJSON> {
  const pts = await loadJSON("/data/heatmap-sales.json");
  return filterAndNormalize(pts, lat, lng, radiusM);
}

/** 선택 상권 반경 내 개업 히트맵 */
export async function getOpenHeatmap(
  lat: number, lng: number, radiusM: number,
): Promise<GeoJSON> {
  const pts = await loadJSON("/data/heatmap-open.json");
  return filterAndNormalize(pts, lat, lng, radiusM);
}

/** 선택 상권 반경 내 폐업 히트맵 */
export async function getCloseHeatmap(
  lat: number, lng: number, radiusM: number,
): Promise<GeoJSON> {
  const pts = await loadJSON("/data/heatmap-close.json");
  return filterAndNormalize(pts, lat, lng, radiusM);
}
