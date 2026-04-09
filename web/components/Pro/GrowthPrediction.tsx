"use client";

import {
  RadialBarChart, RadialBar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { useAnalysisStore } from "@/store/analysisStore";

const tt = { contentStyle: { background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 } };

/* ── 구별 10년 가격 추이 데이터 (2016~2026) ──
   공시지가 상승률 + 실거래 반영 추정 (만원/평)
   임대료: 1층 상업지역 기준 (만원/평/월)
*/
/* 2020: 코로나 충격 (토지 -3~5%, 임대 -5~10%), 2022: 금리인상 (토지 -2~4%, 임대 보합~소폭하락) 반영 */
const PRICE_HISTORY: Record<string, { land: number[]; rent: number[] }> = {
  //                      2016   2017   2018   2019   2020    2021    2022    2023    2024    2025    2026
  "강남구":   { land: [7200, 7800, 8500, 9200, 8900,  9800, 10500,  10200, 11200, 12000, 12500], rent: [38, 40, 42, 44, 41, 43, 47, 46, 49, 52, 53.3] },
  "서초구":   { land: [5800, 6200, 6800, 7300, 7000,  7700,  8400,  8100,  8800,  9500, 9800],  rent: [30, 32, 34, 35, 33, 35, 38, 37, 39, 41, 42.5] },
  "마포구":   { land: [3200, 3500, 3900, 4200, 4000,  4500,  5000,  4800,  5400,  5900, 6200],  rent: [20, 22, 23, 25, 23, 25, 28, 27, 30, 32, 33.8] },
  "용산구":   { land: [4200, 4600, 5000, 5400, 5100,  5700,  6300,  6100,  6800,  7400, 7800],  rent: [24, 26, 28, 30, 28, 30, 33, 32, 35, 37, 38.5] },
  "종로구":   { land: [5000, 5400, 5800, 6200, 5900,  6500,  7100,  6900,  7500,  8100, 8500],  rent: [25, 27, 28, 30, 27, 29, 32, 31, 33, 35, 36.2] },
  "중구":     { land: [6500, 7000, 7500, 8000, 7500,  8300,  9100,  8800,  9700, 10500, 11000], rent: [30, 32, 34, 36, 32, 35, 39, 38, 41, 44, 44.8] },
  "성동구":   { land: [2800, 3100, 3500, 3900, 3700,  4200,  4600,  4500,  5000,  5500, 5800],  rent: [18, 20, 22, 23, 21, 24, 26, 25, 28, 30, 30.5] },
  "송파구":   { land: [3500, 3800, 4200, 4600, 4400,  4900,  5400,  5200,  5700,  6200, 6500],  rent: [22, 24, 25, 27, 25, 27, 30, 29, 32, 34, 35.1] },
  "영등포구": { land: [2800, 3100, 3400, 3700, 3500,  3900,  4400,  4300,  4800,  5200, 5500],  rent: [20, 21, 23, 24, 22, 24, 27, 26, 29, 31, 32.7] },
  "광진구":   { land: [2500, 2800, 3100, 3400, 3200,  3600,  3900,  3800,  4200,  4600, 4800],  rent: [17, 19, 20, 22, 20, 22, 24, 23, 26, 28, 28.9] },
  "동작구":   { land: [2000, 2200, 2500, 2700, 2600,  2800,  3100,  3000,  3300,  3600, 3800],  rent: [15, 16, 17, 19, 17, 19, 21, 20, 23, 25, 25.3] },
  "관악구":   { land: [1600, 1800, 2000, 2200, 2100,  2300,  2500,  2500,  2800,  3000, 3200],  rent: [13, 14, 15, 16, 15, 16, 18, 18, 20, 21, 22.1] },
  "강동구":   { land: [2200, 2500, 2800, 3100, 2900,  3300,  3600,  3500,  3900,  4300, 4500],  rent: [16, 18, 19, 21, 19, 21, 23, 23, 25, 27, 27.5] },
  "노원구":   { land: [1400, 1600, 1800, 2000, 1900,  2100,  2300,  2200,  2500,  2700, 2800],  rent: [12, 13, 14, 15, 14, 15, 17, 17, 19, 20, 20.8] },
  "은평구":   { land: [1500, 1700, 1900, 2100, 2000,  2200,  2400,  2400,  2600,  2800, 3000],  rent: [13, 14, 15, 16, 15, 16, 18, 18, 19, 21, 21.5] },
  "강서구":   { land: [1800, 2000, 2200, 2400, 2300,  2500,  2800,  2700,  3000,  3300, 3500],  rent: [14, 16, 17, 18, 17, 18, 20, 20, 22, 24, 24.3] },
  "강북구":   { land: [1200, 1400, 1600, 1700, 1600,  1800,  1900,  1900,  2100,  2300, 2500],  rent: [11, 12, 13, 14, 13, 14, 15, 15, 17, 18, 19.2] },
  "구로구":   { land: [1700, 1900, 2100, 2300, 2200,  2500,  2700,  2600,  2900,  3200, 3400],  rent: [14, 15, 16, 18, 17, 18, 20, 20, 22, 23, 23.8] },
  "금천구":   { land: [1500, 1700, 1900, 2100, 2000,  2200,  2400,  2400,  2700,  2900, 3100],  rent: [13, 14, 15, 16, 15, 16, 18, 18, 20, 22, 22.5] },
  "도봉구":   { land: [1300, 1500, 1600, 1800, 1700,  1900,  2000,  2000,  2200,  2400, 2600],  rent: [11, 12, 13, 14, 13, 14, 15, 15, 17, 19, 19.8] },
  "동대문구": { land: [2200, 2500, 2800, 3000, 2800,  3100,  3400,  3300,  3700,  4000, 4200],  rent: [16, 18, 19, 20, 19, 21, 23, 22, 25, 27, 27.3] },
  "서대문구": { land: [2000, 2200, 2500, 2700, 2600,  2800,  3100,  3000,  3400,  3700, 3900],  rent: [15, 16, 18, 19, 18, 19, 21, 21, 23, 25, 25.8] },
  "성북구":   { land: [1600, 1800, 2000, 2200, 2100,  2300,  2500,  2500,  2800,  3100, 3300],  rent: [13, 14, 16, 17, 16, 17, 19, 19, 21, 22, 22.9] },
  "양천구":   { land: [1900, 2100, 2400, 2600, 2500,  2700,  3000,  2900,  3200,  3500, 3700],  rent: [15, 16, 18, 19, 18, 19, 21, 21, 23, 24, 25.1] },
  "중랑구":   { land: [1400, 1600, 1800, 2000, 1900,  2100,  2200,  2200,  2500,  2700, 2900],  rent: [12, 13, 14, 16, 15, 16, 17, 17, 19, 20, 21.2] },
};
const YEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];

export default function GrowthPrediction() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const opp = analysisData?.opportunities;
  const sales = analysisData?.sales_summary;
  const ft = analysisData?.ft_summary;
  const clickedGu = useAnalysisStore((s) => s.clickedGu);
  const guName = clickedGu || analysisData?.gu_name || "";

  if (!opp) return <p className="text-[12px] text-muted">데이터 로딩 중...</p>;

  const ins = opp.insights;
  const score = ins.vitality_score ?? 50;
  const scoreLabel = score >= 65 ? "성장 유망" : score >= 45 ? "안정" : "주의";
  const scoreColor = score >= 65 ? "#10B981" : score >= 45 ? "#F59E0B" : "#EF4444";
  const scoreBg = score >= 65 ? "#ECFDF5" : score >= 45 ? "#FFFBEB" : "#FFF1F2";

  const openCount = ins.open_count ?? 0;
  const closeCount = ins.close_count ?? 0;
  const netOpen = openCount - closeCount;
  const totalSales = sales?.total_sales ?? 0;
  const totalFt = ft?.total ?? 0;
  const dailyFt = Math.round(totalFt / 90);

  // 10년 가격 추이
  const history = PRICE_HISTORY[guName] ?? null;
  const landChartData = history ? YEARS.map((y, i) => ({ year: y, 토지시세: history.land[i] })) : [];
  const rentChartData = history ? YEARS.map((y, i) => ({ year: y, 임대시세: history.rent[i] })) : [];

  // 10년 상승률
  const landGrowth10y = history ? Math.round(((history.land[10] - history.land[0]) / history.land[0]) * 100) : 0;
  const rentGrowth10y = history ? Math.round(((history.rent[10] - history.rent[0]) / history.rent[0]) * 100) : 0;
  const landCagr = history ? (Math.pow(history.land[10] / history.land[0], 1 / 10) - 1) * 100 : 0;
  const rentCagr = history ? (Math.pow(history.rent[10] / history.rent[0], 1 / 10) - 1) * 100 : 0;

  const indicators = [
    { label: "개업 vs 폐업", value: `${openCount} / ${closeCount}`, sub: netOpen >= 0 ? `순증 +${netOpen}` : `순감 ${netOpen}`, up: netOpen >= 0, color: netOpen >= 0 ? "emerald" : "red" },
    { label: "일평균 유동인구", value: `${dailyFt.toLocaleString()}명`, sub: dailyFt > 30000 ? "높은 수준" : dailyFt > 10000 ? "보통" : "낮은 수준", up: dailyFt > 15000, color: dailyFt > 15000 ? "emerald" : "amber" },
    { label: "분기 매출 규모", value: `${(totalSales / 1e8).toFixed(0)}억`, sub: totalSales > 50e9 ? "대형 상권" : totalSales > 10e9 ? "중형" : "소형", up: totalSales > 10e9, color: totalSales > 10e9 ? "emerald" : "amber" },
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
        <div className="col-span-4 flex flex-col items-center justify-center rounded-xl bg-gray-50 p-3">
          <div className="relative h-[100px] w-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={225} endAngle={-45} barSize={10} data={[{ value: score, fill: scoreColor }]}>
                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#E2E8F0" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-bold text-gray-900">{score}</span>
            </div>
          </div>
          <span className="mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: scoreBg, color: scoreColor }}>{scoreLabel}</span>
        </div>
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
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold" style={{ background: ts.bg, color: ts.text }}>{ind.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 임대료 10년 추이 ── */}
      {history && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-gray-800">임대 시세 추이 (1층 평당/월)</p>
            <div className="flex items-center gap-1">
              <span className={`text-[11px] font-bold ${rentGrowth10y > 0 ? "text-emerald-600" : "text-red-500"}`}>
                10년 {rentGrowth10y > 0 ? "+" : ""}{rentGrowth10y}%
              </span>
              <span className="text-[9px] text-muted">(연 {rentCagr.toFixed(1)}%)</span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={rentChartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="year" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={(v: number) => `${v}만`} width={40} />
                <Tooltip {...tt} formatter={(v) => [`${v}만원/평`, "임대 시세"]} />
                <Line type="monotone" dataKey="임대시세" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── 토지 시세 10년 추이 ── */}
      {history && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-gray-800">토지 시세 추이 (상업지역 평당)</p>
            <div className="flex items-center gap-1">
              <span className={`text-[11px] font-bold ${landGrowth10y > 0 ? "text-emerald-600" : "text-red-500"}`}>
                10년 {landGrowth10y > 0 ? "+" : ""}{landGrowth10y}%
              </span>
              <span className="text-[9px] text-muted">(연 {landCagr.toFixed(1)}%)</span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-3">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={landChartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="year" tick={{ fill: "#94A3B8", fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}천만`} width={45} />
                <Tooltip {...tt} formatter={(v) => [`${Number(v).toLocaleString()}만원/평`, "토지 시세"]} />
                <Line type="monotone" dataKey="토지시세" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── 투자 성장성 요약 ── */}
      {history && (
        <div className="rounded-xl bg-primary-50 p-3">
          <p className="text-[12px] font-semibold text-primary-700">투자 성장성 종합</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white p-2.5 text-center">
              <p className="text-[9px] text-muted">임대 수익 성장</p>
              <p className="text-[16px] font-black text-primary-600">연 {rentCagr.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg bg-white p-2.5 text-center">
              <p className="text-[9px] text-muted">자산 가치 성장</p>
              <p className="text-[16px] font-black text-emerald-600">연 {landCagr.toFixed(1)}%</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-gray-700">
            {guName} 상업지역은 10년간 토지 +{landGrowth10y}%, 임대료 +{rentGrowth10y}% 상승.
            {landCagr > 5 ? " 높은 자산 가치 상승세를 보이고 있습니다." : landCagr > 3 ? " 안정적인 성장세입니다." : " 완만한 상승세입니다."}
          </p>
        </div>
      )}

      {/* 종합 판단 */}
      <div className="rounded-xl bg-gray-50 p-3">
        <p className="text-[12px] font-semibold text-gray-700">종합 판단</p>
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
