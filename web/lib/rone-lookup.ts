/* ── R-ONE 권역 lookup ──
   좌표(lat, lng)를 받아 가장 가까운 R-ONE 상업용부동산 임대동향조사 권역을 반환.
   현재 서울 핵심 권역만 정의되어 있음 — 정밀 매핑은 R-ONE 공식 권역 구획도 기반으로 추후 갱신.
*/
import data from "./data/rone-regions.json";

export interface RoneRegion {
  code: string;
  name: string;
  gu: string;
  lat: number;
  lng: number;
}

const REGIONS: RoneRegion[] = data.regions;

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
  let best = REGIONS[0];
  let bestDist = Infinity;
  for (const r of REGIONS) {
    const d = haversineKm({ lat, lng }, r);
    if (d < bestDist) {
      bestDist = d;
      best = r;
    }
  }
  return { region: best, distanceKm: Math.round(bestDist * 100) / 100 };
}

/* 좌표 → 행정 구 추정 (rone-regions의 gu 정보 활용) */
export function inferGuFromCoord(lat: number, lng: number): string {
  return nearestRoneRegion(lat, lng).region.gu;
}
