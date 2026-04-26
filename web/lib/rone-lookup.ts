/* ── R-ONE 권역 lookup ──
   좌표(lat, lng)를 받아 R-ONE 임대 데이터가 실제로 있는 권역 중 가장 가까운 권역 반환.
   데이터 없는 권역(예: 한강진)은 자동으로 skip하여 다음 가까운 권역(이태원)으로 fallback.
*/
import data from "./data/rone-regions.json";
import rentData from "./data/rone-rent-yearly.json";

export interface RoneRegion {
  code: string;
  name: string;
  gu: string;
  lat: number;
  lng: number;
}

const REGIONS: RoneRegion[] = data.regions;
// R-ONE rent JSON에 데이터 있는 권역만 활성
const ACTIVE_NAMES = new Set(Object.keys((rentData as { data?: Record<string, unknown> })?.data ?? {}));

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function nearestRoneRegion(lat: number, lng: number): { region: RoneRegion; distanceKm: number } {
  let best: RoneRegion | null = null;
  let bestDist = Infinity;
  for (const r of REGIONS) {
    // R-ONE 임대 데이터 없는 권역은 skip (lookup의 본래 목적이 R-ONE 매칭이라)
    if (!ACTIVE_NAMES.has(r.name)) continue;
    const d = haversineKm({ lat, lng }, r);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  // 모든 권역이 skip된 극단 케이스 (보통 발생 X) — 첫 권역 fallback
  if (!best) best = REGIONS[0];
  return { region: best, distanceKm: Math.round(bestDist * 100) / 100 };
}

/* 좌표 → 행정 구 추정 (rone-regions의 gu 정보 활용) */
export function inferGuFromCoord(lat: number, lng: number): string {
  return nearestRoneRegion(lat, lng).region.gu;
}
