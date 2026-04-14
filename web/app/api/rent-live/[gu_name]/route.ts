import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET(_: Request, { params }: { params: Promise<{ gu_name: string }> }) {
  const { gu_name } = await params;

  // DB에서 조회
  const { data } = await supabase
    .from("gu_rent_stats")
    .select("avg_deposit, avg_monthly_rent, avg_rent_per_m2, source, updated_at")
    .eq("gu", gu_name)
    .single();

  if (data && data.avg_monthly_rent > 0) {
    // 네이버 호가 데이터가 있으면 함께 반환
    const { data: naverData } = await supabase
      .from("naver_estimated_deals")
      .select("estimated_rent, rent_per_pyeong, area_m2")
      .eq("gu", gu_name)
      .order("disappeared_date", { ascending: false })
      .limit(50);

    let naver_avg_pyeong: number | null = null;
    let naver_count = 0;
    if (naverData && naverData.length > 0) {
      const validDeals = naverData.filter((d) => d.rent_per_pyeong > 0);
      if (validDeals.length > 0) {
        naver_avg_pyeong = Math.round(
          validDeals.reduce((s, d) => s + d.rent_per_pyeong, 0) / validDeals.length * 10
        ) / 10;
        naver_count = validDeals.length;
      }
    }

    return NextResponse.json({
      avg_deposit: data.avg_deposit,
      avg_monthly_rent: data.avg_monthly_rent,
      avg_rent_per_m2: data.avg_rent_per_m2,
      source: data.source,
      updated_at: data.updated_at,
      ...(naver_avg_pyeong != null && {
        naver_avg_pyeong,
        naver_count,
        naver_source: "네이버 부동산 추정 실거래",
      }),
    });
  }

  // 폴백
  return NextResponse.json({
    avg_deposit: 3000, avg_monthly_rent: 200, avg_rent_per_m2: 7.5,
    source: "기본값",
  });
}
