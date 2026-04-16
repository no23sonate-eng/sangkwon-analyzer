import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, classifyZone } from "@/lib/district-zones";

export const revalidate = 3600;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

  const [cLat, cLng] = district.center;
  const deg = (district.radiusM / 111000) * 1.3;

  let q = supabase
    .from("areas")
    .select("trdar_cd, lat, lng, gu")
    .gte("lat", cLat - deg).lte("lat", cLat + deg)
    .gte("lng", cLng - deg).lte("lng", cLng + deg);
  if (district.gu.length > 0) q = q.in("gu", district.gu);
  const { data: areaRows } = await q.limit(200);

  const zoned = (areaRows ?? [])
    .map((r) => ({
      trdar_cd: r.trdar_cd,
      gu: r.gu,
      dist: haversineM(cLat, cLng, r.lat, r.lng),
    }))
    .filter((r) => r.dist <= district.radiusM)
    .map((r) => ({ ...r, zone: classifyZone(r.dist, district.radiusM) }));

  const codes = zoned.map((z) => z.trdar_cd);
  if (codes.length === 0) return NextResponse.json({ zones: [] });

  const zoneMap = new Map(zoned.map((z) => [z.trdar_cd, z.zone]));
  const guName = zoned[0]?.gu ?? "";

  // 병렬 조회: stores, foot_traffic, gu_rent_stats
  const [storesRes, ftRes, rentRes] = await Promise.all([
    supabase.from("stores").select("trdar_cd, quarter_cd, store_count, open_count, close_count").in("trdar_cd", codes),
    supabase.from("foot_traffic").select("trdar_cd, quarter_cd, total_ft").in("trdar_cd", codes),
    supabase.from("gu_rent_stats").select("f1_pyeong, f2_pyeong, b1_pyeong").eq("gu", guName).maybeSingle(),
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

  const countedAreas = { main: new Set<string>(), side: new Set<string>(), rear: new Set<string>() };
  for (const r of storeRows) {
    if (r.quarter_cd !== latestQ) continue;
    const z = zoneMap.get(r.trdar_cd);
    if (!z) continue;
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
    if (!z) continue;
    zoneAgg[z].ft += Math.round((r.total_ft ?? 0) / 90);
  }

  const rentData = rentRes.data;
  const avgRent = rentData ? Math.round(((rentData.f1_pyeong ?? 0) + (rentData.f2_pyeong ?? 0)) / 2 * 10) / 10 : 0;

  const ZONE_LABELS = { main: "메인 상권", side: "이면 상권", rear: "배후 상권" };
  const RENT_FACTOR = { main: 1.0, side: 0.55, rear: 0.3 };

  const zones: ZoneStats[] = (["main", "side", "rear"] as const).map((z) => ({
    zone: z,
    label: ZONE_LABELS[z],
    areaCount: zoneAgg[z].count,
    totalStores: zoneAgg[z].stores,
    avgRentPyeong: Math.round(avgRent * RENT_FACTOR[z] * 10) / 10,
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
