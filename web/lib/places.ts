/* ── places 테이블 lookup ──

   place_crawler.py 가 자동 수집한 매장 데이터(명품/플래그십/갤러리/파인다이닝/편집숍/라이프스타일)를
   좌표 반경 / 도로명 단위로 조회.

   trdar 카테고리 7개 + places 카테고리 6개 = 통합 카테고리 13개의
   "추가 6개" 데이터 소스.
*/
import { createClient } from "@supabase/supabase-js";
import { makeProvenance, type Provenance } from "./data-quality";
import { PLACE_CATEGORY_TO_GROUP } from "./category-economics";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function client() {
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export type PlaceCategory =
  | "luxury" | "flagship" | "gallery" | "fine_dining" | "select_shop" | "lifestyle"
  | "contemporary" | "streetwear_premium";

export interface Place {
  id: number;
  kakao_place_id: string;
  brand_name: string;
  category: PlaceCategory;
  kakao_category_name?: string;
  road_name?: string;
  road_address?: string;
  address?: string;
  lat: number;
  lng: number;
  gu?: string;
  dong?: string;
  collected_at?: string;
  is_curated?: boolean;
  is_disabled?: boolean;
  distance_m?: number;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 좌표 반경 N미터 안 모든 places. 도로명 dominant 산출 / BrandSynergy 입력. */
export async function getPlacesNear(
  lat: number,
  lng: number,
  radiusM: number = 200,
): Promise<{ places: Place[]; by_category: Record<string, number>; by_group: Record<string, number>; prov: Provenance }> {
  const sb = client();
  const deg = (radiusM / 111000) * 1.5;
  const { data, error } = await sb
    .from("places")
    .select("id, kakao_place_id, brand_name, category, kakao_category_name, road_name, road_address, address, lat, lng, gu, dong, collected_at, is_curated, is_disabled")
    .gte("lat", lat - deg).lte("lat", lat + deg)
    .gte("lng", lng - deg).lte("lng", lng + deg)
    .eq("is_disabled", false)
    .limit(500);

  if (error || !data) {
    return {
      places: [],
      by_category: {},
      by_group: {},
      prov: makeProvenance({
        source: "naver_listing", // places 자체 source kind 정의 안 됨 — 인접 분류로 매핑
        sample_size: 0,
        collected_at: new Date().toISOString(),
        category: "default",
      }),
    };
  }
  const placesAll = data as Place[];
  const places = placesAll
    .map((p) => ({ ...p, distance_m: Math.round(haversineM(lat, lng, p.lat, p.lng)) }))
    .filter((p) => (p.distance_m ?? 999_999) <= radiusM)
    .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));

  const by_category: Record<string, number> = {};
  const by_group: Record<string, number> = {};
  let latestCollected = "";
  for (const p of places) {
    by_category[p.category] = (by_category[p.category] ?? 0) + 1;
    const grp = PLACE_CATEGORY_TO_GROUP[p.category];
    if (grp) by_group[grp] = (by_group[grp] ?? 0) + 1;
    if (p.collected_at && p.collected_at > latestCollected) latestCollected = p.collected_at;
  }

  return {
    places,
    by_category,
    by_group,
    prov: makeProvenance({
      source: "naver_listing",
      sample_size: places.length,
      collected_at: latestCollected || new Date().toISOString(),
      category: "default",
    }),
  };
}

/** 도로명 단위 places 통계 — 도로명 dominant 산출에 사용 */
export async function getPlacesByRoadName(
  roadName: string,
  gu?: string,
): Promise<{ places: Place[]; by_category: Record<string, number>; by_group: Record<string, number> }> {
  if (!roadName) return { places: [], by_category: {}, by_group: {} };
  const sb = client();
  let q = sb.from("places")
    .select("id, kakao_place_id, brand_name, category, road_name, road_address, lat, lng, gu, dong")
    .eq("road_name", roadName)
    .eq("is_disabled", false);
  if (gu) q = q.eq("gu", gu);
  const { data } = await q.limit(500);
  const places = (data as Place[]) ?? [];
  const by_category: Record<string, number> = {};
  const by_group: Record<string, number> = {};
  for (const p of places) {
    by_category[p.category] = (by_category[p.category] ?? 0) + 1;
    const grp = PLACE_CATEGORY_TO_GROUP[p.category];
    if (grp) by_group[grp] = (by_group[grp] ?? 0) + 1;
  }
  return { places, by_category, by_group };
}
