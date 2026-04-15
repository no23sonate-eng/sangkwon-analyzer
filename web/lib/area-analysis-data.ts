/* ── 상권 분석 패널 데이터 (API fetch) ── */

export interface AreaOverview {
  name: string;
  address: string;
  areaM2: number;
  vitality: number;
  totalStores: number;
  storeChangeYoY: number;
  avgBusinessYears: number;
  categories: Array<{ name: string; count: number; ratio: number; color: string }>;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getAreaOverview(areaCode: string): Promise<AreaOverview | null> {
  return fetchJson<AreaOverview>(`/api/area/${encodeURIComponent(areaCode)}/overview`);
}

export interface FootTrafficData {
  dailyAvg: number;
  hourly: Array<{ hour: string; value: number }>;
  heatmap: number[][];
  gender: { male: number; female: number };
  age: Array<{ label: string; value: number }>;
}

export async function getFootTraffic(areaCode: string): Promise<FootTrafficData | null> {
  return fetchJson<FootTrafficData>(`/api/area/${encodeURIComponent(areaCode)}/foot-traffic`);
}

export interface RentalData {
  avgRentPerM2: number;
  rentChangeQoQ: number;
  vacancyRate: number;
  vacancyChange: number;
  rentTrend: Array<{ month: string; value: number }>;
  recentDeals: Array<{
    date: string;
    building: string;
    areaM2: number;
    floor: string;
    amount: string;
  }>;
}

export async function getRentalData(areaCode: string): Promise<RentalData | null> {
  return fetchJson<RentalData>(`/api/area/${encodeURIComponent(areaCode)}/rental`);
}

export interface OpenCloseData {
  monthly: Array<{ month: string; 개업: number; 폐업: number }>;
  netChange: number;
  totalOpen: number;
  totalClose: number;
}

export async function getOpenCloseData(areaCode: string): Promise<OpenCloseData | null> {
  return fetchJson<OpenCloseData>(`/api/area/${encodeURIComponent(areaCode)}/open-close`);
}
