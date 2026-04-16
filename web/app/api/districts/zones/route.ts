import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, type ZonedArea, type DistrictDef } from "@/lib/district-zones";

export const revalidate = 3600;

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

/**
 * 복합 점수 기반 zone 분류
 * - 유동인구(40%) + 매출(30%) + 점포밀도(30%)
 * - 상위 30% = 메인, 중간 40% = 이면, 하위 30% = 배후
 */
function classifyByScore(
  areas: Array<{ trdar_cd: string; ftScore: number; salesScore: number; storeScore: number }>
): Map<string, "main" | "side" | "rear"> {
  const result = new Map<string, "main" | "side" | "rear">();
  if (areas.length === 0) return result;

  const scores = areas.map((a) => ({
    trdar_cd: a.trdar_cd,
    score: a.ftScore * 0.4 + a.salesScore * 0.3 + a.storeScore * 0.3,
  }));
  scores.sort((a, b) => b.score - a.score);

  const n = scores.length;
  const mainCut = Math.max(1, Math.ceil(n * 0.3));
  const sideCut = Math.max(mainCut + 1, Math.ceil(n * 0.7));

  for (let i = 0; i < n; i++) {
    result.set(scores[i].trdar_cd, i < mainCut ? "main" : i < sideCut ? "side" : "rear");
  }
  return result;
}

async function getZonesForDistrict(d: DistrictDef): Promise<ZonedArea[]> {
  const [cLat, cLng] = d.center;
  const deg = (d.radiusM / 111000) * 1.3;

  let q = supabase
    .from("areas")
    .select("trdar_cd, trdar_nm, lat, lng, gu")
    .gte("lat", cLat - deg).lte("lat", cLat + deg)
    .gte("lng", cLng - deg).lte("lng", cLng + deg);

  if (d.gu.length > 0) q = q.in("gu", d.gu);

  const { data: areaRows } = await q.limit(200);
  if (!areaRows || areaRows.length === 0) return [];

  const nearby = areaRows
    .map((r) => ({ ...r, dist: haversineM(cLat, cLng, r.lat, r.lng) }))
    .filter((r) => r.dist <= d.radiusM);

  if (nearby.length === 0) return [];
  const codes = nearby.map((r) => r.trdar_cd);

  // 유동인구 + 매출 + 점포수 병렬 조회
  const [ftRes, salesRes, storesRes] = await Promise.all([
    supabase.from("foot_traffic").select("trdar_cd, quarter_cd, total_ft").in("trdar_cd", codes),
    supabase.from("sales").select("trdar_cd, quarter_cd, monthly_sales").in("trdar_cd", codes),
    supabase.from("stores").select("trdar_cd, quarter_cd, store_count").in("trdar_cd", codes),
  ]);

  // 최신 분기 기준 집계
  const aggregate = (rows: Array<Record<string, unknown>>, field: string) => {
    const quarters = Array.from(new Set((rows ?? []).map((r) => String(r.quarter_cd ?? "")))).sort();
    const latest = quarters[quarters.length - 1];
    const byArea = new Map<string, number>();
    for (const r of rows ?? []) {
      if (String(r.quarter_cd) !== latest) continue;
      const cd = String(r.trdar_cd);
      byArea.set(cd, (byArea.get(cd) ?? 0) + (Number(r[field]) || 0));
    }
    return byArea;
  };

  const ftByArea = aggregate(ftRes.data ?? [], "total_ft");
  const salesByArea = aggregate(salesRes.data ?? [], "monthly_sales");
  const storesByArea = aggregate(storesRes.data ?? [], "store_count");

  // 정규화 (0~1)
  const normalize = (map: Map<string, number>) => {
    const max = Math.max(...Array.from(map.values()), 1);
    const norm = new Map<string, number>();
    for (const cd of codes) norm.set(cd, (map.get(cd) ?? 0) / max);
    return norm;
  };

  const ftNorm = normalize(ftByArea);
  const salesNorm = normalize(salesByArea);
  const storesNorm = normalize(storesByArea);

  const scored = codes.map((cd) => ({
    trdar_cd: cd,
    ftScore: ftNorm.get(cd) ?? 0,
    salesScore: salesNorm.get(cd) ?? 0,
    storeScore: storesNorm.get(cd) ?? 0,
  }));

  const zoneMap = classifyByScore(scored);

  return nearby
    .map((r) => ({
      trdar_cd: r.trdar_cd,
      trdar_nm: r.trdar_nm,
      lat: r.lat,
      lng: r.lng,
      zone: zoneMap.get(r.trdar_cd) ?? "rear",
      distFromCenter: Math.round(r.dist),
    }))
    .sort((a, b) => {
      const order = { main: 0, side: 1, rear: 2 };
      return order[a.zone] - order[b.zone] || a.distFromCenter - b.distFromCenter;
    });
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "districts-zones", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const district = DISTRICTS.find((d) => d.id === id);
    if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });
    const areas = await getZonesForDistrict(district);
    return NextResponse.json({ district, areas });
  }

  const all = await Promise.all(
    DISTRICTS.map(async (d) => ({
      district: d,
      areas: await getZonesForDistrict(d),
    }))
  );

  return NextResponse.json(all);
}
