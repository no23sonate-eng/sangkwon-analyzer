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
    subs: ["한식음식점", "중식음식점", "일식음식점", "양식음식점", "분식전문점", "패스트푸드점", "치킨전문점", "제과점"],
  },
  "카페/주류": {
    label: "카페/주류",
    icon: "☕",
    subs: ["커피-음료", "호프-간이주점"],
  },
  "소매/유통": {
    label: "소매",
    icon: "🛒",
    subs: ["편의점", "슈퍼마켓", "일반의류", "한복점", "유아의류", "화장품", "신발", "가방", "시계및귀금속", "안경", "서적", "문구", "가전제품", "핸드폰", "운동/경기용품", "예술품", "의약품", "육류판매", "중고가구", "가구", "철물점"],
  },
  "뷰티/건강": {
    label: "뷰티/의료",
    icon: "💇",
    subs: ["미용실", "피부관리실", "네일숍", "일반의원", "치과의원", "한의원", "동물병원", "약국"],
  },
  교육: {
    label: "교육",
    icon: "📚",
    subs: ["외국어학원", "일반교습학원", "예술학원", "컴퓨터학원", "스포츠 강습"],
  },
  "생활서비스": {
    label: "생활서비스",
    icon: "🔧",
    subs: ["세탁소", "부동산중개업", "변호사사무소", "회계사사무소", "세무사사무소", "인테리어", "전자상거래업", "자동차수리", "철물점"],
  },
  "여가/오락": {
    label: "여가",
    icon: "🏋️",
    subs: ["스포츠클럽", "헬스클럽", "골프연습장", "PC방", "노래방", "당구장", "볼링장", "게스트하우스"],
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

      const monthlyRentWon = rent1f > 0 ? rent1f * 30 * 10000 : 0; // 30평 기준 월세 (원)
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

      // 기회 점수: 수요가 높고 공급여유가 클수록 높음
      // 단순 평균 — 임의 가중치 없음
      r.gapScore = Math.max(0, Math.min(100, Math.round((r.demandScore + supplySlack) / 2)));
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
            const isTop = g.gapScore >= 60;
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
                      background: g.gapScore >= 60 ? "#10B981" : g.gapScore >= 40 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <span className={`text-[10px] font-bold w-10 text-right ${
                  g.gapScore >= 60 ? "text-emerald-600" : g.gapScore >= 40 ? "text-amber-600" : "text-red-500"
                }`}>
                  {g.gapScore >= 60 ? "기회" : g.gapScore >= 40 ? "보통" : "과밀"}
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
                수요 {selectedGroup.demandScore} · 공급비율 {selectedGroup.supplyRatio}%
                {selectedGroup.gapScore >= 60 ? " — 진입 기회가 높습니다" : selectedGroup.gapScore >= 40 ? " — 선별적 진입 가능" : " — 공급 과잉 주의"}
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
