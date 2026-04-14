"use client";

import { useState, useMemo } from "react";
import { Building2, TrendingUp, Calendar, AlertTriangle } from "lucide-react";
import { useAnalysisStore } from "@/store/analysisStore";

const INDUSTRY_CONFIG: Record<string, {
  label: string; rate: number;
  materialRatio: number; // 재료비/매출
  laborMin: number;      // 최소 인건비 (만원/월, 사장 포함)
  utilityBase: number;   // 기본 공과금 (만원/월)
  etcRatio: number;      // 기타비용/매출 (카드수수료, 소모품 등)
}> = {
  cafe:       { label: "카페",     rate: 0.03,  materialRatio: 0.30, laborMin: 350, utilityBase: 40, etcRatio: 0.05 },
  restaurant: { label: "음식점",   rate: 0.025, materialRatio: 0.35, laborMin: 400, utilityBase: 50, etcRatio: 0.05 },
  retail:     { label: "소매",     rate: 0.02,  materialRatio: 0.45, laborMin: 250, utilityBase: 30, etcRatio: 0.04 },
  service:    { label: "서비스업", rate: 0.015, materialRatio: 0.15, laborMin: 300, utilityBase: 35, etcRatio: 0.04 },
};

export default function RevenueSim() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const ft = analysisData?.ft_summary;
  const rent = analysisData?.rent_info as Record<string, unknown> | undefined;

  const [industry, setIndustry] = useState("cafe");
  const [area, setArea] = useState(33);
  const [unitPrice, setUnitPrice] = useState(15000);
  const [hours, setHours] = useState(10);
  const [staff, setStaff] = useState(1); // 추가 직원 수

  const totalDailyFt = ft ? Math.round(ft.total / 90) : 10000;
  const raw1f = rent ? (rent["1층_평"] as number) ?? 0 : 0;
  const rentPerPyeong = raw1f > 0 ? raw1f / 10 : 15; // 만원 (데이터 없으면 15만원 기본값)

  const result = useMemo(() => {
    const config = INDUSTRY_CONFIG[industry];
    const pyeong = area / 3.3;

    // 유동인구 기반 방문객 추정
    const hourRatio = hours / 18;
    const dailyVisitors = Math.round(totalDailyFt * hourRatio * config.rate);
    const monthlyRevenue = dailyVisitors * unitPrice * 30;
    const rev = Math.round(monthlyRevenue / 10000); // 만원

    // ── 비용 항목별 계산 ──
    const monthlyRent = Math.round(pyeong * rentPerPyeong);
    const material = Math.round(rev * config.materialRatio);
    const labor = config.laborMin + (staff * 220); // 추가직원 1인당 220만
    const utility = config.utilityBase + Math.round(pyeong * 1.5); // 면적 비례
    const cardFee = Math.round(rev * 0.025); // 카드수수료 2.5%
    const supplies = Math.round(rev * 0.015); // 소모품 1.5%
    const insurance = 15; // 화재+배상 보험
    const depreciation = Math.round((pyeong * 200) / 60); // 인테리어 5년 감가
    const etc = Math.round(rev * 0.01); // 기타

    const totalCost = monthlyRent + material + labor + utility + cardFee + supplies + insurance + depreciation + etc;
    const profit = rev - totalCost;

    const interiorCost = Math.round(pyeong * 200);
    const breakEven = profit > 0 ? Math.ceil(interiorCost / profit) : -1;

    return {
      dailyVisitors, rev, profit, breakEven, interiorCost,
      costs: [
        { label: "임대료", value: monthlyRent, color: "#6366F1" },
        { label: "재료비", value: material, color: "#F59E0B" },
        { label: `인건비 (사장+${staff}명)`, value: labor, color: "#0EA5E9" },
        { label: "공과금 (전기/수도/가스)", value: utility, color: "#10B981" },
        { label: "카드수수료 (2.5%)", value: cardFee, color: "#8B5CF6" },
        { label: "소모품/포장재", value: supplies, color: "#EC4899" },
        { label: "보험 (화재+배상)", value: insurance, color: "#94A3B8" },
        { label: "인테리어 감가 (5년)", value: depreciation, color: "#64748B" },
        { label: "기타 (세금/잡비)", value: etc, color: "#CBD5E1" },
      ],
      totalCost,
    };
  }, [industry, area, unitPrice, hours, staff, totalDailyFt, rentPerPyeong]);

  const isProfitable = result.profit > 0;

  return (
    <div className="space-y-4">
      {/* 입력 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">업종</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-primary-300">
            {Object.entries(INDUSTRY_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">면적 (㎡)</label>
          <input type="number" value={area} onChange={(e) => setArea(Math.max(1, +e.target.value))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-primary-300" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">객단가 (원)</label>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Math.max(1000, +e.target.value))} step={1000}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-primary-300" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted">영업 시간</label>
          <select value={hours} onChange={(e) => setHours(+e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-primary-300">
            <option value={8}>8시간</option>
            <option value={10}>10시간</option>
            <option value={12}>12시간</option>
            <option value={14}>14시간</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[11px] font-medium text-muted">추가 직원 수 (사장 제외)</label>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((n) => (
              <button key={n} onClick={() => setStaff(n)}
                className={`flex-1 rounded-lg py-1.5 text-[11px] font-medium transition-all ${staff === n ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                {n === 0 ? "없음" : `${n}명`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 결과 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-primary-50 p-3 text-center">
          <Building2 size={16} className="mx-auto text-primary-500" />
          <p className="mt-1 text-[10px] text-muted">일 방문객</p>
          <p className="text-[16px] font-bold text-gray-900">{result.dailyVisitors.toLocaleString()}명</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <TrendingUp size={16} className="mx-auto text-emerald-500" />
          <p className="mt-1 text-[10px] text-muted">월매출</p>
          <p className="text-[16px] font-bold text-gray-900">{result.rev.toLocaleString()}만</p>
        </div>
        <div className={`rounded-xl p-3 text-center ${isProfitable ? "bg-sky-50" : "bg-red-50"}`}>
          <Calendar size={16} className={`mx-auto ${isProfitable ? "text-sky-500" : "text-red-400"}`} />
          <p className="mt-1 text-[10px] text-muted">손익분기</p>
          <p className="text-[16px] font-bold text-gray-900">{isProfitable ? `${result.breakEven}개월` : "—"}</p>
        </div>
      </div>

      {!isProfitable && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
          <AlertTriangle size={14} className="text-red-500" />
          <p className="text-[11px] font-medium text-red-700">현 조건에서는 수익 달성이 어렵습니다. 객단가/면적/직원을 조정해보세요.</p>
        </div>
      )}

      {/* 비용 상세 */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-gray-700">월간 비용 상세 (총 {result.totalCost.toLocaleString()}만원)</p>
        {result.costs.map((c) => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-600">{c.label}</span>
              <span className="font-medium text-gray-800">{c.value.toLocaleString()}만</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{
                width: `${Math.round((c.value / result.totalCost) * 100)}%`,
                background: c.color,
              }} />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <span className="text-[12px] font-semibold text-gray-900">월 순이익</span>
          <span className={`text-[15px] font-bold ${isProfitable ? "text-emerald-600" : "text-red-500"}`}>
            {isProfitable ? "+" : ""}{result.profit.toLocaleString()}만원
          </span>
        </div>
      </div>

      <p className="text-[8px] text-muted">
        유동인구 {totalDailyFt.toLocaleString()}명/일 · 임대료 {rentPerPyeong.toFixed(0)}만/평 기준 · 인테리어 {result.interiorCost.toLocaleString()}만 추정
      </p>
    </div>
  );
}
