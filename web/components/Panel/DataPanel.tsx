"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import PanelNav from "./PanelNav";
import CategoryPanel from "./CategoryPanel";
import SalesPanel from "./SalesPanel";
import FootTrafficPanel from "./FootTrafficPanel";
import OpportunityPanel from "./OpportunityPanel";
import ReportPanel from "./ReportPanel";

export default function DataPanel() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const selectedTrdar = useAnalysisStore((s) => s.selectedTrdar);
  const clickedAddress = useAnalysisStore((s) => s.clickedAddress);
  const clickedGu = useAnalysisStore((s) => s.clickedGu);
  const clickedDong = useAnalysisStore((s) => s.clickedDong);
  const radius = useAnalysisStore((s) => s.radius);
  const setRadius = useAnalysisStore((s) => s.setRadius);
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const loading = useAnalysisStore((s) => s.loading);
  const setPanelOpen = useAnalysisStore((s) => s.setPanelOpen);
  const reset = useAnalysisStore((s) => s.reset);

  const trdarCount = analysisData?.trdar_count ?? 0;

  const RADIUS_OPTIONS = [100, 300, 500, 1000];

  return (
    <div
      className="animate-slide-in absolute top-0 left-0 z-30 flex h-full w-[400px] flex-col shadow-2xl"
      style={{ background: palette.background }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: palette.border }}
      >
        <div className="min-w-0 flex-1">
          {clickedAddress && (
            <h2
              className="truncate text-sm font-bold"
              style={{ color: palette.textPrimary }}
              title={clickedAddress}
            >
              {clickedAddress}
            </h2>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: palette.textSecondary }}>
            {selectedTrdar && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ background: palette.orange + "18", color: palette.orange }}
              >
                {selectedTrdar.trdar_nm}
              </span>
            )}
            {clickedGu && <span>{clickedGu} {clickedDong}</span>}
            {selectedTrdar?.distance != null && (
              <span>{selectedTrdar.distance.toFixed(0)}m</span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            setPanelOpen(false);
            reset();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
          style={{ color: palette.textSecondary }}
          aria-label="패널 닫기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* 반경 선택 */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2"
        style={{ borderColor: palette.border }}
      >
        <span className="text-xs font-medium" style={{ color: palette.textSecondary }}>
          반경
        </span>
        <div className="flex gap-1">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background: radius === r ? palette.orange : "transparent",
                color: radius === r ? "#fff" : palette.muted,
                border: `1px solid ${radius === r ? palette.orange : palette.border}`,
              }}
            >
              {r}m
            </button>
          ))}
        </div>
        {trdarCount > 0 && (
          <span className="ml-auto text-[10px] font-medium" style={{ color: palette.teal }}>
            {trdarCount}개 상권 집계
          </span>
        )}
      </div>

      {/* Tab navigation */}
      <PanelNav />

      {/* Content */}
      <div className="panel-scroll flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: palette.orange, borderTopColor: "transparent" }}
            />
          </div>
        ) : (
          <>
            {activeTab === "category" && <CategoryPanel />}
            {activeTab === "sales" && <SalesPanel />}
            {activeTab === "foot_traffic" && <FootTrafficPanel />}
            {activeTab === "opportunity" && <OpportunityPanel />}
            {activeTab === "report" && <ReportPanel />}
          </>
        )}
      </div>
    </div>
  );
}
