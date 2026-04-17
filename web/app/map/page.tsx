"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Search,
  Layers,
  X,
} from "lucide-react";
import DataPanel from "@/components/Panel/DataPanel";
import { useAnalysisStore } from "@/store/analysisStore";
import { findNearbyTrdar, analyzeArea, getStoreCount, reverseGeocode, searchTrdar, geocode } from "@/lib/api";
import { DISTRICTS, findDistrictByQuery, ZONE_COLORS, type DistrictDef, type ZonedArea } from "@/lib/district-zones";
// district-polygons.ts (하드코딩)는 더 이상 사용하지 않음 — /api/districts/polygons에서 실제 SHP 기반 폴리곤 로드

const MapContainer = dynamic(() => import("@/components/Map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-surface">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
    </div>
  ),
});

const IS_PRO = false;

/* ── 검색용 좌표 매핑 ── */
const AREA_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  gangnam: { lat: 37.4979, lng: 127.0276, name: "강남역" },
  hongdae: { lat: 37.5571, lng: 126.9233, name: "홍대입구" },
  seongsu: { lat: 37.5445, lng: 127.0560, name: "성수동" },
  itaewon: { lat: 37.5346, lng: 126.9944, name: "이태원" },
  yeouido: { lat: 37.5218, lng: 126.9245, name: "여의도" },
  euljiro: { lat: 37.5665, lng: 126.9918, name: "을지로" },
  mangwon: { lat: 37.5556, lng: 126.9100, name: "망원동" },
  yeonnam: { lat: 37.5660, lng: 126.9233, name: "연남동" },
  jamsil: { lat: 37.5133, lng: 127.1001, name: "잠실" },
  myeongdong: { lat: 37.5607, lng: 126.9857, name: "명동" },
  sinchon: { lat: 37.5554, lng: 126.9368, name: "신촌" },
  konkuk: { lat: 37.5404, lng: 127.0693, name: "건대입구" },
  hapjeong: { lat: 37.5499, lng: 126.9145, name: "합정동" },
  samcheong: { lat: 37.5816, lng: 126.9816, name: "삼청동" },
  garosu: { lat: 37.5199, lng: 127.0230, name: "가로수길" },
  apgujeong: { lat: 37.5270, lng: 127.0289, name: "압구정" },
};

const SEARCH_KEYWORDS: Record<string, { lat: number; lng: number }> = {
  강남역: { lat: 37.4979, lng: 127.0276 },
  홍대입구: { lat: 37.5571, lng: 126.9233 },
  홍대: { lat: 37.5571, lng: 126.9233 },
  성수동: { lat: 37.5445, lng: 127.0560 },
  성수: { lat: 37.5445, lng: 127.0560 },
  이태원: { lat: 37.5346, lng: 126.9944 },
  여의도: { lat: 37.5218, lng: 126.9245 },
  을지로: { lat: 37.5665, lng: 126.9918 },
  망원동: { lat: 37.5556, lng: 126.9100 },
  연남동: { lat: 37.5660, lng: 126.9233 },
  잠실: { lat: 37.5133, lng: 127.1001 },
  명동: { lat: 37.5607, lng: 126.9857 },
  신촌: { lat: 37.5554, lng: 126.9368 },
  건대입구: { lat: 37.5404, lng: 127.0693 },
  합정: { lat: 37.5499, lng: 126.9145 },
  삼청동: { lat: 37.5816, lng: 126.9816 },
  가로수길: { lat: 37.5199, lng: 127.0230 },
  압구정: { lat: 37.5270, lng: 127.0289 },
  서울역: { lat: 37.5547, lng: 126.9727 },
  종로: { lat: 37.5700, lng: 126.9832 },
};

/* ── 좌표로 자동 분석 실행 ── */
async function triggerAnalysis(lat: number, lng: number) {
  const store = useAnalysisStore.getState();
  const radius = store.radius;
  store.setClicked(lat, lng);
  store.setViewState({ ...store.viewState, latitude: lat, longitude: lng, zoom: 15 });
  store.setLoading(true);

  try {
    reverseGeocode(lat, lng)
      .then((res) => store.setClickedAddress(res.address, res.gu, res.dong))
      .catch(() => store.setClickedAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`, "", ""));

    const list = await findNearbyTrdar(lat, lng, Math.max(radius, 500));
    store.setNearbyList(list);

    if (list.length > 0) {
      const closest = list[0];
      store.setSelectedTrdar(closest);
      store.setPanelOpen(true);
      const [analysis, stores] = await Promise.all([
        analyzeArea(lat, lng, radius),
        getStoreCount(closest.trdar_cd),
      ]);
      store.setAnalysisData(analysis);
      store.setStoreCountData(stores);
    }
  } catch {
    // 검색 분석 실패
  } finally {
    store.setLoading(false);
  }
}

/* ── URL 파라미터 처리 ── */
function AutoAnalysisTrigger() {
  const searchParams = useSearchParams();

  useEffect(() => {
    // ?lat=&lng= 직접 좌표
    const latP = searchParams.get("lat");
    const lngP = searchParams.get("lng");
    if (latP && lngP) {
      const lat = parseFloat(latP);
      const lng = parseFloat(lngP);
      if (!isNaN(lat) && !isNaN(lng)) {
        triggerAnalysis(lat, lng);
        return;
      }
    }

    // ?area=코드 (하드코딩 매칭 또는 API 검색)
    const area = searchParams.get("area");
    if (area) {
      const zoom = parseInt(searchParams.get("zoom") ?? "15");

      // 하드코딩 매칭 (gangnam, seongsu 등)
      if (AREA_COORDS[area]) {
        const { lat, lng } = AREA_COORDS[area];
        const store = useAnalysisStore.getState();
        store.setViewState({ ...store.viewState, latitude: lat, longitude: lng, zoom });
        triggerAnalysis(lat, lng);
        return;
      }

      // 실제 상권 코드로 검색 (API → 좌표 조회 → 분석)
      searchTrdar(area).then((results) => {
        const match = results.find((r) => r.lat && r.lng);
        if (match && match.lat && match.lng) {
          const store = useAnalysisStore.getState();
          store.setViewState({ ...store.viewState, latitude: match.lat, longitude: match.lng, zoom });
          triggerAnalysis(match.lat, match.lng);
        }
      }).catch(() => {});
      return;
    }

    // ?search=강남역 검색어 → API로 검색
    const search = searchParams.get("search");
    if (search) {
      // 주요 상권 zone 매칭
      const dist = findDistrictByQuery(search);
      if (dist) {
        const s = useAnalysisStore.getState();
        s.setActiveDistrictId(dist.id);
        s.setViewState({ ...s.viewState, latitude: dist.center[0], longitude: dist.center[1], zoom: 15 });
        triggerAnalysis(dist.center[0], dist.center[1]);
        return;
      }

      // 하드코딩 매칭
      const match = SEARCH_KEYWORDS[search];
      if (match) {
        triggerAnalysis(match.lat, match.lng);
      } else {
        // API 검색
        searchTrdar(search).then((results) => {
          const first = results.find((r) => r.lat && r.lng);
          if (first && first.lat && first.lng) {
            triggerAnalysis(first.lat, first.lng);
          }
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

/* ── 페이지 ── */
export default function MapPage() {
  const panelOpen = useAnalysisStore((s) => s.panelOpen);
  const selectedTrdar = useAnalysisStore((s) => s.selectedTrdar);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("search_history") ?? "[]"); } catch { return []; }
  });
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // ── 상권 zone 데이터 ──
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(null);
  const [districtZones, setDistrictZones] = useState<{ district: DistrictDef; areas: ZonedArea[] } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [zonePolygonGeoJSON, setZonePolygonGeoJSON] = useState<any>(null);
  const [zoneCompare, setZoneCompare] = useState<{
    district: { name: string; color: string };
    quarter: string | null;
    zones: Array<{ zone: string; label: string; areaCount: number; totalStores: number; avgRentPyeong: number; avgSaleM2: number; dailyFootTraffic: number; openCount: number; closeCount: number }>;
  } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [roadAnalysis, setRoadAnalysis] = useState<any>(null);

  const loadDistrictZones = useCallback((districtId: string) => {
    setActiveDistrictId(districtId);
    fetch(`/api/districts/zones?id=${districtId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.areas) setDistrictZones(data); })
      .catch(() => {});
    fetch(`/api/districts/compare?id=${districtId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setZoneCompare(data); })
      .catch(() => {});
    fetch(`/api/districts/polygons?id=${districtId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.features) setZonePolygonGeoJSON(data); })
      .catch(() => {});
    fetch(`/api/districts/road-analysis?id=${districtId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setRoadAnalysis(data); })
      .catch(() => {});
  }, []);

  const heatmapOn = useAnalysisStore((s) => s.heatmapOn);
  const setHeatmapOn = useAnalysisStore((s) => s.setHeatmapOn);
  const heatmapType = useAnalysisStore((s) => s.heatmapType);
  const setHeatmapType = useAnalysisStore((s) => s.setHeatmapType);

  const addToHistory = useCallback((q: string) => {
    setSearchHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 10);
      try { localStorage.setItem("search_history", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const executeSearch = useCallback(async (q: string) => {
    // 0. 주요 상권 zone 매칭 (즉시)
    const district = findDistrictByQuery(q);
    if (district) {
      const store = useAnalysisStore.getState();
      store.setViewState({
        ...store.viewState,
        latitude: district.center[0],
        longitude: district.center[1],
        zoom: 15,
      });
      store.setClicked(null as unknown as number, null as unknown as number);
      store.setPanelOpen(false);
      loadDistrictZones(district.id);
      return;
    }

    setActiveDistrictId(null);
    setDistrictZones(null);
    setZoneCompare(null);
    setZonePolygonGeoJSON(null);

    // 1. 하드코딩 매칭 (즉시)
    const match = SEARCH_KEYWORDS[q];
    if (match) {
      triggerAnalysis(match.lat, match.lng);
      return;
    }

    // 2. 지오코딩 + 상권 검색 병렬 실행
    const [geoResult, trdarResult] = await Promise.allSettled([
      geocode(q).then((r) => (r?.lat && r?.lng ? r : null)),
      searchTrdar(q).then((results) => {
        const first = results.find((r) => r.lat && r.lng);
        return first?.lat && first?.lng ? { lat: first.lat, lng: first.lng } : null;
      }),
    ]);

    const geo = geoResult.status === "fulfilled" ? geoResult.value : null;
    const trdar = trdarResult.status === "fulfilled" ? trdarResult.value : null;
    const found = geo ?? trdar;
    if (found) {
      triggerAnalysis(found.lat, found.lng);
    }
  }, [loadDistrictZones]);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    addToHistory(q);
    setSearchFocused(false);
    setSearchQuery("");
    await executeSearch(q);
  }, [searchQuery, addToHistory, executeSearch]);

  return (
    <div className="relative h-full overflow-hidden">
      <Suspense fallback={null}>
        <AutoAnalysisTrigger />
      </Suspense>

      {/* 풀스크린 지도 */}
      <MapContainer
        districtZones={districtZones}
        zonePolygonGeoJSON={zonePolygonGeoJSON}
        roadAnalysis={roadAnalysis}
        onDistrictClick={(id) => {
          const d = DISTRICTS.find((dd) => dd.id === id);
          if (d) {
            const store = useAnalysisStore.getState();
            // 지도 이동만 + zone 로드 (원형 포인트 없이)
            store.setViewState({ ...store.viewState, latitude: d.center[0], longitude: d.center[1], zoom: 15 });
            store.setClicked(null as unknown as number, null as unknown as number); // 원형 포인트 제거
            store.setPanelOpen(false); // 왼쪽 분석 패널 닫기
            loadDistrictZones(id);
          }
        }}
      />

      {/* ── 상단 검색바 (플로팅) ── */}
      <div className="absolute left-1/2 top-4 z-20 w-full max-w-xl -translate-x-1/2 px-4">
        <div className="relative">
          <div className="flex h-12 items-center gap-2 rounded-full border border-white/60 bg-white/90 px-5 shadow-lg backdrop-blur-md">
            <Search size={18} className="shrink-0 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="주소, 지역명, 건물명으로 검색"
              className="flex-1 bg-transparent text-[14px] text-gray-800 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={handleSearch}
              className="shrink-0 rounded-full bg-primary-600 px-5 py-1.5 text-[13px] font-semibold text-white transition-all hover:bg-primary-700 active:scale-95"
            >
              검색
            </button>
          </div>
          {searchFocused && searchHistory.length > 0 && !searchQuery && (
            <div className="absolute left-0 right-0 top-14 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-[12px] font-medium text-gray-500">최근 검색</span>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchHistory([]);
                    try { localStorage.removeItem("search_history"); } catch {}
                  }}
                  className="text-[11px] text-muted hover:text-gray-600"
                >
                  전체 삭제
                </button>
              </div>
              {searchHistory.map((h) => (
                <button
                  key={h}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearchFocused(false);
                    addToHistory(h);
                    setSearchQuery("");
                    executeSearch(h);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Search size={14} className="shrink-0 text-gray-300" />
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 좌측 분석 패널 ── */}
      {panelOpen && <DataPanel />}

      {/* ── 우측 상권 zone 패널 ── */}
      {districtZones && (
        <div className="absolute right-0 top-0 z-30 flex h-full w-full sm:w-[360px] flex-col bg-white shadow-xl animate-slide-in">
          <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{districtZones.district.name} 상권</h2>
              <p className="mt-0.5 text-[12px] text-muted">{districtZones.areas.length}개 세부 상권</p>
            </div>
            <button
              onClick={() => { setActiveDistrictId(null); setDistrictZones(null); setZoneCompare(null); setZonePolygonGeoJSON(null); setRoadAnalysis(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* zone 범례 */}
            <div className="flex items-center gap-3">
              {(["main", "side", "rear"] as const).map((z) => (
                <div key={z} className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ background: ZONE_COLORS[z].color }} />
                  <span className="text-[11px] text-gray-600">{ZONE_COLORS[z].label}</span>
                  <span className="text-[11px] font-semibold text-gray-800">{districtZones.areas.filter((a) => a.zone === z).length}</span>
                </div>
              ))}
            </div>

            {/* zone별 비교 — 도로 기반 + 서울시 데이터 병행 */}
            {roadAnalysis && (
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="mb-3 text-[13px] font-semibold text-gray-900">Zone별 비교 <span className="text-[11px] font-normal text-muted">(소상공인 데이터)</span></p>
                <div className="space-y-3">
                  {[
                    { zone: "main", label: "메인 상권", color: "#EF4444", stores: roadAnalysis.summary?.mainStores ?? 0, roads: roadAnalysis.summary?.mainRoads ?? [] },
                    { zone: "side", label: "이면 상권", color: "#F59E0B", stores: roadAnalysis.summary?.sideStores ?? 0 },
                    { zone: "rear", label: "배후 상권", color: "#3B82F6", stores: roadAnalysis.summary?.rearStores ?? 0 },
                  ].map((z) => {
                    const compare = zoneCompare?.zones?.find((c) => c.zone === z.zone);
                    return (
                      <div key={z.zone} className="rounded-lg bg-gray-50 p-3">
                        <p className="mb-1.5 text-[12px] font-semibold" style={{ color: z.color }}>{z.label}</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-muted">점포 </span><span className="font-semibold text-gray-800">{z.stores.toLocaleString()}</span></div>
                          <div><span className="text-muted">임대료 </span><span className="font-semibold text-gray-800">{compare?.avgRentPyeong ?? "—"}만/평</span></div>
                          <div><span className="text-muted">매매가 </span><span className="font-semibold text-gray-800">{compare?.avgSaleM2 ? `${compare.avgSaleM2.toLocaleString()}만/㎡` : "—"}</span></div>
                          <div><span className="text-muted">유동인구 </span><span className="font-semibold text-gray-800">{compare?.dailyFootTraffic?.toLocaleString() ?? "—"}명/일</span></div>
                        </div>
                        {"roads" in z && z.roads?.length > 0 && (
                          <p className="mt-1 text-[10px] text-muted">메인 도로: {z.roads.join(", ")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 도로별 점포 분석 (소상공인 데이터) */}
            {roadAnalysis && (
              <div className="rounded-xl border border-gray-100 p-4">
                <p className="mb-1 text-[13px] font-semibold text-gray-900">도로별 점포 현황</p>
                <p className="mb-3 text-[10px] text-muted">소상공인시장진흥공단 · 반경 {roadAnalysis.radius}m · 총 {roadAnalysis.totalStores?.toLocaleString()}개</p>
                <div className="mb-3 flex gap-3 text-[10px]">
                  <span>🔴 메인 {roadAnalysis.summary?.mainStores?.toLocaleString()}</span>
                  <span>🟡 이면 {roadAnalysis.summary?.sideStores?.toLocaleString()}</span>
                  <span>🟢 배후 {roadAnalysis.summary?.rearStores?.toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  {roadAnalysis.roads?.slice(0, 12).map((r: { name: string; storeCount: number; zone: string }) => {
                    const color = r.zone === "main" ? "#EF4444" : r.zone === "side" ? "#F59E0B" : "#3B82F6";
                    const maxCount = roadAnalysis.roads[0]?.storeCount ?? 1;
                    return (
                      <div key={r.name} className="flex items-center gap-2">
                        <span className="w-20 truncate text-[10px] text-gray-600" title={r.name}>{r.name}</span>
                        <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(r.storeCount / maxCount) * 100}%`, background: color }} />
                        </div>
                        <span className="w-10 text-right text-[10px] font-semibold text-gray-700">{r.storeCount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 세부 상권 목록 */}
            <div>
              <p className="mb-2 text-[13px] font-semibold text-gray-900">세부 상권</p>
              <div className="space-y-1.5">
                {districtZones.areas.map((a) => (
                  <button
                    key={a.trdar_cd}
                    onClick={() => triggerAnalysis(a.lat, a.lng)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: districtZones.district.color, opacity: a.zone === "main" ? 0.7 : a.zone === "side" ? 0.4 : 0.2 }}
                    />
                    <span className="flex-1 text-[12px] text-gray-700">{a.trdar_nm}</span>
                    <span className="text-[10px] text-muted">{a.zone === "main" ? "메인" : a.zone === "side" ? "이면" : "배후"} · {a.distFromCenter}m</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 우측 하단 컨트롤 ── */}
      <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
        {/* 레이어 토글 */}
        <div className="relative">
          {layerMenuOpen && (
            <div className="absolute bottom-12 right-0 w-48 rounded-xl bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-800">레이어</span>
                <button onClick={() => setLayerMenuOpen(false)}>
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              {([
                { key: "openclose" as const, label: "개폐업", dot: "bg-gradient-to-r from-blue-400 to-red-400" },
                { key: "traffic" as const, label: "유동인구", dot: "bg-gradient-to-r from-green-400 to-red-500" },
                { key: "sales" as const, label: "매출", dot: "bg-gradient-to-r from-green-400 to-red-500" },
              ]).map(({ key, label, dot }) => {
                const active = heatmapOn && heatmapType === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (active) {
                        setHeatmapOn(false);
                      } else {
                        setHeatmapType(key);
                        setHeatmapOn(true);
                      }
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] transition-all ${
                      active
                        ? "bg-primary-50 font-semibold text-primary-700"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`h-2.5 w-6 rounded-full ${dot}`} />
                    {label}
                    {active && <span className="ml-auto text-[10px] text-primary-500">ON</span>}
                  </button>
                );
              })}
            </div>
          )}
          <button
            onClick={() => setLayerMenuOpen(!layerMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md transition-colors hover:bg-gray-50"
          >
            <Layers size={18} className="text-gray-500" />
          </button>
        </div>
      </div>

    </div>
  );
}

