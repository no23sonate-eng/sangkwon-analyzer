"use client";

import { useState, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useAnalysisStore } from "@/store/analysisStore";

/* ── 대분류 → 세부 업종 정확 매칭 ──
   실제 서울시 상권 데이터의 업종명과 정확히 일치해야 함.
   부분 문자열 매칭은 오매칭 위험이 있어서 정확 매칭만 사용.
*/
/* 업종별 적정 임대비율 (매출 대비 월세 %)
   한국 상업 부동산 업계 기준 중간값 적용 */
const RENT_RATIO: Record<string, number> = {
  "외식": 0.12,        // 10~15% — 재료비 30-35%, 인건비 25-30%
  "카페/주류": 0.15,   // 15% — 원가율 낮아 임대비중 높아도 가능
  "소매/유통": 0.07,   // 5~10% — 유통마진 얇음
  "뷰티/건강": 0.10,   // 8~12% — 인건비 높아 임대 여력 제한
  "교육": 0.10,        // 8~12% — 강사 인건비 40-50%
  "생활서비스": 0.06,  // 5~8% — 매출 변동 크고 보수적
  "여가/오락": 0.12,   // 10~15% — 면적 넓어 총액 큼
};

const CATEGORY_GROUPS: Record<string, { label: string; icon: string; subs: string[] }> = {
  외식: {
    label: "외식",
    icon: "🍽️",
    subs: ["한식음식점", "중식음식점", "일식음식점", "양식음식점", "분식전문점", "패스트푸드점", "치킨전문점", "제과점", "반찬가게"],
  },
  "카페/주류": {
    label: "카페/주류",
    icon: "☕",
    subs: ["커피-음료", "호프-간이주점", "주류도매"],
  },
  "소매/유통": {
    label: "소매",
    icon: "🛒",
    subs: ["편의점", "슈퍼마켓", "일반의류", "한복점", "유아의류", "화장품", "신발", "가방", "시계및귀금속", "안경", "서적", "문구", "가전제품", "핸드폰", "운동/경기용품", "예술품", "의약품", "육류판매", "중고가구", "가구", "철물점", "청과상", "수산물판매", "미곡판매", "조명용품", "섬유제품", "완구", "악기", "화초", "애완동물", "미용재료", "컴퓨터및주변장치판매", "의류임대", "가정용품임대", "재생용품 판매점", "비디오/서적임대", "중고차판매", "자전거 및 기타운송장비", "모터사이클및부품"],
  },
  "뷰티/건강": {
    label: "뷰티/의료",
    icon: "💇",
    subs: ["미용실", "피부관리실", "네일숍", "일반의원", "치과의원", "한의원", "동물병원", "의료기기"],
  },
  교육: {
    label: "교육",
    icon: "📚",
    subs: ["외국어학원", "일반교습학원", "예술학원", "컴퓨터학원", "스포츠 강습", "독서실"],
  },
  "생활서비스": {
    label: "생활서비스",
    icon: "🔧",
    subs: ["세탁소", "부동산중개업", "변호사사무소", "회계사사무소", "세무사사무소", "인테리어", "전자상거래업", "자동차수리", "사진관", "여행사", "통번역서비스", "법무사사무소", "변리사사무소", "기타법무서비스", "건축물청소", "자동차미용", "자동차부품", "모터사이클수리", "가전제품수리", "통신기기수리", "주유소", "녹음실"],
  },
  "여가/오락": {
    label: "여가",
    icon: "🏋️",
    subs: ["스포츠클럽", "골프연습장", "PC방", "노래방", "당구장", "볼링장", "게스트하우스", "여관", "고시원", "DVD방", "전자게임장", "기타오락장", "복권방"],
  },
};

interface GroupData {
  key: string;
  label: string;
  icon: string;
  storeCount: number;
  supplyRatio: number;
  demandScore: number;
  gapScore: number;
  totalSales: number;
  perStoreSales: number;
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
  const ft = analysisData?.ft_summary;
  const store = analysisData?.store_summary;
  const sales = analysisData?.sales_summary;
  const rent = analysisData?.rent_info as Record<string, unknown> | undefined;
  const scSummary = storeCountData?.summary ?? analysisData?.sc_summary;
  const pop = analysisData?.pop_summary;

  const [selected, setSelected] = useState<string | null>(null);

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

    // 업종별 평균 면적(평) 추정
    const AVG_PYEONG: Record<string, number> = {
      "외식": 20, "카페/주류": 15, "소매/유통": 25,
      "뷰티/건강": 15, "교육": 25, "생활서비스": 10, "여가/오락": 40,
    };

    let categorizedStores = 0;
    const result: GroupData[] = [];

    for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
      const subsSet = new Set(group.subs);

      let storeCount = 0;
      let totalSalesAmt = 0;
      let totalPerStoreSales = 0;
      let perStoreCount = 0;
      let openCount = 0;
      let closeCount = 0;
      let franchise = 0;

      for (const [subName, info] of Object.entries(bySub)) {
        if (subsSet.has(subName)) storeCount += info.count;
      }
      for (const s of byService) {
        if (subsSet.has(s.업종)) totalSalesAmt += s.매출액;
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

      const avgPyeong = AVG_PYEONG[key] ?? 20;
      const monthlyRentWon = rent1f > 0 ? rent1f * avgPyeong * 10000 : 0; // 업종별 면적 기준 월세 (원)
      const rentRatio = RENT_RATIO[key] ?? 0.10;
      // rentBurden: 실제 월세 / 적정 월세 (1이면 적정, 1초과면 부담)
      const appropriateRent = avgPerStoreSales * rentRatio;
      const rentBurden = appropriateRent > 0 && monthlyRentWon > 0
        ? monthlyRentWon / appropriateRent
        : 1.0;

      const franchiseRatio = storeCount > 0 ? franchise / storeCount : 0;

      // 수요: 1인당 소비액 = 카테고리 매출 / (유동인구+거주인구)
      const salesPerPerson = potentialConsumers > 0 ? totalSalesAmt / potentialConsumers : 0;
      // 공급 밀도: 잠재소비자 만명당 점포 수
      const density = potentialConsumers > 0 ? (storeCount / potentialConsumers) * 10000 : 0;

      result.push({
        key,
        label: group.label,
        icon: group.icon,
        storeCount,
        supplyRatio: 0,
        demandScore: salesPerPerson, // 임시: 원시값, 아래서 정규화
        gapScore: 0,
        totalSales: totalSalesAmt,
        perStoreSales: avgPerStoreSales,
        openCount,
        closeCount,
        franchise,
        survivalRate,
        rentBurden,
        franchiseRatio,
        hasData: storeCount > 0 || totalSalesAmt > 0,
      });
    }

    // ── 2차: 상대 정규화 (카테고리 간 비교) ──
    const valid = result.filter((r) => r.hasData);
    if (valid.length === 0) return [];

    const base = categorizedStores > 0 ? categorizedStores : 1;

    // 수요: 1인당 소비액 → 카테고리 중 최고값 대비 비율 (0~100)
    const maxDemand = Math.max(...valid.map((r) => r.demandScore), 1);
    // 공급밀도: 잠재소비자 만명당 점포수 → 최고 대비 비율 (높을수록 과밀)
    const densities = valid.map((r) => potentialConsumers > 0 ? (r.storeCount / potentialConsumers) * 10000 : 0);
    const maxDensity = Math.max(...densities, 1);

    for (let i = 0; i < valid.length; i++) {
      const r = valid[i];
      // 수요: 최고 대비 비율 (0~100)
      r.demandScore = Math.round((r.demandScore / maxDemand) * 100);
      // 공급 비율
      r.supplyRatio = Math.round((r.storeCount / base) * 100);
      // 공급 여유: 밀도가 낮을수록 높음 (0~100)
      const densityRatio = densities[i] / maxDensity;
      const supplySlack = Math.round((1 - densityRatio) * 100);

      // 매출 잠재력
      const consumersPerStore = r.storeCount > 0 ? potentialConsumers / r.storeCount : 0;
      const allCPS = valid.filter((g) => g.storeCount > 0).map((g) => potentialConsumers / g.storeCount);
      const maxCPS = Math.max(...allCPS, 1);
      const revPotential = Math.round((consumersPerStore / maxCPS) * 100);

      // 개폐업률
      const oc = r.openCount + r.closeCount;
      const openRate = oc > 0 ? Math.round((r.openCount / oc) * 100) : 50;

      // 임대 적정
      const rentRatio = RENT_RATIO[r.key] ?? 0.10;
      const appropriateRent = r.perStoreSales * rentRatio;
      const avgPy = AVG_PYEONG[r.key] ?? 20;
      const actualRentWon = (rent?.["1층_평"] as number ?? 0) * avgPy * 10000;
      const rentFit = appropriateRent > 0 && actualRentWon > 0
        ? Math.max(5, Math.min(100, Math.round((appropriateRent / actualRentWon) * 50)))
        : 50;

      // 진입 용이
      const entryEase = Math.round((1 - r.franchiseRatio) * 100);

      // 기회 점수: 레이더 6축 전체 평균
      r.gapScore = Math.max(0, Math.min(100, Math.round(
        (r.demandScore + supplySlack + revPotential + openRate + rentFit + entryEase) / 6
      )));
    }

    return valid.sort((a, b) => b.gapScore - a.gapScore);
  }, [store, ft, sales, scSummary, rent, pop]);

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
  const radarData = selectedGroup ? [
    // 수요: (유동+거주)인구 1인당 소비액 (카테고리 중 최고 대비 %)
    { axis: "수요", value: selectedGroup.demandScore,
      desc: `1인당 ${Math.round(selectedGroup.totalSales / _consumers).toLocaleString()}원` },
    // 공급 여유: 잠재소비자 만명당 점포수 — 적을수록 여유
    { axis: "공급 여유", value: (() => {
      const densities = groups.map((g) => _consumers > 0 ? (g.storeCount / _consumers) * 10000 : 0);
      const maxD = Math.max(...densities, 1);
      const myD = _consumers > 0 ? (selectedGroup.storeCount / _consumers) * 10000 : 0;
      return Math.max(5, Math.round((1 - myD / maxD) * 100));
    })(),
      desc: `만명당 ${(_consumers > 0 ? (selectedGroup.storeCount / _consumers) * 10000 : 0).toFixed(1)}개` },
    // 매출 잠재력: 잠재소비자 대비 현재 점포당 매출이 얼마나 더 나올 수 있는지
    // = (잠재소비자 / 점포수) × (1인당소비액 대비) — 소비자 대비 점포가 적고 수요가 높으면 높음
    { axis: "매출 잠재력", value: (() => {
      if (selectedGroup.storeCount === 0) return 5;
      // 점포당 잠재소비자 수 (많을수록 매출 가능성 높음)
      const consumersPerStore = _consumers / selectedGroup.storeCount;
      const allCPS = groups.filter((g) => g.storeCount > 0).map((g) => _consumers / g.storeCount);
      const maxCPS = Math.max(...allCPS, 1);
      return Math.max(5, Math.min(100, Math.round((consumersPerStore / maxCPS) * 100)));
    })(),
      desc: `점포당 소비자 ${selectedGroup.storeCount > 0 ? Math.round(_consumers / selectedGroup.storeCount).toLocaleString() : "-"}명` },
    // 개폐업률: 해당 카테고리의 개업/(개업+폐업) — 높을수록 건전
    { axis: "개폐업률", value: (() => {
      const oc = selectedGroup.openCount + selectedGroup.closeCount;
      return oc > 0 ? Math.round((selectedGroup.openCount / oc) * 100) : 50;
    })(),
      desc: `개업${selectedGroup.openCount} 폐업${selectedGroup.closeCount}` },
    // 임대 적정: 업종별 적정비율로 산출한 적정월세 vs 실제월세
    { axis: "임대 적정", value: (() => {
      const ratio = RENT_RATIO[selectedGroup.key] ?? 0.10;
      const expectedRent = selectedGroup.perStoreSales * ratio; // 적정 월세 (원)
      const rent1f = (rent?.["1층_평"] as number) ?? 0;
      const actualRent = rent1f > 0 ? rent1f * 30 * 10000 : 0; // 30평 기준 실제 월세 (원)
      if (actualRent <= 0 || expectedRent <= 0) return 50;
      // 적정/실제 비율: 1이상이면 여유, 1미만이면 부담
      return Math.max(5, Math.min(100, Math.round((expectedRent / actualRent) * 50)));
    })(),
      desc: (() => {
        const ratio = RENT_RATIO[selectedGroup.key] ?? 0.10;
        const expectedRent = Math.round(selectedGroup.perStoreSales * ratio / 10000);
        const rent1f = (rent?.["1층_평"] as number) ?? 0;
        const actualRent = rent1f * 30;
        return `적정 ${expectedRent}만 vs 시세 ${actualRent}만`;
      })() },
    // 진입 용이: 프랜차이즈 비율의 역수
    { axis: "진입 용이", value: Math.min(100, Math.max(5, Math.round((1 - selectedGroup.franchiseRatio) * 100))),
      desc: `프랜차이즈 ${Math.round(selectedGroup.franchiseRatio * 100)}%` },
  ] : null;

  const totalScore = radarData
    ? Math.round(radarData.reduce((s, d) => s + d.value, 0) / radarData.length)
    : 0;

  const strengths = radarData?.filter((d) => d.value >= 65).sort((a, b) => b.value - a.value) ?? [];
  const weaknesses = radarData?.filter((d) => d.value < 45).sort((a, b) => a.value - b.value) ?? [];

  return (
    <div className="space-y-4">
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
                  {g.storeCount}개
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 미선택: 수요-공급 갭 요약 */}
      {!selected && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted">1인당 소비액 대비 점포밀도 기준</p>
          {groups.map((g) => (
            <div key={g.key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-[14px]">{g.icon}</span>
              <span className="flex-1 text-[11px] font-semibold text-gray-800">{g.label}</span>
              <span className="text-[9px] text-muted">{g.storeCount}개 · 공급 {g.supplyRatio}%</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-14 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.gapScore}%`,
                      background: g.gapScore >= 55 ? "#10B981" : g.gapScore >= 40 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <span className={`text-[10px] font-bold w-10 text-right ${
                  g.gapScore >= 55 ? "text-emerald-600" : g.gapScore >= 40 ? "text-amber-600" : "text-red-500"
                }`}>
                  {g.gapScore >= 55 ? "기회" : g.gapScore >= 40 ? "보통" : "과밀"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 선택됨: 상세 분석 */}
      {selectedGroup && radarData && (
        <>
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: totalScore >= 60 ? "#ECFDF5" : totalScore >= 45 ? "#FFF7ED" : "#FEF2F2" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: totalScore >= 60 ? "#10B981" : totalScore >= 45 ? "#F59E0B" : "#EF4444" }}>
              <span className="text-[18px] font-black text-white">{totalScore}</span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-900">{selectedGroup.icon} {selectedGroup.label}</p>
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
                stroke={totalScore >= 60 ? "#10B981" : totalScore >= 45 ? "#F59E0B" : "#EF4444"}
                fill={totalScore >= 60 ? "#10B981" : totalScore >= 45 ? "#F59E0B" : "#EF4444"}
                fillOpacity={0.12} strokeWidth={2}
                dot={{ r: 3, fill: totalScore >= 60 ? "#10B981" : totalScore >= 45 ? "#F59E0B" : "#EF4444", stroke: "#fff", strokeWidth: 2 }} />
            </RadarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-[9px] text-muted">점포 수</p>
              <p className="text-[15px] font-bold text-gray-900">{selectedGroup.storeCount}<span className="text-[10px] text-muted">개</span></p>
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
                <span className="text-emerald-600">{selectedGroup.openCount}</span>
                <span className="text-muted">/</span>
                <span className="text-red-500">{selectedGroup.closeCount}</span>
              </p>
            </div>
          </div>

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
    </div>
  );
}
