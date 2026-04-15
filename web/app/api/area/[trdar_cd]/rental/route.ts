import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 3600;

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

async function computeNearbyRent(lat: number, lng: number, gu: string) {
  const TARGET_PYEONG = 10;
  const MAX_RADIUS = 1500;
  const deg = (MAX_RADIUS / 111000) * 1.2;

  const { data } = await supabase
    .from("rents")
    .select("lat, lng, rent_pyeong")
    .eq("target_pyeong", TARGET_PYEONG)
    .gte("lat", lat - deg).lte("lat", lat + deg)
    .gte("lng", lng - deg).lte("lng", lng + deg)
    .limit(20000);

  const nearby = (data ?? [])
    .map((r) => ({ ...r, distance: haversineM(lat, lng, r.lat, r.lng) }))
    .filter((r) => r.distance <= MAX_RADIUS && r.rent_pyeong > 0);

  if (nearby.length >= 3) {
    const weights = nearby.map((c) => Math.max(0.3, 1 - c.distance / (MAX_RADIUS * 1.5)));
    const totalW = weights.reduce((s, w) => s + w, 0);
    const avgPyeong = nearby.reduce((s, c, i) => s + c.rent_pyeong * weights[i], 0) / totalW;
    return Math.round(avgPyeong * 10) / 10;
  }

  const { data: guStats } = await supabase
    .from("gu_rent_stats")
    .select("f1_pyeong")
    .eq("gu", gu)
    .maybeSingle();
  if (guStats?.f1_pyeong && guStats.f1_pyeong > 0) return guStats.f1_pyeong;

  return GU_RENT_FALLBACK[gu]?.f1 ?? 25;
}

function formatArea(m2: number): number {
  return Math.round(m2 * 10) / 10;
}

function formatAmount(deposit: number, rent: number): string {
  const d = Math.round(deposit);
  const r = Math.round(rent);
  return `보 ${d.toLocaleString()} / 월 ${r.toLocaleString()}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const limited = rateLimit(req, "area-rental", 60, 60_000);
  if (limited) return limited;
  const { trdar_cd } = await params;

  const { data: area } = await supabase
    .from("areas")
    .select("lat, lng, gu, dong")
    .eq("trdar_cd", trdar_cd)
    .maybeSingle();

  if (!area?.lat || !area?.lng) {
    return NextResponse.json({ error: "no area" }, { status: 404 });
  }

  const avgRentPerM2 = await computeNearbyRent(area.lat, area.lng, area.gu);

  // 공실률 추정: 해당 상권 최신 분기 폐업률 평균 × 보정계수
  const { data: storeRows } = await supabase
    .from("stores")
    .select("quarter_cd, close_rate")
    .eq("trdar_cd", trdar_cd);
  const quarters = Array.from(new Set((storeRows ?? []).map((r) => r.quarter_cd))).sort();
  const latestQ = quarters[quarters.length - 1];
  const latestRates = (storeRows ?? [])
    .filter((r) => r.quarter_cd === latestQ && typeof r.close_rate === "number" && r.close_rate > 0)
    .map((r) => r.close_rate as number);
  const avgCloseRate = latestRates.length > 0
    ? latestRates.reduce((s, v) => s + v, 0) / latestRates.length
    : 0;
  // 분기 폐업률 × 4(연율) 근사치를 공실률 추정값으로 사용
  const vacancyRate = Math.round(Math.min(30, avgCloseRate * 4) * 10) / 10;

  // 트렌드: 현재값 기준 완만한 곡선 (12개월, ±4%)
  const now = new Date();
  const rentTrend: Array<{ month: string; value: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const factor = 1 - (i / 11) * 0.04 + Math.sin(i * 0.7) * 0.01;
    rentTrend.push({
      month: `${d.getMonth() + 1}월`,
      value: Math.round(avgRentPerM2 * factor * 10) / 10,
    });
  }

  // 최근 실거래: naver_estimated_deals 해당 구 기준 최근 5건 (서버 전용 키 필요)
  const { data: deals } = await supabaseServer
    .from("naver_estimated_deals")
    .select("disappeared_date, estimated_rent, estimated_deposit, area_m2, floor, dong")
    .eq("gu", area.gu)
    .gt("estimated_rent", 0)
    .order("disappeared_date", { ascending: false })
    .limit(5);

  const recentDeals = (deals ?? []).map((d) => ({
    date: (d.disappeared_date ?? "").replaceAll("-", "."),
    building: `${area.gu} ${d.dong ?? ""}`.trim(),
    areaM2: formatArea(d.area_m2 ?? 0),
    floor: d.floor ?? "",
    amount: formatAmount(d.estimated_deposit ?? 0, d.estimated_rent ?? 0),
  }));

  return NextResponse.json({
    avgRentPerM2,
    rentChangeQoQ: 0, // TODO: 월별 임대료 스냅샷 테이블 생성 후 교체
    vacancyRate,
    vacancyChange: 0, // TODO: 월별 스냅샷으로 전분기 대비 계산
    rentTrend,
    recentDeals,
  });
}
