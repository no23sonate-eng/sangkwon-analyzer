import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const AREA_KEYWORDS: Record<string, string[]> = {
  "강남역": ["강남역", "강남"],
  "도산공원": ["도산공원", "압구정", "신사동 가로수길", "가로수길"],
  "한남동": ["한남", "이태원"],
  "성수동": ["성수"],
  "홍대역": ["홍대", "서교", "동교"],
  "명동": ["명동"],
};

const PERIOD_QUARTERS: Record<string, number> = { "3m": 1, "6m": 2, "1y": 4 };

function deriveCategory(svcNm: string): string {
  if (!svcNm) return "기타";
  if (svcNm.includes("주점") || svcNm.includes("호프")) return "주점";
  if (svcNm.includes("커피") || svcNm.includes("카페")) return "카페";
  if (
    svcNm.includes("음식점") || svcNm.includes("식당") || svcNm.includes("분식") ||
    svcNm.includes("치킨") || svcNm.includes("패스트푸드") || svcNm.includes("피자") ||
    svcNm.includes("햄버거") || svcNm.includes("제과")
  ) return "음식점";
  if (
    svcNm.includes("의류") || svcNm.includes("패션") || svcNm.includes("신발") ||
    svcNm.includes("잡화") || svcNm.includes("슈퍼") || svcNm.includes("편의점") ||
    svcNm.includes("마트") || svcNm.includes("판매")
  ) return "소매";
  if (svcNm.includes("미용") || svcNm.includes("헤어") || svcNm.includes("네일") || svcNm.includes("세탁")) return "서비스업";
  return "기타";
}

async function getTrdarCds(area: string): Promise<string[] | null> {
  if (area === "서울 전체") return null;
  const keywords = AREA_KEYWORDS[area] ?? [area];
  const allCodes = new Set<string>();
  for (const kw of keywords) {
    const { data } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${kw}%`);
    if (data) for (const r of data) allCodes.add(r.trdar_cd);
  }
  return allCodes.size > 0 ? Array.from(allCodes) : null;
}

function formatQuarter(q: string): string {
  return `${q.slice(0, 4)} Q${q.slice(4)}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "서울 전체";
  const period = searchParams.get("period") ?? "6m";
  const periodQuarters = PERIOD_QUARTERS[period] ?? 2;

  const trdarCds = await getTrdarCds(area);

  // ── 1. 유동인구 (quarter_cd별 + 요일별) ──
  let ftQuery = supabase
    .from("foot_traffic")
    .select("quarter_cd, total_ft, mon, tue, wed, thu, fri, sat, sun");
  if (trdarCds) ftQuery = ftQuery.in("trdar_cd", trdarCds);
  const { data: ftData } = await ftQuery.limit(100000);

  const byQuarterFT = new Map<string, number>();
  for (const r of ftData ?? []) {
    const q = r.quarter_cd ?? "";
    byQuarterFT.set(q, (byQuarterFT.get(q) ?? 0) + (r.total_ft ?? 0));
  }
  const 유동인구 = Array.from(byQuarterFT.entries())
    .map(([q, total]) => ({ quarter: formatQuarter(q), 유동인구: Math.round(total / 90) }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

  // 요일별 유동인구 — 기간 내 분기 합산 일평균
  const ftQuarters = Array.from(new Set((ftData ?? []).map((r) => r.quarter_cd ?? ""))).sort();
  const recentFtQs = new Set(ftQuarters.slice(-periodQuarters));
  const dayTotals = { 월: 0, 화: 0, 수: 0, 목: 0, 금: 0, 토: 0, 일: 0 };
  let ftDayQuarterCount = 0;
  for (const r of ftData ?? []) {
    if (!recentFtQs.has(r.quarter_cd ?? "")) continue;
    dayTotals.월 += r.mon ?? 0;
    dayTotals.화 += r.tue ?? 0;
    dayTotals.수 += r.wed ?? 0;
    dayTotals.목 += r.thu ?? 0;
    dayTotals.금 += r.fri ?? 0;
    dayTotals.토 += r.sat ?? 0;
    dayTotals.일 += r.sun ?? 0;
    ftDayQuarterCount++;
  }
  // 분기당 요일별 값은 약 13주치 합계 → 13으로 나누면 요일별 평균
  const divisor = recentFtQs.size > 0 ? 13 * recentFtQs.size : 1;
  const 요일별유동인구 = (["월", "화", "수", "목", "금", "토", "일"] as const).map((d) => ({
    day: d,
    value: ftDayQuarterCount > 0 ? Math.round(dayTotals[d] / divisor) : 0,
  }));

  // ── 2. 매출 (quarter_cd별 + 업종별) ──
  let salesQuery = supabase.from("sales").select("quarter_cd, svc_nm, monthly_sales, monthly_count");
  if (trdarCds) salesQuery = salesQuery.in("trdar_cd", trdarCds);
  const { data: salesData } = await salesQuery.limit(100000);

  const byQuarterSales = new Map<string, { sales: number; count: number }>();
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
      quarter: formatQuarter(q),
      매출_억: Math.round(v.sales / 1e8),
      건수_만: Math.round(v.count / 1e4),
    }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));

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

  // ── 3. 개폐업 트렌드 (quarter별) + 업종별 ──
  let storeQuery = supabase.from("stores").select("quarter_cd, svc_nm, open_count, close_count");
  if (trdarCds) storeQuery = storeQuery.in("trdar_cd", trdarCds);
  const { data: storeData } = await storeQuery.limit(100000);

  const byQuarterOC = new Map<string, { open: number; close: number }>();
  for (const r of storeData ?? []) {
    const q = r.quarter_cd ?? "";
    const e = byQuarterOC.get(q) ?? { open: 0, close: 0 };
    e.open += r.open_count ?? 0;
    e.close += r.close_count ?? 0;
    byQuarterOC.set(q, e);
  }
  const storeQuarters = Array.from(byQuarterOC.keys()).sort();
  const recentQs = storeQuarters.slice(-periodQuarters);

  const 개폐업_분기별 = recentQs.map((q) => {
    const v = byQuarterOC.get(q)!;
    return { month: formatQuarter(q), 개업: v.open, 폐업: v.close };
  });

  // 업종별 (최근 기간 합산)
  const recentQSet = new Set(recentQs);
  const byCategory = new Map<string, { open: number; close: number }>();
  for (const r of storeData ?? []) {
    if (!recentQSet.has(r.quarter_cd ?? "")) continue;
    const cat = deriveCategory(r.svc_nm ?? "");
    const e = byCategory.get(cat) ?? { open: 0, close: 0 };
    e.open += r.open_count ?? 0;
    e.close += r.close_count ?? 0;
    byCategory.set(cat, e);
  }
  const 개폐업_업종별 = Array.from(byCategory.entries())
    .filter(([cat]) => cat !== "기타")
    .map(([name, v]) => ({ name, 개업: v.open, 폐업: v.close }))
    .sort((a, b) => (b.개업 + b.폐업) - (a.개업 + a.폐업))
    .slice(0, 5);

  return NextResponse.json({
    "유동인구": 유동인구,
    "요일별유동인구": 요일별유동인구,
    "매출": 매출,
    "매출_업종별": 매출_업종별,
    "개폐업_분기별": 개폐업_분기별,
    "개폐업_업종별": 개폐업_업종별,
    "선택상권": area,
    "기간": period,
    "매칭상권수": trdarCds?.length ?? 0,
  });
}
