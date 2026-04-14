"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatCount } from "@/lib/formatters";
import MetricCard from "@/components/MetricCard";
import TimeSlotBar from "@/components/Charts/TimeSlotBar";
import HorizontalBar from "@/components/Charts/HorizontalBar";
import DonutChart from "@/components/Charts/DonutChart";
import { getDistrictIncome, DISTRICT_INCOME, SEOUL_AVG_INCOME } from "@/lib/district-income";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

export default function FootTrafficPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const ft = analysisData?.ft_summary;
  const pop = analysisData?.pop_summary;
  const clickedGu = useAnalysisStore((s) => s.clickedGu);

  if (!ft) {
    return <p className="py-12 text-center text-sm" style={{ color: palette.textSecondary }}>유동인구 데이터가 없습니다.</p>;
  }

  const timeData = Object.entries(ft.time_slots ?? {}).map(([name, value]) => ({ name, value }));
  const dayData = Object.entries(ft.by_day ?? {}).map(([name, value]) => ({ name, value }));
  const genderData = Object.entries(ft.by_gender ?? {}).map(([name, value]) => ({ name, value }));
  const ageData = Object.entries(ft.by_age ?? {}).map(([name, value]) => ({ name, value }));

  // 배후 인구
  const dailyFt = Math.round(ft.total / 90);
  const popTotal = pop?.total ?? 0;
  const households = pop?.households ?? Math.round(popTotal * 0.4);
  const popAgeData = Object.entries(pop?.by_age ?? {}).map(([name, value]) => ({ name, value }));
  const popGenderData = Object.entries(pop?.by_gender ?? {}).map(([name, value]) => ({ name, value }));

  // 상권 유형 판별: 유동인구 대비 배후인구 비율이 높으면 주거형, 낮으면 유입형
  const ftPopRatio = dailyFt > 0 ? popTotal / dailyFt : 0;
  const areaType = ftPopRatio > 0.5 ? "주거·직장 밀집형" : ftPopRatio > 0.2 ? "혼합형" : "유입형 (관광·상업)";

  // 소비여력
  const incomeData = clickedGu ? getDistrictIncome(clickedGu) : null;
  const monthlySpend = incomeData ? Math.round(incomeData.income * 0.35) : 0; // 소비성향 35%
  const dailySpend = monthlySpend > 0 ? Math.round((monthlySpend * 10000) / 30) : 0;
  const estimatedDailyRevenue = dailyFt > 0 && dailySpend > 0 ? Math.round(dailyFt * dailySpend * 0.05 / 10000) : 0; // 5% 소비전환율

  // 소비여력 비교 차트 데이터 (현재 구 + 인접 구 비교)
  const incomeChartData = Object.entries(DISTRICT_INCOME)
    .map(([name, d]) => ({ name, income: d.income, rank: d.rank }))
    .sort((a, b) => b.income - a.income);

  const currentGuShort = clickedGu ?? "";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── 핵심 수치 ── */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard label="유동인구" value={formatCount(ft.total)} sub="분기" color={palette.teal} />
        <MetricCard label="일평균" value={dailyFt.toLocaleString()} sub="명/일" color={palette.primary} />
        <MetricCard label="배후인구" value={formatCount(popTotal)} sub="직장인구" color={palette.navy} />
      </div>

      {/* ── 상권 유형 배지 ── */}
      <div className="rounded-xl bg-primary-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-600 px-3 py-1 text-[11px] font-bold text-white">{areaType}</span>
          <span className="text-[11px] text-gray-600">
            배후인구 {popTotal.toLocaleString()}명 · 추정 가구 {households.toLocaleString()}세대
          </span>
        </div>
      </div>

      {/* ── 시간대별 유동인구 ── */}
      {timeData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>시간대별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={timeData} color={palette.teal} clickable />
          </div>
        </section>
      )}

      {/* ── 요일별 유동인구 ── */}
      {dayData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>요일별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={dayData} color={palette.navy} />
          </div>
        </section>
      )}

      {/* ── 성별 유동인구 ── */}
      {genderData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>성별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <DonutChart data={genderData} height={200} innerRadius={40} outerRadius={70} />
          </div>
        </section>
      )}

      {/* ── 연령대별 유동인구 ── */}
      {ageData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>연령대별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <HorizontalBar data={ageData} barColor={palette.textSecondary} />
          </div>
        </section>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── 배후 인구 분석 ── */}
      <div className="border-t-2 border-primary-200 pt-4">
        <h3 className="mb-3 text-[15px] font-bold text-gray-900">📊 배후 인구 분석</h3>

        {/* 배후 연령대 분포 */}
        {popAgeData.length > 0 && (
          <section className="mb-4">
            <p className="mb-2 text-[12px] font-semibold text-gray-700">배후 인구 연령 분포</p>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="space-y-2">
                {popAgeData.map((a) => {
                  const maxVal = Math.max(...popAgeData.map((d) => d.value));
                  const pct = popTotal > 0 ? Math.round((a.value / popTotal) * 100) : 0;
                  const isTop = a.value === maxVal;
                  return (
                    <div key={a.name} className="flex items-center gap-2">
                      <span className={`w-10 text-[11px] ${isTop ? "font-bold text-primary-600" : "text-muted"}`}>{a.name}</span>
                      <div className="h-5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="flex h-full items-center rounded-full px-2"
                          style={{ width: `${maxVal > 0 ? (a.value / maxVal) * 100 : 0}%`, background: isTop ? "#6366F1" : "#E0E7FF" }}
                        >
                          <span className={`text-[9px] font-bold ${isTop ? "text-white" : "text-primary-600"}`}>
                            {a.value.toLocaleString()}명
                          </span>
                        </div>
                      </div>
                      <span className={`w-8 text-right text-[11px] font-semibold ${isTop ? "text-primary-600" : "text-gray-400"}`}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 배후 성별 분포 */}
        {popGenderData.length > 0 && (
          <section className="mb-4">
            <p className="mb-2 text-[12px] font-semibold text-gray-700">배후 인구 성별 비율</p>
            <div className="rounded-xl border border-gray-100 bg-white p-3">
              <div className="flex gap-3">
                {popGenderData.map((g) => {
                  const pct = popTotal > 0 ? Math.round((g.value / popTotal) * 100) : 0;
                  const isMale = g.name.includes("남");
                  return (
                    <div key={g.name} className="flex-1 rounded-lg bg-gray-50 p-3 text-center">
                      <p className="text-[20px]">{isMale ? "👨" : "👩"}</p>
                      <p className="text-[13px] font-bold text-gray-900">{pct}%</p>
                      <p className="text-[10px] text-muted">{g.value.toLocaleString()}명</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ── 소비여력 분석 ── */}
      <div className="border-t-2 border-emerald-200 pt-4">
        <h3 className="mb-3 text-[15px] font-bold text-gray-900">💰 소비여력 분석</h3>

        {incomeData ? (
          <>
            {/* 핵심 수치 카드 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-[10px] text-emerald-600 font-medium">월 평균 가구소득</p>
                <p className="text-[22px] font-black text-gray-900">{incomeData.income}<span className="text-[12px] font-medium text-muted">만원</span></p>
                <p className="text-[10px] text-muted">{incomeData.guName} 기준</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <p className="text-[10px] text-blue-600 font-medium">월 추정 소비지출</p>
                <p className="text-[22px] font-black text-gray-900">{monthlySpend}<span className="text-[12px] font-medium text-muted">만원</span></p>
                <p className="text-[10px] text-muted">소비성향 35% 적용</p>
              </div>
            </div>

            {/* 상세 수치 */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 mb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-600">서울 평균 대비</span>
                  <span className={`text-[12px] font-bold ${incomeData.income >= SEOUL_AVG_INCOME ? "text-emerald-600" : "text-amber-600"}`}>
                    {incomeData.income >= SEOUL_AVG_INCOME ? "▲" : "▼"} {Math.abs(incomeData.income - SEOUL_AVG_INCOME)}만원 ({incomeData.income >= SEOUL_AVG_INCOME ? "+" : ""}{Math.round(((incomeData.income - SEOUL_AVG_INCOME) / SEOUL_AVG_INCOME) * 100)}%)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-600">소득 순위</span>
                  <span className="text-[12px] font-bold text-gray-900">서울 25개 구 중 {incomeData.rank}위</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-600">1인당 일 소비액</span>
                  <span className="text-[12px] font-bold text-gray-900">{dailySpend.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-600">일 추정 상권 매출</span>
                  <span className="text-[12px] font-bold text-primary-600">{estimatedDailyRevenue.toLocaleString()}만원</span>
                </div>
                <p className="text-[9px] text-muted pt-1 border-t border-gray-50">
                  * 유동인구 {dailyFt.toLocaleString()}명 × 일 소비액 {dailySpend.toLocaleString()}원 × 소비전환율 5%
                </p>
              </div>
            </div>

            {/* 구별 소득 비교 차트 */}
            <section>
              <p className="mb-2 text-[12px] font-semibold text-gray-700">서울 25개 구 소득 비교</p>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <ResponsiveContainer width="100%" height={620}>
                  <BarChart data={incomeChartData} layout="vertical" margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis type="number" domain={[300, 750]} tick={{ fill: "#94A3B8", fontSize: 10 }} tickFormatter={(v: number) => `${v}만`} />
                    <YAxis type="category" dataKey="name" width={50} tick={{ fill: "#64748B", fontSize: 10 }} interval={0} />
                    <Tooltip
                      formatter={(value) => [`${value}만원`, "월 가구소득"]}
                      contentStyle={{ background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 }}
                    />
                    <ReferenceLine x={SEOUL_AVG_INCOME} stroke="#94A3B8" strokeDasharray="4 3" label={{ value: "서울 평균", position: "top", fill: "#94A3B8", fontSize: 10 }} />
                    <Bar dataKey="income" radius={[0, 4, 4, 0]}>
                      {incomeChartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.name === currentGuShort ? "#6366F1" : entry.income >= SEOUL_AVG_INCOME ? "#C7D2FE" : "#F1F5F9"}
                          stroke={entry.name === currentGuShort ? "#4F46E5" : "none"}
                          strokeWidth={entry.name === currentGuShort ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-xl bg-gray-50 py-8 text-center">
            <p className="text-[12px] text-muted">소비여력 데이터를 불러올 수 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
