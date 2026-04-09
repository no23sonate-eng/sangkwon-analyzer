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
    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
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

export async function getTrendData(period: Period = "6m"): Promise<TrendDataPoint[]> {
  // TODO: Replace with actual API call
  if (period === "3m") {
    return [
      { month: "2026.01", 개업: 1520, 폐업: 870 },
      { month: "2026.02", 개업: 1450, 폐업: 980 },
      { month: "2026.03", 개업: 1620, 폐업: 910 },
    ];
  }
  if (period === "1y") {
    return [
      { month: "2025.04", 개업: 1180, 폐업: 950 },
      { month: "2025.05", 개업: 1290, 폐업: 880 },
      { month: "2025.06", 개업: 1350, 폐업: 860 },
      { month: "2025.07", 개업: 1150, 폐업: 1020 },
      { month: "2025.08", 개업: 1080, 폐업: 1080 },
      { month: "2025.09", 개업: 1200, 폐업: 960 },
      { month: "2025.10", 개업: 1240, 폐업: 890 },
      { month: "2025.11", 개업: 1380, 폐업: 920 },
      { month: "2025.12", 개업: 1100, 폐업: 1050 },
      { month: "2026.01", 개업: 1520, 폐업: 870 },
      { month: "2026.02", 개업: 1450, 폐업: 980 },
      { month: "2026.03", 개업: 1620, 폐업: 910 },
    ];
  }
  // 6m
  return [
    { month: "2025.10", 개업: 1240, 폐업: 890 },
    { month: "2025.11", 개업: 1380, 폐업: 920 },
    { month: "2025.12", 개업: 1100, 폐업: 1050 },
    { month: "2026.01", 개업: 1520, 폐업: 870 },
    { month: "2026.02", 개업: 1450, 폐업: 980 },
    { month: "2026.03", 개업: 1620, 폐업: 910 },
  ];
}

/* ── TOP 5 상권 ── */

export interface TopArea {
  rank: number;
  name: string;
  change: number;
}

export async function getTopAreas(): Promise<TopArea[]> {
  // TODO: Replace with actual API call
  return [
    { rank: 1, name: "성수동", change: 24 },
    { rank: 2, name: "을지로", change: 18 },
    { rank: 3, name: "망원동", change: 15 },
    { rank: 4, name: "연남동", change: 12 },
    { rank: 5, name: "익선동", change: 9 },
  ];
}

/* ── 업종별 개폐업 (기간별 다른 데이터) ── */

export interface IndustryRow {
  name: string;
  개업: number;
  폐업: number;
}

export async function getIndustryStats(period: Period = "6m"): Promise<IndustryRow[]> {
  // TODO: Replace with actual API call
  if (period === "3m") {
    return [
      { name: "카페", 개업: 210, 폐업: 160 },
      { name: "음식점", 개업: 340, 폐업: 270 },
      { name: "소매", 개업: 175, 폐업: 145 },
      { name: "서비스업", 개업: 145, 폐업: 98 },
      { name: "주점", 개업: 85, 폐업: 110 },
    ];
  }
  if (period === "1y") {
    return [
      { name: "카페", 개업: 840, 폐업: 620 },
      { name: "음식점", 개업: 1360, 폐업: 1040 },
      { name: "소매", 개업: 700, 폐업: 560 },
      { name: "서비스업", 개업: 580, 폐업: 380 },
      { name: "주점", 개업: 360, 폐업: 420 },
    ];
  }
  // 6m
  return [
    { name: "카페", 개업: 420, 폐업: 310 },
    { name: "음식점", 개업: 680, 폐업: 520 },
    { name: "소매", 개업: 350, 폐업: 280 },
    { name: "서비스업", 개업: 290, 폐업: 190 },
    { name: "주점", 개업: 180, 폐업: 210 },
  ];
}

/* ── 요일별 유동인구 (기간별 다른 데이터) ── */

export interface FootTrafficDay {
  day: string;
  value: number;
}

export async function getWeeklyFootTraffic(period: Period = "6m"): Promise<FootTrafficDay[]> {
  // TODO: Replace with actual API call
  if (period === "3m") {
    return [
      { day: "월", value: 78200 },
      { day: "화", value: 75800 },
      { day: "수", value: 80100 },
      { day: "목", value: 77500 },
      { day: "금", value: 89400 },
      { day: "토", value: 108600 },
      { day: "일", value: 100200 },
    ];
  }
  if (period === "1y") {
    return [
      { day: "월", value: 86800 },
      { day: "화", value: 83400 },
      { day: "수", value: 88900 },
      { day: "목", value: 85600 },
      { day: "금", value: 98200 },
      { day: "토", value: 118700 },
      { day: "일", value: 109300 },
    ];
  }
  // 6m
  return [
    { day: "월", value: 82400 },
    { day: "화", value: 79100 },
    { day: "수", value: 84300 },
    { day: "목", value: 81200 },
    { day: "금", value: 93800 },
    { day: "토", value: 112400 },
    { day: "일", value: 104700 },
  ];
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
