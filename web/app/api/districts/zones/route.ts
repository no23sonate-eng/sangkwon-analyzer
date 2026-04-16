import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, classifyZone, type ZonedArea, type DistrictDef } from "@/lib/district-zones";

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

async function getZonesForDistrict(d: DistrictDef): Promise<ZonedArea[]> {
  const [cLat, cLng] = d.center;
  const deg = (d.radiusM / 111000) * 1.3;

  let q = supabase
    .from("areas")
    .select("trdar_cd, trdar_nm, lat, lng, gu")
    .gte("lat", cLat - deg).lte("lat", cLat + deg)
    .gte("lng", cLng - deg).lte("lng", cLng + deg);

  if (d.gu.length > 0) q = q.in("gu", d.gu);

  const { data } = await q.limit(200);
  if (!data) return [];

  return data
    .map((r) => {
      const dist = haversineM(cLat, cLng, r.lat, r.lng);
      return {
        trdar_cd: r.trdar_cd,
        trdar_nm: r.trdar_nm,
        lat: r.lat,
        lng: r.lng,
        zone: classifyZone(dist, d.radiusM),
        distFromCenter: Math.round(dist),
      };
    })
    .filter((r) => r.distFromCenter <= d.radiusM)
    .sort((a, b) => a.distFromCenter - b.distFromCenter);
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
