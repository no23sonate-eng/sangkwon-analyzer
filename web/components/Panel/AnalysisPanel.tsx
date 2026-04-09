"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  AreaChart, Area, LineChart, Line, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import { chartTheme } from "@/lib/colors";
import {
  getAreaOverview, getFootTraffic, getRentalData, getOpenCloseData,
  type AreaOverview, type FootTrafficData, type RentalData, type OpenCloseData,
} from "@/lib/area-analysis-data";

const tt = chartTheme.tooltip;
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = ["06", "08", "10", "12", "14", "16", "18", "20", "22"];

interface Props {
  areaCode: string;
  onClose: () => void;
}

export default function AnalysisPanel({ areaCode, onClose }: Props) {
  const [overview, setOverview] = useState<AreaOverview | null>(null);
  const [traffic, setTraffic] = useState<FootTrafficData | null>(null);
  const [rental, setRental] = useState<RentalData | null>(null);
  const [openClose, setOpenClose] = useState<OpenCloseData | null>(null);
  const [dayType, setDayType] = useState<"weekday" | "weekend">("weekday");

  useEffect(() => {
    getAreaOverview(areaCode).then(setOverview);
    getFootTraffic(areaCode).then(setTraffic);
    getRentalData(areaCode).then(setRental);
    getOpenCloseData(areaCode).then(setOpenClose);
  }, [areaCode]);

  if (!overview) return null;

  const peakHour = traffic
    ? traffic.hourly.reduce((a, b) => (b.value > a.value ? b : a))
    : null;
  const maxAge = traffic
    ? traffic.age.reduce((a, b) => (b.value > a.value ? b : a))
    : null;

  return (
    <div className="animate-slide-in absolute left-0 top-0 z-30 flex h-full w-[400px] flex-col bg-white shadow-xl">
      {/* ── 헤더 (고정) ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{overview.name}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {overview.address} · {(overview.areaM2 / 1000).toFixed(0)}천㎡
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* ── 스크롤 영역 ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 panel-scroll">
        <div className="space-y-6">

          {/* ━━ 섹션 1: 핵심 지표 ━━ */}
          <div className="grid grid-cols-3 gap-3">
            {/* 상권 활력 */}
            <div className="flex flex-col items-center rounded-xl bg-gray-50 p-4">
              <div className="relative h-16 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
                    startAngle={225} endAngle={-45} barSize={6}
                    data={[{ value: overview.vitality, fill: overview.vitality >= 80 ? "#10B981" : overview.vitality >= 60 ? "#F59E0B" : "#EF4444" }]}
                  >
                    <RadialBar dataKey="value" cornerRadius={4} background={{ fill: "#E2E8F0" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-gray-900">
                  {overview.vitality}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">상권 활력</p>
            </div>
            {/* 총 상가 */}
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[20px] font-bold text-gray-900">{overview.totalStores.toLocaleString()}</p>
              <p className="text-[11px] text-muted">총 상가</p>
              <p className="mt-0.5 text-[11px] font-semibold text-emerald-500">전년 +{overview.storeChangeYoY}%</p>
            </div>
            {/* 평균 영업 */}
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[20px] font-bold text-gray-900">{overview.avgBusinessYears}</p>
              <p className="text-[11px] text-muted">평균 영업(년)</p>
            </div>
          </div>

          {/* ━━ 섹션 2: 업종 분포 ━━ */}
          <Section title="업종 분포">
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={overview.categories}
                    dataKey="count" nameKey="name"
                    cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
                    paddingAngle={2} stroke="none"
                  >
                    {overview.categories.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip {...tt} formatter={(v) => `${Number(v).toLocaleString()}개`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[18px] font-bold text-gray-900">{overview.totalStores.toLocaleString()}</p>
                  <p className="text-[11px] text-muted">총 상가</p>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {overview.categories.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-[12px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="text-gray-600">{c.name}</span>
                  <span className="ml-auto text-muted">{c.count}개({c.ratio}%)</span>
                </div>
              ))}
            </div>
          </Section>

          {/* ━━ 섹션 3: 유동인구 ━━ */}
          {traffic && (
            <Section
              title="유동인구"
              right={
                <div className="flex rounded-full bg-gray-100 p-0.5">
                  {(["weekday", "weekend"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setDayType(t)}
                      className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                        dayType === t ? "bg-white text-gray-800 shadow-sm" : "text-muted"
                      }`}
                    >
                      {t === "weekday" ? "평일" : "주말"}
                    </button>
                  ))}
                </div>
              }
            >
              <p className="mb-3 text-xl font-bold text-gray-900">
                {traffic.dailyAvg.toLocaleString()}<span className="ml-1 text-sm font-medium text-muted">명/일</span>
              </p>

              {/* 시간대별 바 */}
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={traffic.hourly} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}시`} />
                  <YAxis hide />
                  <Tooltip {...tt} formatter={(v) => [`${Number(v).toLocaleString()}명`, "유동인구"]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={800}>
                    {traffic.hourly.map((h, i) => (
                      <Cell key={i} fill={h.value === peakHour?.value ? "#6366F1" : "#A5B4FC"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {peakHour && (
                <p className="mt-1 text-center text-[11px] text-muted">
                  피크: <span className="font-semibold text-primary-600">{peakHour.hour}시 ({peakHour.value.toLocaleString()}명)</span>
                </p>
              )}

              {/* 히트맵 */}
              <p className="mb-2 mt-4 text-[12px] font-semibold text-gray-700">요일 × 시간대</p>
              <div className="grid gap-1" style={{ gridTemplateColumns: `32px repeat(${HOURS.length}, 1fr)` }}>
                <div />
                {HOURS.map((h) => (
                  <div key={h} className="text-center text-[9px] text-muted">{h}</div>
                ))}
                {traffic.heatmap.map((row, ri) => (
                  <>
                    <div key={`day-${ri}`} className="flex items-center justify-end pr-1 text-[10px] text-muted">
                      {DAYS[ri]}
                    </div>
                    {row.map((val, ci) => {
                      const intensity = Math.min(val / 65, 1);
                      const alpha = 0.08 + intensity * 0.7;
                      return (
                        <div
                          key={`${ri}-${ci}`}
                          className="aspect-square rounded-[4px] transition-transform hover:scale-110"
                          style={{ background: `rgba(99,102,241,${alpha})` }}
                          title={`${DAYS[ri]} ${HOURS[ci]}시: ${val}%`}
                        />
                      );
                    })}
                  </>
                ))}
              </div>

              {/* 성별 + 연령대 */}
              <p className="mb-2 mt-4 text-[12px] font-semibold text-gray-700">방문자 프로필</p>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[11px] text-muted">남 {traffic.gender.male}%</span>
                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full">
                  <div className="bg-blue-400" style={{ width: `${traffic.gender.male}%` }} />
                  <div className="bg-pink-400" style={{ width: `${traffic.gender.female}%` }} />
                </div>
                <span className="text-[11px] text-muted">여 {traffic.gender.female}%</span>
              </div>
              <div className="space-y-1.5">
                {traffic.age.map((a) => (
                  <div key={a.label} className="flex items-center gap-2">
                    <span className="w-8 text-[11px] text-muted">{a.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${a.value}%`,
                          background: a.value === maxAge?.value ? "#6366F1" : "#C7D2FE",
                        }}
                      />
                    </div>
                    <span className="w-7 text-right text-[11px] font-medium text-gray-600">{a.value}%</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ━━ 섹션 4: 임대 시장 ━━ */}
          {rental && (
            <Section title="임대 시장">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] text-muted">3.3㎡당 월 임대료</p>
                  <p className="text-[20px] font-bold text-gray-900">{rental.avgRentPerM2}<span className="text-[13px] font-medium">만원</span></p>
                  <p className={`text-[11px] font-semibold ${rental.rentChangeQoQ >= 0 ? "text-emerald-500" : "text-red-400"}`}>
                    전분기 {rental.rentChangeQoQ >= 0 ? "+" : ""}{rental.rentChangeQoQ}%
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-[11px] text-muted">공실률</p>
                  <p className="text-[20px] font-bold text-gray-900">{rental.vacancyRate}%</p>
                  <p className={`text-[11px] font-semibold ${rental.vacancyChange <= 0 ? "text-emerald-500" : "text-red-400"}`}>
                    {rental.vacancyChange}%
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={rental.rentTrend}>
                  <defs>
                    <linearGradient id="rentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis hide />
                  <Tooltip {...tt} formatter={(v) => [`${v}만원`, "임대료"]} />
                  <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={2} fill="url(#rentFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>

              <p className="mb-2 mt-4 text-[12px] font-semibold text-gray-700">최근 실거래</p>
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-muted">거래일</th>
                      <th className="px-3 py-2 text-left font-medium text-muted">건물명</th>
                      <th className="px-3 py-2 text-right font-medium text-muted">면적</th>
                      <th className="px-3 py-2 text-right font-medium text-muted">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rental.recentDeals.map((d, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2 text-muted">{d.date}</td>
                        <td className="px-3 py-2 font-medium text-gray-700">{d.building}</td>
                        <td className="px-3 py-2 text-right text-muted">{d.areaM2}㎡</td>
                        <td className="px-3 py-2 text-right text-gray-700">{d.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ━━ 섹션 5: 개폐업 동향 ━━ */}
          {openClose && (
            <Section title="개폐업 동향">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={openClose.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis hide />
                  <Tooltip {...tt} />
                  <Legend verticalAlign="bottom" iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="개업" stroke="#6366F1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="폐업" stroke="#F87171" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-3 text-[13px] text-gray-500">
                순증 <span className="font-bold text-emerald-500">+{openClose.netChange}개</span>{" "}
                (개업 {openClose.totalOpen} / 폐업 {openClose.totalClose})
              </p>
            </Section>
          )}

          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}

/* ── 섹션 래퍼 ── */
function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
