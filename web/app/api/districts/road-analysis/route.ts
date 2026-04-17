import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS } from "@/lib/district-zones";

export const revalidate = 3600;

const DATA_GO_KR_KEY = process.env.DATA_GO_KR_API_KEY ?? "";

interface StoreItem {
  bizesNm: string;
  rdnm: string;
  rdnmAdr: string;
  lat: string;
  lon: string;
  indsLclsNm: string;
  indsMclsNm: string;
  indsSclsNm: string;
}

async function fetchStores(cx: number, cy: number, radius: number): Promise<StoreItem[]> {
  const all: StoreItem[] = [];
  const pageSize = 1000;
  // 최대 3페이지 (3000개)
  for (let page = 1; page <= 3; page++) {
    const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${DATA_GO_KR_KEY}&cx=${cx}&cy=${cy}&radius=${radius}&type=json&numOfRows=${pageSize}&pageNo=${page}`;
    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      const data = await res.json();
      const items = data?.body?.items ?? [];
      all.push(...items);
      if (items.length < pageSize) break;
    } catch { break; }
  }
  return all;
}

// 도로명에서 시/구 제거
function shortRoadName(rdnm: string): string {
  return rdnm.replace(/서울특별시\s+\S+구\s+/, "").trim();
}

export async function GET(req: Request) {
  const limited = rateLimit(req, "road-analysis", 10, 60_000);
  if (limited) return limited;

  if (!DATA_GO_KR_KEY) {
    return NextResponse.json({ error: "DATA_GO_KR_API_KEY not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 상권 중심에서 반경 조회
  const [cLat, cLng] = district.center;
  const radius = Math.min(district.bufferM, 1000);
  const stores = await fetchStores(cLng, cLat, radius);

  // 도로명별 집계
  const roadMap = new Map<string, { count: number; stores: StoreItem[] }>();
  for (const s of stores) {
    const road = shortRoadName(s.rdnm || "기타");
    const entry = roadMap.get(road) ?? { count: 0, stores: [] };
    entry.count++;
    entry.stores.push(s);
    roadMap.set(road, entry);
  }

  // 메인 도로 키워드 매칭 (district-zones에서 정의 가능, 일단 자동 감지)
  // 메인 도로: district.mainRoad가 있으면 사용, 없으면 점포수 상위 도로
  const roads = Array.from(roadMap.entries())
    .map(([name, data]) => {
      // 업종별 집계
      const categories = new Map<string, number>();
      for (const s of data.stores) {
        const cat = s.indsLclsNm || "기타";
        categories.set(cat, (categories.get(cat) ?? 0) + 1);
      }
      return {
        name,
        storeCount: data.count,
        categories: Array.from(categories.entries())
          .map(([cat, cnt]) => ({ name: cat, count: cnt }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        sampleStores: data.stores.slice(0, 5).map((s) => ({
          name: s.bizesNm,
          category: s.indsSclsNm || s.indsMclsNm,
          address: s.rdnmAdr,
          lat: parseFloat(s.lat),
          lng: parseFloat(s.lon),
        })),
      };
    })
    .sort((a, b) => b.storeCount - a.storeCount);

  // zone 분류: mainRoads 지정 시 해당 도로명 포함 = 메인, 나머지는 점포수 기준 자동
  const mainRoadKeywords = district.mainRoads ?? [];
  const totalStores = stores.length;

  // 정확히 메인 도로명만 (강남대로84길 같은 골목은 제외)
  const isMainRoad = (name: string) => mainRoadKeywords.some((kw) => name === kw);

  let cumNonMain = 0;
  const nonMainTotal = roads.filter((r) => !isMainRoad(r.name)).reduce((s, r) => s + r.storeCount, 0);

  const roadsWithZone = roads.map((road) => {
    if (isMainRoad(road.name)) {
      return { ...road, zone: "main" as const };
    }
    cumNonMain += road.storeCount;
    const ratio = nonMainTotal > 0 ? cumNonMain / nonMainTotal : 1;
    return { ...road, zone: ratio <= 0.5 ? "side" as const : "rear" as const };
  });

  return NextResponse.json({
    district: district.name,
    center: district.center,
    radius,
    totalStores: stores.length,
    roads: roadsWithZone.slice(0, 20),
    summary: {
      mainRoads: roadsWithZone.filter((r) => r.zone === "main").map((r) => r.name),
      mainStores: roadsWithZone.filter((r) => r.zone === "main").reduce((s, r) => s + r.storeCount, 0),
      sideStores: roadsWithZone.filter((r) => r.zone === "side").reduce((s, r) => s + r.storeCount, 0),
      rearStores: roadsWithZone.filter((r) => r.zone === "rear").reduce((s, r) => s + r.storeCount, 0),
    },
  });
}
