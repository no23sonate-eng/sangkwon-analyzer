import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

  return NextResponse.json({
    total_cases: filtered.length,
    radius: actualRadius,
    stats,
    sample_cases: filtered.slice(0, 20),
  });
}
