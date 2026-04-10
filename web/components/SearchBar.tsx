"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import { geocode, findNearbyTrdar, analyzeArea, getStoreCount, searchTrdar, reverseGeocode } from "@/lib/api";
import { palette } from "@/lib/colors";
import { Clock, X } from "lucide-react";

const HISTORY_KEY = "search_history";
const MAX_HISTORY = 10;

interface HistoryItem {
  query: string;
  address: string;
  lat: number;
  lng: number;
  timestamp: number;
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { setHistory(loadHistory()); }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.address !== item.address);
      const updated = [item, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((address: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.address !== address);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const runAnalysis = useCallback(async (lat: number, lng: number, address: string, originalQuery: string) => {
    setClicked(lat, lng);
    setClickedAddress(address, "", "");
    // 줌 16으로 더 정확하게
    setViewState({ ...viewState, latitude: lat, longitude: lng, zoom: 16 });

    addToHistory({ query: originalQuery, address, lat, lng, timestamp: Date.now() });

    reverseGeocode(lat, lng)
      .then((res) => setClickedAddress(res.address, res.gu, res.dong))
      .catch(() => {});

    const list = await findNearbyTrdar(lat, lng, Math.max(radius, 500));
    setNearbyList(list);

    if (list.length > 0) {
      const closest = list[0];
      setSelectedTrdar(closest);
      setPanelOpen(true);

      const [analysis, stores] = await Promise.all([
        analyzeArea(lat, lng, radius),
        getStoreCount(closest.trdar_cd),
      ]);
      setAnalysisData(analysis);
      setStoreCountData(stores);
    } else {
      setPanelOpen(true);
      const analysis = await analyzeArea(lat, lng, radius);
      setAnalysisData(analysis);
    }
  }, [radius, viewState, setClicked, setClickedAddress, setViewState, setNearbyList, setSelectedTrdar, setAnalysisData, setStoreCountData, setPanelOpen, addToHistory]);

  const handleSearch = useCallback(async (overrideQuery?: string) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setError(null);
    setLoading(true);
    setShowDropdown(false);

    try {
      // 1차: geocode (내부적으로 카카오 주소→키워드 순서)
      try {
        const geo = await geocode(q);
        if (geo?.lat && geo?.lng) {
          await runAnalysis(geo.lat, geo.lng, geo.address, q);
          return;
        }
      } catch {}

      // 2차: 상권 검색 (서울시 상권 DB)
      try {
        const results = await searchTrdar(q);
        const match = results.find((r) => r.lat && r.lng);
        if (match && match.lat && match.lng) {
          await runAnalysis(match.lat, match.lng, match.trdar_nm, q);
          return;
        }
      } catch {}

      setError("검색 결과가 없습니다. 도로명 주소나 행정동으로 다시 시도해주세요.");
    } catch (err) {
      console.error(err);
      setError("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query, setLoading, runAnalysis]);

  const handleHistoryClick = (item: HistoryItem) => {
    setQuery(item.query);
    runAnalysis(item.lat, item.lng, item.address, item.query);
    setShowDropdown(false);
  };

  return (
    <div ref={containerRef} className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
      <div
        className="flex items-center gap-2 rounded-xl border px-4 py-2 shadow-lg backdrop-blur-sm"
        style={{
          background: "rgba(253,251,248,0.95)",
          borderColor: palette.border,
          minWidth: 380,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={palette.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() => setShowDropdown(true)}
          placeholder="도로명/지번 주소, 행정동, 지하철역, 건물명"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          style={{ color: palette.textPrimary }}
        />

        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="rounded-lg px-3 py-1 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: palette.orange }}
        >
          {loading ? "..." : "검색"}
        </button>
      </div>

      {/* 검색 히스토리 드롭다운 */}
      {showDropdown && history.length > 0 && (
        <div className="mt-2 rounded-xl border bg-white shadow-lg overflow-hidden" style={{ borderColor: palette.border }}>
          <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-1.5">
            <Clock size={12} className="text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-500">최근 검색</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.address + item.timestamp}
                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                onClick={() => handleHistoryClick(item)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 truncate">{item.query}</p>
                  <p className="text-[10px] text-muted truncate">{item.address}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromHistory(item.address); }}
                  className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg px-4 py-2 text-center text-xs" style={{ background: "rgba(234,56,145,0.1)", color: palette.magenta }}>
          {error}
        </div>
      )}
    </div>
  );
}
