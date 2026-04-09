/* ── 상권 분석 패널용 더미 데이터 ── */

export interface AreaOverview {
  name: string;
  address: string;
  areaM2: number;
  vitality: number; // 0~100
  totalStores: number;
  storeChangeYoY: number; // %
  avgBusinessYears: number;
  categories: Array<{ name: string; count: number; ratio: number; color: string }>;
}

export async function getAreaOverview(_areaCode: string): Promise<AreaOverview> {
  // TODO: Connect to DB
  return {
    name: "강남역 반경 500m",
    address: "서울 강남구 역삼동",
    areaM2: 785000,
    vitality: 72,
    totalStores: 1247,
    storeChangeYoY: 8,
    avgBusinessYears: 3.2,
    categories: [
      { name: "음식점", count: 399, ratio: 32, color: "#F97316" },
      { name: "카페", count: 224, ratio: 18, color: "#8B5CF6" },
      { name: "소매", count: 187, ratio: 15, color: "#3B82F6" },
      { name: "서비스", count: 150, ratio: 12, color: "#10B981" },
      { name: "주점", count: 100, ratio: 8, color: "#EC4899" },
      { name: "기타", count: 187, ratio: 15, color: "#94A3B8" },
    ],
  };
}

export interface FootTrafficData {
  dailyAvg: number;
  hourly: Array<{ hour: string; value: number }>;
  heatmap: number[][]; // 7(요일) × 9(시간대)
  gender: { male: number; female: number };
  age: Array<{ label: string; value: number }>;
}

export async function getFootTraffic(_areaCode: string): Promise<FootTrafficData> {
  // TODO: Connect to DB
  return {
    dailyAvg: 32450,
    hourly: [
      { hour: "06", value: 2100 },
      { hour: "08", value: 5800 },
      { hour: "10", value: 4200 },
      { hour: "12", value: 7500 },
      { hour: "14", value: 5100 },
      { hour: "16", value: 4800 },
      { hour: "18", value: 6900 },
      { hour: "20", value: 5200 },
      { hour: "22", value: 2800 },
    ],
    heatmap: [
      [12, 35, 28, 52, 38, 32, 48, 35, 18], // 월
      [10, 33, 26, 50, 36, 30, 45, 33, 16], // 화
      [14, 38, 30, 55, 40, 35, 50, 38, 20], // 수
      [11, 34, 27, 51, 37, 31, 46, 34, 17], // 목
      [16, 42, 35, 58, 45, 40, 55, 42, 25], // 금
      [20, 48, 45, 65, 55, 52, 62, 50, 30], // 토
      [18, 45, 40, 60, 50, 48, 58, 45, 28], // 일
    ],
    gender: { male: 48, female: 52 },
    age: [
      { label: "10대", value: 5 },
      { label: "20대", value: 28 },
      { label: "30대", value: 32 },
      { label: "40대", value: 18 },
      { label: "50대", value: 12 },
      { label: "60+", value: 5 },
    ],
  };
}

export interface RentalData {
  avgRentPerM2: number; // 만원/3.3㎡/월
  rentChangeQoQ: number; // %
  vacancyRate: number; // %
  vacancyChange: number; // %
  rentTrend: Array<{ month: string; value: number }>;
  recentDeals: Array<{
    date: string;
    building: string;
    areaM2: number;
    floor: string;
    amount: string;
  }>;
}

export async function getRentalData(_areaCode: string): Promise<RentalData> {
  // TODO: Connect to DB
  return {
    avgRentPerM2: 42,
    rentChangeQoQ: 3.2,
    vacancyRate: 12.4,
    vacancyChange: -1.8,
    rentTrend: [
      { month: "4월", value: 38 }, { month: "5월", value: 38.5 },
      { month: "6월", value: 39 }, { month: "7월", value: 39.2 },
      { month: "8월", value: 39.8 }, { month: "9월", value: 40 },
      { month: "10월", value: 40.5 }, { month: "11월", value: 41 },
      { month: "12월", value: 41.2 }, { month: "1월", value: 41.5 },
      { month: "2월", value: 41.8 }, { month: "3월", value: 42 },
    ],
    recentDeals: [
      { date: "2026.03.28", building: "역삼빌딩 A", areaM2: 52.8, floor: "1층", amount: "보 5,000 / 월 220" },
      { date: "2026.03.15", building: "테헤란타워", areaM2: 33.1, floor: "B1", amount: "보 3,000 / 월 150" },
      { date: "2026.03.02", building: "강남파인벨", areaM2: 66.1, floor: "1층", amount: "보 8,000 / 월 350" },
      { date: "2026.02.20", building: "역삼동 스타빌딩", areaM2: 45.5, floor: "2층", amount: "보 2,000 / 월 120" },
      { date: "2026.02.10", building: "강남프라자", areaM2: 99.2, floor: "1층", amount: "보 15,000 / 월 500" },
    ],
  };
}

export interface OpenCloseData {
  monthly: Array<{ month: string; 개업: number; 폐업: number }>;
  netChange: number;
  totalOpen: number;
  totalClose: number;
}

export async function getOpenCloseData(_areaCode: string): Promise<OpenCloseData> {
  // TODO: Connect to DB
  const monthly = [
    { month: "4월", 개업: 14, 폐업: 8 }, { month: "5월", 개업: 16, 폐업: 7 },
    { month: "6월", 개업: 12, 폐업: 9 }, { month: "7월", 개업: 18, 폐업: 6 },
    { month: "8월", 개업: 15, 폐업: 10 }, { month: "9월", 개업: 13, 폐업: 8 },
    { month: "10월", 개업: 17, 폐업: 7 }, { month: "11월", 개업: 19, 폐업: 9 },
    { month: "12월", 개업: 11, 폐업: 8 }, { month: "1월", 개업: 20, 폐업: 6 },
    { month: "2월", 개업: 16, 폐업: 9 }, { month: "3월", 개업: 15, 폐업: 7 },
  ];
  const totalOpen = monthly.reduce((s, d) => s + d.개업, 0);
  const totalClose = monthly.reduce((s, d) => s + d.폐업, 0);
  return { monthly, netChange: totalOpen - totalClose, totalOpen, totalClose };
}
