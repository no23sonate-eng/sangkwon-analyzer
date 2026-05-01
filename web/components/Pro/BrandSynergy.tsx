"use client";

import { useState, useMemo, useEffect } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useAnalysisStore } from "@/store/analysisStore";
import seoulBenchmark from "@/lib/data/seoul-benchmark.json";
import {
  getCategoryEconomics,
  calcRentEconomy,
  rentFitScore,
  rankSubcategories,
  CATEGORY_GROUPS,
  SCORE_WEIGHTS,
  RENT_BURDEN_WARN,
  RENT_BURDEN_MAX,
} from "@/lib/category-economics";

/* ── 서울 카테고리 벤치마크 ── 분기 단위 정적 집계 (Phase 1)
   값 50 = 서울 일반(median), 100 = median의 2배, 0 = 사실상 없음. */
type CatBenchmark = {
  median_per_store_sales: number; median_ticket: number;
  median_per_capita_sales: number; median_density: number;
  avg_open_rate: number; avg_franchise_ratio: number;
};
const SEOUL_BENCHMARK = seoulBenchmark.categories as Record<string, CatBenchmark>;
function bm(key: string): CatBenchmark | null {
  return SEOUL_BENCHMARK[key] ?? null;
}
function relScore(my: number, seoul: number): number {
  if (!seoul || seoul <= 0) return 50;
  return Math.max(0, Math.min(100, Math.round((my / seoul) * 50)));
}
function relScoreInverse(my: number, seoul: number): number {
  // 낮을수록 좋음 (밀도/프랜차이즈 비율 등)
  if (!my || my <= 0) return 100;
  if (!seoul || seoul <= 0) return 50;
  return Math.max(0, Math.min(100, Math.round((seoul / my) * 50)));
}

/* ── 대분류 → 세부 업종 정확 매칭 ──
   실제 서울시 상권 데이터의 업종명과 정확히 일치해야 함.
   부분 문자열 매칭은 오매칭 위험이 있어서 정확 매칭만 사용.
   카테고리별 임대비율·평균면적은 web/lib/data/category-economics.json (산업 통계 출처).
*/

// CATEGORY_GROUPS는 web/lib/category-economics.ts에서 import (단일 정의)

interface GroupData {
  key: string;
  label: string;
  icon: string;
  storeCount: number;      // 상권당 가중평균 (스코어/비율 계산용)
  displayStores: number;   // 반경 내 총 점포 수 근사 (UI 표시용)
  displayOpen: number;     // 반경 내 총 개업 (UI 표시용)
  displayClose: number;    // 반경 내 총 폐업 (UI 표시용)
  supplyRatio: number;
  demandScore: number;
  gapScore: number;
  totalSales: number;
  perStoreSales: number;
  avgTicket: number;       // 객단가 (원/건) — 카테고리 총매출 ÷ 총거래건수
  openCount: number;
  closeCount: number;
  franchise: number;
  survivalRate: number;
  rentBurden: number;
  franchiseRatio: number;
  hasData: boolean;
}

export default function BrandSynergy() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const storeCountData = useAnalysisStore((s) => s.storeCountData);
  const radius = useAnalysisStore((s) => s.radius);
  const ft = analysisData?.ft_summary;
  const store = analysisData?.store_summary;
  const sales = analysisData?.sales_summary;
  const rent = analysisData?.rent_info as Record<string, unknown> | undefined;
  const rentConfidence = (rent?.confidence as string | undefined) ?? "actual";
  const isGuFallback = rentConfidence === "gu_fallback";
  // 임대 민감 카테고리 — 구 평균 폴백 시 추천 제외 (rent1f가 실시장보다 낮게 잡혀 false positive 위험)
  const RENT_SENSITIVE_KEYS = new Set(["카페/주류", "외식", "뷰티/건강"]);
  const scSummary = storeCountData?.summary ?? analysisData?.sc_summary;
  const pop = analysisData?.pop_summary;
  // 반경 내 포함된 상권 수 — 점포수 스케일링에 사용 (가중평균 → 반경 내 총합 근사)
  const trdarCount = Math.max(1, analysisData?.trdar_count ?? 1);

  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"category" | "subcategory">("category");

  // 세부업종 단위 추천 (D 시나리오 포함: 임대료 임계 매출 표시)
  const subRanks = useMemo(() => {
    const rent1f = (rent?.["1층_평"] as number) ?? 0;
    if (rent1f <= 0) return [];
    const perStore = sales?.per_store ?? [];
    const bySub = store?.by_subcategory ?? {};
    return rankSubcategories(perStore, bySub, rent1f);
  }, [sales, store, rent]);

  const groups = useMemo(() => {
    if (!store || !ft) return [];

    const bySub = store.by_subcategory ?? {};
    const byService = sales?.by_service ?? [];
    const perStore = sales?.per_store ?? [];
    const scList = scSummary?.by_service ?? [];
    const rent1f = (rent?.["1층_평"] as number) ?? 0;
    const ageSum = Object.values(ft.by_age ?? {}).reduce((s: number, v: number) => s + (v as number), 0);
    const ftTotal = ((ft.total as number) ?? ageSum) || 1;
    const popTotal = (pop?.total as number) || 0;
    // 잠재 소비자 = 유동인구 + 거주인구 (거주인구는 반복 소비하므로 가중)
    const potentialConsumers = ftTotal + popTotal;

    let categorizedStores = 0;
    const result: GroupData[] = [];

    for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
      const subsSet = new Set(group.subs);

      let storeCount = 0;
      let totalSalesAmt = 0;
      let totalCountAmt = 0;
      let totalPerStoreSales = 0;
      let perStoreCount = 0;
      let openCount = 0;
      let closeCount = 0;
      let franchise = 0;

      for (const [subName, info] of Object.entries(bySub)) {
        if (subsSet.has(subName)) storeCount += info.count;
      }
      for (const s of byService) {
        if (subsSet.has(s.업종)) {
          totalSalesAmt += s.매출액;
          totalCountAmt += s.건수 ?? 0;
        }
      }
      for (const p of perStore) {
        if (subsSet.has(p.업종) && p.점포당_매출 > 0) {
          totalPerStoreSales += p.점포당_매출;
          perStoreCount++;
        }
      }
      for (const sc of scList) {
        const name = (sc as Record<string, unknown>)["업종"] as string;
        if (name && subsSet.has(name)) {
          openCount += ((sc as Record<string, unknown>)["개업수"] as number) ?? 0;
          closeCount += ((sc as Record<string, unknown>)["폐업수"] as number) ?? 0;
          franchise += ((sc as Record<string, unknown>)["프랜차이즈"] as number) ?? 0;
        }
      }

      categorizedStores += storeCount;

      const avgPerStoreSales = perStoreCount > 0 ? totalPerStoreSales / perStoreCount : 0;
      const totalOC = openCount + closeCount;
      const survivalRate = totalOC > 0 ? openCount / totalOC : 0.5;

      const eco = getCategoryEconomics(key);
      const monthlyRentWon = rent1f > 0 ? rent1f * eco.avg_pyeong * 10000 : 0;
      const appropriateRent = avgPerStoreSales * eco.rent_ratio;
      const rentBurden = appropriateRent > 0 && monthlyRentWon > 0
        ? monthlyRentWon / appropriateRent
        : 0;

      const franchiseRatio = storeCount > 0 ? franchise / storeCount : 0;

      // 수요: 1인당 소비액 = 카테고리 매출 / (유동인구+거주인구)
      const salesPerPerson = potentialConsumers > 0 ? totalSalesAmt / potentialConsumers : 0;
      // 공급 밀도: 잠재소비자 만명당 점포 수
      const density = potentialConsumers > 0 ? (storeCount / potentialConsumers) * 10000 : 0;

      const avgTicket = totalCountAmt > 0 ? totalSalesAmt / totalCountAmt : 0;

      result.push({
        key,
        label: group.label,
        icon: group.icon,
        storeCount,
        // 반경 내 상권수로 스케일 → "반경 내 총량" 근사. 비율·스코어는 storeCount(가중평균)를 사용하므로 영향 없음.
        displayStores: Math.round(storeCount * trdarCount),
        displayOpen: Math.round(openCount * trdarCount),
        displayClose: Math.round(closeCount * trdarCount),
        supplyRatio: 0,
        demandScore: salesPerPerson, // 임시: 원시값, 아래서 정규화
        gapScore: 0,
        totalSales: totalSalesAmt,
        perStoreSales: avgPerStoreSales,
        avgTicket,
        openCount,
        closeCount,
        franchise,
        survivalRate,
        rentBurden,
        franchiseRatio,
        hasData: storeCount > 0 || totalSalesAmt > 0,
      });
    }

    // ── 2차: 서울 벤치마크 대비 절대 정규화 (50점 = 서울 median) ──
    const valid = result.filter((r) => r.hasData);
    if (valid.length === 0) return [];

    const base = categorizedStores > 0 ? categorizedStores : 1;

    for (const r of valid) {
      const cb = bm(r.key);

      // 수요: 1인당 카테고리 소비액 → 서울 median 대비
      const myPerCapita = potentialConsumers > 0 ? r.totalSales / potentialConsumers : 0;
      r.demandScore = cb ? relScore(myPerCapita, cb.median_per_capita_sales) : 50;
      r.supplyRatio = Math.round((r.storeCount / base) * 100);

      // 공급 여유: 만명당 점포수 → 서울 median 대비 역수 (낮을수록 좋음)
      const myDensity = potentialConsumers > 0 ? (r.storeCount / potentialConsumers) * 10000 : 0;
      const supplySlack = cb ? relScoreInverse(myDensity, cb.median_density) : 50;

      // 객단가: 내 / 서울 median × 50
      const ticketScore = cb ? relScore(r.avgTicket, cb.median_ticket) : 50;

      // 개폐업률: 내 / 서울 카테고리 평균 × 50
      const oc = r.openCount + r.closeCount;
      const myOpenRate = oc > 0 ? (r.openCount / oc) * 100 : 50;
      const openRate = cb ? relScore(myOpenRate, cb.avg_open_rate) : Math.round(myOpenRate);

      // 임대 적정: rentBurden(실제월세/적정월세) 기반 절대 점수
      // 1.0 = 적정(50점), 0.7 이하 = 90점, 1.5 이상 = 0점
      const rentFit = (rent?.["1층_평"] as number ?? 0) > 0 && r.perStoreSales > 0
        ? rentFitScore(r.rentBurden)
        : 50;

      // 진입 용이: 내 프랜차이즈 비율 vs 서울 카테고리 평균 (낮을수록 진입 쉬움)
      const myFranchisePct = r.franchiseRatio * 100;
      const entryEase = cb ? relScoreInverse(myFranchisePct, cb.avg_franchise_ratio) : Math.round((1 - r.franchiseRatio) * 100);

      // 기회 점수: 가중평균 — 임대 30%, 수요 20%, 객단가 15%, 공급여유 15%, 개폐업률 12%, 진입용이 8%
      r.gapScore = Math.max(0, Math.min(100, Math.round(
        rentFit * SCORE_WEIGHTS.rentFit +
        r.demandScore * SCORE_WEIGHTS.demand +
        ticketScore * SCORE_WEIGHTS.ticket +
        supplySlack * SCORE_WEIGHTS.supplySlack +
        openRate * SCORE_WEIGHTS.openRate +
        entryEase * SCORE_WEIGHTS.entryEase,
      )));
    }

    // 하드 필터: 임대 부담이 RENT_BURDEN_MAX(1.5) 초과 → 추천 제외
    // 단 rentBurden 산출 불가(0)인 경우는 데이터 부족이라 통과
    // gu_fallback 신뢰도면 임대 민감 카테고리(카페·외식·뷰티)는 추천에서 다운그레이드
    const filtered = valid.filter((r) => {
      if (r.rentBurden > 0 && r.rentBurden >= RENT_BURDEN_MAX) return false;
      // 구 평균 폴백 + 임대 민감 카테고리는 점수 강제로 깎아 상위 추천에서 빠짐
      if (isGuFallback && RENT_SENSITIVE_KEYS.has(r.key)) {
        r.gapScore = Math.min(r.gapScore, 39); // "보통(40)" 미만으로 = "과밀" 표시
      }
      return true;
    });

    return filtered.sort((a, b) => b.gapScore - a.gapScore);
  }, [store, ft, sales, scSummary, rent, pop, trdarCount, isGuFallback]);

  if (!store || !ft) return <p className="text-[12px] text-muted">데이터 로딩 중...</p>;
  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 py-8 text-center">
        <p className="text-[12px] text-muted">이 지역의 업종 데이터가 부족합니다</p>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.key === selected);

  // 선택된 카테고리의 레이더 데이터 — 모두 실데이터 기반
  const _ftTotal = ft?.total ?? 1;
  const _popTotal = pop?.total ?? 0;
  const _consumers = _ftTotal + _popTotal;
  const _cb = selectedGroup ? bm(selectedGroup.key) : null;

  // "서울 대비 +N%" 라벨 헬퍼
  const vsSeoul = (my: number, seoul: number) => {
    if (!seoul || seoul <= 0 || !my || my <= 0) return "";
    const pct = Math.round(((my - seoul) / seoul) * 100);
    return pct >= 0 ? `서울 +${pct}%` : `서울 ${pct}%`;
  };

  const radarData = selectedGroup && _cb ? [
    // 수요: 1인당 카테고리 소비액 → 서울 median 대비
    (() => {
      const myPC = _consumers > 0 ? selectedGroup.totalSales / _consumers : 0;
      const seoulPC = _cb.median_per_capita_sales;
      return {
        axis: "수요",
        value: relScore(myPC, seoulPC),
        desc: `1인당 ${Math.round(myPC).toLocaleString()}원 (${vsSeoul(myPC, seoulPC)})`,
      };
    })(),
    // 공급 여유: 만명당 점포수 → 서울 median 대비 역수 (낮을수록 좋음)
    (() => {
      const myD = _consumers > 0 ? (selectedGroup.storeCount / _consumers) * 10000 : 0;
      const seoulD = _cb.median_density;
      return {
        axis: "공급 여유",
        value: relScoreInverse(myD, seoulD),
        desc: `만명당 ${myD.toFixed(1)}개 (서울 median ${seoulD})`,
      };
    })(),
    // 객단가: 내 / 서울 median × 50
    (() => {
      const myT = selectedGroup.avgTicket;
      const seoulT = _cb.median_ticket;
      return {
        axis: "객단가",
        value: relScore(myT, seoulT),
        desc: `건당 ${myT > 0 ? Math.round(myT).toLocaleString() : "-"}원 (${vsSeoul(myT, seoulT)})`,
      };
    })(),
    // 개폐업률: 내 % / 서울 평균 % × 50
    (() => {
      const oc = selectedGroup.openCount + selectedGroup.closeCount;
      const myOR = oc > 0 ? (selectedGroup.openCount / oc) * 100 : 50;
      const seoulOR = _cb.avg_open_rate;
      return {
        axis: "개폐업률",
        value: relScore(myOR, seoulOR),
        desc: `${myOR.toFixed(0)}% (서울 ${seoulOR}%) · 개${selectedGroup.displayOpen}/폐${selectedGroup.displayClose}`,
      };
    })(),
    // 임대 적정: rentBurden 기반 (calcRentEconomy 사용)
    (() => {
      const rent1f = (rent?.["1층_평"] as number) ?? 0;
      const econ = calcRentEconomy(selectedGroup.key, rent1f, selectedGroup.perStoreSales);
      const value = (rent1f > 0 && selectedGroup.perStoreSales > 0)
        ? rentFitScore(econ.rentBurden)
        : 50;
      const eco = getCategoryEconomics(selectedGroup.key);
      const appropriateRentMan = Math.round(econ.actualSalesMan * eco.rent_ratio);
      const burdenPct = Math.round(econ.rentBurden * 100);
      return {
        axis: "임대 적정",
        value,
        desc: `시세 ${econ.monthlyRentMan}만 vs 적정 ${appropriateRentMan}만 · 부담 ${burdenPct}%`,
      };
    })(),
    // 진입 용이: 내 프랜차이즈 비율 vs 서울 카테고리 평균 (낮을수록 좋음)
    (() => {
      const myF = selectedGroup.franchiseRatio * 100;
      const seoulF = _cb.avg_franchise_ratio;
      return {
        axis: "진입 용이",
        value: relScoreInverse(myF, seoulF),
        desc: `프랜차이즈 ${myF.toFixed(0)}% (서울 ${seoulF}%)`,
      };
    })(),
  ] : null;

  // 추천 점수 — 리스트의 gapScore와 동일 값(6축 평균). 선택화면 원 안에도 같은 수를 노출.
  const totalScore = selectedGroup?.gapScore ?? 0;
  const totalVerdict = totalScore >= 55 ? "기회" : totalScore >= 40 ? "보통" : "과밀";

  const strengths = radarData?.filter((d) => d.value >= 65).sort((a, b) => b.value - a.value) ?? [];
  const weaknesses = radarData?.filter((d) => d.value < 45).sort((a, b) => a.value - b.value) ?? [];

  return (
    <div className="space-y-4">
      {/* 임대료 신뢰도 경고 — gu_fallback이면 카페·외식 추천이 부정확할 수 있음 */}
      {isGuFallback && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-[11px] font-bold text-amber-700">⚠️ 임대료 = 구 평균 폴백</p>
          <p className="mt-0.5 text-[10px] text-amber-800 leading-relaxed">
            이 위치의 동 단위 실측·매매역산 데이터가 부족해 {(rent?.gu as string) ?? "구"} 평균을 사용했습니다.
            한남·청담·신사 등 프라임 입지에서는 실시장보다 낮게 잡혀 카페·외식이 과대 추천될 수 있습니다.
            카페·외식·뷰티는 자동으로 신뢰도 다운그레이드 처리됨.
          </p>
        </div>
      )}

      {/* View 토글: 대분류 vs 세부업종 */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setView("category")}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
            view === "category" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          대분류 7개
        </button>
        <button
          onClick={() => setView("subcategory")}
          className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
            view === "subcategory" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
          }`}
        >
          세부업종 ({subRanks.length})
        </button>
      </div>

      {view === "subcategory" && (
        <>
          <RoadLineDistribution radius={radius} />
          <SubcategoryView ranks={subRanks} rent1f={(rent?.["1층_평"] as number) ?? 0} radius={radius} />
        </>
      )}

      {view === "category" && (
      <>
      {/* 대분류 카테고리 선택 */}
      <div>
        <label className="mb-1.5 block text-[10px] font-medium text-muted">업종 카테고리 ({groups.length}개)</label>
        <div className="grid grid-cols-4 gap-1.5">
          {groups.map((g) => {
            const isSelected = selected === g.key;
            const isTop = g.gapScore >= 55;
            return (
              <button
                key={g.key}
                onClick={() => setSelected(isSelected ? null : g.key)}
                className={`relative rounded-xl px-2 py-2.5 text-center transition-all ${
                  isSelected
                    ? "bg-primary-600 text-white shadow-md scale-[1.02]"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {isTop && !isSelected && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white">!</span>
                )}
                <span className="block text-[16px]">{g.icon}</span>
                <span className="block text-[10px] font-semibold leading-tight mt-0.5">{g.label}</span>
                <span className={`block text-[9px] mt-0.5 ${isSelected ? "text-white/70" : "text-muted"}`}>
                  {g.displayStores}개
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 미선택: 추천 점수 요약 */}
      {!selected && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted">반경 {radius}m · 가중평균 (임대 30% / 수요 20% / 객단가·공급 15% / 개폐업 12% / 진입 8%)</p>
          {groups.map((g) => {
            const tone = g.gapScore >= 55 ? "emerald" : g.gapScore >= 40 ? "amber" : "red";
            const color = tone === "emerald" ? "#10B981" : tone === "amber" ? "#F59E0B" : "#EF4444";
            const verdict = g.gapScore >= 55 ? "기회" : g.gapScore >= 40 ? "보통" : "과밀";
            const burdenAlert = g.rentBurden >= RENT_BURDEN_WARN;
            return (
              <div key={g.key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-[14px]">{g.icon}</span>
                <span className="flex-1 text-[11px] font-semibold text-gray-800">
                  {g.label}
                  {burdenAlert && (
                    <span className="ml-1.5 inline-block rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] font-bold text-red-700">
                      임대 {Math.round(g.rentBurden * 100)}%
                    </span>
                  )}
                </span>
                <span className="text-[9px] text-muted w-12 text-right">{g.displayStores}개</span>
                <div className="h-1.5 w-14 rounded-full bg-gray-200">
                  <div className="h-full rounded-full" style={{ width: `${g.gapScore}%`, background: color }} />
                </div>
                <span className={`text-[11px] font-bold w-14 text-right`} style={{ color }}>
                  {g.gapScore}<span className="text-[9px] font-medium"> 점</span>
                  <span className="ml-1 text-[9px] font-medium" style={{ color }}>{verdict}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 선택됨: 상세 분석 */}
      {selectedGroup && radarData && (
        <>
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: totalScore >= 55 ? "#ECFDF5" : totalScore >= 40 ? "#FFF7ED" : "#FEF2F2" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: totalScore >= 55 ? "#10B981" : totalScore >= 40 ? "#F59E0B" : "#EF4444" }}>
              <span className="text-[18px] font-black text-white">{totalScore}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900">
                {selectedGroup.icon} {selectedGroup.label}
                <span
                  className="ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: totalScore >= 55 ? "#D1FAE5" : totalScore >= 40 ? "#FEF3C7" : "#FEE2E2",
                    color: totalScore >= 55 ? "#059669" : totalScore >= 40 ? "#B45309" : "#DC2626",
                  }}
                >
                  추천 {totalVerdict}
                </span>
              </p>
              <p className="text-[11px] text-muted">
                {(() => {
                  const g = selectedGroup;
                  const s = g.gapScore;
                  const k = g.key;
                  const verdicts: Record<string, [string, string, string, string]> = {
                    "외식": [
                      "유동인구 대비 외식 점포가 부족해 신규 출점 여건이 좋습니다",
                      "외식 수요가 안정적이며 객단가 확보가 가능합니다",
                      "외식업 경쟁이 존재하나 메뉴 특화로 승산이 있습니다",
                      "외식 점포가 밀집해 있어 가격·마진 경쟁이 치열합니다",
                    ],
                    "카페/주류": [
                      "카페·주류 수요 대비 공급이 적어 입점 기회가 열려 있습니다",
                      "음료·주류 소비가 활발하고 원가율이 낮아 수익성이 양호합니다",
                      "카페 밀도가 있으나 콘셉트 차별화로 시장 진입이 가능합니다",
                      "카페·주류 업종 포화 상태로 임대 부담이 수익을 압박합니다",
                    ],
                    "소매/유통": [
                      "거주·유동인구 대비 소매 점포가 적어 생활 소비 수요를 흡수할 여지가 큽니다",
                      "소매 매출이 꾸준하며 일상 소비 기반의 안정적 수익이 예상됩니다",
                      "소매 경쟁이 있으나 전문 품목 특화 시 틈새 수요 공략이 가능합니다",
                      "대형 유통과 온라인에 밀려 소규모 소매의 수익성이 낮은 구간입니다",
                    ],
                    "뷰티/건강": [
                      "미용·의료 수요 대비 공급이 적어 안정적 고객 확보가 가능합니다",
                      "뷰티·건강 분야의 재방문율이 높아 매출 안정성이 좋습니다",
                      "뷰티 업종 경쟁이 있으나 전문 시술·차별 서비스로 가능성이 있습니다",
                      "미용·건강 점포가 과밀하여 고객 확보 비용이 높아질 수 있습니다",
                    ],
                    "교육": [
                      "교육 수요 대비 학원이 적어 수강생 모집이 수월할 환경입니다",
                      "교육 업종은 경기 방어력이 높고 월정기 매출이 안정적입니다",
                      "학원 간 경쟁이 존재하나 전문 분야 특화로 차별화 여지가 있습니다",
                      "교육 시설이 밀집돼 있어 수강생 유치 경쟁이 심합니다",
                    ],
                    "생활서비스": [
                      "생활 편의 수요는 높으나 서비스 공급이 부족한 상태입니다",
                      "필수 서비스 특성상 수요가 꾸준하고 폐업 위험이 낮습니다",
                      "서비스 업종 경쟁이 있으나 접근성·편의성으로 우위를 잡을 수 있습니다",
                      "생활서비스 업종이 많아 단가 인하 압력이 있을 수 있습니다",
                    ],
                    "여가/오락": [
                      "여가 시설이 부족해 유동인구의 체류 소비를 끌어낼 기회입니다",
                      "여가·오락 소비 의향이 높고 객단가 확보 여건이 갖춰져 있습니다",
                      "여가 시설 경쟁이 있으나 체험형 콘텐츠로 차별화가 가능합니다",
                      "여가 시설이 과밀하여 고정비 대비 가동률 확보가 어렵습니다",
                    ],
                  };
                  const msgs = verdicts[k] ?? [
                    "수요 대비 공급이 적어 진입 여건이 우수합니다",
                    "수익성과 경쟁 환경이 양호한 편입니다",
                    "경쟁이 있으나 차별화로 가능성이 있습니다",
                    "점포 밀도가 높아 수익 압박이 예상됩니다",
                  ];
                  if (s >= 70) return msgs[0];
                  if (s >= 55) return msgs[1];
                  if (s >= 40) return msgs[2];
                  return msgs[3];
                })()}
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke="#F1F5F9" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#64748B", fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94A3B8", fontSize: 9 }} axisLine={false} />
              <Radar dataKey="value"
                stroke={totalScore >= 55 ? "#10B981" : totalScore >= 40 ? "#F59E0B" : "#EF4444"}
                fill={totalScore >= 55 ? "#10B981" : totalScore >= 40 ? "#F59E0B" : "#EF4444"}
                fillOpacity={0.12} strokeWidth={2}
                dot={{ r: 3, fill: totalScore >= 55 ? "#10B981" : totalScore >= 40 ? "#F59E0B" : "#EF4444", stroke: "#fff", strokeWidth: 2 }} />
            </RadarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-[9px] text-muted">점포 수 <span className="text-[8px]">(반경 {radius}m)</span></p>
              <p className="text-[15px] font-bold text-gray-900">{selectedGroup.displayStores}<span className="text-[10px] text-muted">개</span></p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-[9px] text-muted">점포당 매출</p>
              <p className="text-[15px] font-bold text-gray-900">
                {selectedGroup.perStoreSales > 0 ? Math.round(selectedGroup.perStoreSales / 10000).toLocaleString() : "-"}
                <span className="text-[10px] text-muted">만</span>
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-[9px] text-muted">개업/폐업</p>
              <p className="text-[15px] font-bold text-gray-900">
                <span className="text-emerald-600">{selectedGroup.displayOpen}</span>
                <span className="text-muted">/</span>
                <span className="text-red-500">{selectedGroup.displayClose}</span>
              </p>
            </div>
          </div>

          {/* 임대 경제성 — 추천 근거의 결정변수 */}
          {(() => {
            const rent1f = (rent?.["1층_평"] as number) ?? 0;
            if (rent1f <= 0 || selectedGroup.perStoreSales <= 0) return null;
            const econ = calcRentEconomy(selectedGroup.key, rent1f, selectedGroup.perStoreSales);
            const eco = getCategoryEconomics(selectedGroup.key);
            const appropriateRentMan = Math.round(econ.actualSalesMan * eco.rent_ratio);
            const burdenPct = Math.round(econ.rentBurden * 100);
            const tone = econ.rentBurden >= RENT_BURDEN_MAX ? "red"
              : econ.rentBurden >= RENT_BURDEN_WARN ? "amber"
              : econ.rentBurden >= 1.0 ? "stone" : "emerald";
            const palette = {
              emerald: { bg: "#ECFDF5", text: "#047857", label: "적정" },
              stone: { bg: "#F1F5F9", text: "#475569", label: "균형" },
              amber: { bg: "#FFFBEB", text: "#B45309", label: "주의" },
              red: { bg: "#FEF2F2", text: "#B91C1C", label: "부담" },
            }[tone];
            return (
              <div className="rounded-xl border border-gray-100 px-3 py-3" style={{ background: palette.bg }}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold" style={{ color: palette.text }}>
                    임대 경제성 — {palette.label} (부담 {burdenPct}%)
                  </p>
                  <p className="text-[9px] text-muted">평당 {rent1f}만 × {eco.avg_pyeong}평</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] text-muted">예상 월세</p>
                    <p className="text-[13px] font-bold" style={{ color: palette.text }}>
                      {econ.monthlyRentMan.toLocaleString()}<span className="text-[9px] font-medium">만</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted">적정 월세 <span className="text-[8px]">(매출 × {Math.round(eco.rent_ratio * 100)}%)</span></p>
                    <p className="text-[13px] font-bold text-gray-900">
                      {appropriateRentMan.toLocaleString()}<span className="text-[9px] font-medium">만</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted">실제 매출</p>
                    <p className="text-[13px] font-bold text-gray-900">
                      {econ.actualSalesMan.toLocaleString()}<span className="text-[9px] font-medium">만</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[9px] text-muted">{eco.source}</p>
              </div>
            );
          })()}

          {(strengths.length > 0 || weaknesses.length > 0) && (
            <div className="space-y-2">
              {strengths.length > 0 && (
                <div className="rounded-xl bg-emerald-50 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold text-emerald-700">강점</p>
                  <p className="text-[12px] text-emerald-900">
                    {strengths.map((s) => `${s.axis} ${s.value}점`).join(" · ")}
                  </p>
                </div>
              )}
              {weaknesses.length > 0 && (
                <div className="rounded-xl bg-red-50 px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold text-red-600">주의</p>
                  <p className="text-[12px] text-red-900">
                    {weaknesses.map((w) => `${w.axis} ${w.value}점`).join(" · ")}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </>
      )}
    </div>
  );
}

import type { SubcategoryRec } from "@/lib/category-economics";

interface StoresNearResponse {
  source: "kakao" | "sbiz";
  total: number;
  summary: {
    roads: { name: string; total: number; byParent: Record<string, number> }[];
    byParent: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

function RoadLineDistribution({ radius }: { radius: number }) {
  const lat = useAnalysisStore((s) => s.clickedLat);
  const lng = useAnalysisStore((s) => s.clickedLng);
  const [data, setData] = useState<StoresNearResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 도로명 분포는 200m 반경 (건물 라인 단위) 고정
  const lineRadius = Math.min(radius, 200);

  useEffect(() => {
    if (!lat || !lng) return;
    setLoading(true);
    fetch(`/api/stores-near?lat=${lat}&lng=${lng}&radius=${lineRadius}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: StoresNearResponse | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [lat, lng, lineRadius]);

  if (!lat || !lng) return null;
  if (loading) return <p className="text-[11px] text-muted">도로 라인 분포 로딩...</p>;
  if (!data || data.summary.roads.length === 0) return null;

  const sourceLabel = data.source === "sbiz" ? "정식 상가 데이터" : "실시간 (Kakao)";

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-900">📍 도로 라인별 점포 분포 (반경 {lineRadius}m)</p>
        <span className="text-[9px] text-muted">출처: {sourceLabel} · {data.total}개</span>
      </div>
      <div className="space-y-1.5">
        {data.summary.roads.slice(0, 6).map((r) => {
          const detail = Object.entries(r.byParent)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}×${v}`)
            .join(" · ");
          return (
            <div key={r.name} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-gray-800 flex-shrink-0">{r.name}</span>
              <span className="text-[10px] text-muted">{detail}</span>
              <span className="ml-auto text-[10px] font-bold text-gray-900">{r.total}개</span>
            </div>
          );
        })}
      </div>
      {data.source === "kakao" && (
        <p className="mt-2 text-[9px] text-muted">
          ※ Kakao 카테고리는 음식점·카페·병원·학원·숙박만 잡힙니다. 의류·신발 등 일반 소매는 정식 상가 데이터(stores_geo) 임포트 후 자동 표시됩니다.
        </p>
      )}
    </div>
  );
}

function SubcategoryView({ ranks, rent1f, radius }: { ranks: SubcategoryRec[]; rent1f: number; radius: number }) {
  if (rent1f <= 0) {
    return <p className="text-[11px] text-muted">임대료 데이터가 없어 세부업종 분석을 할 수 없습니다.</p>;
  }
  if (ranks.length === 0) {
    return <p className="text-[11px] text-muted">세부업종 매출 데이터가 부족합니다.</p>;
  }
  const tonePalette: Record<SubcategoryRec["verdict"], { bg: string; text: string; dot: string }> = {
    "적정": { bg: "#ECFDF5", text: "#047857", dot: "#10B981" },
    "주의": { bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B" },
    "부담": { bg: "#FEF2F2", text: "#B91C1C", dot: "#EF4444" },
    "데이터부족": { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted">
        반경 {radius}m · 1층 평당 {rent1f}만원 · 임대료 감당 매출 임계치 비교
      </p>
      <div className="rounded-lg bg-blue-50 px-3 py-2">
        <p className="text-[10px] font-semibold text-blue-900">
          임계 매출 = (평당 시세 × 평수) ÷ 매출 대비 임대비율
        </p>
        <p className="text-[9px] text-blue-700 mt-0.5">
          이 권역에서 흑자가 나려면 점포당 매출이 임계치 이상이어야 합니다. 임대료가 비싸면 객단가 큰 업종만 살아남습니다.
        </p>
      </div>
      {ranks.map((r) => {
        const palette = tonePalette[r.verdict];
        const ratio = r.thresholdSalesMan > 0 ? r.perStoreSalesMan / r.thresholdSalesMan : 0;
        return (
          <div key={r.svcNm} className="rounded-lg border border-gray-100 px-3 py-2.5" style={{ background: palette.bg }}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: palette.dot }} />
              <span className="text-[12px] font-bold" style={{ color: palette.text }}>{r.svcNm}</span>
              <span className="text-[9px] text-muted">({r.parent})</span>
              <span className="ml-auto text-[10px] font-semibold" style={{ color: palette.text }}>
                {r.verdict} <span className="ml-1 text-[9px]">부담 {Math.round(r.rentBurden * 100)}%</span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
              <div>
                <p className="text-[8px] text-muted">점포</p>
                <p className="text-[11px] font-bold text-gray-800">{r.storeCount}개</p>
              </div>
              <div>
                <p className="text-[8px] text-muted">월세 ({r.pyeong}평)</p>
                <p className="text-[11px] font-bold text-gray-800">{r.monthlyRentMan.toLocaleString()}만</p>
              </div>
              <div>
                <p className="text-[8px] text-muted">임계 매출</p>
                <p className="text-[11px] font-bold text-gray-800">{r.thresholdSalesMan.toLocaleString()}만</p>
              </div>
              <div>
                <p className="text-[8px] text-muted">실제 매출</p>
                <p className="text-[11px] font-bold" style={{ color: palette.text }}>
                  {r.perStoreSalesMan.toLocaleString()}만
                </p>
              </div>
            </div>
            {r.thresholdSalesMan > 0 && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, ratio * 100)}%`,
                    background: palette.dot,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
