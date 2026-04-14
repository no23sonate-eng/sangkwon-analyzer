import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 구 단위 평균 임대료 (만원/평) - 한국부동산원 2025 Q3 기준
const GU_RENT_FALLBACK: Record<string, { f1: number; b1: number; f2: number }> = {
  "강남구": { f1: 53.3, b1: 30.9, f2: 32.0 },
  "서초구": { f1: 42.5, b1: 24.7, f2: 25.5 },
  "마포구": { f1: 33.8, b1: 19.6, f2: 20.3 },
  "용산구": { f1: 38.5, b1: 22.3, f2: 23.1 },
  "종로구": { f1: 36.2, b1: 21.0, f2: 21.7 },
  "중구": { f1: 44.8, b1: 26.0, f2: 26.9 },
  "성동구": { f1: 30.5, b1: 17.7, f2: 18.3 },
  "송파구": { f1: 35.1, b1: 20.4, f2: 21.1 },
  "영등포구": { f1: 32.7, b1: 19.0, f2: 19.6 },
  "광진구": { f1: 28.9, b1: 16.8, f2: 17.3 },
  "동작구": { f1: 25.3, b1: 14.7, f2: 15.2 },
  "관악구": { f1: 22.1, b1: 12.8, f2: 13.3 },
  "강동구": { f1: 27.5, b1: 16.0, f2: 16.5 },
  "노원구": { f1: 20.8, b1: 12.1, f2: 12.5 },
  "은평구": { f1: 21.5, b1: 12.5, f2: 12.9 },
  "강서구": { f1: 24.3, b1: 14.1, f2: 14.6 },
  "강북구": { f1: 19.2, b1: 11.1, f2: 11.5 },
  "구로구": { f1: 23.8, b1: 13.8, f2: 14.3 },
  "금천구": { f1: 22.5, b1: 13.1, f2: 13.5 },
  "도봉구": { f1: 19.8, b1: 11.5, f2: 11.9 },
  "동대문구": { f1: 27.3, b1: 15.8, f2: 16.4 },
  "서대문구": { f1: 25.8, b1: 15.0, f2: 15.5 },
  "성북구": { f1: 22.9, b1: 13.3, f2: 13.7 },
  "양천구": { f1: 25.1, b1: 14.6, f2: 15.1 },
  "중랑구": { f1: 21.2, b1: 12.3, f2: 12.7 },
};

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

interface RentRow {
  lat: number;
  lng: number;
  floor: string;
  rent_pyeong: number;
  rent: number;
  deposit: number;
  distance?: number;
}

function classifyFloor(floor: string): string {
  if (floor === "지하" || floor === "B1" || floor === "반지하") return "지하";
  if (floor === "1" || floor === "1층") return "1층";
  return "2층";
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calcStats(cases: RentRow[], maxDistance: number, targetPyeong: number) {
  if (cases.length === 0) {
    return {
      count: 0,
      avg_rent: 0,
      avg_deposit: 0,
      avg_pyeong: 0,
      min_rent: 0,
      max_rent: 0,
      median_rent: 0,
      target_pyeong: targetPyeong,
    };
  }

  const weights = cases.map((c) =>
    Math.max(0.3, 1 - (c.distance ?? 0) / (maxDistance * 1.5))
  );
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  const avgRent =
    cases.reduce((s, c, i) => s + c.rent * weights[i], 0) / totalWeight;
  const avgDeposit =
    cases.reduce((s, c, i) => s + c.deposit * weights[i], 0) / totalWeight;
  const avgPyeong =
    cases.reduce((s, c, i) => s + c.rent_pyeong * weights[i], 0) / totalWeight;

  const rents = cases.map((c) => c.rent);

  return {
    count: cases.length,
    avg_rent: Math.round(avgRent),
    avg_deposit: Math.round(avgDeposit),
    avg_pyeong: Math.round(avgPyeong * 10) / 10,
    min_rent: Math.min(...rents),
    max_rent: Math.max(...rents),
    median_rent: median(rents),
    target_pyeong: targetPyeong,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radius = parseInt(searchParams.get("radius") ?? "500", 10);
  const target_pyeong = parseInt(searchParams.get("target_pyeong") ?? "10", 10);
  const gu = searchParams.get("gu") ?? "";

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  // Query with bounding box for max 3km radius
  const deg = (3000 / 111000) * 1.2;
  // target_pyeong 300은 DB에 없으므로 200으로 대체
  const queryPyeong = target_pyeong > 200 ? 200 : target_pyeong;
  const { data, error } = await supabase
    .from("rents")
    .select("lat, lng, floor, rent_pyeong, rent, deposit")
    .eq("target_pyeong", queryPyeong)
    .gte("lat", lat - deg)
    .lte("lat", lat + deg)
    .gte("lng", lng - deg)
    .lte("lng", lng + deg)
    .limit(50000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate distance and filter by 3km max
  const MAX_RADIUS = 3000;
  const withDistance: RentRow[] = (data ?? [])
    .map((row) => ({
      ...row,
      distance: haversineM(lat, lng, row.lat, row.lng),
    }))
    .filter((row) => row.distance! <= MAX_RADIUS)
    .sort((a, b) => a.distance! - b.distance!);

  // Expand radius until >= 3 cases found
  const radiusSteps = [300, 500, 800, 1000, 1500, 2000, 3000];
  // Start from the requested radius
  const startIdx = radiusSteps.findIndex((r) => r >= radius);
  const stepsToTry = radiusSteps.slice(startIdx >= 0 ? startIdx : 0);
  // Ensure the requested radius itself is tried first
  if (stepsToTry[0] !== radius) {
    stepsToTry.unshift(radius);
  }

  let actualRadius = radius;
  let filtered: RentRow[] = [];

  for (const r of stepsToTry) {
    filtered = withDistance.filter((row) => row.distance! <= r);
    actualRadius = r;
    if (filtered.length >= 3) break;
  }

  // Split by floor
  const floorGroups: Record<string, RentRow[]> = {
    "1층": [],
    "2층": [],
    "지하": [],
  };
  for (const row of filtered) {
    const key = classifyFloor(row.floor);
    floorGroups[key].push(row);
  }

  const maxDistance = actualRadius;
  const stats: Record<string, ReturnType<typeof calcStats>> = {};
  for (const [key, cases] of Object.entries(floorGroups)) {
    stats[key] = calcStats(cases, maxDistance, target_pyeong);
  }

  // DB에 사례가 없으면 gu_rent_stats → 하드코딩 순서로 fallback
  if (filtered.length === 0 && gu) {
    const makeGuStats = (avgPyeong: number) => ({
      count: 1,
      avg_rent: Math.round(avgPyeong * target_pyeong),
      avg_deposit: Math.round(avgPyeong * target_pyeong * 10),
      avg_pyeong: avgPyeong,
      min_rent: Math.round(avgPyeong * target_pyeong * 0.8),
      max_rent: Math.round(avgPyeong * target_pyeong * 1.2),
      median_rent: Math.round(avgPyeong * target_pyeong),
      target_pyeong,
    });

    // 1차: DB에서 구 통계 조회
    const { data: guStats } = await supabase
      .from("gu_rent_stats")
      .select("f1_pyeong, f2_pyeong, b1_pyeong, source")
      .eq("gu", gu)
      .single();

    if (guStats && guStats.f1_pyeong > 0) {
      return NextResponse.json({
        total_cases: 1,
        radius: actualRadius,
        fallback: true,
        fallback_source: `${gu} 평균 (${guStats.source})`,
        stats: {
          "1층": makeGuStats(guStats.f1_pyeong),
          "2층": makeGuStats(guStats.f2_pyeong),
          "지하": makeGuStats(guStats.b1_pyeong),
        },
        sample_cases: [],
      });
    }

    // 2차: 하드코딩 폴백
    const fallback = GU_RENT_FALLBACK[gu];
    if (fallback) {
      return NextResponse.json({
        total_cases: 1,
        radius: actualRadius,
        fallback: true,
        fallback_source: `${gu} 평균 (한국부동산원 2025 Q3)`,
        stats: {
          "1층": makeGuStats(fallback.f1),
          "2층": makeGuStats(fallback.f2),
          "지하": makeGuStats(fallback.b1),
        },
        sample_cases: [],
      });
    }
  }

  return NextResponse.json({
    total_cases: filtered.length,
    radius: actualRadius,
    stats,
    sample_cases: filtered.slice(0, 20),
  });
}
