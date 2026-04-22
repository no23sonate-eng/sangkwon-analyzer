/* ── 소비지출·상권매출 추정 엔진 ──

   1) 가구 소비지출 (월/일·가구·인당):
      가처분소득 = 총소득 × (1 - 세금·사회보험 부담률)
      소비지출 = 가처분소득 × 평균소비성향
      — 소득분위별(1~5분위) 통계청 가계동향조사 기반

   2) 일 추정 상권매출:
      1순위: sales 테이블 실측 monthly_sales ÷ 30
      2순위: 유동인구 × 인당 소비액 × 상권유형별 전환율
       — 주거밀집 3% / 혼합 6% / 유입형 12%

   모든 상수는 통계청·KOSIS 2024 기준.
*/

export interface IncomeQuintile {
  quintile: 1 | 2 | 3 | 4 | 5;
  label: string;
  disposableRate: number;      // 가처분소득 / 총소득
  propensityToConsume: number; // 소비지출 / 가처분소득
  avgHouseholdSize: number;    // 분위별 평균 가구원 수
}

// 통계청 2024 가계동향조사 — 도시 2인이상 가구 기준
export const QUINTILES: IncomeQuintile[] = [
  { quintile: 1, label: "1분위(하위)", disposableRate: 0.92, propensityToConsume: 0.95, avgHouseholdSize: 1.8 },
  { quintile: 2, label: "2분위",       disposableRate: 0.90, propensityToConsume: 0.82, avgHouseholdSize: 2.1 },
  { quintile: 3, label: "3분위(중위)", disposableRate: 0.87, propensityToConsume: 0.72, avgHouseholdSize: 2.4 },
  { quintile: 4, label: "4분위",       disposableRate: 0.84, propensityToConsume: 0.65, avgHouseholdSize: 2.6 },
  { quintile: 5, label: "5분위(상위)", disposableRate: 0.80, propensityToConsume: 0.57, avgHouseholdSize: 2.7 },
];

/** 서울 25개 구 소득순위(rank)를 5분위로 매핑 */
export function getQuintileByRank(rank: number): IncomeQuintile {
  if (rank <= 5)  return QUINTILES[4];
  if (rank <= 10) return QUINTILES[3];
  if (rank <= 15) return QUINTILES[2];
  if (rank <= 20) return QUINTILES[1];
  return QUINTILES[0];
}

export interface SpendingEstimate {
  monthlyIncome: number;         // 만원 — 입력 원본
  disposableIncome: number;      // 만원
  monthlyConsumption: number;    // 만원
  dailyPerHousehold: number;     // 원/일/가구
  dailyPerPerson: number;        // 원/일/인
  quintile: IncomeQuintile;
}

export function estimateHouseholdSpending(
  monthlyIncomeMan: number,
  rank: number,
): SpendingEstimate {
  const q = getQuintileByRank(rank);
  const disposable = monthlyIncomeMan * q.disposableRate;
  const consumption = disposable * q.propensityToConsume;
  const dailyHouse = Math.round((consumption * 10000) / 30);
  const dailyPerson = Math.round(dailyHouse / q.avgHouseholdSize);
  return {
    monthlyIncome: monthlyIncomeMan,
    disposableIncome: Math.round(disposable),
    monthlyConsumption: Math.round(consumption),
    dailyPerHousehold: dailyHouse,
    dailyPerPerson: dailyPerson,
    quintile: q,
  };
}

export type AreaType = "residential" | "mixed" | "inflow";

export const AREA_LABEL: Record<AreaType, string> = {
  residential: "주거·직장 밀집형",
  mixed: "혼합형",
  inflow: "유입형 (관광·상업)",
};

// 상권유형별 유동→매출 전환율 (실측 없을 때만 적용)
export const CONVERSION_RATES: Record<AreaType, number> = {
  residential: 0.03,
  mixed: 0.06,
  inflow: 0.12,
};

export function classifyAreaType(ftPopRatio: number): AreaType {
  if (ftPopRatio > 0.5) return "residential";
  if (ftPopRatio > 0.2) return "mixed";
  return "inflow";
}

export interface RevenueEstimate {
  method: "actual" | "estimated";
  dailyRevenue: number;     // 원
  dailyRevenueMan: number;  // 만원
  // 실측 메타
  actualMonthlyRevenue?: number;
  // 추정 메타
  conversionRate?: number;
  areaType?: AreaType;
  dailyFootTraffic?: number;
  dailySpendPerPerson?: number;
}

export function estimateAreaRevenue(args: {
  actualMonthlyRevenue?: number; // 원 (sales_summary.total_sales)
  dailyFootTraffic: number;
  dailySpendPerPerson: number;   // 원
  ftPopRatio: number;
}): RevenueEstimate {
  if (args.actualMonthlyRevenue && args.actualMonthlyRevenue > 0) {
    const daily = Math.round(args.actualMonthlyRevenue / 30);
    return {
      method: "actual",
      dailyRevenue: daily,
      dailyRevenueMan: Math.round(daily / 10000),
      actualMonthlyRevenue: args.actualMonthlyRevenue,
    };
  }
  const areaType = classifyAreaType(args.ftPopRatio);
  const rate = CONVERSION_RATES[areaType];
  const daily = Math.round(args.dailyFootTraffic * args.dailySpendPerPerson * rate);
  return {
    method: "estimated",
    dailyRevenue: daily,
    dailyRevenueMan: Math.round(daily / 10000),
    conversionRate: rate,
    areaType,
    dailyFootTraffic: args.dailyFootTraffic,
    dailySpendPerPerson: args.dailySpendPerPerson,
  };
}
