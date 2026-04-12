import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ── 상권 키워드 매핑 (ilike 검색용) ──
   사용자가 선택할 수 있는 상권 이름과 서울시 상권 DB의 trdar_nm이 다를 수 있어서
   여러 키워드로 매칭 범위를 확장
*/
const AREA_KEYWORDS: Record<string, string[]> = {
  "강남역": ["강남역", "강남"],
  "도산공원": ["도산공원", "압구정", "신사동 가로수길", "가로수길"],
  "한남동": ["한남", "이태원"],
  "성수동": ["성수"],
  "홍대역": ["홍대", "서교", "동교"],
  "명동": ["명동"],
};

async function getTrdarCds(area: string): Promise<string[] | null> {
  if (area === "서울 전체") return null;
  const keywords = AREA_KEYWORDS[area] ?? [area];
  const allCodes = new Set<string>();
  for (const kw of keywords) {
    const { data } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${kw}%`);
    if (data) {
      for (const r of data) allCodes.add(r.trdar_cd);
    }
  }
  return allCodes.size > 0 ? Array.from(allCodes) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "서울 전체";

  const trdarCds = await getTrdarCds(area);

  // ── 1. 유동인구 (quarter_cd별) ──
  let ftQuery = supabase.from("foot_traffic").select("quarter_cd, total_ft");
  if (trdarCds) ftQuery = ftQuery.in("trdar_cd", trdarCds);
  const { data: ftData } = await ftQuery.limit(100000);

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

  // ── 2. 매출 (quarter_cd별 + 업종별) ──
  let salesQuery = supabase.from("sales").select("quarter_cd, svc_nm, monthly_sales, monthly_count");
  if (trdarCds) salesQuery = salesQuery.in("trdar_cd", trdarCds);
  const { data: salesData } = await salesQuery.limit(100000);

  const byQuarterSales = new Map<string, { sales: number; count: number }>();
  // quarter별 업종별 매출: 전분기 대비 증감 계산용
  const svcQuarterSales = new Map<string, Map<string, number>>();

  for (const r of salesData ?? []) {
    const q = r.quarter_cd ?? "";
    const existing = byQuarterSales.get(q) ?? { sales: 0, count: 0 };
    existing.sales += r.monthly_sales ?? 0;
    existing.count += r.monthly_count ?? 0;
    byQuarterSales.set(q, existing);

    const svc = r.svc_nm ?? "기타";
    if (!svcQuarterSales.has(svc)) svcQuarterSales.set(svc, new Map());
    const qMap = svcQuarterSales.get(svc)!;
    qMap.set(q, (qMap.get(q) ?? 0) + (r.monthly_sales ?? 0));
  }

  const 매출 = Array.from(byQuarterSales.entries())
    .map(([q, v]) => ({
      quarter: `${q.slice(0, 4)} Q${q.slice(4)}`,
      매출_억: Math.round(v.sales / 1e8),
      건수_만: Math.round(v.count / 1e4),
    }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  // 업종별 매출 TOP 10 — 최신 분기 기준 + 전분기 대비 증감률
  const allQuarters = Array.from(byQuarterSales.keys()).sort();
  const latestQ = allQuarters[allQuarters.length - 1];
  const prevQ = allQuarters[allQuarters.length - 2];

  const 매출_업종별 = Array.from(svcQuarterSales.entries())
    .map(([svc, qMap]) => {
      const latest = qMap.get(latestQ) ?? 0;
      const prev = prevQ ? qMap.get(prevQ) ?? 0 : 0;
      const diff = prev > 0 ? Math.round(((latest - prev) / prev) * 1000) / 10 : 0;
      return { 업종: svc, 매출_억: Math.round(latest / 1e8), 전분기대비: diff };
    })
    .filter((r) => r.매출_억 > 0)
    .sort((a, b) => b.매출_억 - a.매출_억)
    .slice(0, 10);

  return NextResponse.json({
    "유동인구": 유동인구,
    "매출": 매출,
    "매출_업종별": 매출_업종별,
    "선택상권": area,
    "매칭상권수": trdarCds?.length ?? 0,
  });
}
