"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip,
} from "recharts";
import { useAnalysisStore } from "@/store/analysisStore";

/* ── 대분류 → 세부 업종 정확 매칭 ── */
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

/*
  ── 분석 철학 ──
  합성 점수(임의 가중치로 만든 수요지수, 공급지수 등)를 배제하고
  직접 관측 가능한 3가지 팩트만으로 판단한다.

  1. 점포당 월매출 — 카드결제 실데이터. 높으면 수요가 공급보다 큰 상태.
  2. 점포 밀도 — 유동인구 1만명당 해당 업종 점포 수. 경쟁 강도의 직접 지표.
  3. 순증감률 — (개업-폐업)/점포수. 시장이 성장 중인지 쇠퇴 중인지.

  기회 판정:
  - 점포당 매출 상위 + 밀도 하위 = 수요는 있는데 경쟁이 적음 → 기회
  - 점포당 매출 하위 + 밀도 상위 = 돈 안되는데 경쟁만 치열 → 과밀
  순위 기반(percentile rank)으로 비교하므로 임의 가중치가 없다.
*/

interface GroupData {
  key: string;
  label: string;
  icon: string;
  // ── 직접 관측치 (원시 데이터) ──
  storeCount: number;
  monthlySales: number;         // 업종 총 월매출 (원)
  perStoreSales: number;        // 점포당 월매출 (원)
  density: number;              // 유동인구 1만명당 점포 수
  openCount: number;
  closeCount: number;
  netGrowthRate: number;        // (개업-폐업)/점포수 (%)
  franchise: number;
  franchiseRatio: number;
  rentBurden: number;           // 월임대료 / 점포당매출 (%)
  // ── 순위 (1=가장 좋은 조건, N=가장 나쁜 조건) ──
  rankRevenue: number;          // 점포당매출 순위 (1=최고매출)
  rankDensity: number;          // 밀도 순위 (1=가장 낮은 밀도=경쟁 적음)
  rankGrowth: number;           // 순증감 순위 (1=가장 높은 성장)
  opportunityRank: number;      // 종합 순위 (3개 순위 평균)
  hasData: boolean;
}

function fmtWon(v: number): string {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return v.toLocaleString();
}

export default function BrandSynergy() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const storeCountData = useAnalysisStore((s) => s.storeCountData);
  const ft = analysisData?.ft_summary;
  const store = analysisData?.store_summary;
  const sales = analysisData?.sales_summary;
  const rent = analysisData?.rent_info as Record<string, unknown> | undefined;
  const scSummary = storeCountData?.summary ?? analysisData?.sc_summary;

  const [selected, setSelected] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!store || !ft) return [];

    const bySub = store.by_subcategory ?? {};
    const byService = sales?.by_service ?? [];
    const perStoreList = sales?.per_store ?? [];
    const scList = scSummary?.by_service ?? [];
    const rent1f = (rent?.["1층_평"] as number) ?? 0;
    const ageSum = Object.values(ft.by_age ?? {}).reduce((s: number, v: number) => s + (v as number), 0);
    const ftTotal = ((ft.total as number) ?? ageSum) || 1;

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
      for (const p of perStoreList) {
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

      const perStoreSales = perStoreCount > 0 ? totalPerStoreSales / perStoreCount : 0;
      const density = ftTotal > 0 ? (storeCount / ftTotal) * 10000 : 0;
      const netGrowthRate = storeCount > 0
        ? Math.round(((openCount - closeCount) / storeCount) * 1000) / 10
        : 0;
      const franchiseRatio = storeCount > 0 ? franchise / storeCount : 0;
      const monthlyRent = rent1f > 0 ? rent1f * 30 : 0; // 30평 기준
      const rentBurden = perStoreSales > 0 && monthlyRent > 0
        ? Math.round((monthlyRent * 10000 / perStoreSales) * 1000) / 10
        : 0;

      result.push({
        key, label: group.label, icon: group.icon,
        storeCount, monthlySales: totalSalesAmt, perStoreSales,
        density, openCount, closeCount, netGrowthRate,
        franchise, franchiseRatio, rentBurden,
        rankRevenue: 0, rankDensity: 0, rankGrowth: 0, opportunityRank: 0,
        hasData: storeCount > 0 || totalSalesAmt > 0,
      });
    }

    // ── 순위 산출 (데이터 있는 것만) ──
    const valid = result.filter((r) => r.hasData);
    const n = valid.length;
    if (n === 0) return [];

    // 점포당 매출: 높을수록 좋음 → 내림차순 정렬 → rank 1=최고
    const byRev = [...valid].sort((a, b) => b.perStoreSales - a.perStoreSales);
    byRev.forEach((g, i) => { g.rankRevenue = i + 1; });

    // 밀도: 낮을수록 좋음 → 오름차순 정렬 → rank 1=최저밀도
    const byDen = [...valid].sort((a, b) => a.density - b.density);
    byDen.forEach((g, i) => { g.rankDensity = i + 1; });

    // 순증감: 높을수록 좋음 → 내림차순 정렬 → rank 1=최고성장
    const byGrow = [...valid].sort((a, b) => b.netGrowthRate - a.netGrowthRate);
    byGrow.forEach((g, i) => { g.rankGrowth = i + 1; });

    // 종합: 3개 순위의 평균 (낮을수록 좋음)
    for (const g of valid) {
      g.opportunityRank = Math.round(((g.rankRevenue + g.rankDensity + g.rankGrowth) / 3) * 10) / 10;
    }

    return valid.sort((a, b) => a.opportunityRank - b.opportunityRank);
  }, [store, ft, sales, scSummary, rent]);

  if (!store || !ft) return <p className="text-[12px] text-muted">데이터 로딩 중...</p>;
  if (groups.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 py-8 text-center">
        <p className="text-[12px] text-muted">이 지역의 업종 데이터가 부족합니다</p>
      </div>
    );
  }

  const selectedGroup = groups.find((g) => g.key === selected);
  const n = groups.length;

  // 점포당매출 차트 데이터 (전 카테고리 비교)
  const revenueChartData = [...groups]
    .sort((a, b) => b.perStoreSales - a.perStoreSales)
    .map((g) => ({
      name: g.label,
      value: Math.round(g.perStoreSales / 10000),
      isSelected: g.key === selected,
    }));

  return (
    <div className="space-y-4">
      {/* 카테고리 선택 */}
      <div>
        <label className="mb-1.5 block text-[10px] font-medium text-muted">
          업종별 진입 기회 ({groups.length}개 · 종합순위 기준)
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {groups.map((g, idx) => {
            const isSelected = selected === g.key;
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
                {idx < 2 && !isSelected && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">{idx + 1}</span>
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

      {/* ── 미선택: 전 카테고리 비교표 ── */}
      {!selected && (
        <div className="space-y-3">
          {/* 순위표 */}
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-2 py-2 text-left font-medium">#</th>
                  <th className="px-2 py-2 text-left font-medium">업종</th>
                  <th className="px-2 py-2 text-right font-medium">점포당매출</th>
                  <th className="px-2 py-2 text-right font-medium">밀도</th>
                  <th className="px-2 py-2 text-right font-medium">증감</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, idx) => (
                  <tr
                    key={g.key}
                    onClick={() => setSelected(g.key)}
                    className={`border-t border-gray-50 cursor-pointer hover:bg-gray-50 ${idx < 2 ? "bg-emerald-50/40" : ""}`}
                  >
                    <td className="px-2 py-2 font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-2 font-semibold text-gray-900">{g.icon} {g.label}</td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-bold text-gray-900">{fmtWon(g.perStoreSales)}</span>
                      <span className={`ml-1 text-[8px] ${g.rankRevenue <= 2 ? "text-emerald-600" : g.rankRevenue >= n - 1 ? "text-red-500" : "text-gray-400"}`}>
                        {g.rankRevenue}위
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-bold text-gray-900">{g.density.toFixed(1)}</span>
                      <span className={`ml-1 text-[8px] ${g.rankDensity <= 2 ? "text-emerald-600" : g.rankDensity >= n - 1 ? "text-red-500" : "text-gray-400"}`}>
                        {g.rankDensity}위
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={`font-bold ${g.netGrowthRate > 0 ? "text-emerald-600" : g.netGrowthRate < 0 ? "text-red-500" : "text-gray-500"}`}>
                        {g.netGrowthRate > 0 ? "+" : ""}{g.netGrowthRate}%
                      </span>
                      <span className={`ml-1 text-[8px] ${g.rankGrowth <= 2 ? "text-emerald-600" : g.rankGrowth >= n - 1 ? "text-red-500" : "text-gray-400"}`}>
                        {g.rankGrowth}위
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-[9px] text-muted leading-relaxed">
              <strong>판단 기준:</strong> 점포당매출(수익성) + 밀도(경쟁도) + 순증감(시장추세) 3개 지표의 순위 평균으로 정렬.
              매출 높고 · 밀도 낮고 · 성장 중인 업종이 상위.
              모든 수치는 서울시 상권 카드결제·점포·유동인구 실데이터 기반.
            </p>
          </div>
        </div>
      )}

      {/* ── 선택됨: 상세 분석 ── */}
      {selectedGroup && (
        <>
          {/* 핵심 3지표 카드 */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-xl p-3 text-center ${selectedGroup.rankRevenue <= 2 ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50"}`}>
              <p className="text-[9px] text-muted">점포당 월매출</p>
              <p className="text-[16px] font-black text-gray-900">{fmtWon(selectedGroup.perStoreSales)}</p>
              <p className={`text-[10px] font-bold ${selectedGroup.rankRevenue <= 2 ? "text-emerald-600" : "text-gray-400"}`}>
                {n}개 중 {selectedGroup.rankRevenue}위
              </p>
            </div>
            <div className={`rounded-xl p-3 text-center ${selectedGroup.rankDensity <= 2 ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50"}`}>
              <p className="text-[9px] text-muted">경쟁 밀도</p>
              <p className="text-[16px] font-black text-gray-900">{selectedGroup.density.toFixed(1)}</p>
              <p className="text-[9px] text-muted">만명당 {selectedGroup.density.toFixed(1)}개</p>
              <p className={`text-[10px] font-bold ${selectedGroup.rankDensity <= 2 ? "text-emerald-600" : "text-gray-400"}`}>
                {n}개 중 {selectedGroup.rankDensity}위
              </p>
            </div>
            <div className={`rounded-xl p-3 text-center ${selectedGroup.rankGrowth <= 2 ? "bg-emerald-50 border border-emerald-100" : "bg-gray-50"}`}>
              <p className="text-[9px] text-muted">순증감률</p>
              <p className={`text-[16px] font-black ${selectedGroup.netGrowthRate > 0 ? "text-emerald-600" : selectedGroup.netGrowthRate < 0 ? "text-red-500" : "text-gray-900"}`}>
                {selectedGroup.netGrowthRate > 0 ? "+" : ""}{selectedGroup.netGrowthRate}%
              </p>
              <p className="text-[9px] text-muted">
                개업 {selectedGroup.openCount} / 폐업 {selectedGroup.closeCount}
              </p>
            </div>
          </div>

          {/* 점포당 매출 비교 차트 */}
          <div>
            <p className="mb-1.5 text-[10px] font-medium text-muted">점포당 월매출 비교 (만원)</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={revenueChartData} layout="vertical" margin={{ left: 50, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "#94A3B8" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#64748B" }} width={48} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any) => [`${Number(v).toLocaleString()}만원`, "점포당 매출"]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                  {revenueChartData.map((d, i) => (
                    <Cell key={i} fill={d.isSelected ? "#4F46E5" : "#E2E8F0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 부가 지표 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] text-muted">점포 수</p>
              <p className="text-[14px] font-bold text-gray-900">{selectedGroup.storeCount}개</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] text-muted">업종 총매출</p>
              <p className="text-[14px] font-bold text-gray-900">{fmtWon(selectedGroup.monthlySales)}</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] text-muted">프랜차이즈 비율</p>
              <p className="text-[14px] font-bold text-gray-900">{Math.round(selectedGroup.franchiseRatio * 100)}%</p>
              <p className="text-[9px] text-muted">{selectedGroup.franchise}개 / {selectedGroup.storeCount}개</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[9px] text-muted">임대료 부담률</p>
              <p className={`text-[14px] font-bold ${selectedGroup.rentBurden > 15 ? "text-red-500" : selectedGroup.rentBurden > 8 ? "text-amber-600" : "text-emerald-600"}`}>
                {selectedGroup.rentBurden > 0 ? `${selectedGroup.rentBurden}%` : "-"}
              </p>
              <p className="text-[9px] text-muted">30평 기준 월세/매출</p>
            </div>
          </div>

          {/* 종합 판단 */}
          {(() => {
            const signals: { text: string; positive: boolean }[] = [];
            if (selectedGroup.rankRevenue <= 2) signals.push({ text: `점포당 매출 ${selectedGroup.rankRevenue}위 — 수익성 검증됨`, positive: true });
            if (selectedGroup.rankRevenue >= n - 1) signals.push({ text: `점포당 매출 하위 — 업종 자체의 수익성이 낮음`, positive: false });
            if (selectedGroup.rankDensity <= 2) signals.push({ text: `밀도 ${selectedGroup.rankDensity}위 — 경쟁이 적은 편`, positive: true });
            if (selectedGroup.rankDensity >= n - 1) signals.push({ text: `밀도 최상위 — 이미 경쟁이 치열함`, positive: false });
            if (selectedGroup.netGrowthRate > 0) signals.push({ text: `개업이 폐업보다 많음 — 성장 시장`, positive: true });
            if (selectedGroup.netGrowthRate < -5) signals.push({ text: `폐업이 개업을 크게 초과 — 쇠퇴 추세`, positive: false });
            if (selectedGroup.rentBurden > 15) signals.push({ text: `임대료 부담률 ${selectedGroup.rentBurden}% — 수익 압박`, positive: false });
            if (selectedGroup.franchiseRatio > 0.5) signals.push({ text: `프랜차이즈 ${Math.round(selectedGroup.franchiseRatio * 100)}% — 개인 진입 장벽 높음`, positive: false });

            if (signals.length === 0) return null;
            const positives = signals.filter((s) => s.positive);
            const negatives = signals.filter((s) => !s.positive);
            return (
              <div className="space-y-2">
                {positives.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-semibold text-emerald-700">긍정 시그널</p>
                    {positives.map((s, i) => (
                      <p key={i} className="text-[11px] text-emerald-900">{s.text}</p>
                    ))}
                  </div>
                )}
                {negatives.length > 0 && (
                  <div className="rounded-xl bg-red-50 px-4 py-3">
                    <p className="mb-1 text-[10px] font-semibold text-red-600">주의 시그널</p>
                    {negatives.map((s, i) => (
                      <p key={i} className="text-[11px] text-red-900">{s.text}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
