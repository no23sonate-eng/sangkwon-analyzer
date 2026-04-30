import data from "./data/category-economics.json";

export interface CategoryEconomics {
  rent_ratio: number;
  avg_pyeong: number;
  source: string;
}

const RAW = data.categories as Record<string, CategoryEconomics>;
const CONST = data._constants as { rent_burden_warn: number; rent_burden_max: number };

export const RENT_BURDEN_WARN = CONST.rent_burden_warn;
export const RENT_BURDEN_MAX = CONST.rent_burden_max;

export function getCategoryEconomics(category: string): CategoryEconomics {
  return RAW[category] ?? { rent_ratio: 0.10, avg_pyeong: 20, source: "기본값 (산업 통계 미정의)" };
}

export interface RentEconomy {
  monthlyRentMan: number;       // 카테고리 평균 면적 기준 예상 월세 (만원)
  appropriateSalesMan: number;  // 임대 부담 적정 점포당 매출 (만원/월)
  actualSalesMan: number;       // 실제 카테고리 점포당 매출 (만원/월)
  rentBurden: number;           // 실제월세 / 적정월세. 1.0 = 적정, 1.5+ = 추천 제외
  rentRatioActual: number;      // 실제 매출 대비 임대료 비중
  source: string;
}

export function calcRentEconomy(
  category: string,
  rent1fPerPyeongMan: number,  // 1층 평당 시세 (만원/평/월)
  perStoreSalesWon: number,    // 카테고리 점포당 매출 (원/월)
): RentEconomy {
  const eco = getCategoryEconomics(category);
  const monthlyRentMan = rent1fPerPyeongMan * eco.avg_pyeong;
  const monthlyRentWon = monthlyRentMan * 10000;
  const appropriateRentWon = perStoreSalesWon * eco.rent_ratio;
  const appropriateSalesWon = monthlyRentWon / Math.max(eco.rent_ratio, 0.01);

  const rentBurden = appropriateRentWon > 0 && monthlyRentWon > 0
    ? monthlyRentWon / appropriateRentWon
    : 0;
  const rentRatioActual = perStoreSalesWon > 0 ? monthlyRentWon / perStoreSalesWon : 0;

  return {
    monthlyRentMan: Math.round(monthlyRentMan),
    appropriateSalesMan: Math.round(appropriateSalesWon / 10000),
    actualSalesMan: Math.round(perStoreSalesWon / 10000),
    rentBurden: Math.round(rentBurden * 100) / 100,
    rentRatioActual: Math.round(rentRatioActual * 1000) / 1000,
    source: eco.source,
  };
}

/* 임대 적정 점수 (0~100). rentBurden 1.0 = 50점 (적정), 0.7 = 80점, 1.5 = 0점 */
export function rentFitScore(rentBurden: number): number {
  if (rentBurden <= 0) return 50;
  if (rentBurden >= RENT_BURDEN_MAX) return 0;
  if (rentBurden <= 0.7) return 90;
  if (rentBurden <= 1.0) return 80 - (rentBurden - 0.7) * 100;     // 0.7→80, 1.0→50
  if (rentBurden <= 1.2) return 50 - (rentBurden - 1.0) * 100;     // 1.0→50, 1.2→30
  return Math.max(0, 30 - (rentBurden - 1.2) * 100);                // 1.2→30, 1.5→0
}

/* 추천 가중평균 — 임대료가 흑자 결정변수임을 반영
   합계 100. */
export const SCORE_WEIGHTS = {
  rentFit: 0.30,       // 임대 적정 — 한남동 같은 프라임에선 결정변수
  demand: 0.20,        // 1인당 카테고리 소비 (서울 median 대비)
  ticket: 0.15,        // 객단가 (서울 median 대비)
  supplySlack: 0.15,   // 공급 여유 (밀도 역수)
  openRate: 0.12,      // 개폐업률 (서울 카테고리 평균 대비)
  entryEase: 0.08,     // 진입 용이 (프랜차이즈 비율 역수)
} as const;
