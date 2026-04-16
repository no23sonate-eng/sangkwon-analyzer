import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, distToAxisM } from "@/lib/district-zones";
import { readFile } from "fs/promises";
import { join } from "path";

export const revalidate = 86400; // 24h — 폴리곤은 거의 안 바뀜

// GeoJSON 캐시
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

export async function GET(req: Request) {
  const limited = rateLimit(req, "districts-polygons", 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });

  const geojson = await loadGeoJSON();

  // 해당 상권의 trdar_cd들 필터 (zones API와 동일 기준 — 축 거리 bufferM 이내)
  const features = geojson.features.filter((f) => {
    const props = f.properties as Record<string, string>;
    if (!district.gu.includes(props.gu)) return false;
    const geom = f.geometry as GeoJSON.Polygon;
    if (!geom.coordinates?.[0]) return false;
    const [cLat, cLng] = centroid(geom.coordinates[0]);
    const axisDist = distToAxisM(cLat, cLng, district.axis);
    return axisDist <= district.bufferM;
  });

  // zone 분류 (축 거리 기반 — 빨강/노랑/초록)
  const ZONE_COLORS = {
    main: "#EF4444",
    side: "#F59E0B",
    rear: "#22C55E",
  };
  const ZONE_OPACITY = { main: 0.45, side: 0.28, rear: 0.15 };

  // 축 거리 계산해서 정렬
  const withDist = features.map((f) => {
    const geom = f.geometry as GeoJSON.Polygon;
    const [cLat, cLng] = centroid(geom.coordinates[0]);
    return { feature: f, axisDist: distToAxisM(cLat, cLng, district.axis) };
  });
  withDist.sort((a, b) => a.axisDist - b.axisDist);

  const n = withDist.length;
  const mainCut = Math.max(1, Math.ceil(n * 0.3));
  const sideCut = Math.max(mainCut + 1, Math.ceil(n * 0.7));

  const coloredFeatures = withDist.map((item, i) => {
    const zone = i < mainCut ? "main" : i < sideCut ? "side" : "rear";
    return {
      ...item.feature,
      properties: {
        ...item.feature.properties,
        zone,
        fillColor: ZONE_COLORS[zone],
        fillOpacity: ZONE_OPACITY[zone],
        strokeColor: ZONE_COLORS[zone],
        strokeWidth: zone === "main" ? 2.5 : zone === "side" ? 1.5 : 1,
        strokeOpacity: zone === "main" ? 0.85 : zone === "side" ? 0.55 : 0.3,
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
