/* ── 추천 업종 점수 계산 ──
   score = (1 - 포화도/100) × 25 + 매출순위점수 × 25 +
           유동인구매칭 × 20 + 생존율점수 × 15 + 경쟁강도역수 × 15
*/

import type { StoreSummary, SalesSummary, FootTrafficSummary, StoreCountSummary } from "./types";

export interface RecommendedIndustry {
  name: string;
  score: number;
  reason: string;
  avgMonthlySales: number; // 만원
}

export function calculateRecommendations(
  storeSummary: StoreSummary | undefined,
  salesSummary: SalesSummary | undefined,
  ftSummary: FootTrafficSummary | undefined,
  scSummary: StoreCountSummary | undefined,
): RecommendedIndustry[] {
  if (!storeSummary || !salesSummary) return [];

  const totalStores = storeSummary.total || 1;
  const bySub = storeSummary.by_subcategory ?? {};
  const byService = salesSummary.by_service ?? [];
  const perStore = salesSummary.per_store ?? [];
  const scList = scSummary?.by_service ?? [];

  // 업종별 데이터 수집
  const industries = new Map<string, {
    storeCount: number;
    saturation: number; // 0~100
    salesAmount: number;
    salesRank: number;
    openCount: number;
    closeCount: number;
    perStoreSales: number;
  }>();

  // 점포 수 + 포화도
  for (const [name, info] of Object.entries(bySub)) {
    industries.set(name, {
      storeCount: info.count,
      saturation: info.ratio,
      salesAmount: 0,
      salesRank: -1,
      openCount: 0,
      closeCount: 0,
      perStoreSales: 0,
    });
  }

  // 매출
  const sortedSales = [...byService].sort((a, b) => b.매출액 - a.매출액);
  sortedSales.forEach((item, idx) => {
    const existing = industries.get(item.업종);
    if (existing) {
      existing.salesAmount = item.매출액;
      existing.salesRank = idx;
    } else {
      industries.set(item.업종, {
        storeCount: 0,
        saturation: 0,
        salesAmount: item.매출액,
        salesRank: idx,
        openCount: 0,
        closeCount: 0,
        perStoreSales: 0,
      });
    }
  });

  // 점포당 매출
  for (const item of perStore) {
    const existing = industries.get(item.업종);
    if (existing) {
      existing.perStoreSales = item.점포당_매출;
    }
  }

  // 개폐업
  for (const item of scList) {
    const existing = industries.get(item.업종);
    if (existing) {
      existing.openCount = item.개업수 ?? 0;
      existing.closeCount = item.폐업수 ?? 0;
    }
  }

  // 유동인구 매칭 (연령대 기반 단순 점수)
  const topAge = ftSummary?.by_age
    ? Object.entries(ftSummary.by_age).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
    : "";

  const ageAffinityMap: Record<string, string[]> = {
    "20대": ["커피-음료", "분식전문점", "호프-간이주점", "의류점"],
    "30대": ["한식음식점", "커피-음료", "양식음식점", "일식음식점"],
    "40대": ["한식음식점", "중식음식점", "의원", "슈퍼마켓"],
    "50대": ["한식음식점", "약국", "의원", "슈퍼마켓"],
  };
  const affinityList = ageAffinityMap[topAge] ?? [];

  // 점수 계산
  const maxSales = sortedSales.length > 0 ? sortedSales[0].매출액 : 1;
  const results: RecommendedIndustry[] = [];

  for (const [name, data] of industries) {
    if (data.storeCount <= 0 && data.salesAmount <= 0) continue;

    // 포화도 역수 (낮을수록 좋음)
    const satScore = (1 - data.saturation / 100) * 25;

    // 매출 순위 (높을수록 좋음, -1이면 매출 데이터 없음)
    const salesScore = sortedSales.length > 0 && data.salesRank >= 0
      ? ((sortedSales.length - data.salesRank) / sortedSales.length) * 25
      : 0;

    // 유동인구 매칭
    const ftMatch = affinityList.some((a) => name.includes(a) || a.includes(name)) ? 20 : 8;

    // 생존율 (개업 > 폐업이면 좋음)
    const totalOC = data.openCount + data.closeCount;
    const survivalScore = totalOC > 0
      ? (data.openCount / totalOC) * 15
      : 7.5;

    // 경쟁 강도 역수 (점포 적을수록 좋음)
    const competitionScore = Math.max(0, (1 - data.storeCount / totalStores) * 15);

    const total = Math.round(satScore + salesScore + ftMatch + survivalScore + competitionScore);

    // 이유 생성
    const reasons: string[] = [];
    if (data.saturation < 5) reasons.push("공급 부족");
    if (data.salesRank < 3) reasons.push("매출 상위");
    if (affinityList.some((a) => name.includes(a))) reasons.push(`${topAge} 타깃 적합`);
    if (data.openCount > data.closeCount) reasons.push("개업 증가 중");

    const avgMonthly = data.perStoreSales > 0
      ? Math.round(data.perStoreSales / 10000)
      : data.storeCount > 0
      ? Math.round(data.salesAmount / data.storeCount / 10000)
      : 0;

    results.push({
      name,
      score: total,
      reason: reasons.length > 0 ? reasons.join(" · ") : "종합 평가",
      avgMonthlySales: avgMonthly,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}
