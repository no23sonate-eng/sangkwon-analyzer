"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  MapPin,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
} from "lucide-react";
import {
  searchAreas,
  getRecommendedAreas,
  POPULAR_TAGS,
  type SearchResult,
  type RecommendedArea,
} from "@/lib/search-data";
import { track } from "@/lib/track";

/* ── 통계 색상 맵 ── */
const STAT_COLORS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: "#ECFDF5", text: "#059669" },
  blue: { bg: "#EFF6FF", text: "#2563EB" },
  amber: { bg: "#FFFBEB", text: "#D97706" },
  rose: { bg: "#FFF1F2", text: "#E11D48" },
};

/* ── 트렌드 아이콘 ── */
function RentIcon({ trend }: { trend: string }) {
  if (trend === "상승")
    return <TrendingUp size={12} className="text-rose-400" />;
  if (trend === "하락")
    return <TrendingDown size={12} className="text-emerald-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recommended, setRecommended] = useState<RecommendedArea[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getRecommendedAreas().then(setRecommended);
  }, []);

  const handleSearch = useCallback(
    async (q?: string) => {
      const term = q ?? query;
      if (!term.trim()) return;
      track({ event_type: "search", query: term, path: "/search" });
      setLoading(true);
      setSearched(true);
      const res = await searchAreas(term);
      setResults(res);
      setLoading(false);
    },
    [query],
  );

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    handleSearch(tag);
  };

  const goToAnalysis = (areaCode: string, lat?: number, lng?: number, name?: string) => {
    track({
      event_type: "area_view",
      trdar_cd: areaCode,
      area_name: name,
      lat,
      lng,
      path: "/search",
    });
    if (lat && lng) {
      router.push(`/map?lat=${lat}&lng=${lng}`);
    } else {
      router.push(`/map?area=${areaCode}`);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-[960px] space-y-8 animate-fade-in">
        {/* ── 검색바 ── */}
        <div className="space-y-3">
          <div
            className="flex items-center gap-3 rounded-full bg-gray-50 px-5 transition-all
              focus-within:bg-white focus-within:ring-2 focus-within:ring-primary-200 focus-within:shadow-lg"
            style={{ height: 56 }}
          >
            <Search size={20} className="shrink-0 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setSearched(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="지역명, 주소, 또는 상권명으로 검색 (예: 강남역, 성수동)"
              className="flex-1 bg-transparent text-[15px] text-gray-800 outline-none placeholder:text-muted"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading}
              className="shrink-0 rounded-full bg-primary-600 px-5 py-2 text-[14px] font-semibold text-white
                transition-all hover:bg-primary-700 active:scale-95 disabled:opacity-50"
            >
              {loading ? "검색 중..." : "검색"}
            </button>
          </div>

          {/* 인기 검색 태그 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1 text-[12px] font-semibold text-muted">
              <Sparkles size={13} className="text-amber-400" />
              인기
            </span>
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="rounded-full bg-gray-100 px-4 py-2 text-[13px] font-medium text-gray-600
                  transition-all hover:bg-primary-50 hover:text-primary-600 active:scale-95"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* ── 검색 결과 ── */}
        {searched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">
                검색 결과
                {results.length > 0 && (
                  <span className="ml-2 text-[14px] font-normal text-muted">
                    {results.length}건
                  </span>
                )}
              </h2>
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[20px] bg-card py-16 text-center shadow-card">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <Search size={24} className="text-muted" />
                </div>
                <p className="text-[15px] font-medium text-gray-700">
                  &ldquo;{query}&rdquo;에 대한 검색 결과가 없습니다
                </p>
                <p className="text-[13px] text-muted">
                  다른 키워드로 검색하거나, 인기 태그를 클릭해보세요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <div
                    key={r.areaCode}
                    onClick={() => goToAnalysis(r.areaCode, r.lat, r.lng, r.name)}
                    className="group flex cursor-pointer items-center gap-5 rounded-[20px] bg-card p-5 shadow-card
                      transition-all hover:shadow-card-hover"
                  >
                    {/* 미니 지도 썸네일 */}
                    <div className="flex h-[120px] w-[160px] shrink-0 items-center justify-center rounded-xl bg-gray-100">
                      <MapPin size={28} className="text-gray-300" />
                    </div>

                    {/* 정보 */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[16px] font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {r.name}
                      </h3>
                      <p className="mt-1 text-[13px] text-muted">{r.address}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {r.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-600"
                          >
                            {tag.includes("임대료") && (
                              <RentIcon trend={r.rentTrend} />
                            )}
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goToAnalysis(r.areaCode, r.lat, r.lng, r.name);
                      }}
                      className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-button)] border border-primary-200
                        bg-white px-4 py-2.5 text-[13px] font-semibold text-primary-600
                        transition-all hover:bg-primary-50 hover:border-primary-300 active:scale-95"
                    >
                      분석하기
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 검색 전: 추천 상권 ── */}
        {!searched && (
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-gray-900">
              추천 상권
            </h2>
            <div className="grid grid-cols-3 gap-5">
              {recommended.map((area) => {
                const sc = STAT_COLORS[area.statColor];
                return (
                  <div
                    key={area.areaCode}
                    onClick={() => goToAnalysis(area.areaCode, area.lat, area.lng, area.name)}
                    className="group cursor-pointer rounded-[20px] bg-card p-6 shadow-card
                      transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[17px] font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {area.name}
                      </h3>
                      <ArrowRight
                        size={16}
                        className="text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-primary-500"
                      />
                    </div>
                    <p className="text-[13px] leading-relaxed text-muted">
                      {area.description}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-[13px] font-bold"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {area.stat}
                      </span>
                      <span className="text-[12px] text-muted">
                        {area.statLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
