"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, X, TrendingUp, MapPin, Map as MapIcon } from "lucide-react";
import MapGL, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { geocode } from "@/lib/api";
import { supabase } from "@/lib/supabase";

/* ── Vworld 타일 스타일 ── */
const MAP_STYLE = {
  version: 8 as const,
  sources: {
    vworld: {
      type: "raster" as const,
      tiles: ["https://xdworld.vworld.kr/2d/Base/service/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "\u00a9 Vworld",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "vworld-tiles", type: "raster" as const, source: "vworld", minzoom: 0, maxzoom: 19 },
  ],
};

/* ── 색상 테마 ── */
const LOCATION_COLORS = [
  { bg: "bg-indigo-600", text: "text-indigo-600", light: "bg-indigo-50", ring: "ring-indigo-200", fill: "rgba(99,102,241,0.15)", stroke: "rgba(99,102,241,0.6)", bar: "bg-indigo-500" },
  { bg: "bg-emerald-600", text: "text-emerald-600", light: "bg-emerald-50", ring: "ring-emerald-200", fill: "rgba(16,185,129,0.15)", stroke: "rgba(16,185,129,0.6)", bar: "bg-emerald-500" },
  { bg: "bg-amber-600", text: "text-amber-600", light: "bg-amber-50", ring: "ring-amber-200", fill: "rgba(245,158,11,0.15)", stroke: "rgba(245,158,11,0.6)", bar: "bg-amber-500" },
];

/* ── 유틸 ── */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function makeCircle(lat: number, lng: number, radiusM: number, n = 64) {
  const coords: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    const dLat = (radiusM / 111320) * Math.cos(a);
    const dLng = (radiusM / (111320 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [coords] },
  };
}

/* ── 타입 ── */
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

/* ── 분석 함수 (기존 유지) ── */
async function analyzeLocation(address: string): Promise<LocationData | null> {
  try {
    const geo = await geocode(address);
    if (!geo) return null;
    const { lat, lng } = geo;
    const radius = 500;
    const deg = (radius / 111000) * 1.5;

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

    const [salesRes, ftRes, storeRes] = await Promise.all([
      supabase.from("sales").select("svc_nm, monthly_sales").in("trdar_cd", codes),
      supabase.from("foot_traffic").select("total_ft, time_00_06, time_06_11, time_11_14, time_14_17, time_17_21, time_21_24, age_10, age_20, age_30, age_40, age_50, age_60").in("trdar_cd", codes),
      supabase.from("stores").select("store_count, open_count, close_count, svc_nm").in("trdar_cd", codes),
    ]);

    let totalSales = 0;
    const salesBySvc = new Map<string, number>();
    for (const r of salesRes.data ?? []) {
      totalSales += r.monthly_sales ?? 0;
      salesBySvc.set(r.svc_nm, (salesBySvc.get(r.svc_nm) ?? 0) + (r.monthly_sales ?? 0));
    }
    const topIndustry = Array.from(salesBySvc.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

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

    let stores = 0, openCount = 0, closeCount = 0;
    for (const r of storeRes.data ?? []) {
      stores += r.store_count ?? 0;
      openCount += r.open_count ?? 0;
      closeCount += r.close_count ?? 0;
    }

    const rentRes = await fetch(`/api/rent-nearby?lat=${lat}&lng=${lng}&radius=${radius}&target_pyeong=30`);
    const rentData = await rentRes.json();
    const rentPerPyeong = rentData?.stats?.["1층"]?.avg_pyeong ?? 0;

    return {
      address: geo.address, lat, lng, areaName: nearby[0].trdar_nm, gu,
      stores, totalSales, footTraffic: totalFt, openCount, closeCount,
      topIndustry, peakTime, dominantAge, rentPerPyeong,
    };
  } catch {
    return null;
  }
}

/* ── 비교 바 컴포넌트 ── */
function CompareBar({ label, values, format, colors }: {
  label: string;
  values: (number | null)[];
  format: (v: number) => string;
  colors: typeof LOCATION_COLORS;
}) {
  const nums = values.filter((v): v is number => v !== null && v > 0);
  const maxVal = Math.max(...nums, 1);

  return (
    <div className="py-3 border-b border-gray-50 last:border-0">
      <p className="text-[11px] font-medium text-gray-400 mb-2">{label}</p>
      <div className="space-y-1.5">
        {values.map((v, i) => {
          if (v === null) return null;
          const pct = maxVal > 0 ? (v / maxVal) * 100 : 0;
          const isBest = v === Math.max(...nums) && nums.length >= 2;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${colors[i].bg}`}>
                {String.fromCharCode(65 + i)}
              </span>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${colors[i].bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
              </div>
              <span className={`text-[12px] tabular-nums w-16 text-right ${isBest ? `font-bold ${colors[i].text}` : "text-gray-600"}`}>
                {format(v)}
                {isBest && <span className="text-[9px] ml-0.5">best</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function ComparePage() {
  const mapRef = useRef<MapRef>(null);
  const [locations, setLocations] = useState<(LocationData | null)[]>([null, null]);
  const [inputs, setInputs] = useState(["", ""]);
  const [loading, setLoading] = useState([false, false]);
  const [viewState, setViewState] = useState({ latitude: 37.5665, longitude: 126.978, zoom: 11 });

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
  const filledKey = filledLocations.map((l) => `${l.lat},${l.lng}`).join("|");

  /* 지도 자동 피팅 */
  useEffect(() => {
    if (filledLocations.length === 0 || !mapRef.current) return;

    if (filledLocations.length === 1) {
      setViewState({ latitude: filledLocations[0].lat, longitude: filledLocations[0].lng, zoom: 14 });
      return;
    }

    const lats = filledLocations.map((l) => l.lat);
    const lngs = filledLocations.map((l) => l.lng);
    const padding = 0.008; // ~800m buffer
    const minLat = Math.min(...lats) - padding;
    const maxLat = Math.max(...lats) + padding;
    const minLng = Math.min(...lngs) - padding;
    const maxLng = Math.max(...lngs) + padding;

    try {
      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 60, duration: 800 }
      );
    } catch {
      setViewState({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        zoom: 13,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filledKey]);

  /* 원형 GeoJSON */
  const circleFeatures = filledLocations.map((loc) => {
    const originalIndex = locations.findIndex((l) => l === loc);
    return {
      feature: makeCircle(loc.lat, loc.lng, 500),
      color: LOCATION_COLORS[originalIndex],
      id: `circle-${originalIndex}`,
    };
  });

  return (
    <div className="relative flex h-full overflow-hidden">
      {/* ── 좌측 패널 ── */}
      <div className="relative z-10 flex h-full w-full sm:w-[400px] shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* 헤더 */}
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[17px] font-semibold text-gray-900">입지 비교</h1>
              <p className="mt-0.5 text-[12px] text-gray-400">2~3개 위치를 비교하여 최적 입지를 찾으세요</p>
            </div>
            <button
              onClick={() => window.open("/map", "_blank")}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-200"
            >
              <MapIcon size={12} className="text-primary-600" />
              지도 분석
            </button>
          </div>
        </div>

        {/* 검색 입력 */}
        <div className="space-y-3 px-5 py-4 border-b border-gray-100">
          {locations.map((loc, i) => (
            <div key={i} className={`rounded-xl border p-3 transition-all ${loc ? `${LOCATION_COLORS[i].light} border-transparent ring-1 ${LOCATION_COLORS[i].ring}` : "border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${LOCATION_COLORS[i].bg}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-[13px] font-semibold text-gray-700">
                  {loc ? loc.areaName : `위치 ${String.fromCharCode(65 + i)}`}
                </span>
                {locations.length > 2 && (
                  <button onClick={() => removeSlot(i)} className="ml-auto text-gray-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
                  <Search size={13} className="text-gray-400" />
                  <input
                    value={inputs[i]}
                    onChange={(e) => { const n = [...inputs]; n[i] = e.target.value; setInputs(n); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch(i)}
                    placeholder="주소, 지역명 검색"
                    className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-gray-400"
                  />
                </div>
                <button onClick={() => handleSearch(i)} disabled={loading[i]}
                  className="rounded-lg bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap">
                  {loading[i] ? "..." : "분석"}
                </button>
              </div>
              {loc && (
                <p className="mt-1.5 text-[10px] text-gray-400 flex items-center gap-1">
                  <MapPin size={10} /> {loc.address} · {loc.gu}
                </p>
              )}
            </div>
          ))}
          {locations.length < 3 && (
            <button onClick={addSlot}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-[12px] text-gray-400 hover:border-primary-300 hover:text-primary-600 transition-colors">
              <Plus size={14} /> 비교 추가 (최대 3곳)
            </button>
          )}
        </div>

        {/* 비교 결과 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filledLocations.length >= 2 ? (
            <div className="space-y-1">
              <h2 className="text-[13px] font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-primary-600" />
                비교 결과
              </h2>

              <CompareBar
                label="점포 수"
                values={locations.map((l) => l?.stores ?? null)}
                format={(v) => `${v.toLocaleString()}개`}
                colors={LOCATION_COLORS}
              />
              <CompareBar
                label="분기 매출"
                values={locations.map((l) => l?.totalSales ?? null)}
                format={(v) => `${(v / 1e8).toFixed(0)}억`}
                colors={LOCATION_COLORS}
              />
              <CompareBar
                label="유동인구"
                values={locations.map((l) => l?.footTraffic ?? null)}
                format={(v) => `${(v / 10000).toFixed(1)}만`}
                colors={LOCATION_COLORS}
              />
              <CompareBar
                label="개업 수"
                values={locations.map((l) => l?.openCount ?? null)}
                format={(v) => `${v}개`}
                colors={LOCATION_COLORS}
              />
              <CompareBar
                label="폐업 수"
                values={locations.map((l) => l?.closeCount ?? null)}
                format={(v) => `${v}개`}
                colors={LOCATION_COLORS}
              />
              <CompareBar
                label="1층 임대료"
                values={locations.map((l) => l?.rentPerPyeong ?? null)}
                format={(v) => v > 0 ? `${v}만/평` : "-"}
                colors={LOCATION_COLORS}
              />

              {/* 텍스트 지표 카드 */}
              <div className="pt-3 mt-2 border-t border-gray-100">
                <p className="text-[11px] font-medium text-gray-400 mb-2">업종 / 시간 / 연령</p>
                <div className="space-y-2">
                  {locations.map((loc, i) => {
                    if (!loc) return null;
                    return (
                      <div key={i} className={`rounded-lg p-3 ${LOCATION_COLORS[i].light}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${LOCATION_COLORS[i].bg}`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-[12px] font-semibold text-gray-700">{loc.areaName}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <p className="text-gray-400">주요 업종</p>
                            <p className="font-medium text-gray-700 mt-0.5">{loc.topIndustry}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">피크 시간</p>
                            <p className="font-medium text-gray-700 mt-0.5">{loc.peakTime}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">주요 연령</p>
                            <p className="font-medium text-gray-700 mt-0.5">{loc.dominantAge}</p>
                          </div>
                        </div>
                        <div className="mt-1.5 text-[11px]">
                          <span className="text-gray-400">순증감 </span>
                          <span className={`font-semibold ${loc.openCount - loc.closeCount >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {loc.openCount - loc.closeCount >= 0 ? "+" : ""}{loc.openCount - loc.closeCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <MapPin size={24} className="text-gray-300" />
              </div>
              <p className="text-[13px] text-gray-400">두 곳 이상의 주소를 입력하면</p>
              <p className="text-[13px] text-gray-400">비교 분석이 시작됩니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ── 우측 지도 ── */}
      <div className="relative flex-1">
        <MapGL
          ref={mapRef}
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" />

          {/* 반경 원 */}
          {circleFeatures.map(({ feature, color, id }) => (
            <Source key={id} id={id} type="geojson" data={feature}>
              <Layer
                id={`${id}-fill`}
                type="fill"
                paint={{ "fill-color": color.fill, "fill-opacity": 0.5 }}
              />
              <Layer
                id={`${id}-stroke`}
                type="line"
                paint={{ "line-color": color.stroke, "line-width": 2, "line-dasharray": [3, 2] }}
              />
            </Source>
          ))}

          {/* 마커 */}
          {locations.map((loc, i) => {
            if (!loc) return null;
            return (
              <Marker key={`marker-${i}`} latitude={loc.lat} longitude={loc.lng} anchor="center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-lg border-2 border-white ${LOCATION_COLORS[i].bg}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className="mt-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm backdrop-blur-sm">
                    {loc.areaName}
                  </div>
                </div>
              </Marker>
            );
          })}
        </MapGL>

        {/* 지도 범례 */}
        {filledLocations.length > 0 && (
          <div className="absolute top-4 right-4 z-10 rounded-xl bg-white/90 px-4 py-3 shadow-md backdrop-blur-sm">
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">비교 위치</p>
            {locations.map((loc, i) => {
              if (!loc) return null;
              return (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${LOCATION_COLORS[i].bg}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-[11px] text-gray-600">{loc.areaName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
