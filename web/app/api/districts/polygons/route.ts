import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, distToAxisM } from "@/lib/district-zones";
import { readFile } from "fs/promises";
import { join } from "path";

export const revalidate = 86400;

let cachedGeoJSON: GeoJSON.FeatureCollection | null = null;

async function loadGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  if (cachedGeoJSON) return cachedGeoJSON;
  const filePath = join(process.cwd(), "public", "data", "trdar_polygons.geojson");
  const raw = await readFile(filePath, "utf-8");
  cachedGeoJSON = JSON.parse(raw);
  return cachedGeoJSON!;
}

function centroid(coords: number[][]): [number, number] {
  let lat = 0, lng = 0;
  for (const c of coords) { lng += c[0]; lat += c[1]; }
  return [lat / coords.length, lng / coords.length];
}

// 서울 전체 기준 최대값 (절대 기준용) — 최상위 상권 수준
const ABSOLUTE_MAX_FT = 500000;  // 강남역급 분기 유동인구
const ABSOLUTE_MAX_SALES = 5_000_000_000; // 50억 분기 매출

const ZONE_COLORS = { main: "#EF4444", side: "#F59E0B", rear: "#22C55E" };

export async function GET(req: Request) {
  const limited = rateLimit(req, "districts-polygons", 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });

  const geojson = await loadGeoJSON();

  // 해당 상권 폴리곤 필터 (축 거리 bufferM 이내)
  const features = geojson.features
    .filter((f) => {
      const props = f.properties as Record<string, string>;
      if (!district.gu.includes(props.gu)) return false;
      const geom = f.geometry as GeoJSON.Polygon;
      if (!geom.coordinates?.[0]) return false;
      const [cLat, cLng] = centroid(geom.coordinates[0]);
      return distToAxisM(cLat, cLng, district.axis) <= district.bufferM;
    })
    .map((f) => {
      const geom = f.geometry as GeoJSON.Polygon;
      const [cLat, cLng] = centroid(geom.coordinates[0]);
      return { feature: f, trdar_cd: (f.properties as Record<string, string>).TRDAR_CD, axisDist: distToAxisM(cLat, cLng, district.axis) };
    });

  if (features.length === 0) return NextResponse.json({ type: "FeatureCollection", features: [], _meta: { district: district.name, total: 0 } });

  const codes = features.map((f) => f.trdar_cd);

  // 유동인구 + 매출 조회 (절대값 기반 opacity 계산용)
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
    if (String(r.quarter_cd) === ftLatest)
      ftByArea.set(r.trdar_cd, (ftByArea.get(r.trdar_cd) ?? 0) + (r.total_ft ?? 0));
  }
  const salesByArea = new Map<string, number>();
  for (const r of salesRes.data ?? []) {
    if (String(r.quarter_cd) === salesLatest)
      salesByArea.set(r.trdar_cd, (salesByArea.get(r.trdar_cd) ?? 0) + (r.monthly_sales ?? 0));
  }

  // zone 분류 + 절대 활성도 기반 opacity
  features.sort((a, b) => a.axisDist - b.axisDist);
  const n = features.length;
  const mainCut = Math.max(1, Math.ceil(n * 0.3));
  const sideCut = Math.max(mainCut + 1, Math.ceil(n * 0.7));

  const coloredFeatures = features.map((item, i) => {
    const zone: "main" | "side" | "rear" = i < mainCut ? "main" : i < sideCut ? "side" : "rear";
    const ft = ftByArea.get(item.trdar_cd) ?? 0;
    const sales = salesByArea.get(item.trdar_cd) ?? 0;

    // 절대 활성도: 0~1 (서울 전체 최상위 대비)
    const activity = Math.min(1, (ft / ABSOLUTE_MAX_FT) * 0.5 + (sales / ABSOLUTE_MAX_SALES) * 0.5);

    // 색상은 zone별 고정, 농도(opacity)가 절대 활성도에 비례
    const baseOpacity = zone === "main" ? 0.5 : zone === "side" ? 0.3 : 0.15;
    // 활성도 0이면 base × 0.3, 활성도 1이면 base × 1.0
    const fillOpacity = Math.round(baseOpacity * (0.3 + activity * 0.7) * 100) / 100;
    const strokeOpacity = Math.round((zone === "main" ? 0.85 : zone === "side" ? 0.55 : 0.3) * (0.4 + activity * 0.6) * 100) / 100;

    return {
      ...item.feature,
      properties: {
        ...item.feature.properties,
        zone,
        fillColor: ZONE_COLORS[zone],
        fillOpacity,
        strokeColor: ZONE_COLORS[zone],
        strokeWidth: zone === "main" ? 2.5 : zone === "side" ? 1.5 : 1,
        strokeOpacity,
        activity: Math.round(activity * 100),
      },
    };
  });

  return NextResponse.json({
    type: "FeatureCollection",
    features: coloredFeatures,
    _meta: {
      district: district.name,
      total: coloredFeatures.length,
      main: coloredFeatures.filter((f) => f.properties.zone === "main").length,
      side: coloredFeatures.filter((f) => f.properties.zone === "side").length,
      rear: coloredFeatures.filter((f) => f.properties.zone === "rear").length,
    },
  });
}
