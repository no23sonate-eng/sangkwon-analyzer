import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gu = searchParams.get("gu") ?? "";
  const dong = searchParams.get("dong") ?? "";
  const floor = searchParams.get("floor") ?? "";
  const days = parseInt(searchParams.get("days") ?? "30", 10);

  if (!gu) {
    return NextResponse.json({ error: "gu parameter required" }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // 추정 실거래 (사라진 매물)
  let dealQuery = supabase
    .from("naver_estimated_deals")
    .select("estimated_rent, estimated_deposit, rent_per_pyeong, area_m2, floor, dong, disappeared_date")
    .eq("gu", gu)
    .gte("disappeared_date", cutoff)
    .order("disappeared_date", { ascending: false });

  if (dong) dealQuery = dealQuery.eq("dong", dong);
  if (floor) dealQuery = dealQuery.eq("floor", floor);

  const { data: deals } = await dealQuery.limit(100);

  // 최신 호가 (현재 매물)
  let listingQuery = supabase
    .from("naver_listings")
    .select("monthly_rent, deposit, area_m2, floor, dong, crawl_date")
    .eq("gu", gu)
    .order("crawl_date", { ascending: false });

  if (dong) listingQuery = listingQuery.eq("dong", dong);
  if (floor) listingQuery = listingQuery.eq("floor", floor);

  const { data: listings } = await listingQuery.limit(100);

  // 집계
  const validDeals = (deals ?? []).filter((d) => d.rent_per_pyeong > 0);
  const validListings = (listings ?? []).filter((l) => l.monthly_rent > 0 && l.area_m2 > 0);

  const estimated_rent_per_pyeong = validDeals.length > 0
    ? Math.round(validDeals.reduce((s, d) => s + d.rent_per_pyeong, 0) / validDeals.length * 10) / 10
    : null;

  const asking_rent_per_pyeong = validListings.length > 0
    ? Math.round(
        validListings.reduce((s, l) => s + (l.monthly_rent / (l.area_m2 / 3.3)), 0) / validListings.length * 10
      ) / 10
    : null;

  return NextResponse.json({
    gu,
    dong: dong || null,
    floor: floor || null,
    period_days: days,
    estimated_rent_per_pyeong,
    deal_count: validDeals.length,
    asking_rent_per_pyeong,
    asking_count: validListings.length,
    source: "네이버 부동산 호가 추정 실거래",
    recent_deals: validDeals.slice(0, 10),
  });
}
