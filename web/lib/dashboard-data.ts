/* ── 대시보드 데이터 fetch 함수 (더미) ── */

export type Period = "3m" | "6m" | "1y";

export interface DashboardStats {
  totalDistricts: number;
  totalStores: string;
  monthlyAnalyses: number;
  maxAnalyses: string;
  favorites: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const BASE = "";
    const res = await fetch(`${BASE}/api/dashboard/stats`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const stores = data.totalStores;
    const storesStr = stores >= 10000
      ? `${Math.round(stores / 10000).toLocaleString()}만`
      : stores.toLocaleString();
    return {
      totalDistricts: data.totalDistricts,
      totalStores: storesStr,
      monthlyAnalyses: 12,
      maxAnalyses: "무제한(Pro)",
      favorites: 3,
    };
  } catch {
    return {
      totalDistricts: 0,
      totalStores: "-",
      monthlyAnalyses: 0,
      maxAnalyses: "-",
      favorites: 0,
    };
  }
}

/* ── 상권 트렌드 (기간별 다른 데이터) ── */

export interface TrendDataPoint {
  month: string;
  개업: number;
  폐업: number;
}

async function fetchTrend(period: Period, area = "서울 전체") {
  try {
    const res = await fetch(
      `/api/dashboard/trend?area=${encodeURIComponent(area)}&period=${period}`,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getTrendData(period: Period = "6m", area = "서울 전체"): Promise<TrendDataPoint[]> {
  const data = await fetchTrend(period, area);
  return data?.["개폐업_분기별"] ?? [];
}

/* ── TOP 5 상권 ── */

export interface TopArea {
  rank: number;
  name: string;
  change: number;
}

export async function getTopAreas(): Promise<TopArea[]> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );
    const { data: storesData } = await supabase
      .from("stores")
      .select("trdar_cd, open_count, close_count")
      .gt("open_count", 0)
      .limit(10000);
    const { data: areasData } = await supabase
      .from("areas")
      .select("trdar_cd, trdar_nm");

    if (!storesData?.length || !areasData?.length) throw new Error("no data");

    const areaMap = new Map(areasData.map((a) => [a.trdar_cd, a.trdar_nm]));
    const byArea = new Map<string, { name: string; open: number; close: number }>();
    for (const r of storesData) {
      const name = areaMap.get(r.trdar_cd);
      if (!name) continue;
      const existing = byArea.get(r.trdar_cd) ?? { name, open: 0, close: 0 };
      existing.open += r.open_count ?? 0;
      existing.close += r.close_count ?? 0;
      byArea.set(r.trdar_cd, existing);
    }
    const sorted = [...byArea.values()]
      .filter((a) => a.open + a.close > 0)
      .sort((a, b) => (b.open - b.close) - (a.open - a.close))
      .slice(0, 5);

    return sorted.map((a, i) => ({
      rank: i + 1,
      name: a.name,
      change: a.open + a.close > 0 ? Math.round(((a.open - a.close) / (a.open + a.close)) * 100) : 0,
    }));
  } catch {
    return [
      { rank: 1, name: "성수동", change: 24 },
      { rank: 2, name: "을지로", change: 18 },
      { rank: 3, name: "망원동", change: 15 },
      { rank: 4, name: "연남동", change: 12 },
      { rank: 5, name: "익선동", change: 9 },
    ];
  }
}

/* ── 업종별 개폐업 (기간별 다른 데이터) ── */

export interface IndustryRow {
  name: string;
  개업: number;
  폐업: number;
}

export async function getIndustryStats(period: Period = "6m", area = "서울 전체"): Promise<IndustryRow[]> {
  const data = await fetchTrend(period, area);
  return data?.["개폐업_업종별"] ?? [];
}

/* ── 요일별 유동인구 (기간별 다른 데이터) ── */

export interface FootTrafficDay {
  day: string;
  value: number;
}

export async function getWeeklyFootTraffic(period: Period = "6m", area = "서울 전체"): Promise<FootTrafficDay[]> {
  const data = await fetchTrend(period, area);
  return data?.["요일별유동인구"] ?? [];
}

/* ── 최근 분석 기록 ── */

export interface RecentAnalysis {
  id: string;
  name: string;
  date: string;
}

export function getRecentAnalyses(): RecentAnalysis[] {
  // TODO: Replace with actual API call
  return [
    { id: "1", name: "강남역 상권", date: "2026.04.03" },
    { id: "2", name: "홍대입구역 상권", date: "2026.04.01" },
    { id: "3", name: "성수동 카페거리", date: "2026.03.28" },
  ];
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "새벽에도 열심이시네요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}
