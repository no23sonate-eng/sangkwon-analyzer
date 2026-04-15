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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { chartTheme } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import {
  getDashboardStats,
  getTopAreas,
  type DashboardStats,
  type TopArea,
} from "@/lib/dashboard-data";

const tooltipStyle = chartTheme.tooltip;

/* ── 숫자 포맷 ── */
function fmtK(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

const BASE_URL = "";
interface AreaGroup { key: string; label: string; }

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topAreas, setTopAreas] = useState<TopArea[]>([]);

  // 상권 선택
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [selectedArea, setSelectedArea] = useState("서울 전체");

  // KPI 데이터
  const [kpi, setKpi] = useState<Record<string, { value: number; label: string; change_pct: number }> | null>(null);

  // 실제 API 트렌드 데이터
  const [salesByIndustry, setSalesByIndustry] = useState<Array<{ 업종: string; 매출_억: number; 전분기대비: number }>>([]);

  useEffect(() => {
    getDashboardStats().then(setStats);
    getTopAreas().then(setTopAreas);
    fetch(`${BASE_URL}/api/dashboard/area-groups`)
      .then((r) => r.json())
      .then(setAreaGroups)
      .catch(() => {});
  }, []);

  const [fetchError, setFetchError] = useState(false);

  // 상권 변경 시 KPI + 트렌드 API 호출
  useEffect(() => {
    const q = `area=${encodeURIComponent(selectedArea)}`;
    setFetchError(false);
    Promise.all([
      fetch(`${BASE_URL}/api/dashboard/kpi?${q}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BASE_URL}/api/dashboard/trend?${q}&period=6m`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([kpiData, trendData]) => {
        if (kpiData) setKpi(kpiData);
        if (trendData) setSalesByIndustry(trendData["매출_업종별"] ?? []);
        if (!kpiData || !trendData) setFetchError(true);
      })
      .catch(() => setFetchError(true));
  }, [selectedArea]);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="space-y-6 animate-fade-in">
        {fetchError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-800">
            일부 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        )}
        {/* ── 상단 헤더 ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">서울 상권 대시보드</h1>
            <p className="mt-1 text-sm text-muted">
              {(() => {
                const label = kpi?.monthly_open?.label ?? "";
                const m = label.match(/\d{4}\s*Q[1-4]/);
                return m ? `${m[0]} 기준 · 서울시 열린데이터` : "서울시 열린데이터 기반";
              })()}
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

        {/* ── 지표 카드 3개 (DB 기반) ── */}
        <div className="mt-8 grid grid-cols-3 gap-6">
          <StatCard
            icon={Building2}
            label={kpi?.total_stores?.label ?? "총 상가 데이터"}
            value={Math.round((kpi?.total_stores?.value ?? 12840000) / 10000)}
            suffix="만 건"
            iconColor="#0EA5E9"
            iconBg="#F0F9FF"
          />
          <StatCard
            icon={TrendingUp}
            label={kpi?.monthly_open?.label ?? "신규 개업"}
            value={kpi?.monthly_open?.value ?? 3241}
            suffix="개"
            change={kpi?.monthly_open ? `${kpi.monthly_open.change_pct > 0 ? "+" : ""}${kpi.monthly_open.change_pct}%` : undefined}
            changeColor="text-emerald-500"
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />
          <StatCard
            icon={TrendingDown}
            label={kpi?.monthly_close?.label ?? "폐업"}
            value={kpi?.monthly_close?.value ?? 2103}
            suffix="개"
            change={kpi?.monthly_close ? `${kpi.monthly_close.change_pct > 0 ? "+" : ""}${kpi.monthly_close.change_pct}%` : undefined}
            changeColor="text-emerald-500"
            iconColor="#F43F5E"
            iconBg="#FFF1F2"
          />
        </div>

        {/* ── TOP 10 ── */}
        <OpenCloseAndTop10 />

        {/* ── 상권 선택 태그 (여기 아래 모든 차트가 상권 필터 연동) ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-white p-4 shadow-card">
          <span className="text-[13px] font-semibold text-gray-700 mr-1">분석 상권</span>
          {areaGroups.map((g) => (
            <button
              key={g.key}
              onClick={() => setSelectedArea(g.key)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium transition-all active:scale-95 ${
                selectedArea === g.key
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-primary-50 hover:text-primary-600"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* ── 중단: 업종별 매출 증감 그래프 + TOP 5 ── */}
        <div className="grid grid-cols-12 gap-5">
          {/* 좌측: 업종별 매출 증감 (바 차트) */}
          <div className="col-span-8">
            {salesByIndustry.length > 0 && (
              <div className="rounded-[20px] bg-card p-6 shadow-card">
                <h2 className="mb-4 text-[16px] font-semibold text-gray-900">
                  {selectedArea} · 업종별 매출 증감
                </h2>
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={salesByIndustry.slice(0, 10)}
                    layout="vertical"
                    barSize={20}
                    margin={{ left: 80, right: 60, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="업종"
                      tick={{ fill: "#334155", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={78}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => [`${Number(v).toLocaleString()}억`, "매출"]}
                    />
                    <Bar dataKey="매출_억" radius={[0, 6, 6, 0]} animationDuration={800}>
                      {salesByIndustry.slice(0, 10).map((row, i) => (
                        <Cell
                          key={i}
                          fill={row.전분기대비 > 0 ? "#10B981" : row.전분기대비 < 0 ? "#F43F5E" : "#94A3B8"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* 전분기 대비 증감 레이블 */}
                <div className="mt-3 flex flex-wrap gap-2 px-2">
                  {salesByIndustry.slice(0, 10).map((row, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        row.전분기대비 > 0
                          ? "bg-emerald-50 text-emerald-600"
                          : row.전분기대비 < 0
                          ? "bg-red-50 text-red-500"
                          : "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {row.업종}
                      {row.전분기대비 > 0 ? " +" : " "}{row.전분기대비}%
                    </span>
                  ))}
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

        {/* ── 업종별 점포수 · 주요 상권 바로가기 ── */}
        <TwoColumnCards selectedArea={selectedArea} />

        <div className="mt-8 border-t border-gray-100 pt-4 text-[11px] leading-relaxed text-muted">
          <p>
            데이터 출처: 서울 열린데이터광장(서울시 상권분석서비스·실거래가), 한국부동산원 상업용부동산 임대동향조사,
            공개 부동산 시세정보. 모든 지표는 참고용 추정치이며 실제 시장 상황과 차이가 있을 수 있습니다.
          </p>
          <p className="mt-1">
            본 서비스는 정보 제공 목적이며, 투자·매매·계약의 근거로 사용할 수 없습니다.
          </p>
        </div>

      </div>
    </div>
  );
}

/* ── 임대료 · 매각가 카드 (상권에 해당하는 구 기준) ── */

const AREA_TO_GU: Record<string, string> = {
  "서울 전체": "서울 전체",
  "강남역": "강남구",
  "도산공원": "강남구",
  "한남동": "용산구",
  "성수동": "성동구",
  "홍대역": "마포구",
  "명동": "중구",
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
    const gu = AREA_TO_GU[selectedArea] ?? selectedArea;
    if (gu === "서울 전체") { setRent(null); setSale(null); return; }
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

/* ── TOP 10 ── */

interface Top10Area {
  rank: number;
  name: string;
  gu: string;
  value: number;
  lat: number;
  lng: number;
}

function OpenCloseAndTop10() {
  const [sortBy, setSortBy] = useState("유동인구 규모");
  const [top10, setTop10] = useState<Top10Area[]>([]);
  const [loading, setLoading] = useState(true);

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
          const ocTotal = stores.open_count + stores.close_count;
          const openRate = ocTotal > 0 ? (stores.open_count / ocTotal) * 100 : 0;

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
        } else if (sortBy === "매출 규모") {
          sorted = [...areaMetrics].sort((a, b) => b.totalSales - a.totalSales);
        } else {
          // 유동인구 규모
          sorted = [...areaMetrics].sort((a, b) => b.footTraffic - a.footTraffic);
        }

        const top = sorted.slice(0, 10).map((m, i) => ({
          rank: i + 1,
          name: m.name,
          gu: m.gu,
          value:
            sortBy === "신규 개업률"
              ? Math.round(m.openRate * 10) / 10
              : sortBy === "매출 규모"
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
    sortBy === "신규 개업률" ? "%" : sortBy === "매출 규모" ? "만" : "천명";

  return (
    <div className="mt-6 grid grid-cols-1">
      {/* ── TOP 10 ── */}
      <div className="flex flex-col rounded-[20px] bg-white p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">뜨는 상권 TOP 10</h2>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[12px] text-gray-600 outline-none focus:border-primary-300"
          >
            <option>유동인구 규모</option>
            <option>신규 개업률</option>
            <option>매출 규모</option>
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

/* 상권 키워드 → trdar_cd 해결 (trend API와 동일 로직) */
const AREA_KEYWORDS_CLIENT: Record<string, string[]> = {
  "강남역": ["강남역", "강남"],
  "도산공원": ["도산공원", "압구정", "신사동 가로수길", "가로수길"],
  "한남동": ["한남", "이태원"],
  "성수동": ["성수"],
  "홍대역": ["홍대", "서교", "동교"],
  "명동": ["명동"],
};

async function resolveTrdarCds(area: string): Promise<string[] | null> {
  if (area === "서울 전체") return null;
  const kws = AREA_KEYWORDS_CLIENT[area] ?? [area];
  const all = new Set<string>();
  for (const kw of kws) {
    const { data } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${kw}%`);
    if (data) for (const r of data) all.add(r.trdar_cd);
  }
  return all.size > 0 ? Array.from(all) : null;
}

function TwoColumnCards({ selectedArea }: { selectedArea: string }) {
  const [industryData, setIndustryData] = useState<Array<{ name: string; 점포수: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    setIndustryData([]);
    async function fetchAll() {
      const trdarCds = await resolveTrdarCds(selectedArea);

      // 업종별 점포수
      let storeQuery = supabase.from("stores").select("svc_nm, store_count");
      if (trdarCds) storeQuery = storeQuery.in("trdar_cd", trdarCds);
      const { data: sData } = await storeQuery.limit(50000);

      const bySvc = new Map<string, number>();
      for (const r of sData ?? []) {
        const nm = r.svc_nm ?? "기타";
        bySvc.set(nm, (bySvc.get(nm) ?? 0) + (r.store_count ?? 0));
      }
      const sorted = Array.from(bySvc.entries())
        .map(([name, count]) => ({ name, 점포수: count }))
        .sort((a, b) => b.점포수 - a.점포수)
        .slice(0, 5);

      if (cancelled) return;
      setIndustryData(sorted);
    }
    fetchAll();
    return () => { cancelled = true; };
  }, [selectedArea]);

  return (
    <div className="mt-6 grid grid-cols-2 gap-6">
      {/* 카드 1: 업종별 점포수 TOP 5 */}
      <div className="rounded-[20px] bg-white p-6 shadow-card">
        <h3 className="mb-4 text-[16px] font-semibold text-gray-900">{selectedArea} · 업종별 점포수 TOP 5</h3>
        {industryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={industryData} layout="vertical" barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toLocaleString()}개`, "점포수"]} />
              <Bar dataKey="점포수" fill="#6366F1" radius={[0, 4, 4, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-[13px] text-muted">로딩 중...</div>
        )}
      </div>

      {/* 카드 2: 주요 상권 바로가기 */}
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
