/* ── 주소 → 필지 자동조회 헬퍼 (VWorld) ──

   /api/land-lookup 라우트가 사용하는 순수 함수 모음.
   외부 호출부와 분리해 파싱·기하 계산을 단독 테스트 가능하게 유지한다.

   데이터 소스 (VWorld, 국토부):
   - 주소→좌표: req/address getcoord
   - 연속지적도(필지 폴리곤): data GetFeature LP_PA_CBND_BUBUN
   - 용도지역: data GetFeature LT_C_UQ111

   필지 폴리곤에서 직접 산출:
   - 면적(㎡): 구면 보정 shoelace
   - 북측 폭(동서 extent)·남북 깊이: bbox — 정북 일조 입력값으로 사용
   ※ bbox 기반이라 부정형 대지는 실제보다 크게 잡힐 수 있음(개략 검토용).
*/

import type { ZoneKey } from "./use-zones";

/* ── 용도지역명 → ZoneKey ── */
const ZONE_NAME_MAP: Array<[string, ZoneKey]> = [
  ["제1종전용주거", "res1_exclusive"],
  ["제2종전용주거", "res2_exclusive"],
  ["제1종일반주거", "res1_general"],
  ["제2종일반주거", "res2_general"],
  ["제3종일반주거", "res3_general"],
  ["준주거", "semi_residential"],
  ["중심상업", "central_commercial"],
  ["일반상업", "general_commercial"],
  ["근린상업", "neighborhood_commercial"],
  ["유통상업", "distribution_commercial"],
  ["전용공업", "exclusive_industrial"],
  ["일반공업", "general_industrial"],
  ["준공업", "semi_industrial"],
  ["보전녹지", "conservation_green"],
  ["생산녹지", "production_green"],
  ["자연녹지", "natural_green"],
];

export function zoneNameToKey(name: string): ZoneKey | null {
  const n = (name ?? "").replace(/\s/g, "");
  for (const [kw, key] of ZONE_NAME_MAP) if (n.includes(kw)) return key;
  return null;
}

/** GetFeature 응답의 properties 들에서 용도지역명 후보 추출 (스키마 변화 방어) */
export function extractZoneName(props: Record<string, unknown>): string | null {
  // 대표 컬럼 우선
  for (const k of ["uname", "UNAME", "dgm_nm", "prpos_area_dstrc_nm"]) {
    const v = props[k];
    if (typeof v === "string" && v.includes("지역")) return v;
  }
  // 폴백: 값 스캔
  for (const v of Object.values(props)) {
    if (typeof v === "string" && /지역$/.test(v.trim()) && zoneNameToKey(v)) return v.trim();
  }
  return null;
}

/* ── 필지 폴리곤 기하 ── */
export interface ParcelMetrics {
  areaM2: number;
  northWidthM: number; // 동서 폭 (bbox)
  lotDepthM: number; // 남북 깊이 (bbox)
  centroid: { lat: number; lng: number };
}

/** [lng,lat][] 링에서 면적·bbox 산출 (등장방형 근사, 서울 스케일 충분) */
export function polygonMetrics(ring: [number, number][]): ParcelMetrics {
  if (ring.length < 3) throw new Error("폴리곤 좌표가 3점 미만");
  const latAvg = ring.reduce((s, [, la]) => s + la, 0) / ring.length;
  const mPerLng = 111320 * Math.cos((latAvg * Math.PI) / 180);
  const mPerLat = 111320;

  // shoelace (m 단위 투영)
  let area2 = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    area2 += (x1 * mPerLng) * (y2 * mPerLat) - (x2 * mPerLng) * (y1 * mPerLat);
    minX = Math.min(minX, x1); maxX = Math.max(maxX, x1);
    minY = Math.min(minY, y1); maxY = Math.max(maxY, y1);
  }
  return {
    areaM2: Math.round(Math.abs(area2) / 2),
    northWidthM: Math.round((maxX - minX) * mPerLng * 10) / 10,
    lotDepthM: Math.round((maxY - minY) * mPerLat * 10) / 10,
    centroid: { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 },
  };
}

/** GeoJSON geometry(Polygon/MultiPolygon)에서 최대 외곽 링 추출 */
export function outerRing(geometry: { type?: string; coordinates?: unknown }): [number, number][] | null {
  const g = geometry ?? {};
  try {
    if (g.type === "Polygon") return (g.coordinates as [number, number][][])[0] ?? null;
    if (g.type === "MultiPolygon") {
      const polys = g.coordinates as [number, number][][][];
      let best: [number, number][] | null = null;
      let bestN = 0;
      for (const p of polys) {
        const r = p[0];
        if (r && r.length > bestN) { best = r; bestN = r.length; }
      }
      return best;
    }
  } catch { /* fallthrough */ }
  return null;
}

/* ── VWorld 응답 파서 (방어적) ── */
export function parseGeocode(json: unknown): { lat: number; lng: number; refined?: string } | null {
  const r = (json as { response?: { status?: string; result?: { point?: { x?: string; y?: string } }; refined?: { text?: string } } })?.response;
  if (r?.status !== "OK") return null;
  const x = parseFloat(r.result?.point?.x ?? "");
  const y = parseFloat(r.result?.point?.y ?? "");
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { lng: x, lat: y, refined: r.refined?.text };
}

export interface VwFeature {
  properties: Record<string, unknown>;
  geometry: { type?: string; coordinates?: unknown };
}

export function parseFeatures(json: unknown): VwFeature[] {
  const r = (json as {
    response?: { status?: string; result?: { featureCollection?: { features?: VwFeature[] } } };
  })?.response;
  if (r?.status !== "OK") return [];
  return r.result?.featureCollection?.features ?? [];
}

/** 용도지구·구역 등 규제명 후보 추출 (스키마 방어적: 한글 명칭 스캔) */
export function extractDistrictNames(props: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(props)) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length >= 2 && t.length <= 40 && /[가-힣]/.test(t) && /(지구|구역|계획|권역|보호|제한)/.test(t)) out.push(t);
  }
  return [...new Set(out)];
}

/** 고도지구류 명칭에서 높이(m) 파싱 — 예: "20m고도지구" */
export function parseHeightLimit(names: string[]): number | null {
  for (const n of names) {
    if (!/고도/.test(n)) continue;
    const m = n.match(/(\d+(?:\.\d+)?)\s*(?:m|미터|Ｍ|M)/);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

/** 도로 레이어 properties → 도로명·폭(m) 추출 (스키마 방어적)
   폭 후보 컬럼: width/폭/rdwidth/wdt 류 · 숫자값 0~100m 범위. */
export function extractRoadInfo(props: Record<string, unknown>): { name?: string; widthM?: number } {
  let name: string | undefined;
  let widthM: number | undefined;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string") {
      const t = v.trim();
      if (!name && /(대로|로|길)$/.test(t) && t.length <= 30 && /[가-힣]/.test(t)) name = t;
    }
    if (/(width|폭|rdwid|wdt|rw_?)/i.test(k)) {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (Number.isFinite(n) && n > 0 && n < 100 && (widthM === undefined || n > widthM)) widthM = n;
    }
  }
  return { name, widthM };
}

/** DEM 표고 응답에서 표고(m) 파싱 (VWorld getElevation / attr 방어적) */
export function parseElevation(json: unknown): number | null {
  // req/data 또는 전용 elevation 응답 모두 대응: 숫자형 height/elevation/z 탐색
  const walk = (o: unknown, depth: number): number | null => {
    if (depth > 6 || o == null) return null;
    if (typeof o === "object") {
      for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
        if (/(elevation|height|altitude|^z$|표고|고도)/i.test(k)) {
          const n = typeof v === "number" ? v : parseFloat(String(v));
          if (Number.isFinite(n) && Math.abs(n) < 5000) return n;
        }
        const r = walk(v, depth + 1);
        if (r != null) return r;
      }
    }
    return null;
  };
  return walk(json, 0);
}
