"use client";

import { useState } from "react";
import { Search, Plus, X, TrendingUp, TrendingDown } from "lucide-react";
import { geocode } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
  areaName: string;
  gu: string;
  stores: number;
  totalSales: number;
  footTraffic: number;
  openCount: number;
  closeCount: number;
  topIndustry: string;
  peakTime: string;
  dominantAge: string;
  rentPerPyeong: number;
}

async function analyzeLocation(address: string): Promise<LocationData | null> {
  try {
    const geo = await geocode(address);
    if (!geo) return null;
    const { lat, lng } = geo;
    const radius = 500;
    const deg = radius / 111000 * 1.5;

    // 근처 상권 찾기
    const { data: areas } = await supabase
      .from("areas").select("trdar_cd, trdar_nm, gu, lat, lng")
      .gte("lat", lat - deg).lte("lat", lat + deg)
      .gte("lng", lng - deg).lte("lng", lng + deg);

    const nearby = (areas ?? [])
      .map((a) => ({ ...a, dist: haversineM(lat, lng, a.lat, a.lng) }))
      .filter((a) => a.dist <= radius)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);

    if (nearby.length === 0) return null;
    const codes = nearby.map((a) => a.trdar_cd);
    const gu = nearby[0].gu ?? "";

    // 병렬 쿼리
    const [salesRes, ftRes, storeRes] = await Promise.all([
      supabase.from("sales").select("svc_nm, monthly_sales").in("trdar_cd", codes),
      supabase.from("foot_traffic").select("total_ft, time_00_06, time_06_11, time_11_14, time_14_17, time_17_21, time_21_24, age_10, age_20, age_30, age_40, age_50, age_60").in("trdar_cd", codes),
      supabase.from("stores").select("store_count, open_count, close_count, svc_nm").in("trdar_cd", codes),
    ]);

    // 매출
    let totalSales = 0;
    const salesBySvc = new Map<string, number>();
    for (const r of salesRes.data ?? []) {
      totalSales += r.monthly_sales ?? 0;
      salesBySvc.set(r.svc_nm, (salesBySvc.get(r.svc_nm) ?? 0) + (r.monthly_sales ?? 0));
    }
    const topIndustry = Array.from(salesBySvc.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    // 유동인구
    let totalFt = 0;
    const timeSlots: Record<string, number> = {};
    const ageBuckets: Record<string, number> = {};
    for (const r of ftRes.data ?? []) {
      totalFt += r.total_ft ?? 0;
      const slots = { "00~06시": r.time_00_06, "06~11시": r.time_06_11, "11~14시": r.time_11_14, "14~17시": r.time_14_17, "17~21시": r.time_17_21, "21~24시": r.time_21_24 };
      for (const [k, v] of Object.entries(slots)) timeSlots[k] = (timeSlots[k] ?? 0) + (v ?? 0);
      const ages = { "10대": r.age_10, "20대": r.age_20, "30대": r.age_30, "40대": r.age_40, "50대": r.age_50, "60대+": r.age_60 };
      for (const [k, v] of Object.entries(ages)) ageBuckets[k] = (ageBuckets[k] ?? 0) + (v ?? 0);
    }
    const peakTime = Object.entries(timeSlots).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    const dominantAge = Object.entries(ageBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

    // 점포
    let stores = 0, openCount = 0, closeCount = 0;
    for (const r of storeRes.data ?? []) {
      stores += r.store_count ?? 0;
      openCount += r.open_count ?? 0;
      closeCount += r.close_count ?? 0;
    }

    // 임대료
    const rentRes = await fetch(`/api/rent-nearby?lat=${lat}&lng=${lng}&radius=${radius}&target_pyeong=30`);
    const rentData = await rentRes.json();
    const rentPerPyeong = rentData?.stats?.["1층"]?.avg_pyeong ?? 0;

    return {
      address: geo.address,
      lat, lng,
      areaName: nearby[0].trdar_nm,
      gu,
      stores,
      totalSales,
      footTraffic: totalFt,
      openCount,
      closeCount,
      topIndustry,
      peakTime,
      dominantAge,
      rentPerPyeong,
    };
  } catch {
    return null;
  }
}

export default function ComparePage() {
  const [locations, setLocations] = useState<(LocationData | null)[]>([null, null]);
  const [inputs, setInputs] = useState(["", ""]);
  const [loading, setLoading] = useState([false, false]);

  const handleSearch = async (index: number) => {
    if (!inputs[index]) return;
    const newLoading = [...loading];
    newLoading[index] = true;
    setLoading(newLoading);

    const result = await analyzeLocation(inputs[index]);
    const newLocations = [...locations];
    newLocations[index] = result;
    setLocations(newLocations);

    newLoading[index] = false;
    setLoading(newLoading);
  };

  const addSlot = () => {
    if (locations.length >= 3) return;
    setLocations([...locations, null]);
    setInputs([...inputs, ""]);
    setLoading([...loading, false]);
  };

  const removeSlot = (i: number) => {
    if (locations.length <= 2) return;
    setLocations(locations.filter((_, idx) => idx !== i));
    setInputs(inputs.filter((_, idx) => idx !== i));
    setLoading(loading.filter((_, idx) => idx !== i));
  };

  const filledLocations = locations.filter((l): l is LocationData => l !== null);

  // 비교 지표별 최고값 (하이라이트용)
  const maxSales = Math.max(...filledLocations.map((l) => l.totalSales), 0);
  const maxFt = Math.max(...filledLocations.map((l) => l.footTraffic), 0);
  const maxStores = Math.max(...filledLocations.map((l) => l.stores), 0);

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">입지 비교</h1>
          <p className="mt-1 text-sm text-muted">2~3개 주소를 비교하여 최적의 입지를 찾으세요</p>
        </div>

        {/* 검색 입력 */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${locations.length}, 1fr)` }}>
          {locations.map((loc, i) => (
            <div key={i} className="relative rounded-[20px] bg-white p-5 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-[13px] font-bold text-white">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-[14px] font-semibold text-gray-800">
                  {loc ? loc.areaName : `위치 ${String.fromCharCode(65 + i)}`}
                </span>
                {locations.length > 2 && (
                  <button onClick={() => removeSlot(i)} className="ml-auto text-gray-400 hover:text-red-500">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                  <Search size={14} className="text-gray-400" />
                  <input
                    value={inputs[i]}
                    onChange={(e) => { const n = [...inputs]; n[i] = e.target.value; setInputs(n); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch(i)}
                    placeholder="주소, 지역명 검색"
                    className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
                  />
                </div>
                <button onClick={() => handleSearch(i)} disabled={loading[i]}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {loading[i] ? "분석중..." : "분석"}
                </button>
              </div>
              {loc && (
                <p className="mt-2 text-[11px] text-muted">{loc.address} · {loc.gu}</p>
              )}
            </div>
          ))}
          {locations.length < 3 && (
            <button onClick={addSlot}
              className="flex items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-gray-200 p-5 text-[13px] text-muted hover:border-primary-300 hover:text-primary-600">
              <Plus size={16} /> 비교 추가
            </button>
          )}
        </div>

        {/* 비교 테이블 */}
        {filledLocations.length >= 2 && (
          <div className="rounded-[20px] bg-white p-6 shadow-card">
            <h2 className="mb-4 text-[16px] font-semibold text-gray-900">비교 결과</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium text-muted w-32">지표</th>
                    {locations.map((loc, i) => (
                      <th key={i} className="px-4 py-3 text-center font-semibold text-gray-800">
                        {loc ? (
                          <div>
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-600 mr-1">
                              {String.fromCharCode(65 + i)}
                            </span>
                            {loc.areaName}
                          </div>
                        ) : "-"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "점포 수", key: "stores", format: (v: number) => `${v.toLocaleString()}개`, best: maxStores },
                    { label: "분기 매출", key: "totalSales", format: (v: number) => `${(v / 1e8).toFixed(0)}억`, best: maxSales },
                    { label: "유동인구", key: "footTraffic", format: (v: number) => `${(v / 10000).toFixed(1)}만`, best: maxFt },
                    { label: "개업/폐업", key: "openClose", format: (_: number, l: LocationData) => `${l.openCount}/${l.closeCount}`, best: -1 },
                    { label: "순증감", key: "netOpen", format: (_: number, l: LocationData) => { const n = l.openCount - l.closeCount; return n >= 0 ? `+${n}` : `${n}`; }, best: -1 },
                    { label: "주요 업종", key: "topIndustry", format: (_: number, l: LocationData) => l.topIndustry, best: -1 },
                    { label: "피크 시간", key: "peakTime", format: (_: number, l: LocationData) => l.peakTime, best: -1 },
                    { label: "주요 연령", key: "dominantAge", format: (_: number, l: LocationData) => l.dominantAge, best: -1 },
                    { label: "1층 임대료", key: "rentPerPyeong", format: (v: number) => v > 0 ? `${v}만/평` : "-", best: -1 },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-600">{row.label}</td>
                      {locations.map((loc, i) => {
                        if (!loc) return <td key={i} className="px-4 py-3 text-center text-muted">-</td>;
                        const val = (loc as unknown as Record<string, unknown>)[row.key] as number;
                        const isBest = row.best > 0 && val === row.best && filledLocations.length >= 2;
                        return (
                          <td key={i} className={`px-4 py-3 text-center ${isBest ? "font-bold text-primary-600" : "text-gray-800"}`}>
                            {row.format(val, loc)}
                            {isBest && <span className="ml-1 text-[9px] text-primary-500">best</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filledLocations.length < 2 && (
          <div className="flex flex-col items-center gap-3 rounded-[20px] bg-gray-50 py-16">
            <p className="text-[14px] text-muted">두 곳 이상의 주소를 입력하면 비교 분석이 시작됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
