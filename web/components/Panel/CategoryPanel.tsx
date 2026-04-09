"use client";

import { useAnalysisStore } from "@/store/analysisStore";
import { getCategoryColor } from "@/lib/colors";
import { palette } from "@/lib/colors";
import { formatCount } from "@/lib/formatters";
import MetricCard from "@/components/MetricCard";
import DonutChart from "@/components/Charts/DonutChart";
import HorizontalBar from "@/components/Charts/HorizontalBar";

export default function CategoryPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const storeSummary = analysisData?.store_summary;

  if (!storeSummary) {
    return <EmptyState />;
  }

  const { total, by_category, by_subcategory } = storeSummary;

  // Convert Record<string, {count, ratio}> to chart data for donut
  const donutData = Object.entries(by_category ?? {}).map(([name, info]) => ({
    name,
    value: info.count,
    color: getCategoryColor(name),
  }));

  // Convert subcategory to bar data, sorted desc, top 12
  const barData = Object.entries(by_subcategory ?? {})
    .map(([name, info]) => ({
      name,
      value: info.count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="총 점포 수"
          value={formatCount(total)}
          color={palette.orange}
        />
        <MetricCard
          label="대분류 업종 수"
          value={`${Object.keys(by_category ?? {}).length}개`}
          color={palette.navy}
        />
      </div>

      {/* Donut chart - by category */}
      {donutData.length > 0 && (
        <section>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: palette.textPrimary }}
          >
            업종별 비중
          </h3>
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: palette.border, background: "white" }}
          >
            <DonutChart data={donutData} />
          </div>
        </section>
      )}

      {/* Horizontal bar - by subcategory top 12 */}
      {barData.length > 0 && (
        <section>
          <h3
            className="mb-2 text-sm font-semibold"
            style={{ color: palette.textPrimary }}
          >
            세부업종별 점포 수 (상위 12)
          </h3>
          <div
            className="rounded-xl border p-3"
            style={{ borderColor: palette.border, background: "white" }}
          >
            <HorizontalBar
              data={barData}
              barColor={palette.navy}
              height={Math.max(260, barData.length * 28)}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-12 text-center text-sm" style={{ color: palette.textSecondary }}>
      지도를 클릭하거나 주소를 검색하면 업종 데이터가 표시됩니다.
    </p>
  );
}
