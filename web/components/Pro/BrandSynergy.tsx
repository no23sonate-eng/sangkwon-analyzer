"use client";

import { useState, useMemo } from "react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { useAnalysisStore } from "@/store/analysisStore";

/* ── 대분류 → 세부 업종 매핑 ── */
const CATEGORY_GROUPS: Record<string, { label: string; icon: string; subs: string[]; targetAge: string[] }> = {
  외식: {
    label: "외식",
    icon: "🍽️",
    subs: ["한식음식점", "중식음식점", "일식음식점", "양식음식점", "분식전문점", "패스트푸드점", "치킨전문점", "음식점"],
    targetAge: ["30대", "40대", "50대"],
  },
  "카페/디저트": {
    label: "카페/디저트",
    icon: "☕",
    subs: ["커피-음료", "커피전문점", "제과점", "카페"],
    targetAge: ["20대", "30대"],
  },
  주류: {
    label: "주류",
    icon: "🍺",
    subs: ["호프-간이주점", "주점"],
    targetAge: ["20대", "30대", "40대"],
  },
  "소매/유통": {
    label: "소매/유통",
    icon: "🛒",
    subs: ["편의점", "슈퍼마켓", "의류", "일반의류", "화장품", "가전제품", "핸드폰", "서적", "문구", "신발", "가방", "시계및귀금속", "안경"],
    targetAge: ["20대", "30대", "40대"],
  },
  "뷰티/건강": {
    label: "뷰티/건강",
    icon: "💇",
    subs: ["미용실", "피부관리실", "네일숍", "일반의원", "치과의원", "한의원", "의원", "약국"],
    targetAge: ["30대", "40대", "50대"],
  },
  교육: {
    label: "교육",
    icon: "📚",
    subs: ["외국어학원", "일반교습학원", "예술학원", "컴퓨터학원", "학원"],
    targetAge: ["10대", "20대", "30대"],
  },
  "생활서비스": {
    label: "생활서비스",
    icon: "🔧",
    subs: ["세탁소", "부동산중개업", "인테리어", "자동차수리"],
    targetAge: ["30대", "40대", "50대"],
  },
  "스포츠/여가": {
    label: "스포츠/여가",
    icon: "🏋️",
    subs: ["스포츠클럽", "헬스클럽", "골프연습장", "PC방", "노래방", "당구장", "볼링장"],
    targetAge: ["20대", "30대", "40대"],
  },
};

/** 세부 업종명이 어느 대분류에 속하는지 찾기 */
function findGroup(subName: string): string | null {
  for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
    if (group.subs.some((s) => subName.includes(s) || s.includes(subName))) return key;
  }
  return null;
}

interface GroupData {
  key: string;
  label: string;
  icon: string;
  storeCount: number;
  supplyRatio: number;      // 전체 점포 대비 비율
  demandScore: number;      // 수요 점수 (유동인구 연령 매칭)
  gapScore: number;         // 수요-공급 갭 (높을수록 기회)
  totalSales: number;
  perStoreSales: number;
  openCount: number;
  closeCount: number;
  franchise: number;
  survivalRate: number;
  rentBurden: number;       // 임대 부담률 (0~1)
  franchiseRatio: number;
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

  // 대분류별 집계
  const groups = useMemo(() => {
    if (!store || !ft) return [];

    const totalStores = store.total ?? 1;
    const bySub = store.by_subcategory ?? {};
    const byService = sales?.by_service ?? [];
    const perStore = sales?.per_store ?? [];
    const scList = scSummary?.by_service ?? [];
    const rent1f = (rent?.["1층_평"] as number) ?? 0;

    // 유동인구 연령 분포
    const byAge = ft.by_age ?? {};
    const ageTotalFt = Object.values(byAge).reduce((s, v) => s + v, 0) || 1;

    const result: GroupData[] = [];

    for (const [key, group] of Object.entries(CATEGORY_GROUPS)) {
      let storeCount = 0;
      let totalSalesAmt = 0;
      let totalPerStoreSales = 0;
      let perStoreCount = 0;
      let openCount = 0;
      let closeCount = 0;
      let franchise = 0;

      // 해당 대분류에 속하는 세부 업종 데이터 합산
      for (const [subName, info] of Object.entries(bySub)) {
        if (group.subs.some((s) => subName.includes(s) || s.includes(subName))) {
          storeCount += info.count;
        }
      }
      for (const s of byService) {
        if (group.subs.some((sub) => s.업종.includes(sub) || sub.includes(s.업종))) {
          totalSalesAmt += s.매출액;
        }
      }
      for (const p of perStore) {
        if (group.subs.some((sub) => p.업종.includes(sub) || sub.includes(p.업종))) {
          totalPerStoreSales += p.점포당_매출;
          perStoreCount++;
        }
      }
      for (const sc of scList) {
        const name = (sc as Record<string, unknown>)["업종"] as string;
        if (name && group.subs.some((sub) => name.includes(sub) || sub.includes(name))) {
          openCount += ((sc as Record<string, unknown>)["개업수"] as number) ?? 0;
          closeCount += ((sc as Record<string, unknown>)["폐업수"] as number) ?? 0;
          franchise += ((sc as Record<string, unknown>)["프랜차이즈"] as number) ?? 0;
        }
      }

      // 수요 점수: 타깃 연령 유동인구 비율
      const targetFt = Object.entries(byAge)
        .filter(([k]) => group.targetAge.some((a) => k.includes(a)))
        .reduce((s, [, v]) => s + v, 0);
      const demandScore = Math.round((targetFt / ageTotalFt) * 100);

      // 공급 비율
      const supplyRatio = Math.round((storeCount / totalStores) * 100);

      // 수요-공급 갭 (수요 높고 공급 낮을수록 점수 높음)
      const gapScore = Math.max(0, Math.min(100, Math.round(demandScore * 1.2 - supplyRatio * 2 + 30)));

      const avgPerStoreSales = perStoreCount > 0 ? totalPerStoreSales / perStoreCount : 0;
      const totalOC = openCount + closeCount;
      const survivalRate = totalOC > 0 ? openCount / totalOC : 0.5;

      // 임대 부담률
      const monthlyRent = rent1f > 0 ? rent1f * 30 : 0;
      const rentBurden = avgPerStoreSales > 0 && monthlyRent > 0
        ? monthlyRent / (avgPerStoreSales / 10000)
        : 0.3;

      const franchiseRatio = storeCount > 0 ? franchise / storeCount : 0;

      result.push({
        key,
        label: group.label,
        icon: group.icon,
        storeCount,
        supplyRatio,
        demandScore,
        gapScore,
        totalSales: totalSalesAmt,
        perStoreSales: avgPerStoreSales,
        openCount,
        closeCount,
        franchise,
        survivalRate,
        rentBurden,
        franchiseRatio,
      });
    }

    // 수요-공급 갭 높은 순 정렬
    result.sort((a, b) => b.gapScore - a.gapScore);
    return result;
  }, [store, ft, sales, scSummary, rent]);

  if (!store || !ft) return <p className="text-[12px] text-muted">데이터 로딩 중...</p>;

  const selectedGroup = groups.find((g) => g.key === selected);

  // 선택된 카테고리의 레이더 데이터
  const radarData = selectedGroup ? [
    { axis: "수요", value: selectedGroup.demandScore },
    { axis: "공급 여유", value: Math.max(5, 100 - selectedGroup.supplyRatio * 3) },
    { axis: "매출력", value: (() => {
      const allAvg = groups.reduce((s, g) => s + g.perStoreSales, 0) / (groups.filter((g) => g.perStoreSales > 0).length || 1);
      return allAvg > 0 ? Math.min(100, Math.max(5, Math.round((selectedGroup.perStoreSales / allAvg) * 50))) : 30;
    })() },
    { axis: "생존율", value: Math.round(selectedGroup.survivalRate * 100) },
    { axis: "임대 적정", value: Math.min(100, Math.max(5, Math.round((1 - Math.min(selectedGroup.rentBurden, 1)) * 100))) },
    { axis: "진입 용이", value: Math.min(100, Math.max(5, Math.round((1 - selectedGroup.franchiseRatio) * 100))) },
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
        <label className="mb-1.5 block text-[10px] font-medium text-muted">업종 카테고리</label>
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
          <p className="text-[10px] font-medium text-muted">수요 대비 공급 부족 순</p>
          {groups.map((g) => (
            <div key={g.key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-[14px]">{g.icon}</span>
              <span className="flex-1 text-[11px] font-semibold text-gray-800">{g.label}</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-16 rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.gapScore}%`,
                      background: g.gapScore >= 60 ? "#10B981" : g.gapScore >= 40 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <span className={`text-[10px] font-bold ${
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
          {/* 종합 점수 */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: totalScore >= 60 ? "#ECFDF5" : totalScore >= 45 ? "#FFF7ED" : "#FEF2F2" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: totalScore >= 60 ? "#10B981" : totalScore >= 45 ? "#F59E0B" : "#EF4444" }}>
              <span className="text-[18px] font-black text-white">{totalScore}</span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-gray-900">{selectedGroup.icon} {selectedGroup.label}</p>
              <p className="text-[11px] text-muted">
                수요 {selectedGroup.demandScore}% · 공급 {selectedGroup.supplyRatio}%
                {selectedGroup.gapScore >= 60 ? " — 진입 기회가 높습니다" : selectedGroup.gapScore >= 40 ? " — 선별적 진입 가능" : " — 공급 과잉 주의"}
              </p>
            </div>
          </div>

          {/* 레이더 차트 */}
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

          {/* 핵심 수치 */}
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

          {/* 강점 / 약점 */}
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
