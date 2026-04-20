import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";
import { DISTRICTS, distToAxisM } from "@/lib/district-zones";

export const revalidate = 3600;

const RENT_FALLBACK: Record<string, number> = {
  "강남구": 42.9, "서초구": 33.6, "마포구": 26.7, "용산구": 30.4, "종로구": 28.6,
  "중구": 35.4, "성동구": 24.1, "송파구": 27.7, "영등포구": 25.9, "광진구": 22.9,
};

export async function GET(req: Request) {
  const limited = rateLimit(req, "districts-compare", 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const district = DISTRICTS.find((d) => d.id === id);
  if (!district) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [cLat, cLng] = district.center;
  const deg = (district.radiusM / 111000) * 1.3;
  let q = supabase
    .from("areas")
    .select("trdar_cd, lat, lng, gu")
    .gte("lat", cLat - deg).lte("lat", cLat + deg)
    .gte("lng", cLng - deg).lte("lng", cLng + deg);
  if (district.gu.length > 0) q = q.in("gu", district.gu);
  const { data: areaRows } = await q.limit(200);

  const nearby = (areaRows ?? [])
    .map((r) => ({ ...r, axisDist: distToAxisM(r.lat, r.lng, district.axis) }))
    .filter((r) => r.axisDist <= district.bufferM);

  type ZoneKey = "main" | "side" | "rear";
  const mainSet = new Set(district.mainCodes ?? []);
  const sideSet = new Set(district.sideCodes ?? []);
  const hasManual = mainSet.size > 0 || sideSet.size > 0;
  const zoneMap = new Map<string, ZoneKey>();

  if (hasManual) {
    for (const r of nearby) {
      zoneMap.set(r.trdar_cd, mainSet.has(r.trdar_cd) ? "main" : sideSet.has(r.trdar_cd) ? "side" : "rear");
    }
  } else {
    const sorted = [...nearby].sort((a, b) => a.axisDist - b.axisDist);
    const n = sorted.length;
    const mainCut = Math.max(1, Math.ceil(n * 0.25));
    const sideCut = Math.max(mainCut + 1, Math.ceil(n * 0.65));
    sorted.forEach((r, i) => {
      zoneMap.set(r.trdar_cd, i < mainCut ? "main" : i < sideCut ? "side" : "rear");
    });
  }

  const codes = nearby.map((r) => r.trdar_cd);
  if (codes.length === 0) return NextResponse.json({ zones: [], _debug: { nearbyCount: 0, areaRowCount: areaRows?.length ?? 0 } });
  const guName = district.gu[0] ?? "";


  // 최신 분기 먼저 조회
  const { data: latestQRow } = await supabase.from("stores").select("quarter_cd").order("quarter_cd", { ascending: false }).limit(1);
  const latestQ = latestQRow?.[0]?.quarter_cd ?? "";

  const [storesRes, ftRes, rentRes, saleRes] = await Promise.all([
    supabaseServer.from("stores").select("trdar_cd, store_count, open_count, close_count").in("trdar_cd", codes).eq("quarter_cd", latestQ).limit(5000),
    supabaseServer.from("foot_traffic").select("trdar_cd, quarter_cd, total_ft").in("trdar_cd", codes).limit(5000),
    supabaseServer.from("gu_rent_stats").select("f1_pyeong, f2_pyeong, b1_pyeong").eq("gu", guName).maybeSingle(),
    supabaseServer.from("gu_sale_stats").select("m2_price, avg_price").eq("gu", guName).maybeSingle(),
  ]);

  const storeRows = storesRes.data ?? [];
  const ftRows = ftRes.data ?? [];

  const zoneAgg: Record<ZoneKey, { stores: number; open: number; close: number; ft: number }> = {
    main: { stores: 0, open: 0, close: 0, ft: 0 },
    side: { stores: 0, open: 0, close: 0, ft: 0 },
    rear: { stores: 0, open: 0, close: 0, ft: 0 },
  };

  for (const r of storeRows) {
    const z = zoneMap.get(r.trdar_cd);
    if (!z) continue;
    zoneAgg[z].stores += r.store_count ?? 0;
    zoneAgg[z].open += r.open_count ?? 0;
    zoneAgg[z].close += r.close_count ?? 0;
  }

  const ftQ = Array.from(new Set(ftRows.map((r) => r.quarter_cd))).sort();
  const latestFtQ = ftQ[ftQ.length - 1];
  for (const r of ftRows) {
    if (r.quarter_cd !== latestFtQ) continue;
    const z = zoneMap.get(r.trdar_cd);
    if (!z) continue;
    zoneAgg[z].ft += Math.round((r.total_ft ?? 0) / 90);
  }

  // 실제 임대료: rents 테이블에서 해당 상권 근처 데이터
  const rentDeg = 0.005; // ~500m
  const { data: rentRows } = await supabaseServer
    .from("rents")
    .select("rent_pyeong, floor")
    .gte("lat", cLat - rentDeg).lte("lat", cLat + rentDeg)
    .gte("lng", cLng - rentDeg).lte("lng", cLng + rentDeg)
    .eq("target_pyeong", 10)
    .gt("rent_pyeong", 0)
    .limit(200);

  const rentValues = (rentRows ?? []).filter((r) => r.floor === "1" || r.floor === "1층").map((r) => r.rent_pyeong);
  let avgRent = rentValues.length > 0
    ? Math.round(rentValues.reduce((s, v) => s + v, 0) / rentValues.length * 10) / 10
    : RENT_FALLBACK[guName] ?? 20;

  // 상업용 매매 실거래가 (국토교통부 API)
  const GU_LAWD: Record<string, string> = {
    "강남구": "11680", "서초구": "11650", "마포구": "11440", "용산구": "11170",
    "종로구": "11110", "중구": "11140", "성동구": "11200", "송파구": "11710",
    "영등포구": "11560", "광진구": "11215", "서대문구": "11410",
  };
  const lawdCd = GU_LAWD[guName] ?? "";
  let avgSalePyeong = 0;
  if (lawdCd) {
    try {
      const now = new Date();
      // 최근 3개월 조회
      const months = [0, 1, 2].map((i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
      const saleKey = process.env.DATA_GO_KR_API_KEY ?? "";
      const allPyeongs: number[] = [];
      for (const ym of months) {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade?serviceKey=${saleKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&numOfRows=100`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 86400 } });
        const xml = await res.text();
        // 간단 XML 파싱
        const items = xml.split("<item>").slice(1);
        for (const item of items) {
          const getTag = (tag: string) => { const m = item.match(new RegExp(`<${tag}>(.*?)</${tag}>`)); return m?.[1]?.trim() ?? ""; };
          const use = getTag("buildingUse");
          if (!use.includes("근린생활") && !use.includes("판매")) continue;
          const amt = parseInt(getTag("dealAmount").replace(/,/g, "")) || 0;
          const area = parseFloat(getTag("buildingAr")) || 0;
          if (amt > 0 && area > 5) {
            allPyeongs.push(Math.round(amt / area * 3.3));
          }
        }
      }
      if (allPyeongs.length > 0) {
        allPyeongs.sort((a, b) => a - b);
        // 중앙값 사용 (이상치 제거)
        avgSalePyeong = allPyeongs[Math.floor(allPyeongs.length / 2)];
      }
    } catch {}
  }

  const ZONE_LABELS = { main: "메인 상권", side: "이면 상권", rear: "배후 상권" };
  const RENT_FACTOR = { main: 1.0, side: 0.7, rear: 0.45 };
  const SALE_FACTOR = { main: 1.15, side: 0.75, rear: 0.5 };

  const zones = (["main", "side", "rear"] as const).map((z) => ({
    zone: z,
    label: ZONE_LABELS[z],
    areaCount: codes.filter((cd) => zoneMap.get(cd) === z).length,
    totalStores: zoneAgg[z].stores,
    avgRentPyeong: Math.round(avgRent * RENT_FACTOR[z] * 10) / 10,
    avgSalePyeong: Math.round(avgSalePyeong * SALE_FACTOR[z]),
    dailyFootTraffic: zoneAgg[z].ft,
    openCount: zoneAgg[z].open,
    closeCount: zoneAgg[z].close,
  }));

  return NextResponse.json({
    district: { id: district.id, name: district.name, color: district.color },
    quarter: latestQ ? `${latestQ.slice(0, 4)} Q${latestQ.slice(4)}` : null,
    zones,
    _debug: { codes: codes.length, latestQ, storeRows: storeRows.length },
  });
}
