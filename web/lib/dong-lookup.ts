/* ── 행정동 lookup ──
   좌표(lat, lng) → 서울 행정동(adm_cd2 10자리, 동명, 구명) 반환.
   서버 사이드 전용 (fs 사용). public/data/seoul_dong_polygons.geojson 1회 로드 캐시.
   point-in-polygon 미스 시 nearest dong 폴백.
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface DongInfo {
  dong_code: string;       // 10자리 (adm_cd2) — 행정동코드 표준
  dong_code_short: string; // 8자리 (adm_cd)
  dong_name: string;       // "한남동"
  full_name: string;       // "서울특별시 용산구 한남동"
  gu_name: string;         // "용산구"
  gu_code: string;         // "11170"
}

interface DongFeature {
  type: "Feature";
  properties: DongInfo;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

interface DongCollection {
  type: "FeatureCollection";
  features: DongFeature[];
}

let cache: DongFeature[] | null = null;

function loadDongs(): DongFeature[] {
  if (cache) return cache;
  const path = join(process.cwd(), "public", "data", "seoul_dong_polygons.geojson");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as DongCollection;

  // bbox 프리컴퓨트 — point-in-polygon 호출 전 필터로 사용 (426개 → 평균 5개로 축소)
  for (const f of raw.features) {
    f.bbox = computeBbox(f.geometry);
  }
  cache = raw.features;
  return cache;
}

function computeBbox(geom: DongFeature["geometry"]): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const visit = (coords: number[][]) => {
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (geom.type === "Polygon") {
    for (const ring of geom.coordinates as number[][][]) visit(ring);
  } else {
    for (const poly of geom.coordinates as number[][][][]) {
      for (const ring of poly) visit(ring);
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  // ray casting
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, geom: DongFeature["geometry"]): boolean {
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as number[][][];
    if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
    // 홀(hole) 체크
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
  }
  // MultiPolygon
  for (const poly of geom.coordinates as number[][][][]) {
    if (!poly.length || !pointInRing(lng, lat, poly[0])) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRing(lng, lat, poly[i])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}

/** 좌표 → 동. 폴리곤 내부에 정확히 들어가지 않으면 null. */
export function findDongByCoord(lat: number, lng: number): DongInfo | null {
  const dongs = loadDongs();
  for (const f of dongs) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox!;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (pointInPolygon(lng, lat, f.geometry)) return f.properties;
  }
  return null;
}

/** 가장 가까운 동 (한강 위, 도로 위 등 폴리곤 외부 좌표 폴백용). 거리는 bbox 중심 기준. */
export function nearestDongByCoord(lat: number, lng: number): { dong: DongInfo; distanceKm: number } {
  const dongs = loadDongs();
  let best: DongFeature | null = null;
  let bestDist = Infinity;
  for (const f of dongs) {
    const [minLng, minLat, maxLng, maxLat] = f.bbox!;
    const cx = (minLng + maxLng) / 2;
    const cy = (minLat + maxLat) / 2;
    const dx = (lng - cx) * Math.cos((lat * Math.PI) / 180);
    const dy = lat - cy;
    const d = Math.sqrt(dx * dx + dy * dy) * 111;
    if (d < bestDist) { bestDist = d; best = f; }
  }
  if (!best) throw new Error("dong polygons not loaded");
  return { dong: best.properties, distanceKm: Math.round(bestDist * 100) / 100 };
}

/** 좌표 → 동. 폴리곤 매칭 실패 시 가장 가까운 동으로 폴백. 항상 반환. */
export function resolveDong(lat: number, lng: number): DongInfo {
  return findDongByCoord(lat, lng) ?? nearestDongByCoord(lat, lng).dong;
}

/** 인접 동 후보 — 표본 적은 동 폴백용 (bbox 중심 거리 기준 상위 N개) */
export function adjacentDongs(dongCode: string, n: number = 5): DongInfo[] {
  const dongs = loadDongs();
  const target = dongs.find((f) => f.properties.dong_code === dongCode);
  if (!target) return [];
  const [tMinLng, tMinLat, tMaxLng, tMaxLat] = target.bbox!;
  const tcx = (tMinLng + tMaxLng) / 2;
  const tcy = (tMinLat + tMaxLat) / 2;
  return dongs
    .filter((f) => f.properties.dong_code !== dongCode)
    .map((f) => {
      const [minLng, minLat, maxLng, maxLat] = f.bbox!;
      const cx = (minLng + maxLng) / 2;
      const cy = (minLat + maxLat) / 2;
      const dx = (cx - tcx) * Math.cos((tcy * Math.PI) / 180);
      const dy = cy - tcy;
      const d = Math.sqrt(dx * dx + dy * dy);
      return { props: f.properties, dist: d };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
    .map((x) => x.props);
}

/** 전체 동 목록 (UI 드롭다운 등) */
export function allDongs(): DongInfo[] {
  return loadDongs().map((f) => f.properties);
}
