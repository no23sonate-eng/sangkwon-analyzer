"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatWon, formatCount } from "@/lib/formatters";
import MetricCard from "@/components/MetricCard";
import TimeSlotBar from "@/components/Charts/TimeSlotBar";
import HorizontalBar from "@/components/Charts/HorizontalBar";
import Collapsible from "@/components/Collapsible";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";

const tt = {
  contentStyle: { background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 },
};

// 요일 정렬 순서
const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];

export default function SalesPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const sales = analysisData?.sales_summary;
  const ft = analysisData?.ft_summary;
  const storeSummary = analysisData?.store_summary;

  if (!sales) {
    return <p className="py-12 text-center text-sm" style={{ color: palette.textSecondary }}>매출 데이터가 없습니다.</p>;
  }

  // 업종별 점포당 월매출 — 상위 10개 + 나머지 블러
  const perStoreAll = (sales.per_store ?? []).map((item) => ({ name: item.업종, value: item.점포당_매출 }));
  const perStoreTop = perStoreAll.slice(0, 10);
  const perStoreBlur = perStoreAll.slice(10);

  const timeData = Object.entries(sales.time_slots ?? {}).map(([name, value]) => ({ name, value }));

  // 요일별 매출 — 월화수목금토일 순서로 정렬
  const dayRaw = Object.entries(sales.day_of_week ?? {});
  const dayData = DAY_ORDER
    .map((d) => {
      const found = dayRaw.find(([name]) => name === d);
      return found ? { name: found[0], value: found[1] } : null;
    })
    .filter(Boolean) as { name: string; value: number }[];

  // 소비 패턴 계산
  const totalStores = storeSummary?.total ?? 1;
  const dailySalesPerStore = Math.round(sales.total_sales / Math.max(totalStores, 1) / 30 / 10000);

  // 시간대별 매출 vs 유동인구 비교
  const ftTimeSlots = ft?.time_slots ?? {};
  const salesTimeSlots = sales.time_slots ?? {};
  const timeKeys = Object.keys(salesTimeSlots);
  const maxSalesTime = Math.max(...Object.values(salesTimeSlots), 1);
  const maxFtTime = Math.max(...Object.values(ftTimeSlots), 1);
  const comparisonData = timeKeys.map((k) => {
    const salesPct = Math.round((salesTimeSlots[k] / maxSalesTime) * 100);
    const ftPct = Math.round(((ftTimeSlots[k] ?? 0) / maxFtTime) * 100);
    const gap = ftPct - salesPct;
    return { name: k, 매출비중: salesPct, 유동인구비중: ftPct, gap, opportunity: gap > 20 };
  });

  // 요일별 매출 인사이트
  const weekdayDays = dayData.filter((d) => ["월", "화", "수", "목", "금"].includes(d.name));
  const weekendDays = dayData.filter((d) => ["토", "일"].includes(d.name));
  const weekdayAvg = weekdayDays.length > 0 ? weekdayDays.reduce((s, d) => s + d.value, 0) / weekdayDays.length : 0;
  const weekendAvg = weekendDays.length > 0 ? weekendDays.reduce((s, d) => s + d.value, 0) / weekendDays.length : 0;
  const weekendDiff = weekdayAvg > 0 ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100) : 0;

  // 업종별 매출 집중도
  const byService = sales.by_service ?? [];
  const topIndustry = byService[0];
  const topPct = topIndustry && sales.total_sales > 0
    ? Math.round((topIndustry.매출액 / sales.total_sales) * 100) : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 요약 메트릭 */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="총 매출" value={formatWon(sales.total_sales)} color={palette.orange} />
        <MetricCard label="총 건수" value={formatCount(sales.total_count)} sub="분기 기준" color={palette.teal} />
      </div>

      {/* 업종별 점포당 월매출 — 상위 10개 + 나머지 블러 */}
      {perStoreTop.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>업종별 점포당 월매출</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <HorizontalBar data={perStoreTop} barColor={palette.orange} height={Math.max(260, perStoreTop.length * 28)} />
          </div>
          {perStoreBlur.length > 0 && (
            <div className="relative mt-1 overflow-hidden rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
              <div style={{ filter: "blur(5px)", pointerEvents: "none" }}>
                <HorizontalBar data={perStoreBlur} barColor={palette.orange} height={perStoreBlur.length * 28} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <span className="text-[11px] text-muted">+{perStoreBlur.length}개 업종</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 시간대별 매출 */}
      {timeData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>시간대별 매출</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={timeData} color={palette.orange} />
          </div>
        </section>
      )}

      {/* 요일별 매출 (월~일 순서) */}
      {dayData.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: palette.textPrimary }}>요일별 매출</h3>
          <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: "white" }}>
            <TimeSlotBar data={dayData} color={palette.teal} />
          </div>
        </section>
      )}

      {/* ━━━ 소비 패턴 분석 ━━━ */}
      <h3 className="mt-2 text-sm font-bold" style={{ color: palette.textPrimary }}>소비 패턴 분석</h3>

      {/* 점포당 일 매출 추정 */}
      <Collapsible title="점포당 일 매출 추정" defaultOpen={true}>
        <div className="rounded-xl bg-gray-50 p-4 text-center">
          <p className="text-[11px] text-muted">점포당 일평균 매출</p>
          <p className="mt-1 text-[22px] font-bold text-gray-900">약 {dailySalesPerStore.toLocaleString()}<span className="text-[14px] font-medium">만원</span></p>
          <p className="mt-1 text-[10px] text-muted">총매출 ÷ {totalStores}개 점포 ÷ 30일</p>
        </div>
      </Collapsible>

      {/* 시간대별 매출 vs 유동인구 */}
      {comparisonData.length > 0 && ft && (
        <Collapsible title="시간대별 매출 vs 유동인구" defaultOpen={true}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={comparisonData} barGap={-8}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...tt} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="유동인구비중" fill="#A5B4FC" radius={[3, 3, 0, 0]} barSize={14} />
              <Bar dataKey="매출비중" fill="#F97316" radius={[3, 3, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
          {comparisonData.some((d) => d.opportunity) && (
            <div className="mt-2 space-y-1">
              {comparisonData.filter((d) => d.opportunity).map((d) => (
                <p key={d.name} className="text-[11px]">
                  <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">⚡ 매출 기회</span>
                  <span className="text-gray-600">{d.name}: 유동인구 대비 매출 비중 낮음</span>
                </p>
              ))}
            </div>
          )}
        </Collapsible>
      )}

      {/* 요일별 매출 패턴 */}
      {dayData.length > 0 && (
        <Collapsible title="요일별 매출 패턴" defaultOpen={true}>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...tt} formatter={(v) => formatWon(Number(v))} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24}>
                {dayData.map((d) => (
                  <Cell key={d.name} fill={["토", "일"].includes(d.name) ? "#6366F1" : "#C7D2FE"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-gray-600">
            {weekendDiff > 0
              ? `주말 매출이 평일 대비 +${weekendDiff}% 높음`
              : weekendDiff < 0
              ? `평일 매출이 주말 대비 +${Math.abs(weekendDiff)}% 높음 (직장인 중심)`
              : "평일과 주말 매출이 유사함"}
          </p>
        </Collapsible>
      )}

      {/* 업종별 매출 집중도 */}
      {byService.length > 0 && (
        <Collapsible title="업종별 매출 집중도" defaultOpen={true}>
          <div className="space-y-2">
            {byService.slice(0, 8).map((item, i) => {
              const pct = sales.total_sales > 0 ? Math.round((item.매출액 / sales.total_sales) * 100) : 0;
              return (
                <div key={i}>
                  <div className="mb-0.5 flex items-center justify-between text-[11px]">
                    <span className={i === 0 ? "font-semibold text-primary-600" : "text-gray-600"}>{item.업종}</span>
                    <span className="text-muted">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i === 0 ? "#6366F1" : "#C7D2FE" }} />
                  </div>
                </div>
              );
            })}
          </div>
          {topIndustry && (
            <p className="mt-2 text-[11px] text-gray-600">
              {topIndustry.업종}이 매출의 {topPct}%를 차지
              {topPct > 40 ? " — 특정 업종 집중형 상권" : topPct > 25 ? " — 주요 업종 중심 상권" : " — 다양한 업종 분포"}
            </p>
          )}
        </Collapsible>
      )}
    </div>
  );
}
