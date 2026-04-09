"use client";

import {
  RadialBarChart, RadialBar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAnalysisStore } from "@/store/analysisStore";

const tt = { contentStyle: { background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 } };

export default function GrowthPrediction() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const opp = analysisData?.opportunities;
  const sales = analysisData?.sales_summary;
  const ft = analysisData?.ft_summary;
  const sc = analysisData?.sc_summary;

  if (!opp) return <p className="text-[12px] text-muted">데이터 로딩 중...</p>;

  const ins = opp.insights;
  const score = ins.vitality_score ?? 50;
  const scoreLabel = score >= 65 ? "성장 유망" : score >= 45 ? "안정" : "주의";
  const scoreColor = score >= 65 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  const scoreBg = score >= 65 ? "#ECFDF5" : score >= 45 ? "#FFFBEB" : "#FFF1F2";

  // 근거 지표
  const openCount = ins.open_count ?? 0;
  const closeCount = ins.close_count ?? 0;
  const netOpen = openCount - closeCount;
  const totalSales = sales?.total_sales ?? 0;
  const totalFt = ft?.total ?? 0;
  const dailyFt = Math.round(totalFt / 90);

  const indicators = [
    {
      label: "개업 vs 폐업",
      value: `${openCount} / ${closeCount}`,
      sub: netOpen >= 0 ? `순증 +${netOpen}` : `순감 ${netOpen}`,
      up: netOpen >= 0,
      color: netOpen >= 0 ? "emerald" : "red",
    },
    {
      label: "일평균 유동인구",
      value: `${dailyFt.toLocaleString()}명`,
      sub: dailyFt > 30000 ? "높은 수준" : dailyFt > 10000 ? "보통 수준" : "낮은 수준",
      up: dailyFt > 15000,
      color: dailyFt > 15000 ? "emerald" : "amber",
    },
    {
      label: "분기 매출 규모",
      value: `${(totalSales / 1e8).toFixed(0)}억`,
      sub: totalSales > 50e9 ? "대형 상권" : totalSales > 10e9 ? "중형 상권" : "소형 상권",
      up: totalSales > 10e9,
      color: totalSales > 10e9 ? "emerald" : "amber",
    },
  ];

  const tagStyles: Record<string, { bg: string; text: string }> = {
    emerald: { bg: "#ECFDF5", text: "#059669" },
    amber: { bg: "#FFFBEB", text: "#D97706" },
    red: { bg: "#FFF1F2", text: "#E11D48" },
  };

  return (
    <div className="space-y-5">
      {/* 성장 점수 게이지 + 근거 */}
      <div className="grid grid-cols-12 gap-3">
        {/* 게이지 */}
        <div className="col-span-4 flex flex-col items-center justify-center rounded-xl bg-gray-50 p-3">
          <div className="relative h-[100px] w-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
                startAngle={225} endAngle={-45} barSize={10}
                data={[{ value: score, fill: scoreColor }]}
              >
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#E2E8F0" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-bold text-gray-900">{score}</span>
            </div>
          </div>
          <span className="mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: scoreBg, color: scoreColor }}>
            {scoreLabel}
          </span>
        </div>

        {/* 근거 지표 */}
        <div className="col-span-8 space-y-2">
          {indicators.map((ind) => {
            const ts = tagStyles[ind.color];
            return (
              <div key={ind.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <div>
                  <span className="text-[11px] text-muted">{ind.label}</span>
                  <p className="text-[13px] font-bold text-gray-900">{ind.value}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {ind.up ? <TrendingUp size={13} style={{ color: ts.text }} /> : <TrendingDown size={13} style={{ color: ts.text }} />}
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: ts.bg, color: ts.text }}>
                    {ind.sub}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 종합 판단 */}
      <div className="rounded-xl bg-primary-50 p-3">
        <p className="text-[12px] font-semibold text-primary-700">종합 판단</p>
        <p className="mt-1 text-[11px] text-gray-700">
          {score >= 65
            ? `활력 점수 ${score}점으로 성장 가능성이 높습니다. ${ins.dominant_age ?? ""} 타깃 업종 진입 시 유리합니다.`
            : score >= 45
            ? `활력 점수 ${score}점으로 안정적이나 성장세가 두드러지지는 않습니다. 차별화된 컨셉이 필요합니다.`
            : `활력 점수 ${score}점으로 주의가 필요합니다. 폐업이 개업보다 많아 신중한 접근이 필요합니다.`}
        </p>
      </div>
    </div>
  );
}
