/* ── 본인 큐레이션 브랜드 DB ──
   build-time에 CSV → JSON 변환 (web/scripts/build-curated-brands.mjs).

   trdar 분류로 안 잡히는 명품·플래그십·갤러리·편집숍 등을 좌표 단위로 보유.
   브랜드 시너지 산출의 ground truth.
*/
import data from "./data/curated-brands.json";
import { makeProvenance, type Provenance } from "./data-quality";

export type BrandCategory =
  | "luxury" | "flagship" | "gallery" | "fine_dining"
  | "select_shop" | "lifestyle" | "contemporary" | "streetwear_premium";

export const CATEGORY_LABEL: Record<BrandCategory, string> = {
  luxury: "명품",
  flagship: "플래그십",
  gallery: "갤러리",
  fine_dining: "파인 다이닝",
  select_shop: "셀렉트숍",
  lifestyle: "라이프스타일",
  contemporary: "컨템포러리",
  streetwear_premium: "스트리트웨어 프리미엄",
};

export interface CuratedBrand {
  recorded_at: string;
  gu: string;
  dong: string;
  road_name: string;
  brand_name: string;
  category: BrandCategory;
  store_type: string;
  lat: number;
  lng: number;
  area_pyeong: number;
  opened_at?: string;
  note?: string;
  contributed_by?: string;
}

interface CuratedJson {
  _meta: { synced_at?: string; brand_count?: number; dong_count?: number; category_count?: number };
  brands: CuratedBrand[];
  by_dong: Record<string, CuratedBrand[]>;
  by_category: Record<string, CuratedBrand[]>;
}

const DB = data as CuratedJson;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 좌표 반경 N미터 안 큐레이션 브랜드 — 카테고리별 분포 산출 */
export function getCuratedBrandsNear(lat: number, lng: number, radiusM: number = 200): {
  brands: Array<CuratedBrand & { distance_m: number }>;
  by_category: Record<string, number>;
  prov: Provenance;
} {
  const hits: Array<CuratedBrand & { distance_m: number }> = [];
  for (const b of DB.brands) {
    const d = haversineM(lat, lng, b.lat, b.lng);
    if (d <= radiusM) hits.push({ ...b, distance_m: Math.round(d) });
  }
  hits.sort((a, b) => a.distance_m - b.distance_m);

  const by_category: Record<string, number> = {};
  for (const h of hits) {
    by_category[h.category] = (by_category[h.category] ?? 0) + 1;
  }

  return {
    brands: hits,
    by_category,
    prov: makeProvenance({
      source: "owner_network", // 본인 큐레이션 = Tier 2 (네트워크 GT 와 동급 신뢰)
      sample_size: hits.length,
      collected_at: DB._meta.synced_at ?? new Date().toISOString(),
      category: "default",
    }),
  };
}

/** 동 단위 큐레이션 브랜드 카운트 — admin 헬스 패널·리포트용 */
export function getCuratedBrandsByDong(gu: string, dong: string): CuratedBrand[] {
  return DB.by_dong[`${gu}|${dong}`] ?? [];
}

export function curatedMeta() {
  return DB._meta;
}

export function listCuratedCategories(): BrandCategory[] {
  return Object.keys(DB.by_category) as BrandCategory[];
}
