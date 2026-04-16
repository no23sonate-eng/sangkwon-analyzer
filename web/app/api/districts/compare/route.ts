import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS } from "@/lib/district-zones";

export const revalidate = 3600;

// DB에 임대료 데이터가 없을 때 사용하는 폴백 (만원/평)
const RENT_FALLBACK: Record<string, { f1: number; f2: number; b1: number }> = {
  "강남구": { f1: 53.3, f2: 32.0, b1: 30.9 },
  "서초구": { f1: 42.5, f2: 25.5, b1: 24.7 },
  "마포구": { f1: 33.8, f2: 20.3, b1: 19.6 },
  "용산구": { f1: 38.5, f2: 23.1, b1: 22.3 },
  "종로구": { f1: 36.2, f2: 21.7, b1: 21.0 },
  "중구":   { f1: 44.8, f2: 26.9, b1: 26.0 },
  "성동구": { f1: 30.5, f2: 18.3, b1: 17.7 },
  "송파구": { f1: 35.1, f2: 21.1, b1: 20.4 },
  "영등포구": { f1: 32.7, f2: 19.6, b1: 19.0 },
  "광진구": { f1: 28.9, f2: 17.3, b1: 16.8 },
};

interface ZoneStats {
  zone: string;
  label: string;
  areaCount: number;
  totalStores: number;
  avgRentPyeong: number;
  dailyFootTraffic: number;
  openCount: number;
  closeCount: number;
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "districts-compare", 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });

  // zones API와 동일 로직으로 상권 목록 + zone 분류 가져오기
  const zonesApiUrl = new URL(`/api/districts/zones?id=${id}`, req.url);
  const zonesRes = await fetch(zonesApiUrl);
  if (!zonesRes.ok) return NextResponse.json({ zones: [] });
  const zonesData = await zonesRes.json();
  const zoned: Array<{ trdar_cd: string; zone: string }> = zonesData.areas ?? [];

  const codes = zoned.map((z) => z.trdar_cd);
  if (codes.length === 0) return NextResponse.json({ zones: [] });

  const zoneMap = new Map(zoned.map((z: { trdar_cd: string; zone: string }) => [z.trdar_cd, z.zone]));
  const guName = district.gu[0] ?? "";

  // 병렬 조회: stores, foot_traffic, gu_rent_stats, gu_sale_stats
  const [storesRes, ftRes, rentRes, saleRes] = await Promise.all([
    supabase.from("stores").select("trdar_cd, quarter_cd, store_count, open_count, close_count").in("trdar_cd", codes),
    supabase.from("foot_traffic").select("trdar_cd, quarter_cd, total_ft").in("trdar_cd", codes),
    supabaseServer.from("gu_rent_stats").select("f1_pyeong, f2_pyeong, b1_pyeong").eq("gu", guName).maybeSingle(),
    supabaseServer.from("gu_sale_stats").select("m2_price, avg_price").eq("gu", guName).maybeSingle(),
  ]);

  // 최신 분기만
  const storeRows = storesRes.data ?? [];
  const ftRows = ftRes.data ?? [];
  const allQ = Array.from(new Set(storeRows.map((r) => r.quarter_cd))).sort();
  const latestQ = allQ[allQ.length - 1];

  const zoneAgg: Record<string, { stores: number; open: number; close: number; ft: number; count: number }> = {
    main: { stores: 0, open: 0, close: 0, ft: 0, count: 0 },
    side: { stores: 0, open: 0, close: 0, ft: 0, count: 0 },
    rear: { stores: 0, open: 0, close: 0, ft: 0, count: 0 },
  };

  type ZoneKey = "main" | "side" | "rear";
  const isZoneKey = (v: string): v is ZoneKey => v === "main" || v === "side" || v === "rear";

  const countedAreas: Record<ZoneKey, Set<string>> = { main: new Set(), side: new Set(), rear: new Set() };
  for (const r of storeRows) {
    if (r.quarter_cd !== latestQ) continue;
    const z = zoneMap.get(r.trdar_cd);
    if (!z || !isZoneKey(z)) continue;
    zoneAgg[z].stores += r.store_count ?? 0;
    zoneAgg[z].open += r.open_count ?? 0;
    zoneAgg[z].close += r.close_count ?? 0;
    countedAreas[z].add(r.trdar_cd);
  }
  for (const z of ["main", "side", "rear"] as const) {
    zoneAgg[z].count = countedAreas[z].size;
  }

  const ftQ = Array.from(new Set(ftRows.map((r) => r.quarter_cd))).sort();
  const latestFtQ = ftQ[ftQ.length - 1];
  for (const r of ftRows) {
    if (r.quarter_cd !== latestFtQ) continue;
    const z = zoneMap.get(r.trdar_cd);
    if (!z || !isZoneKey(z)) continue;
    zoneAgg[z].ft += Math.round((r.total_ft ?? 0) / 90);
  }

  const rentData = rentRes.data;
  const fb = RENT_FALLBACK[guName];
  const f1 = (rentData?.f1_pyeong ?? 0) > 0 ? rentData!.f1_pyeong : (fb?.f1 ?? 0);
  const f2 = (rentData?.f2_pyeong ?? 0) > 0 ? rentData!.f2_pyeong : (fb?.f2 ?? 0);
  const avgRent = Math.round(((f1 ?? 0) + (f2 ?? 0)) / 2 * 10) / 10;
  const saleData = saleRes.data;
  const avgSaleM2 = saleData?.m2_price ?? 0;

  const ZONE_LABELS = { main: "메인 상권", side: "이면 상권", rear: "배후 상권" };
  const RENT_FACTOR = { main: 1.0, side: 0.55, rear: 0.3 };
  const SALE_FACTOR = { main: 1.15, side: 0.75, rear: 0.5 };

  const zones = (["main", "side", "rear"] as const).map((z) => ({
    zone: z,
    label: ZONE_LABELS[z],
    areaCount: zoneAgg[z].count,
    totalStores: zoneAgg[z].stores,
    avgRentPyeong: Math.round(avgRent * RENT_FACTOR[z] * 10) / 10,
    avgSaleM2: Math.round(avgSaleM2 * SALE_FACTOR[z]),
    dailyFootTraffic: zoneAgg[z].ft,
    openCount: zoneAgg[z].open,
    closeCount: zoneAgg[z].close,
  }));

  return NextResponse.json({
    district: { id: district.id, name: district.name, color: district.color },
    quarter: latestQ ? `${latestQ.slice(0, 4)} Q${latestQ.slice(4)}` : null,
    zones,
  });
}
