import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const CATEGORY_COLORS: Record<string, string> = {
  "음식점": "#F97316",
  "카페": "#8B5CF6",
  "소매": "#3B82F6",
  "서비스": "#10B981",
  "주점": "#EC4899",
  "의료": "#14B8A6",
  "교육": "#06B6D4",
  "기타": "#94A3B8",
};

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
  if (svcNm.includes("의원") || svcNm.includes("약국") || svcNm.includes("병원")) return "의료";
  if (svcNm.includes("학원") || svcNm.includes("교육")) return "교육";
  if (svcNm.includes("미용") || svcNm.includes("헤어") || svcNm.includes("네일") || svcNm.includes("세탁")) return "서비스";
  return "기타";
}

export async function GET(_: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const { trdar_cd } = await params;

  const [areaRes, storesRes] = await Promise.all([
    supabase.from("areas").select("trdar_nm, gu, dong").eq("trdar_cd", trdar_cd).maybeSingle(),
    supabase
      .from("stores")
      .select("quarter_cd, svc_nm, store_count, open_count, close_count, close_rate")
      .eq("trdar_cd", trdar_cd),
  ]);

  const area = areaRes.data;
  const stores = storesRes.data ?? [];

  if (!area || stores.length === 0) {
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }

  const quarters = Array.from(new Set(stores.map((s) => s.quarter_cd))).sort();
  const latestQ = quarters[quarters.length - 1];
  // 같은 분기 작년: quarter_cd는 "YYYYQ" 형태 (예: "20251" → 2025 Q1)
  const yoyQ = latestQ ? `${Number(latestQ.slice(0, 4)) - 1}${latestQ.slice(4)}` : undefined;

  const latestRows = stores.filter((s) => s.quarter_cd === latestQ);
  const yoyRows = yoyQ ? stores.filter((s) => s.quarter_cd === yoyQ) : [];

  const totalStores = latestRows.reduce((sum, r) => sum + (r.store_count ?? 0), 0);
  const yoyTotal = yoyRows.reduce((sum, r) => sum + (r.store_count ?? 0), 0);
  const storeChangeYoY =
    yoyTotal > 0 ? Math.round(((totalStores - yoyTotal) / yoyTotal) * 1000) / 10 : 0;

  // 업종 분포
  const byCategory = new Map<string, number>();
  for (const r of latestRows) {
    const cat = deriveCategory(r.svc_nm ?? "");
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + (r.store_count ?? 0));
  }
  const categories = Array.from(byCategory.entries())
    .map(([name, count]) => ({
      name,
      count,
      ratio: totalStores > 0 ? Math.round((count / totalStores) * 1000) / 10 : 0,
      color: CATEGORY_COLORS[name] ?? "#94A3B8",
    }))
    .sort((a, b) => b.count - a.count);

  // 활력도: 개업률 - 폐업률 기반 (최근 분기 평균, 0~100 정규화)
  const openSum = latestRows.reduce((s, r) => s + (r.open_count ?? 0), 0);
  const closeSum = latestRows.reduce((s, r) => s + (r.close_count ?? 0), 0);
  const netRate = totalStores > 0 ? ((openSum - closeSum) / totalStores) * 100 : 0;
  const vitality = Math.max(0, Math.min(100, Math.round(50 + netRate * 5)));

  // 평균 영업기간: 1 / 연간 폐업률 근사 (close_rate는 분기이므로 ×4)
  const validCloseRates = latestRows
    .map((r) => r.close_rate)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const avgQuarterlyCloseRate =
    validCloseRates.length > 0
      ? validCloseRates.reduce((s, v) => s + v, 0) / validCloseRates.length
      : 0;
  const avgBusinessYears =
    avgQuarterlyCloseRate > 0 ? Math.round((100 / (avgQuarterlyCloseRate * 4)) * 10) / 10 : 0;

  return NextResponse.json({
    name: area.trdar_nm,
    address: [area.gu, area.dong].filter(Boolean).join(" "),
    areaM2: 0,
    vitality,
    totalStores,
    storeChangeYoY,
    avgBusinessYears,
    categories,
  });
}
