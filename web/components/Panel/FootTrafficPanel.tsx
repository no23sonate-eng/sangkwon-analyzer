"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatCount } from "@/lib/formatters";
import MetricCard from "@/components/MetricCard";
import TimeSlotBar from "@/components/Charts/TimeSlotBar";
import HorizontalBar from "@/components/Charts/HorizontalBar";
import DonutChart from "@/components/Charts/DonutChart";
import Collapsible from "@/components/Collapsible";
import { getDistrictIncome, SEOUL_AVG_INCOME } from "@/lib/district-income";

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

  // 배후 인구 분석
  const dailyFt = Math.round(ft.total / 90);
  const popTotal = pop?.total ?? 0;
  const ftPopRatio = dailyFt > 0 ? Math.round((popTotal / dailyFt) * 100) : 0;

  // 연령대 비교 인사이트
  const ftTopAge = ageData.length > 0 ? ageData.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const popAgeData = Object.entries(pop?.by_age ?? {}).map(([name, value]) => ({ name, value }));
  const popTopAge = popAgeData.length > 0 ? popAgeData.reduce((a, b) => (b.value > a.value ? b : a)) : null;

  // 소비여력
  const incomeData = clickedGu ? getDistrictIncome(clickedGu) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 기존: 메트릭 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="총 유동인구" value={formatCount(ft.total)} sub="분기 기준" color={palette.teal} />
        {pop && <MetricCard label="직장인구" value={formatCount(popTotal)} color={palette.navy} />}
      </div>

      {/* 기존: 시간대별 */}
      {timeData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>시간대별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={timeData} color={palette.teal} clickable />
          </div>
        </section>
      )}

      {/* 기존: 요일별 */}
      {dayData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>요일별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={dayData} color={palette.navy} />
          </div>
        </section>
      )}

      {/* 기존: 성별 */}
      {genderData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>성별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <DonutChart data={genderData} height={200} innerRadius={40} outerRadius={70} />
          </div>
        </section>
      )}

      {/* 기존: 연령대별 */}
      {ageData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>연령대별 유동인구</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <HorizontalBar data={ageData} barColor={palette.textSecondary} />
          </div>
        </section>
      )}

      {/* ━━━ 배후 인구 (추가) ━━━ */}
      <h3 className="mt-2 text-sm font-bold" style={{ color: palette.textPrimary }}>배후 인구 분석</h3>

      {/* (a) 인구 구성 비교 */}
      <Collapsible title="인구 구성 비교" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[11px] text-muted">유동인구 일평균</p>
            <p className="mt-1 text-[18px] font-bold text-gray-900">{dailyFt.toLocaleString()}<span className="text-[12px]">명</span></p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-[11px] text-muted">직장인구</p>
            <p className="mt-1 text-[18px] font-bold text-gray-900">{popTotal.toLocaleString()}<span className="text-[12px]">명</span></p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-600">
          {ftPopRatio > 50
            ? `직장인구가 유동인구의 ${ftPopRatio}% — 직장인 중심 상권`
            : ftPopRatio > 30
            ? `직장인구가 유동인구의 ${ftPopRatio}% — 혼합형 상권`
            : `직장인구가 유동인구의 ${ftPopRatio}% — 외부 유입형 상권 (관광·상업 중심)`}
        </p>
      </Collapsible>

      {/* (b) 연령대 비교 */}
      {popAgeData.length > 0 && (
        <Collapsible title="유동인구 vs 직장인구 연령대">
          <p className="mb-2 text-[10px] font-semibold text-muted">직장인구 연령 분포</p>
          <div className="space-y-1.5">
            {popAgeData.map((a) => {
              const maxVal = Math.max(...popAgeData.map((d) => d.value));
              return (
                <div key={a.name} className="flex items-center gap-2">
                  <span className="w-10 text-[10px] text-muted">{a.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${maxVal > 0 ? (a.value / maxVal) * 100 : 0}%`, background: a.value === maxVal ? "#6366F1" : "#C7D2FE" }}
                    />
                  </div>
                  <span className="w-10 text-right text-[10px] text-gray-600">{a.value.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          {ftTopAge && popTopAge && (
            <p className="mt-2 text-[11px] text-gray-600">
              유동인구는 {ftTopAge.name}가 최다, 직장인구는 {popTopAge.name}가 최다
            </p>
          )}
        </Collapsible>
      )}

      {/* (c) 소비여력 추정 */}
      <Collapsible title="소비여력 추정">
        {incomeData ? (
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-[12px] text-gray-600">{incomeData.guName} 평균 가구소득</p>
            <p className="mt-1 text-[20px] font-bold text-gray-900">월 {incomeData.income}<span className="text-[13px] font-medium">만원</span></p>
            <p className="mt-1 text-[11px]">
              <span className={incomeData.income >= SEOUL_AVG_INCOME ? "text-emerald-500" : "text-amber-500"}>
                서울 평균({SEOUL_AVG_INCOME}만원) 대비 {incomeData.income >= SEOUL_AVG_INCOME ? "상위" : "하위"} {incomeData.percentile}%
              </span>
            </p>
          </div>
        ) : (
          <p className="text-[12px] text-muted">데이터 준비 중</p>
        )}
      </Collapsible>
    </div>
  );
}
