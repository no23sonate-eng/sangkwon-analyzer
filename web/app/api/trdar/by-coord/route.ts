import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radius = parseInt(searchParams.get("radius") ?? "500");

  if (!lat || !lng) return NextResponse.json([]);

  const deg = radius / 111000 * 1.5;
  const { data } = await supabase
    .from("areas")
    .select("trdar_cd, trdar_nm, gu, dong, lat, lng")
    .gte("lat", lat - deg).lte("lat", lat + deg)
    .gte("lng", lng - deg).lte("lng", lng + deg);

  if (!data) return NextResponse.json([]);

  const results = data
    .map((r) => ({ ...r, distance: Math.round(haversineM(lat, lng, r.lat, r.lng)) }))
    .filter((r) => r.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  return NextResponse.json(results);
}
