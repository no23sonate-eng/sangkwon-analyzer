"use client";

import { useState, useCallback } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import { geocode, findNearbyTrdar, analyzeArea, getStoreCount, searchTrdar, reverseGeocode } from "@/lib/api";
import { palette } from "@/lib/colors";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setClicked = useAnalysisStore((s) => s.setClicked);
  const setClickedAddress = useAnalysisStore((s) => s.setClickedAddress);
  const setViewState = useAnalysisStore((s) => s.setViewState);
  const viewState = useAnalysisStore((s) => s.viewState);
  const setNearbyList = useAnalysisStore((s) => s.setNearbyList);
  const setSelectedTrdar = useAnalysisStore((s) => s.setSelectedTrdar);
  const setAnalysisData = useAnalysisStore((s) => s.setAnalysisData);
  const setStoreCountData = useAnalysisStore((s) => s.setStoreCountData);
  const setPanelOpen = useAnalysisStore((s) => s.setPanelOpen);
  const setLoading = useAnalysisStore((s) => s.setLoading);
  const loading = useAnalysisStore((s) => s.loading);
  const radius = useAnalysisStore((s) => s.radius);

  /** 좌표로 분석 실행 */
  const runAnalysis = useCallback(async (lat: number, lng: number, address: string) => {
    setClicked(lat, lng);
    setClickedAddress(address, "", "");
    setViewState({ ...viewState, latitude: lat, longitude: lng, zoom: 15 });

    // 역지오코딩으로 구/동 업데이트
    reverseGeocode(lat, lng)
      .then((res) => setClickedAddress(res.address, res.gu, res.dong))
      .catch(() => {});

    const list = await findNearbyTrdar(lat, lng, Math.max(radius, 500));
    setNearbyList(list);

    if (list.length > 0) {
      const closest = list[0];
      setSelectedTrdar(closest);
      setPanelOpen(true);

      const cLat = closest.lat ?? lat;
      const cLng = closest.lng ?? lng;

      const [analysis, stores] = await Promise.all([
        analyzeArea(cLat, cLng, radius),
        getStoreCount(closest.trdar_cd),
      ]);
      setAnalysisData(analysis);
      setStoreCountData(stores);
    } else {
      setError("주변에 상권 데이터가 없습니다.");
      setPanelOpen(false);
    }
  }, [radius, viewState, setClicked, setClickedAddress, setViewState, setNearbyList, setSelectedTrdar, setAnalysisData, setStoreCountData, setPanelOpen]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setError(null);
    setLoading(true);

    const q = query.trim();

    try {
      // 1차: 지오코딩 시도
      try {
        const geo = await geocode(q);
        if (geo?.lat && geo?.lng) {
          await runAnalysis(geo.lat, geo.lng, geo.address);
          return;
        }
      } catch {
        // 지오코딩 실패 → 2차 시도
      }

      // 2차: 상권 검색
      try {
        const results = await searchTrdar(q);
        const match = results.find((r) => r.lat && r.lng);
        if (match && match.lat && match.lng) {
          await runAnalysis(match.lat, match.lng, match.trdar_nm);
          return;
        }
      } catch {
        // 상권 검색도 실패
      }

      setError("검색 결과가 없습니다. 다른 키워드로 시도해주세요.");
    } catch (err) {
      console.error(err);
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query, setLoading, runAnalysis]);

  return (
    <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-xl border px-4 py-2 shadow-lg backdrop-blur-sm"
        style={{
          background: "rgba(253,251,248,0.92)",
          borderColor: palette.border,
          minWidth: 360,
        }}
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={palette.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="주소 또는 장소 검색 (예: 강남역, 성수동)"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          style={{ color: palette.textPrimary }}
        />

        <button
          onClick={handleSearch}
          disabled={loading}
          className="rounded-lg px-3 py-1 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: palette.orange }}
        >
          {loading ? "..." : "검색"}
        </button>
      </div>

      {error && (
        <div
          className="mt-2 rounded-lg px-4 py-2 text-center text-xs"
          style={{ background: "rgba(234,56,145,0.1)", color: palette.magenta }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
