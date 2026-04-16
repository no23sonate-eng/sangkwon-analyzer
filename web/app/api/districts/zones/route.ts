import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, distToAxisM, type ZonedArea, type DistrictDef } from "@/lib/district-zones";

export const revalidate = 3600;

/**
 * 축 거리(40%) + 유동인구(30%) + 매출(30%) 복합 점수
 * 축에 가까우면서 유동인구·매출이 높은 곳 = 메인
 */
function classifyByCompositeScore(
  areas: Array<{ trdar_cd: string; axisDist: number; ft: number; sales: number }>,
  bufferM: number,
): Map<string, "main" | "side" | "rear"> {
  const result = new Map<string, "main" | "side" | "rear">();
  if (areas.length === 0) return result;

  const maxFt = Math.max(...areas.map((a) => a.ft), 1);
  const maxSales = Math.max(...areas.map((a) => a.sales), 1);

  const scored = areas.map((a) => {
    // 축 거리 점수: 가까울수록 1, bufferM 거리에서 0
    const axisScore = Math.max(0, 1 - a.axisDist / bufferM);
    const ftScore = a.ft / maxFt;
    const salesScore = a.sales / maxSales;
    return {
      trdar_cd: a.trdar_cd,
      score: axisScore * 0.4 + ftScore * 0.3 + salesScore * 0.3,
    };
  });
  scored.sort((a, b) => b.score - a.score);

  const n = scored.length;
  const mainCut = Math.max(1, Math.ceil(n * 0.3));
  const sideCut = Math.max(mainCut + 1, Math.ceil(n * 0.7));

  for (let i = 0; i < n; i++) {
    result.set(scored[i].trdar_cd, i < mainCut ? "main" : i < sideCut ? "side" : "rear");
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

  // 도로축 기반 필터: bufferM 이내만 포함
  const nearby = areaRows
    .map((r) => ({
      ...r,
      axisDist: distToAxisM(r.lat, r.lng, d.axis),
    }))
    .filter((r) => r.axisDist <= d.bufferM);

  if (nearby.length === 0) return [];
  const codes = nearby.map((r) => r.trdar_cd);

  // 유동인구 + 매출 병렬 조회 (최신 분기)
  const [ftRes, salesRes] = await Promise.all([
    supabase.from("foot_traffic").select("trdar_cd, quarter_cd, total_ft").in("trdar_cd", codes),
    supabase.from("sales").select("trdar_cd, quarter_cd, monthly_sales").in("trdar_cd", codes),
  ]);

  const latestQ = (rows: Array<Record<string, unknown>>) => {
    const qs = Array.from(new Set((rows ?? []).map((r) => String(r.quarter_cd ?? "")))).sort();
    return qs[qs.length - 1] ?? "";
  };

  const ftLatest = latestQ(ftRes.data ?? []);
  const salesLatest = latestQ(salesRes.data ?? []);

  const ftByArea = new Map<string, number>();
  for (const r of ftRes.data ?? []) {
    if (String(r.quarter_cd) === ftLatest) {
      ftByArea.set(r.trdar_cd, (ftByArea.get(r.trdar_cd) ?? 0) + (r.total_ft ?? 0));
    }
  }

  const salesByArea = new Map<string, number>();
  for (const r of salesRes.data ?? []) {
    if (String(r.quarter_cd) === salesLatest) {
      salesByArea.set(r.trdar_cd, (salesByArea.get(r.trdar_cd) ?? 0) + (r.monthly_sales ?? 0));
    }
  }

  const scored = codes.map((cd) => ({
    trdar_cd: cd,
    axisDist: nearby.find((r) => r.trdar_cd === cd)!.axisDist,
    ft: ftByArea.get(cd) ?? 0,
    sales: salesByArea.get(cd) ?? 0,
  }));

  const zoneMap = classifyByCompositeScore(scored, d.bufferM);

  return nearby
    .map((r) => ({
      trdar_cd: r.trdar_cd,
      trdar_nm: r.trdar_nm,
      lat: r.lat,
      lng: r.lng,
      zone: zoneMap.get(r.trdar_cd) ?? "rear",
      distFromCenter: Math.round(r.axisDist),
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
