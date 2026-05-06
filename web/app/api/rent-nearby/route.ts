import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { resolveDong } from "@/lib/dong-lookup";
import { getDongLandPrice } from "@/lib/dong-sale-data";
import { getOwnerNetworkRent, getOwnerNetworkRentByFloor } from "@/lib/owner-network-rents";
import { makeProvenance } from "@/lib/data-quality";

const LOC_PREMIUM_1F = 1.7;
const FLOOR_RATIO = { "1층": 1.0, "2층": 0.55, "지하": 0.45 } as const;
const DEFAULT_CAP_RATE = 4.5;

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
  const limited = rateLimit(request, "rent-nearby", 60, 60_000);
  if (limited) return limited;

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
  const rawWithDistance: RentRow[] = (data ?? [])
    .map((row) => ({
      ...row,
      distance: haversineM(lat, lng, row.lat, row.lng),
    }))
    .filter((row) => row.distance! <= MAX_RADIUS);

  // 좌표·층 단위 dedupe — 동일 매물이 target_pyeong 외 다른 컬럼 차이로 다중 저장된 경우 1건으로
  const seen = new Map<string, RentRow>();
  for (const r of rawWithDistance) {
    const key = `${r.lat.toFixed(6)}_${r.lng.toFixed(6)}_${r.floor}`;
    if (!seen.has(key)) seen.set(key, r);
  }
  const withDistance: RentRow[] = Array.from(seen.values()).sort((a, b) => a.distance! - b.distance!);

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

  // ── 네이버 실거래/호가 개별 사례 (dong 우선, 없으면 gu) ──
  let recentDeals: Array<{
    date: string;
    dong: string;
    floor: string;
    area_m2: number;
    deposit: number;
    monthly: number;
    rent_per_pyeong: number;
  }> = [];
  let recentListings: Array<{
    crawl_date: string;
    dong: string;
    floor: string;
    area_m2: number;
    deposit: number;
    monthly: number;
    rent_per_pyeong: number;
  }> = [];

  if (gu) {
    // 이 위치 주변 1km 내 dong 집합
    const dongDeg = (1000 / 111000) * 1.2;
    const { data: nearbyAreas } = await supabase
      .from("areas")
      .select("dong, lat, lng")
      .eq("gu", gu)
      .gte("lat", lat - dongDeg).lte("lat", lat + dongDeg)
      .gte("lng", lng - dongDeg).lte("lng", lng + dongDeg)
      .limit(50);
    const dongsForCases = Array.from(
      new Set((nearbyAreas ?? []).map((a) => a.dong as string).filter((d): d is string => !!d))
    );

    // 네이버 추정실거래 — 최신 20건
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qd: any = supabase
      .from("naver_estimated_deals")
      .select("disappeared_date, dong, floor, area_m2, estimated_deposit, estimated_rent, rent_per_pyeong")
      .eq("gu", gu)
      .gt("estimated_rent", 0);
    if (dongsForCases.length > 0) qd = qd.in("dong", dongsForCases);
    const { data: dealsRaw } = await qd
      .order("disappeared_date", { ascending: false })
      .limit(20);
    recentDeals = ((dealsRaw as Array<{
      disappeared_date: string; dong: string; floor: string; area_m2: number;
      estimated_deposit: number; estimated_rent: number; rent_per_pyeong: number;
    }> | null) ?? []).map((d) => ({
      date: d.disappeared_date ?? "",
      dong: d.dong ?? "",
      floor: d.floor ?? "",
      area_m2: d.area_m2 ?? 0,
      deposit: d.estimated_deposit ?? 0,
      monthly: d.estimated_rent ?? 0,
      rent_per_pyeong: d.rent_per_pyeong ?? 0,
    }));

    // 네이버 호가 — 최신 20건
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ql: any = supabase
      .from("naver_listings")
      .select("crawl_date, dong, floor, area_m2, deposit, monthly_rent")
      .eq("gu", gu)
      .gt("monthly_rent", 0)
      .gt("area_m2", 0);
    if (dongsForCases.length > 0) ql = ql.in("dong", dongsForCases);
    const { data: listingsRaw } = await ql
      .order("crawl_date", { ascending: false })
      .limit(20);
    recentListings = ((listingsRaw as Array<{
      crawl_date: string; dong: string; floor: string; area_m2: number;
      deposit: number; monthly_rent: number;
    }> | null) ?? []).map((l) => ({
      crawl_date: l.crawl_date ?? "",
      dong: l.dong ?? "",
      floor: l.floor ?? "",
      area_m2: l.area_m2 ?? 0,
      deposit: l.deposit ?? 0,
      monthly: l.monthly_rent ?? 0,
      rent_per_pyeong: l.area_m2 > 0 ? Math.round((l.monthly_rent / (l.area_m2 / 3.3)) * 10) / 10 : 0,
    }));
  }

  // DB에 사례가 없으면: owner-network → 네이버(추정실거래→호가) → dong RTMS → 구 평균
  if (filtered.length === 0 && gu) {
    // 클릭 좌표의 행정동 — owner-network·dong RTMS 조회용
    const clickDong = resolveDong(lat, lng);
    const clickDongName = clickDong.dong_name;

    // 0차: 본인 네트워크 ground truth — 가장 높은 신뢰도, 위치별 차이 보존
    // 단, n>=3 일 때만 단독 GT로 인정. n<3 은 보조로만 쓰고 다른 폴백을 우선.
    const ownerF1 = getOwnerNetworkRent(gu, clickDongName);
    if (ownerF1 && ownerF1.rent > 0 && ownerF1.n >= 3) {
      const ownerF2 = getOwnerNetworkRentByFloor(gu, clickDongName, "2층이상");
      const ownerB = getOwnerNetworkRentByFloor(gu, clickDongName, "지하");
      const makeOwnerStats = (rentPP: number) => ({
        count: ownerF1.n,
        avg_rent: Math.round(rentPP * target_pyeong),
        avg_deposit: Math.round(rentPP * target_pyeong * 12),
        avg_pyeong: Math.round(rentPP * 10) / 10,
        min_rent: Math.round(rentPP * target_pyeong * 0.85),
        max_rent: Math.round(rentPP * target_pyeong * 1.15),
        median_rent: Math.round(rentPP * target_pyeong),
        target_pyeong,
      });
      return NextResponse.json({
        total_cases: ownerF1.n,
        radius: actualRadius,
        fallback: true,
        fallback_source: `본인 네트워크 ground truth · ${ownerF1.detail}`,
        confidence: "actual",
        provenance: ownerF1.prov,
        stats: {
          "1층": makeOwnerStats(ownerF1.rent),
          "2층": makeOwnerStats(ownerF2?.rent ?? ownerF1.rent * FLOOR_RATIO["2층"]),
          "지하": makeOwnerStats(ownerB?.rent ?? ownerF1.rent * FLOOR_RATIO["지하"]),
        },
        sample_cases: [],
        recent_deals: recentDeals,
        recent_listings: recentListings,
      });
    }

    // 이 위치에 가까운 상권들의 행정동 목록 — 네이버 필터에 사용해 gu 전체 희석 방지
    const dongDeg = (1000 / 111000) * 1.2; // 1km 반경
    const { data: nearbyAreas } = await supabase
      .from("areas")
      .select("dong, lat, lng")
      .eq("gu", gu)
      .gte("lat", lat - dongDeg).lte("lat", lat + dongDeg)
      .gte("lng", lng - dongDeg).lte("lng", lng + dongDeg)
      .limit(50);
    const nearbyDongs = Array.from(
      new Set(
        (nearbyAreas ?? [])
          .map((a) => a.dong as string)
          .filter((d): d is string => !!d)
      )
    );

    const classifyFloor2 = (f: string | null | undefined): "1층" | "2층" | "지하" | null => {
      if (f == null) return null;
      const s = String(f).trim();
      if (s === "지하" || s === "B1" || s === "반지하") return "지하";
      if (s === "1" || s === "1층") return "1층";
      if (s === "") return null;
      return "2층";
    };

    const makeNaverStats = (avgPyeong: number, count: number) => ({
      count: Math.max(1, count),
      avg_rent: Math.round(avgPyeong * target_pyeong),
      avg_deposit: Math.round(avgPyeong * target_pyeong * 10),
      avg_pyeong: Math.round(avgPyeong * 10) / 10,
      min_rent: Math.round(avgPyeong * target_pyeong * 0.8),
      max_rent: Math.round(avgPyeong * target_pyeong * 1.2),
      median_rent: Math.round(avgPyeong * target_pyeong),
      target_pyeong,
    });

    const MIN_NAVER = 3;

    // 1차: 네이버 추정실거래 (사라진 매물) — dong 우선 → gu 폴백
    for (const scope of ["dong", "gu"] as const) {
      if (scope === "dong" && nearbyDongs.length === 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("naver_estimated_deals")
        .select("rent_per_pyeong, floor, disappeared_date")
        .eq("gu", gu)
        .gt("rent_per_pyeong", 0);
      if (scope === "dong") q = q.in("dong", nearbyDongs);
      const { data } = await q.order("disappeared_date", { ascending: false }).limit(150);
      const deals = (data as { rent_per_pyeong: number; floor: string }[] | null) ?? [];
      const d1 = deals.filter((d) => classifyFloor2(d.floor) === "1층");
      const d2 = deals.filter((d) => classifyFloor2(d.floor) === "2층");
      const dB = deals.filter((d) => classifyFloor2(d.floor) === "지하");
      const avgDeal = (arr: { rent_per_pyeong: number }[]) =>
        arr.length === 0 ? 0 : arr.reduce((s, d) => s + d.rent_per_pyeong, 0) / arr.length;

      if (d1.length >= MIN_NAVER) {
        const scopeLabel = scope === "dong"
          ? `${nearbyDongs.slice(0, 2).join("/")}${nearbyDongs.length > 2 ? " 외" : ""}`
          : gu;
        const latestDate = (data as { disappeared_date?: string }[] | null)?.[0]?.disappeared_date
          || new Date().toISOString();
        return NextResponse.json({
          total_cases: d1.length,
          radius: actualRadius,
          fallback: true,
          fallback_source: `추정 실거래 ${d1.length}건 · ${scopeLabel}`,
          confidence: scope === "dong" ? "dong_estimate" : "gu_fallback",
          provenance: makeProvenance({
            source: "naver_deal",
            sample_size: d1.length,
            collected_at: latestDate,
            category: "rent",
          }),
          stats: {
            "1층": makeNaverStats(avgDeal(d1), d1.length),
            "2층": d2.length > 0 ? makeNaverStats(avgDeal(d2), d2.length) : makeNaverStats(0, 0),
            "지하": dB.length > 0 ? makeNaverStats(avgDeal(dB), dB.length) : makeNaverStats(0, 0),
          },
          sample_cases: [],
          recent_deals: recentDeals,
          recent_listings: recentListings,
        });
      }
    }

    // 2차: 네이버 호가 — dong 우선 → gu 폴백
    for (const scope of ["dong", "gu"] as const) {
      if (scope === "dong" && nearbyDongs.length === 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase
        .from("naver_listings")
        .select("monthly_rent, area_m2, floor, crawl_date")
        .eq("gu", gu)
        .gt("monthly_rent", 0)
        .gt("area_m2", 0);
      if (scope === "dong") q = q.in("dong", nearbyDongs);
      const { data } = await q.order("crawl_date", { ascending: false }).limit(150);
      const listings = (data as { monthly_rent: number; area_m2: number; floor: string }[] | null) ?? [];
      const perPyeong = (l: { monthly_rent: number; area_m2: number }) => l.monthly_rent / (l.area_m2 / 3.3);
      const l1 = listings.filter((l) => classifyFloor2(l.floor) === "1층");
      const l2 = listings.filter((l) => classifyFloor2(l.floor) === "2층");
      const lB = listings.filter((l) => classifyFloor2(l.floor) === "지하");
      const avgList = (arr: { monthly_rent: number; area_m2: number }[]) =>
        arr.length === 0 ? 0 : arr.reduce((s, l) => s + perPyeong(l), 0) / arr.length;

      if (l1.length >= MIN_NAVER) {
        const scopeLabel = scope === "dong"
          ? `${nearbyDongs.slice(0, 2).join("/")}${nearbyDongs.length > 2 ? " 외" : ""}`
          : gu;
        const latestDate = (data as { crawl_date?: string }[] | null)?.[0]?.crawl_date
          || new Date().toISOString();
        return NextResponse.json({
          total_cases: l1.length,
          radius: actualRadius,
          fallback: true,
          fallback_source: `현재 호가 ${l1.length}건 · ${scopeLabel}`,
          confidence: scope === "dong" ? "dong_estimate" : "gu_fallback",
          provenance: makeProvenance({
            source: "naver_listing",
            sample_size: l1.length,
            collected_at: latestDate,
            category: "rent",
          }),
          stats: {
            "1층": makeNaverStats(avgList(l1), l1.length),
            "2층": l2.length > 0 ? makeNaverStats(avgList(l2), l2.length) : makeNaverStats(0, 0),
            "지하": lB.length > 0 ? makeNaverStats(avgList(lB), lB.length) : makeNaverStats(0, 0),
          },
          sample_cases: [],
          recent_deals: recentDeals,
          recent_listings: recentListings,
        });
      }
    }

    // 2.5차: 동 단위 RTMS 매매역산 — 네이버 표본 부족 시 위치별 차이 유지
    const dongLand = getDongLandPrice(gu, clickDongName, clickDong.dong_code);
    if (dongLand && dongLand.source !== "gu_avg") {
      const rent1f = Math.round(((dongLand.pricePerPyeong * (DEFAULT_CAP_RATE / 100)) / 12) * LOC_PREMIUM_1F * 10) / 10;
      const makeRtmsStats = (rentPP: number) => ({
        count: dongLand.sampleN,
        avg_rent: Math.round(rentPP * target_pyeong),
        avg_deposit: Math.round(rentPP * target_pyeong * 12),
        avg_pyeong: Math.round(rentPP * 10) / 10,
        min_rent: Math.round(rentPP * target_pyeong * 0.8),
        max_rent: Math.round(rentPP * target_pyeong * 1.2),
        median_rent: Math.round(rentPP * target_pyeong),
        target_pyeong,
      });
      return NextResponse.json({
        total_cases: dongLand.sampleN,
        radius: actualRadius,
        fallback: true,
        fallback_source: `동 RTMS 매매역산 · ${dongLand.detail} · cap ${DEFAULT_CAP_RATE}% × 1.7`,
        confidence: dongLand.source === "exact" ? "dong_estimate" : "gu_fallback",
        provenance: makeProvenance({
          source: "dong_rtms_inverse",
          sample_size: dongLand.sampleN,
          collected_at: new Date().toISOString(),
          category: "rent",
        }),
        stats: {
          "1층": makeRtmsStats(rent1f),
          "2층": makeRtmsStats(rent1f * FLOOR_RATIO["2층"]),
          "지하": makeRtmsStats(rent1f * FLOOR_RATIO["지하"]),
        },
        sample_cases: [],
        recent_deals: recentDeals,
        recent_listings: recentListings,
      });
    }

    // 3차: 구 평균 (DB)
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
        fallback_source: `${gu} 권역 평균`,
        confidence: "gu_fallback",
        provenance: makeProvenance({
          source: "gu_avg",
          sample_size: 1,
          collected_at: new Date().toISOString(),
          category: "rent",
        }),
        stats: {
          "1층": makeGuStats(guStats.f1_pyeong),
          "2층": makeGuStats(guStats.f2_pyeong),
          "지하": makeGuStats(guStats.b1_pyeong),
        },
        sample_cases: [],
        recent_deals: recentDeals,
        recent_listings: recentListings,
      });
    }

    // 4차: 하드코딩 폴백
    const fallback = GU_RENT_FALLBACK[gu];
    if (fallback) {
      return NextResponse.json({
        total_cases: 1,
        radius: actualRadius,
        fallback: true,
        fallback_source: `${gu} 권역 평균`,
        confidence: "gu_fallback",
        provenance: makeProvenance({
          source: "hardcoded_fallback",
          sample_size: 1,
          collected_at: "2025-09-01",  // 한국부동산원 2025 Q3 발표
          category: "rent",
        }),
        stats: {
          "1층": makeGuStats(fallback.f1),
          "2층": makeGuStats(fallback.f2),
          "지하": makeGuStats(fallback.b1),
        },
        sample_cases: [],
        recent_deals: recentDeals,
        recent_listings: recentListings,
      });
    }
  }

  return NextResponse.json({
    total_cases: filtered.length,
    radius: actualRadius,
    confidence: filtered.length >= 3 ? "actual" : "dong_estimate",
    provenance: makeProvenance({
      source: "rtms_rent",
      sample_size: filtered.length,
      collected_at: new Date().toISOString(),
      category: "rent",
    }),
    stats,
    sample_cases: filtered.slice(0, 20),
    recent_deals: recentDeals,
    recent_listings: recentListings,
  });
}
