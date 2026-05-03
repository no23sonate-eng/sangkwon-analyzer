/* ── 1층 임대료 anchor 산출 ──
   네이버 등 "실제 임대 데이터" 우선. 매매역산은 마지막 폴백.
   price-history 시계열 anchor에 사용 (위치 맞춤 절대값).

   우선순위:
     1. 본인 네트워크 ground truth (owner_network)
     2. 네이버 추정 실거래 (dong → gu)
     3. 네이버 호가 (dong → gu)
     4. 동 RTMS 매매역산 (cap 5%, 1층 보정 1.7×) — 폴백
     5. 구 평균 (gu_rent_stats / hardcoded) — 폴백
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOwnerNetworkRent } from "./owner-network-rents";
import { getDongLandPrice } from "./dong-sale-data";

const DEFAULT_CAP_RATE = 0.05;
const FLOOR1_BOOST = 1.7;
const MIN_NAVER = 3;

export type RentAnchorSource =
  | "owner_network"
  | "naver_deal_dong"
  | "naver_deal_gu"
  | "naver_listing_dong"
  | "naver_listing_gu"
  | "dong_rtms_inverse"
  | "gu_avg_db"
  | "none";

export interface RentAnchor {
  rent: number;          // 1층 평당 월세 (만원/평/월)
  source: RentAnchorSource;
  detail: string;        // "한남동 네이버 추정 실거래 (n=12)"
  sampleN: number;
}

interface DealRow { rent_per_pyeong: number; floor: string }
interface ListingRow { monthly_rent: number; area_m2: number; floor: string }

function classifyFloor(f: string | null | undefined): "1층" | "2층" | "지하" | null {
  if (f == null) return null;
  const s = String(f).trim();
  if (s === "지하" || s === "B1" || s === "반지하") return "지하";
  if (s === "1" || s === "1층") return "1층";
  if (s === "") return null;
  return "2층";
}

/** 좌표 인근 동 목록 (1km 반경) */
async function nearbyDongNames(
  supabase: SupabaseClient,
  gu: string,
  lat: number,
  lng: number,
): Promise<string[]> {
  const dongDeg = (1000 / 111000) * 1.2;
  const { data } = await supabase
    .from("areas")
    .select("dong, lat, lng")
    .eq("gu", gu)
    .gte("lat", lat - dongDeg).lte("lat", lat + dongDeg)
    .gte("lng", lng - dongDeg).lte("lng", lng + dongDeg)
    .limit(50);
  return Array.from(
    new Set(
      ((data as { dong?: string }[] | null) ?? [])
        .map((a) => a.dong)
        .filter((d): d is string => !!d)
    )
  );
}

export async function getRentAnchor1F(
  supabase: SupabaseClient,
  gu: string,
  dongName: string | undefined,
  dongCode: string | undefined,
  lat: number,
  lng: number,
): Promise<RentAnchor> {
  // 1차: 본인 네트워크 ground truth
  if (dongName) {
    const own = getOwnerNetworkRent(gu, dongName);
    if (own && own.rent > 0) {
      return {
        rent: own.rent,
        source: "owner_network",
        detail: own.detail,
        sampleN: own.n,
      };
    }
  }

  const nearbyDongs = await nearbyDongNames(supabase, gu, lat, lng);
  const avgPP = (rents: number[]) => rents.reduce((s, r) => s + r, 0) / rents.length;
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  // 2~3차: 네이버 추정 실거래 → 호가 (dong → gu)
  for (const scope of ["dong", "gu"] as const) {
    if (scope === "dong" && nearbyDongs.length === 0) continue;

    // 추정 실거래 (사라진 매물 = 거래 추정)
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("naver_estimated_deals")
        .select("rent_per_pyeong, floor")
        .eq("gu", gu)
        .gt("rent_per_pyeong", 0);
      if (scope === "dong") q = q.in("dong", nearbyDongs);
      const { data } = await q.order("disappeared_date", { ascending: false }).limit(150);
      const rows = (data as DealRow[] | null) ?? [];
      const f1 = rows.filter((r) => classifyFloor(r.floor) === "1층").map((r) => r.rent_per_pyeong);
      if (f1.length >= MIN_NAVER) {
        return {
          rent: Math.round(median(f1) * 10) / 10,
          source: scope === "dong" ? "naver_deal_dong" : "naver_deal_gu",
          detail: `${scope === "dong" ? `${dongName ?? "동"} 인근` : gu} 네이버 추정 실거래 1층 (n=${f1.length}, median)`,
          sampleN: f1.length,
        };
      }
    }

    // 호가
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("naver_listings")
        .select("monthly_rent, area_m2, floor")
        .eq("gu", gu)
        .gt("monthly_rent", 0)
        .gt("area_m2", 0);
      if (scope === "dong") q = q.in("dong", nearbyDongs);
      const { data } = await q.order("crawl_date", { ascending: false }).limit(150);
      const rows = (data as ListingRow[] | null) ?? [];
      const perPP = (l: ListingRow) => l.monthly_rent / (l.area_m2 / 3.3);
      const f1 = rows.filter((r) => classifyFloor(r.floor) === "1층" && r.area_m2 > 0).map(perPP);
      if (f1.length >= MIN_NAVER) {
        return {
          rent: Math.round(median(f1) * 10) / 10,
          source: scope === "dong" ? "naver_listing_dong" : "naver_listing_gu",
          detail: `${scope === "dong" ? `${dongName ?? "동"} 인근` : gu} 네이버 호가 1층 (n=${f1.length}, median)`,
          sampleN: f1.length,
        };
      }
    }
  }

  // 4차: 동 RTMS 매매역산 (네이버 표본 부족 시 위치별 차이는 유지)
  if (dongName) {
    const dongLand = getDongLandPrice(gu, dongName, dongCode);
    if (dongLand && dongLand.source !== "gu_avg") {
      const rent1F = Math.round((dongLand.pricePerPyeong * DEFAULT_CAP_RATE / 12) * FLOOR1_BOOST * 10) / 10;
      return {
        rent: rent1F,
        source: "dong_rtms_inverse",
        detail: `${dongName} RTMS 매매역산 (cap ${DEFAULT_CAP_RATE * 100}%, 1층 ×${FLOOR1_BOOST}) · ${dongLand.detail}`,
        sampleN: dongLand.sampleN,
      };
    }
  }

  // 5차: gu_rent_stats DB
  const { data: guStats } = await supabase
    .from("gu_rent_stats")
    .select("f1_pyeong")
    .eq("gu", gu)
    .single();
  if (guStats && (guStats as { f1_pyeong?: number }).f1_pyeong != null && (guStats as { f1_pyeong: number }).f1_pyeong > 0) {
    const f1 = (guStats as { f1_pyeong: number }).f1_pyeong;
    return {
      rent: f1,
      source: "gu_avg_db",
      detail: `${gu} 권역 평균`,
      sampleN: 1,
    };
  }

  return { rent: 0, source: "none", detail: "anchor 산출 실패", sampleN: 0 };
}

export function rentAnchorSourceLabel(src: RentAnchorSource): string {
  switch (src) {
    case "owner_network": return "본인 네트워크 GT";
    case "naver_deal_dong": return "네이버 추정 실거래 (동)";
    case "naver_deal_gu": return "네이버 추정 실거래 (구)";
    case "naver_listing_dong": return "네이버 호가 (동)";
    case "naver_listing_gu": return "네이버 호가 (구)";
    case "dong_rtms_inverse": return "동 RTMS 매매역산 (폴백)";
    case "gu_avg_db": return "구 평균 (폴백)";
    case "none": return "anchor 없음";
  }
}
