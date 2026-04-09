"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowUpRight,
  Search,
} from "lucide-react";
import CountUp from "@/components/CountUp";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from "recharts";
import { chartTheme } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import {
  getDashboardStats,
  getTrendData,
  getTopAreas,
  getIndustryStats,
  getWeeklyFootTraffic,
  getRecentAnalyses,
  getGreeting,
  type Period,
  type DashboardStats,
  type TrendDataPoint,
  type TopArea,
  type IndustryRow,
  type FootTrafficDay,
  type RecentAnalysis,
} from "@/lib/dashboard-data";

const tooltipStyle = chartTheme.tooltip;

/* ── 숫자 포맷 ── */
function fmtK(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

const BASE_URL = "";
const PERIOD_OPTIONS = [
  { value: "3m", label: "3개월" },
  { value: "6m", label: "6개월" },
  { value: "1y", label: "1년" },
  { value: "2y", label: "2년" },
  { value: "3y", label: "3년" },
] as const;

interface AreaGroup { key: string; label: string; }
interface TrendApiPoint { quarter: string; 개업: number; 폐업: number; }
interface FootTrafficApiPoint { quarter: string; 유동인구: number; }

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [period, setPeriod] = useState<string>("6m");
  const [topAreas, setTopAreas] = useState<TopArea[]>([]);
  const [industry, setIndustry] = useState<IndustryRow[]>([]);
  const [weekly, setWeekly] = useState<FootTrafficDay[]>([]);
  const [recent, setRecent] = useState<RecentAnalysis[]>([]);

  // 상권 선택
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [selectedArea, setSelectedArea] = useState("서울 전체");

  // 실제 API 트렌드 데이터
  const [trendData, setTrendData] = useState<TrendApiPoint[]>([]);
  const [ftTrendData, setFtTrendData] = useState<FootTrafficApiPoint[]>([]);
  const [salesTrend, setSalesTrend] = useState<Array<{ quarter: string; 매출_억: number; 건수_만: number }>>([]);
  const [salesByIndustry, setSalesByIndustry] = useState<Array<{ 업종: string; 매출_억: number; 전분기대비: number }>>([]);
  const [dataRange, setDataRange] = useState<Record<string, string>>({});

  useEffect(() => {
    getDashboardStats().then(setStats);
    getTopAreas().then(setTopAreas);
    setRecent(getRecentAnalyses());
    fetch(`${BASE_URL}/api/dashboard/area-groups`)
      .then((r) => r.json())
      .then(setAreaGroups)
      .catch(() => {});
  }, []);

  // 기간 + 상권 변경 시 트렌드 API 호출
  useEffect(() => {
    const url = `${BASE_URL}/api/dashboard/trend?area=${encodeURIComponent(selectedArea)}&period=${period}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setTrendData(data["개폐업"] ?? []);
        setFtTrendData(data["유동인구"] ?? []);
        setSalesTrend(data["매출"] ?? []);
        setSalesByIndustry(data["매출_업종별"] ?? []);
        setDataRange(data["data_range"] ?? {});
      })
      .catch(() => {});

    // 하단 더미 차트도 갱신
    const p = (["3m", "6m", "1y"].includes(period) ? period : "1y") as Period;
    getIndustryStats(p).then(setIndustry);
    getWeeklyFootTraffic(p).then(setWeekly);
  }, [period, selectedArea]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="space-y-6 animate-fade-in">
        {/* ── 상단 헤더 ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">서울 상권 대시보드</h1>
            <p className="mt-1 text-sm text-muted">
              2026년 4월 기준 · 최종 업데이트: 2026.03.31
            </p>
          </div>
          <div className="flex h-11 w-80 items-center gap-2 rounded-full border border-gray-100 bg-white px-4 shadow-sm">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              type="text"
              placeholder="상권, 지역명, 주소 검색"
              className="flex-1 bg-transparent text-[14px] text-gray-700 outline-none placeholder:text-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) window.location.href = `/map?search=${encodeURIComponent(val)}`;
                }
              }}
            />
          </div>
        </div>

        {/* ── 지표 카드 3개 ── */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          <StatCard
            icon={Building2}
            label="총 상가 데이터"
            value={1284}
            suffix="만 건"
            iconColor="#0EA5E9"
            iconBg="#F0F9FF"
          />
          <StatCard
            icon={TrendingUp}
            label="이번 달 신규 개업"
            value={3241}
            suffix="개"
            change="+8.2%"
            changeColor="text-emerald-500"
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />
          <StatCard
            icon={TrendingDown}
            label="이번 달 폐업"
            value={2103}
            suffix="개"
            change="-3.1%"
            changeColor="text-emerald-500"
            iconColor="#F43F5E"
            iconBg="#FFF1F2"
          />
        </div>

        {/* ── 2컬럼: 개폐업 추이 + TOP 10 ── */}
        <OpenCloseAndTop10 />

        {/* ── 3컬럼 카드 ── */}
        <ThreeColumnCards />

        {/* ── 상권 선택 태그 ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-gray-700">상권</span>
          {areaGroups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedArea(g.key)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95 ${
                selectedArea === g.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-white text-gray-600 shadow-card hover:bg-primary-50 hover:text-primary-600"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* ── 중단: 트렌드 차트 + TOP 5 ── */}
        <div className="grid grid-cols-12 gap-5">
          {/* 좌측: 상권 트렌드 (실제 API) */}
          <div className="col-span-8 space-y-5">
            {/* 개업/폐업 차트 (1년 고정 — 데이터 4분기만 보유) */}
            <div className="rounded-[20px] bg-card p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-gray-900">
                  {selectedArea} · 분기별 개업 vs 폐업
                </h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-muted">
                  2024년 데이터
                </span>
              </div>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="fillOpen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillClose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F87171" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#F87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...tooltipStyle} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#64748B", paddingTop: 8 }} />
                    <Area type="monotone" dataKey="개업" stroke="#6366F1" strokeWidth={2} fill="url(#fillOpen)" dot={{ r: 3, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="폐업" stroke="#F87171" strokeWidth={2} fill="url(#fillClose)" dot={{ r: 3, fill: "#F87171", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-[13px] text-muted">데이터 없음</div>
              )}
            </div>

            {/* 유동인구 트렌드 (기간 선택 가능 — 7년치 보유) */}
            <div className="rounded-[20px] bg-card p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-gray-900">
                  {selectedArea} · 유동인구 추이
                </h2>
                <div className="flex rounded-full bg-gray-100 p-0.5">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPeriod(opt.value)}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                        period === opt.value
                          ? "bg-white text-gray-800 shadow-sm"
                          : "text-muted hover:text-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {ftTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={ftTrendData}>
                    <defs>
                      <linearGradient id="fillFt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} interval={ftTrendData.length > 8 ? 1 : 0} />
                    <YAxis tickFormatter={(v: number) => v >= 10000 ? `${(v/10000).toFixed(0)}만` : `${(v/1000).toFixed(0)}k`} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()}명`, "일평균 유동인구"]} />
                    <Area type="monotone" dataKey="유동인구" stroke="#0EA5E9" strokeWidth={2} fill="url(#fillFt)" dot={ftTrendData.length <= 8 ? { r: 3, fill: "#0EA5E9", stroke: "#fff", strokeWidth: 2 } : false} activeDot={{ r: 5, fill: "#0EA5E9", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-[13px] text-muted">데이터 없음</div>
              )}
            </div>

            {/* 매출 트렌드 */}
            <div className="rounded-[20px] bg-card p-6 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-gray-900">
                  {selectedArea} · 분기별 매출
                </h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-muted">
                  2025년 데이터
                </span>
              </div>
              {salesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => `${v >= 1000 ? `${(v/1000).toFixed(0)}천` : v}억`} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                    <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()}억원`, "매출"]} />
                    <Bar dataKey="매출_억" fill="#F59E0B" radius={[6, 6, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-[13px] text-muted">
                  해당 기간의 매출 데이터가 없습니다
                </div>
              )}
            </div>

            {/* 업종별 매출 증감 */}
            {salesByIndustry.length > 0 && (
              <div className="rounded-[20px] bg-card p-6 shadow-card">
                <h2 className="mb-3 text-[16px] font-semibold text-gray-900">
                  {selectedArea} · 업종별 매출 증감
                </h2>
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left font-medium text-muted">업종</th>
                        <th className="px-4 py-2 text-right font-medium text-muted">매출</th>
                        <th className="px-4 py-2 text-right font-medium text-muted">전분기 대비</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesByIndustry.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-800">{row.업종}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{row.매출_억.toLocaleString()}억</td>
                          <td className={`px-4 py-2 text-right font-semibold ${
                            row.전분기대비 > 0 ? "text-emerald-500" : row.전분기대비 < 0 ? "text-red-400" : "text-gray-400"
                          }`}>
                            {row.전분기대비 > 0 ? "+" : ""}{row.전분기대비}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 우측: TOP 5 */}
          <div className="col-span-4 flex flex-col rounded-[20px] bg-card p-6 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-gray-900">
              지금 뜨는 상권 TOP 5
            </h2>
            <div className="flex-1 space-y-0">
              {topAreas.map((area, idx) => (
                <div
                  key={area.rank}
                  className={`flex items-center gap-3 rounded-[12px] px-3 py-3 transition-colors hover:bg-gray-50 ${
                    idx < topAreas.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <span className="w-6 text-center text-[15px] font-bold text-primary-600">
                    {area.rank}
                  </span>
                  <span className="flex-1 text-[14px] font-medium text-gray-800">
                    {area.name}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 text-[13px] font-semibold ${
                      area.change >= 0 ? "text-emerald-500" : "text-red-400"
                    }`}
                  >
                    {area.change >= 0 ? (
                      <TrendingUp size={14} />
                    ) : (
                      <TrendingDown size={14} />
                    )}
                    {area.change >= 0 ? "+" : ""}
                    {area.change}%
                  </span>
                </div>
              ))}
            </div>
            <a
              href="/search"
              className="mt-3 flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:text-primary-700"
            >
              전체 보기 <ArrowRight size={14} />
            </a>
          </div>
        </div>

        {/* ── 임대료 · 매각가 (선택 상권 기준) ── */}
        <RentSaleCards selectedArea={selectedArea} />

        {/* ── 하단: 3컬럼 ── */}
        <div className="grid grid-cols-3 gap-5">
          {/* 업종별 개폐업 현황 */}
          <div className="rounded-[20px] bg-card p-6 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-gray-900">
              업종별 개폐업 현황
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={industry} layout="vertical" barGap={0} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="개업" fill="#6366F1" radius={[0, 6, 6, 0]} />
                <Bar dataKey="폐업" fill="#FCA5A5" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-primary-500" />
                개업
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#FCA5A5" }} />
                폐업
              </span>
            </div>
          </div>

          {/* 요일별 유동인구 패턴 */}
          <div className="rounded-[20px] bg-card p-6 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-gray-900">
              요일별 유동인구 패턴
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weekly} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#64748B", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [fmtK(Number(v)) + "명", "유동인구"]}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(v) => fmtK(Number(v))}
                    style={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                  />
                  {weekly.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.day === "토" || entry.day === "일"
                          ? "#6366F1"
                          : "#C7D2FE"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 최근 분석 기록 */}
          <div className="flex flex-col rounded-[20px] bg-card p-6 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-gray-900">
              최근 분석 기록
            </h2>
            {recent.length > 0 ? (
              <div className="flex-1 space-y-0">
                {recent.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between py-3.5 ${
                      idx < recent.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    <div>
                      <p className="text-[14px] font-medium text-gray-800">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">{item.date}</p>
                    </div>
                    <a
                      href="/search"
                      className="text-[12px] font-medium text-primary-600 hover:text-primary-700"
                    >
                      다시 보기
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Search size={20} className="text-muted" />
                </div>
                <p className="text-[13px] text-muted">
                  아직 분석 기록이 없어요.
                  <br />
                  상권을 검색해보세요!
                </p>
                <a
                  href="/search"
                  className="rounded-[var(--radius-button)] bg-primary-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-primary-700"
                >
                  상권 검색하기
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 임대료 · 매각가 카드 (상권에 해당하는 구 기준) ── */

const AREA_TO_GU: Record<string, string> = {
  "명동": "중구", "강남역": "강남구", "한남동": "용산구", "성수동": "성동구",
  "도산공원": "강남구", "홍대입구": "마포구", "연남동": "마포구", "이태원": "용산구",
  "여의도": "영등포구", "잠실": "송파구", "서울 전체": "강남구",
};

function RentSaleCards({ selectedArea }: { selectedArea: string }) {
  const [rent, setRent] = useState<{
    avg_deposit?: number; avg_monthly_rent?: number; avg_rent_per_m2?: number;
    count?: number; source?: string;
  } | null>(null);
  const [sale, setSale] = useState<{
    avg_price_per_m2?: number; avg_price?: number;
    count?: number; source?: string;
  } | null>(null);

  useEffect(() => {
    const gu = AREA_TO_GU[selectedArea] ?? "강남구";
    fetch(`${BASE_URL}/api/rent-live/${encodeURIComponent(gu)}`)
      .then((r) => r.json())
      .then(setRent)
      .catch(() => setRent(null));
    fetch(`${BASE_URL}/api/sale-live/${encodeURIComponent(gu)}`)
      .then((r) => r.json())
      .then(setSale)
      .catch(() => setSale(null));
  }, [selectedArea]);

  const gu = AREA_TO_GU[selectedArea] ?? selectedArea;

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* 임대료 */}
      <div className="rounded-[20px] bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-gray-900">
            상가 임대료 · {gu}
          </h2>
          {rent?.source && (
            <span className="text-[10px] text-gray-400">{rent.source}</span>
          )}
        </div>
        {rent ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[12px] text-muted">평균 보증금</p>
              <p className="mt-1 text-[20px] font-bold text-gray-900">
                {(rent.avg_deposit ?? 0).toLocaleString()}<span className="text-[14px] font-medium">만</span>
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[12px] text-muted">평균 월세</p>
              <p className="mt-1 text-[20px] font-bold text-primary-600">
                {(rent.avg_monthly_rent ?? 0).toLocaleString()}<span className="text-[14px] font-medium">만</span>
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[12px] text-muted">m²당 월세</p>
              <p className="mt-1 text-[20px] font-bold text-gray-900">
                {rent.avg_rent_per_m2 ?? 0}<span className="text-[14px] font-medium">만</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-[13px] text-muted">
            로딩 중...
          </div>
        )}
      </div>

      {/* 매각가 */}
      <div className="rounded-[20px] bg-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-gray-900">
            상업용 부동산 매매 · {gu}
          </h2>
          {sale?.source && (
            <span className="text-[10px] text-gray-400">{sale.source}</span>
          )}
        </div>
        {sale ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[12px] text-muted">m²당 매매가</p>
              <p className="mt-1 text-[20px] font-bold text-gray-900">
                {(sale.avg_price_per_m2 ?? 0).toLocaleString()}<span className="text-[14px] font-medium">만</span>
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 text-center">
              <p className="text-[12px] text-muted">평균 매매가</p>
              <p className="mt-1 text-[20px] font-bold text-amber-600">
                {((sale.avg_price ?? 0) / 10000).toFixed(1)}<span className="text-[14px] font-medium">억</span>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-[13px] text-muted">
            로딩 중...
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 개폐업 추이 + TOP 10 ── */

const TREND_DUMMY: Record<string, Array<{ month: string; 개업: number; 폐업: number }>> = {
  "3m": [
    { month: "1월", 개업: 3400, 폐업: 2500 },
    { month: "2월", 개업: 3200, 폐업: 2550 },
    { month: "3월", 개업: 3600, 폐업: 2100 },
  ],
  "6m": [
    { month: "10월", 개업: 3100, 폐업: 2400 },
    { month: "11월", 개업: 3300, 폐업: 2500 },
    { month: "12월", 개업: 2800, 폐업: 2600 },
    { month: "1월", 개업: 3400, 폐업: 2500 },
    { month: "2월", 개업: 3200, 폐업: 2550 },
    { month: "3월", 개업: 3600, 폐업: 2100 },
  ],
  "1y": [
    { month: "4월", 개업: 2900, 폐업: 2300 },
    { month: "5월", 개업: 3000, 폐업: 2350 },
    { month: "6월", 개업: 3100, 폐업: 2200 },
    { month: "7월", 개업: 2700, 폐업: 2500 },
    { month: "8월", 개업: 2600, 폐업: 2450 },
    { month: "9월", 개업: 2800, 폐업: 2400 },
    { month: "10월", 개업: 3100, 폐업: 2400 },
    { month: "11월", 개업: 3300, 폐업: 2500 },
    { month: "12월", 개업: 2800, 폐업: 2600 },
    { month: "1월", 개업: 3400, 폐업: 2500 },
    { month: "2월", 개업: 3200, 폐업: 2550 },
    { month: "3월", 개업: 3600, 폐업: 2100 },
  ],
};

interface Top10Area {
  rank: number;
  name: string;
  gu: string;
  value: number;
  lat: number;
  lng: number;
}

function OpenCloseAndTop10() {
  const [trendPeriod, setTrendPeriod] = useState<"3m" | "6m" | "1y">("6m");
  const [sortBy, setSortBy] = useState("유동인구 증가율");
  const [top10, setTop10] = useState<Top10Area[]>([]);
  const [loading, setLoading] = useState(true);
  const trendData = TREND_DUMMY[trendPeriod];

  const totalOpen = trendData.reduce((s, d) => s + d.개업, 0);
  const totalClose = trendData.reduce((s, d) => s + d.폐업, 0);
  const net = totalOpen - totalClose;

  // Fetch real data from Supabase
  useEffect(() => {
    let cancelled = false;
    async function fetchTop10() {
      setLoading(true);
      try {
        // Fetch stores (per-area aggregation)
        const { data: storesData } = await supabase
          .from("stores")
          .select("trdar_cd, store_count, open_count, close_count")
          .limit(10000);

        // Fetch foot traffic (per-area totals)
        const { data: ftData } = await supabase
          .from("foot_traffic")
          .select("trdar_cd, total_ft")
          .limit(10000);

        // Fetch sales (per-area totals)
        const { data: salesData } = await supabase
          .from("sales")
          .select("trdar_cd, monthly_sales")
          .limit(10000);

        // Fetch areas for names, lat, lng, gu
        const { data: areasData } = await supabase
          .from("areas")
          .select("trdar_cd, trdar_nm, lat, lng, gu");

        if (cancelled) return;

        const areaMap = new Map(
          (areasData ?? []).map((a) => [a.trdar_cd, a])
        );

        // Aggregate stores by area
        const storesByArea = new Map<string, { store_count: number; open_count: number; close_count: number }>();
        for (const r of storesData ?? []) {
          const existing = storesByArea.get(r.trdar_cd) ?? { store_count: 0, open_count: 0, close_count: 0 };
          existing.store_count += r.store_count ?? 0;
          existing.open_count += r.open_count ?? 0;
          existing.close_count += r.close_count ?? 0;
          storesByArea.set(r.trdar_cd, existing);
        }

        // Aggregate foot traffic by area
        const ftByArea = new Map<string, number>();
        for (const r of ftData ?? []) {
          ftByArea.set(r.trdar_cd, (ftByArea.get(r.trdar_cd) ?? 0) + (r.total_ft ?? 0));
        }

        // Aggregate sales by area
        const salesByArea = new Map<string, number>();
        for (const r of salesData ?? []) {
          salesByArea.set(r.trdar_cd, (salesByArea.get(r.trdar_cd) ?? 0) + (r.monthly_sales ?? 0));
        }

        // Build per-area metrics
        const allCodes = new Set([
          ...storesByArea.keys(),
          ...ftByArea.keys(),
          ...salesByArea.keys(),
        ]);

        const areaMetrics: Array<{
          trdar_cd: string;
          name: string;
          gu: string;
          lat: number;
          lng: number;
          footTraffic: number;
          openRate: number;
          totalSales: number;
        }> = [];

        for (const code of allCodes) {
          const area = areaMap.get(code);
          if (!area) continue;

          const stores = storesByArea.get(code) ?? { store_count: 0, open_count: 0, close_count: 0 };
          const ft = ftByArea.get(code) ?? 0;
          const sales = salesByArea.get(code) ?? 0;
          const denom = stores.open_count + stores.close_count + stores.store_count;
          const openRate = denom > 0 ? (stores.open_count / denom) * 100 : 0;

          areaMetrics.push({
            trdar_cd: code,
            name: area.trdar_nm,
            gu: area.gu ?? "",
            lat: area.lat ?? 0,
            lng: area.lng ?? 0,
            footTraffic: ft,
            openRate,
            totalSales: sales,
          });
        }

        // Sort by selected criteria
        let sorted: typeof areaMetrics;
        if (sortBy === "신규 개업률") {
          sorted = [...areaMetrics].sort((a, b) => b.openRate - a.openRate);
        } else if (sortBy === "매출 증가율") {
          sorted = [...areaMetrics].sort((a, b) => b.totalSales - a.totalSales);
        } else {
          // 유동인구 증가율
          sorted = [...areaMetrics].sort((a, b) => b.footTraffic - a.footTraffic);
        }

        const top = sorted.slice(0, 10).map((m, i) => ({
          rank: i + 1,
          name: m.name,
          gu: m.gu,
          value:
            sortBy === "신규 개업률"
              ? Math.round(m.openRate * 10) / 10
              : sortBy === "매출 증가율"
              ? Math.round(m.totalSales / 10000) // 만원 단위
              : Math.round(m.footTraffic / 1000), // 천명 단위
          lat: m.lat,
          lng: m.lng,
        }));

        setTop10(top);
      } catch {
        // keep empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTop10();
    return () => { cancelled = true; };
  }, [sortBy]);

  const valueSuffix =
    sortBy === "신규 개업률" ? "%" : sortBy === "매출 증가율" ? "만" : "천명";

  return (
    <div className="mt-6 grid grid-cols-12 gap-6">
      {/* ── 좌측: 개폐업 추이 ── */}
      <div className="col-span-8 rounded-[20px] bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">서울 개폐업 추이</h2>
          <div className="flex rounded-full bg-gray-100 p-0.5">
            {([["3m", "3개월"], ["6m", "6개월"], ["1y", "1년"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTrendPeriod(val)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                  trendPeriod === val
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="gradOpen2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradClose2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip {...tooltipStyle} />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "#64748B", paddingTop: 12 }}
              formatter={(value) => <span className="text-gray-600">{value === "개업" ? "신규 개업" : "폐업"}</span>}
            />
            <Area
              type="monotone"
              dataKey="개업"
              stroke="#6366F1"
              strokeWidth={2.5}
              fill="url(#gradOpen2)"
              dot={false}
              activeDot={{ r: 5, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }}
              animationDuration={800}
            />
            <Area
              type="monotone"
              dataKey="폐업"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#gradClose2)"
              dot={false}
              activeDot={{ r: 5, fill: "#EF4444", stroke: "#fff", strokeWidth: 2 }}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>

        <p className="mt-4 text-sm text-gray-500">
          최근 {trendPeriod === "3m" ? "3개월" : trendPeriod === "6m" ? "6개월" : "1년"}{" "}
          순증{" "}
          <span className="font-bold text-emerald-500">+{net.toLocaleString()}개</span>{" "}
          (개업 {totalOpen.toLocaleString()} / 폐업 {totalClose.toLocaleString()})
        </p>
      </div>

      {/* ── 우측: TOP 10 ── */}
      <div className="col-span-4 flex flex-col rounded-[20px] bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">뜨는 상권 TOP 10</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-600 outline-none focus:border-primary-300"
          >
            <option>유동인구 증가율</option>
            <option>신규 개업률</option>
            <option>매출 증가율</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 340 }}>
          {loading ? (
            <div className="flex h-full items-center justify-center text-[13px] text-muted">
              로딩 중...
            </div>
          ) : top10.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[13px] text-muted">
              데이터 없음
            </div>
          ) : (
            top10.map((area, idx) => (
              <div
                key={area.rank}
                onClick={() => { window.location.href = `/map?lat=${area.lat}&lng=${area.lng}`; }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-gray-50 ${
                  idx < top10.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <span
                  className={`w-8 text-center text-[15px] font-bold ${
                    area.rank <= 3 ? "text-primary-600" : "text-muted"
                  }`}
                >
                  {area.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-gray-800">{area.name}</p>
                  <p className="text-[11px] text-muted">{area.gu}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[14px] font-semibold text-emerald-500">
                    {area.value.toLocaleString()}{valueSuffix}
                  </span>
                  <ArrowUpRight size={14} className="text-emerald-500" />
                </div>
              </div>
            ))
          )}
        </div>

        <a
          href="/map"
          className="mt-3 block text-center text-[13px] font-medium text-primary-600 transition-colors hover:text-primary-700 hover:underline"
        >
          전체 순위 보기 →
        </a>
      </div>
    </div>
  );
}

/* ── 3컬럼 카드: 업종별 개폐업 + 요일별 유동인구 + 바로가기 ── */

const SHORTCUTS = [
  { name: "강남역", tag: "오피스 밀집", stat: "상가 2,100개", code: "gangnam", lat: 37.4979, lng: 127.0276 },
  { name: "홍대입구", tag: "MZ 핫플", stat: "카페 28%", code: "hongdae", lat: 37.5571, lng: 126.9233 },
  { name: "성수동", tag: "급성장 중", stat: "+24%", code: "seongsu", lat: 37.5445, lng: 127.0560 },
  { name: "이태원", tag: "F&B 특화", stat: "주점 밀집", code: "itaewon", lat: 37.5346, lng: 126.9944 },
  { name: "여의도", tag: "직장인 상권", stat: "점심 피크", code: "yeouido", lat: 37.5218, lng: 126.9245 },
  { name: "을지로", tag: "뉴트로", stat: "+18%", code: "euljiro", lat: 37.5665, lng: 126.9918 },
];

function ThreeColumnCards() {
  const [industryData, setIndustryData] = useState<Array<{ name: string; 개업: number; 폐업: number }>>([]);
  const [weekdayData, setWeekdayData] = useState<Array<{ day: string; value: number }>>([]);

  useEffect(() => {
    // Fetch industry data from stores table
    async function fetchIndustry() {
      const { data } = await supabase
        .from("stores")
        .select("svc_nm, store_count, open_count, close_count")
        .limit(10000);

      if (!data) return;

      const bySvc = new Map<string, { store_count: number; open_count: number; close_count: number }>();
      for (const r of data) {
        const nm = r.svc_nm ?? "기타";
        const existing = bySvc.get(nm) ?? { store_count: 0, open_count: 0, close_count: 0 };
        existing.store_count += r.store_count ?? 0;
        existing.open_count += r.open_count ?? 0;
        existing.close_count += r.close_count ?? 0;
        bySvc.set(nm, existing);
      }

      const sorted = Array.from(bySvc.entries())
        .map(([name, v]) => ({ name, 개업: v.open_count, 폐업: v.close_count, _total: v.store_count }))
        .sort((a, b) => b._total - a._total)
        .slice(0, 5)
        .map(({ name, 개업, 폐업 }) => ({ name, 개업, 폐업 }));

      setIndustryData(sorted);
    }

    // Fetch weekday foot traffic from foot_traffic table
    async function fetchWeekday() {
      const { data } = await supabase
        .from("foot_traffic")
        .select("mon, tue, wed, thu, fri, sat, sun")
        .limit(10000);

      if (!data) return;

      let mon = 0, tue = 0, wed = 0, thu = 0, fri = 0, sat = 0, sun = 0;
      for (const r of data) {
        mon += r.mon ?? 0;
        tue += r.tue ?? 0;
        wed += r.wed ?? 0;
        thu += r.thu ?? 0;
        fri += r.fri ?? 0;
        sat += r.sat ?? 0;
        sun += r.sun ?? 0;
      }

      setWeekdayData([
        { day: "월", value: mon },
        { day: "화", value: tue },
        { day: "수", value: wed },
        { day: "목", value: thu },
        { day: "금", value: fri },
        { day: "토", value: sat },
        { day: "일", value: sun },
      ]);
    }

    fetchIndustry();
    fetchWeekday();
  }, []);

  const peakValue = weekdayData.length > 0 ? Math.max(...weekdayData.map((d) => d.value)) : 0;

  return (
    <div className="mt-6 grid grid-cols-3 gap-6">
      {/* 카드 1: 업종별 개폐업 */}
      <div className="rounded-[20px] bg-white p-6 shadow-card">
        <h3 className="mb-4 text-[16px] font-semibold text-gray-900">업종별 개폐업</h3>
        {industryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={industryData} layout="vertical" barGap={2} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="개업" fill="#818CF8" radius={[0, 4, 4, 0]} animationDuration={800} />
              <Bar dataKey="폐업" fill="#FCA5A5" radius={[0, 4, 4, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-muted">로딩 중...</div>
        )}
        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-primary-400" />개업</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: "#FCA5A5" }} />폐업</span>
        </div>
      </div>

      {/* 카드 2: 요일별 유동인구 */}
      <div className="rounded-[20px] bg-white p-6 shadow-card">
        <h3 className="mb-4 text-[16px] font-semibold text-gray-900">요일별 유동인구</h3>
        {weekdayData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weekdayData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#64748B", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()}명`, "유동인구"]} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
                {weekdayData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.day === "토" || entry.day === "일" ? "#6366F1" : "#A5B4FC"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-muted">로딩 중...</div>
        )}
        {/* PEAK 뱃지 — 가장 높은 요일 위 */}
        {weekdayData.length > 0 && (
          <div className="mt-1 flex justify-center text-[11px]">
            <span className="text-muted">
              피크: <span className="font-semibold text-primary-600">
                {weekdayData.find((d) => d.value === peakValue)?.day}요일 {(peakValue / 10000).toFixed(1)}만명
              </span>
            </span>
          </div>
        )}
      </div>

      {/* 카드 3: 주요 상권 바로가기 */}
      <div className="rounded-[20px] bg-white p-6 shadow-card">
        <h3 className="mb-4 text-[16px] font-semibold text-gray-900">주요 상권 바로가기</h3>
        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map((s) => (
            <div
              key={s.code}
              onClick={() => { window.location.href = `/map?lat=${s.lat}&lng=${s.lng}`; }}
              className="cursor-pointer rounded-xl bg-gray-50 p-3 transition-all duration-150
                hover:-translate-y-0.5 hover:border hover:border-primary-200 hover:bg-primary-50 hover:shadow-sm"
            >
              <p className="text-[13px] font-medium text-gray-800">{s.name}</p>
              <p className="text-[11px] text-muted">{s.tag}</p>
              <p className="mt-1 text-[12px] font-semibold text-primary-600">{s.stat}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── StatCard with CountUp ── */

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  change,
  changeColor,
  iconColor,
  iconBg,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
  suffix?: string;
  change?: string;
  changeColor?: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] bg-white p-6 shadow-card">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
        style={{ background: iconBg }}
      >
        <Icon size={22} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-gray-900">
          <CountUp end={value} suffix={suffix} />
        </p>
        {change && (
          <p className={`mt-0.5 text-sm ${changeColor ?? "text-muted"}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}
