/* 좌표 기반 점포 분포 API.
 *
 * 1차: stores_geo (정식 import 데이터) — 좌표·도로명·표준업종·층 다 잡힘
 * 2차: 카카오 places API (실시간 폴백) — 음식점/카페/병원 등 카테고리 그룹별
 *
 * 한남동 같은 지역에선 trdar 가중평균이 패션 라인을 묻어버리는 한계 해소용.
 * 도로명별 점포 분포로 "건물 라인" 단위 분석 가능.
 */
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

// 카카오 카테고리 그룹 → 우리 대분류 매핑
const KAKAO_CAT_MAP: Record<string, string> = {
  FD6: "외식",
  CE7: "카페/주류",
  CS2: "소매/유통",
  HP8: "뷰티/건강",
  PM9: "뷰티/건강",
  AC5: "교육",
  AD5: "여가/오락",
};

interface StoreNear {
  source: "kakao" | "sbiz";
  name: string;
  category: string;        // 카테고리명 (소분류)
  parent: string;          // 우리 대분류 매핑값
  road_name: string;       // "한남대로27가길"
  road_address: string;    // 전체 도로명주소
  lat: number;
  lng: number;
  distance_m: number;
}

function extractRoadName(roadAddress: string): string {
  // "서울 용산구 한남대로27가길 8-3" → "한남대로27가길"
  const m = roadAddress.match(/[가-힣]+(?:대로|로|길)(?:\d+\S*)?/);
  return m?.[0] ?? "";
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function fetchKakaoCategory(code: string, lat: number, lng: number, radius: number, maxPages = 3): Promise<StoreNear[]> {
  if (!KAKAO_KEY) return [];
  const out: StoreNear[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
    url.searchParams.set("category_group_code", code);
    url.searchParams.set("x", String(lng));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("radius", String(Math.min(20000, radius)));
    url.searchParams.set("size", "15");
    url.searchParams.set("page", String(page));
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) break;
    const data = await res.json();
    const docs = (data.documents ?? []) as Array<{
      place_name: string; category_name: string; road_address_name: string;
      x: string; y: string; distance: string;
    }>;
    for (const d of docs) {
      const cats = (d.category_name ?? "").split(">").map((s) => s.trim()).filter(Boolean);
      const subCat = cats[cats.length - 1] || "";
      const road = extractRoadName(d.road_address_name ?? "");
      out.push({
        source: "kakao",
        name: d.place_name,
        category: subCat,
        parent: KAKAO_CAT_MAP[code] ?? "기타",
        road_name: road,
        road_address: d.road_address_name ?? "",
        lat: parseFloat(d.y),
        lng: parseFloat(d.x),
        distance_m: parseInt(d.distance ?? "0", 10),
      });
    }
    if (data.meta?.is_end) break;
  }
  return out;
}

interface SbizRow {
  store_name: string | null;
  category_m: string | null;
  category_s: string | null;
  road_name: string | null;
  road_address: string | null;
  lat: number;
  lng: number;
}

async function fetchSbizNear(lat: number, lng: number, radius: number): Promise<StoreNear[]> {
  const supabase = supabaseServer;
  // 좌표 기반 직사각형 prefilter (반경 1.5x), 정확한 거리는 후처리
  const dLat = (radius * 1.5) / 111000;
  const dLng = (radius * 1.5) / (111000 * Math.cos((lat * Math.PI) / 180));
  const { data, error } = await supabase
    .from("stores_geo")
    .select("store_name, category_m, category_s, road_name, road_address, lat, lng")
    .gte("lat", lat - dLat)
    .lte("lat", lat + dLat)
    .gte("lng", lng - dLng)
    .lte("lng", lng + dLng)
    .limit(2000);
  if (error || !data) return [];
  const out: StoreNear[] = [];
  for (const r of data as SbizRow[]) {
    const dist = haversineM(lat, lng, r.lat, r.lng);
    if (dist > radius) continue;
    out.push({
      source: "sbiz",
      name: r.store_name ?? "",
      category: r.category_s ?? r.category_m ?? "",
      parent: r.category_m ?? "기타",
      road_name: r.road_name ?? "",
      road_address: r.road_address ?? "",
      lat: r.lat,
      lng: r.lng,
      distance_m: dist,
    });
  }
  return out;
}

function summarize(stores: StoreNear[]) {
  const byRoad: Record<string, { total: number; byParent: Record<string, number> }> = {};
  const byParent: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const s of stores) {
    if (s.road_name) {
      if (!byRoad[s.road_name]) byRoad[s.road_name] = { total: 0, byParent: {} };
      byRoad[s.road_name].total++;
      byRoad[s.road_name].byParent[s.parent] = (byRoad[s.road_name].byParent[s.parent] ?? 0) + 1;
    }
    byParent[s.parent] = (byParent[s.parent] ?? 0) + 1;
    byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
  }

  const roads = Object.entries(byRoad)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);

  return { roads, byParent, byCategory };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radius = Math.min(2000, parseInt(searchParams.get("radius") ?? "200", 10));

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat, lng required" }, { status: 400 });
  }

  // 1차: stores_geo (정식 데이터)
  let stores: StoreNear[] = [];
  try {
    stores = await fetchSbizNear(lat, lng, radius);
  } catch {
    stores = [];
  }
  let dataSource: "sbiz" | "kakao" = "sbiz";

  // 2차: stores_geo 데이터 부족 → 카카오 places API
  if (stores.length < 5) {
    const codes = ["FD6", "CE7", "CS2", "HP8", "AC5", "AD5"];
    const batches = await Promise.all(codes.map((c) => fetchKakaoCategory(c, lat, lng, radius)));
    stores = batches.flat();
    dataSource = "kakao";
  }

  const summary = summarize(stores);

  return NextResponse.json({
    source: dataSource,
    lat, lng, radius,
    total: stores.length,
    summary,
    stores: stores.slice(0, 100), // detail은 100건만
  });
}
