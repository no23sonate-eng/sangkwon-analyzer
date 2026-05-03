/* ── 도로명 단위 dominant 카테고리 산출 ──

   trdar 거대 단위 한계 극복: 한남동 안에서도 이태원로(명품 라인)와 우사단로(카페 골목)를
   분리해서 dominant 카테고리를 따로 산출.

   동작:
   1. 클릭 좌표 → kakao reverse geocoding 으로 도로명 추출 (서버 API 경유)
   2. places 테이블에서 그 도로명 매장 목록 + 반경 N미터 좌표 매장 합산
   3. 카테고리 분포 → dominant Top 3
   4. trdar 카테고리(외식·카페 등) 와 places 카테고리(명품·플래그십 등) 통합 13개 그룹 단위.
*/

import { getPlacesNear, getPlacesByRoadName } from "./places";
import { CATEGORY_GROUPS } from "./category-economics";
import { makeProvenance, type Provenance } from "./data-quality";

export interface RoadLineDominant {
  road_name: string;
  total_places: number;
  by_group: Record<string, number>;          // CATEGORY_GROUPS 키 → 카운트
  share: Record<string, number>;             // 카운트 / 총합 (0~1)
  dominant: Array<{ group: string; share: number; count: number }>;  // share desc Top 3
  prov: Provenance;
}

/* CATEGORY_GROUPS 7개(trdar) 는 store_summary.by_subcategory 로 카운트.
   places 6개는 places 테이블 카운트. 이 함수는 places 카운트만 (도로명 좌표 단위).
   trdar 카운트는 analyze-area 결과에서 따로 받아 합산해야 정확.
*/

export async function getRoadLineDominantFromPlaces(
  lat: number,
  lng: number,
  options: { road_name?: string; gu?: string; radius_m?: number } = {},
): Promise<RoadLineDominant> {
  const radius = options.radius_m ?? 200;

  // 1차: 좌표 반경 매장 (클릭 지점 중심)
  const near = await getPlacesNear(lat, lng, radius);

  // 2차: 도로명 매장 (있으면 합산 — 동일 도로 라인 전체)
  let roadHits: typeof near.places = [];
  let roadByGroup: Record<string, number> = {};
  if (options.road_name) {
    const road = await getPlacesByRoadName(options.road_name, options.gu);
    roadHits = road.places;
    roadByGroup = road.by_group;
  }

  // dedup by id, 우선 좌표 반경 결과 + 도로명에서 빠진 매장 추가
  const seen = new Set<number>();
  const merged = [...near.places];
  for (const p of near.places) seen.add(p.id);
  for (const p of roadHits) if (!seen.has(p.id)) { merged.push(p); seen.add(p.id); }

  // 그룹별 카운트 합산 (radius + road)
  const by_group: Record<string, number> = { ...near.by_group };
  for (const [k, v] of Object.entries(roadByGroup)) {
    by_group[k] = (by_group[k] ?? 0) + v;
  }
  // dedup 으로 좌표·도로 양쪽에 잡힌 매장은 중복 카운트 — 보정 위해 merged 에서 다시 산출.
  const recount: Record<string, number> = {};
  for (const p of merged) {
    const grp = (await import("./category-economics")).PLACE_CATEGORY_TO_GROUP[p.category];
    if (grp) recount[grp] = (recount[grp] ?? 0) + 1;
  }
  const total = merged.length;

  const share: Record<string, number> = {};
  for (const [k, v] of Object.entries(recount)) {
    share[k] = total > 0 ? v / total : 0;
  }

  const dominant = Object.entries(recount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([group, count]) => ({ group, share: total > 0 ? count / total : 0, count }));

  return {
    road_name: options.road_name ?? "",
    total_places: total,
    by_group: recount,
    share,
    dominant,
    prov: makeProvenance({
      source: "naver_listing",
      sample_size: total,
      collected_at: near.prov.collected_at,
      category: "default",
    }),
  };
}

/* ── trdar(서울시) 카테고리 + places 카테고리 통합 dominant ──
   analyze-area 의 store_summary.by_subcategory 와 합산해서 13개 그룹 단위 dominant 산출.
   BrandSynergy 가 직접 호출.
*/
export interface UnifiedDominant {
  total: number;
  by_group: Record<string, number>;
  share: Record<string, number>;
  dominant: Array<{ group: string; share: number; count: number }>;
  source_breakdown: { trdar: number; places: number };
}

export function unifyDominant(
  bySubcategory: Record<string, { count: number }>,
  placesByGroup: Record<string, number>,
): UnifiedDominant {
  // trdar subs → group 매핑 (CATEGORY_GROUPS 의 subs 기반)
  const subsToGroup: Record<string, string> = {};
  for (const [groupKey, g] of Object.entries(CATEGORY_GROUPS)) {
    for (const sub of g.subs) subsToGroup[sub] = groupKey;
  }

  const merged: Record<string, number> = {};
  let trdarTotal = 0;
  for (const [sub, info] of Object.entries(bySubcategory)) {
    const grp = subsToGroup[sub];
    if (!grp) continue;
    merged[grp] = (merged[grp] ?? 0) + info.count;
    trdarTotal += info.count;
  }
  let placesTotal = 0;
  for (const [grp, n] of Object.entries(placesByGroup)) {
    merged[grp] = (merged[grp] ?? 0) + n;
    placesTotal += n;
  }
  const total = trdarTotal + placesTotal;
  const share: Record<string, number> = {};
  for (const [k, v] of Object.entries(merged)) share[k] = total > 0 ? v / total : 0;
  const dominant = Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([group, count]) => ({ group, share: total > 0 ? count / total : 0, count }));

  return {
    total,
    by_group: merged,
    share,
    dominant,
    source_breakdown: { trdar: trdarTotal, places: placesTotal },
  };
}
