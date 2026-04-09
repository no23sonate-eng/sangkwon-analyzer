"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import type { PanelTab } from "@/lib/types";

const tabs: { key: PanelTab; label: string }[] = [
  { key: "category", label: "업종" },
  { key: "sales", label: "매출" },
  { key: "foot_traffic", label: "유동인구" },
  { key: "opportunity", label: "기회분석" },
  { key: "report", label: "리포트" },
];

export default function PanelNav() {
  const activeTab = useAnalysisStore((s) => s.activeTab);
  const setActiveTab = useAnalysisStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex gap-1 border-b px-2 pt-2"
      style={{ borderColor: palette.border }}
    >
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="relative rounded-t-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{
              color: active ? palette.orange : palette.textSecondary,
              background: active ? "white" : "transparent",
              borderBottom: active ? `2px solid ${palette.orange}` : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
