import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "서울 전체";

  // 상권 필터
  let trdarCds: string[] | null = null;
  if (area !== "서울 전체") {
    const { data: areaData } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${area}%`);
    if (areaData && areaData.length > 0) {
      trdarCds = areaData.map((a) => a.trdar_cd);
    }
  }

  // ── 1. 유동인구 (foot_traffic — quarter_cd별) ──
  let ftQuery = supabase.from("foot_traffic").select("quarter_cd, total_ft");
  if (trdarCds) ftQuery = ftQuery.in("trdar_cd", trdarCds);
  const { data: ftData } = await ftQuery.limit(50000);

  const byQuarterFT = new Map<string, number>();
  for (const r of ftData ?? []) {
    const q = r.quarter_cd ?? "";
    byQuarterFT.set(q, (byQuarterFT.get(q) ?? 0) + (r.total_ft ?? 0));
  }
  const 유동인구 = Array.from(byQuarterFT.entries())
    .map(([q, total]) => ({
      quarter: `${q.slice(0, 4)} Q${q.slice(4)}`,
      유동인구: Math.round(total / 90), // 일평균
    }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  // ── 3. 매출 (sales — quarter_cd별) ──
  let salesQuery = supabase.from("sales").select("quarter_cd, svc_nm, monthly_sales, monthly_count");
  if (trdarCds) salesQuery = salesQuery.in("trdar_cd", trdarCds);
  const { data: salesData } = await salesQuery.limit(50000);

  const byQuarterSales = new Map<string, { sales: number; count: number }>();
  const bySvcSales = new Map<string, number>();
  for (const r of salesData ?? []) {
    const q = r.quarter_cd ?? "";
    const existing = byQuarterSales.get(q) ?? { sales: 0, count: 0 };
    existing.sales += r.monthly_sales ?? 0;
    existing.count += r.monthly_count ?? 0;
    byQuarterSales.set(q, existing);

    const svc = r.svc_nm ?? "기타";
    bySvcSales.set(svc, (bySvcSales.get(svc) ?? 0) + (r.monthly_sales ?? 0));
  }
  const 매출 = Array.from(byQuarterSales.entries())
    .map(([q, v]) => ({
      quarter: `${q.slice(0, 4)} Q${q.slice(4)}`,
      매출_억: Math.round(v.sales / 1e8),
      건수_만: Math.round(v.count / 1e4),
    }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  // 업종별 매출 TOP 10
  const 매출_업종별 = Array.from(bySvcSales.entries())
    .map(([svc, sales]) => ({ 업종: svc, 매출_억: Math.round(sales / 1e8), 전분기대비: 0 }))
    .sort((a, b) => b.매출_억 - a.매출_억)
    .slice(0, 10);

  return NextResponse.json({
    "유동인구": 유동인구,
    "매출": 매출,
    "매출_업종별": 매출_업종별,
    store_trend: 매출_업종별,
  });
}
