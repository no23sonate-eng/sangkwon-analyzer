"use client";

import ReactMarkdown from "react-markdown";
import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatWon, formatCount } from "@/lib/formatters";

/** Generate a markdown summary from analysisData since there is no report field */
function generateReport(data: NonNullable<ReturnType<typeof useAnalysisStore.getState>["analysisData"]>): string {
  const lines: string[] = [];

  lines.push("# 상권 분석 리포트\n");

  // Store summary
  const ss = data.store_summary;
  if (ss) {
    lines.push("## 업종 현황");
    lines.push(`- 총 점포 수: **${formatCount(ss.total)}개**`);
    const topCategories = Object.entries(ss.by_category ?? {})
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    if (topCategories.length > 0) {
      lines.push("- 주요 업종: " + topCategories.map(([k, v]) => `${k}(${v.count}개, ${v.ratio.toFixed(1)}%)`).join(", "));
    }
    lines.push("");
  }

  // Sales summary
  const sl = data.sales_summary;
  if (sl) {
    lines.push("## 매출 현황");
    lines.push(`- 총 매출: **${formatWon(sl.total_sales)}**`);
    lines.push(`- 총 건수: **${formatCount(sl.total_count)}건**`);
    if (sl.per_store && sl.per_store.length > 0) {
      const topSales = [...sl.per_store].sort((a, b) => b.점포당_매출 - a.점포당_매출).slice(0, 3);
      lines.push("- 점포당 매출 상위: " + topSales.map((s) => `${s.업종}(${formatWon(s.점포당_매출)})`).join(", "));
    }
    lines.push("");
  }

  // Foot traffic
  const ft = data.ft_summary;
  if (ft) {
    lines.push("## 유동인구");
    lines.push(`- 총 유동인구: **${formatCount(ft.total)}명**`);
    const peakTime = Object.entries(ft.time_slots ?? {}).sort((a, b) => b[1] - a[1])[0];
    if (peakTime) {
      lines.push(`- 피크 시간대: **${peakTime[0]}** (${formatCount(peakTime[1])}명)`);
    }
    const peakAge = Object.entries(ft.by_age ?? {}).sort((a, b) => b[1] - a[1])[0];
    if (peakAge) {
      lines.push(`- 주요 연령대: **${peakAge[0]}** (${formatCount(peakAge[1])}명)`);
    }
    lines.push("");
  }

  // Population
  const pop = data.pop_summary;
  if (pop) {
    lines.push("## 상주인구");
    lines.push(`- 총 인구: **${formatCount(pop.total)}명** (${formatCount(pop.households)} 세대)`);
    lines.push("");
  }

  // Opportunities
  const opp = data.opportunities;
  if (opp?.insights) {
    lines.push("## 기회 분석");
    lines.push(`- 활력도: **${opp.insights.vitality}**`);
    lines.push(`- 개업: ${opp.insights.open_count}개 / 폐업: ${opp.insights.close_count}개`);
    if (opp.recommendations && opp.recommendations.length > 0) {
      lines.push("- 추천 업종: " + opp.recommendations.map((r) => r.업종).join(", "));
    }
    lines.push("");
  }

  // Cross result highlights
  const cr = data.cross_result;
  if (cr && cr.length > 0) {
    lines.push("## 매출 추정 요약");
    const topCr = [...cr].sort((a, b) => b.종합_점포당_월매출 - a.종합_점포당_월매출).slice(0, 5);
    topCr.forEach((r) => {
      lines.push(`- ${r.업종}: 점포당 ${formatWon(r.종합_점포당_월매출)} (${r.신뢰등급})`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

export default function ReportPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);

  if (!analysisData) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: palette.textSecondary }}>
        리포트 데이터가 없습니다.
      </p>
    );
  }

  const report = generateReport(analysisData);

  return (
    <div className="animate-fade-in">
      <div
        className="prose prose-sm max-w-none rounded-xl border p-4"
        style={{
          borderColor: palette.border,
          background: "white",
          color: palette.textPrimary,
        }}
      >
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="mb-3 text-lg font-bold" style={{ color: palette.navy }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-2 mt-4 text-base font-bold" style={{ color: palette.orange }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-1 mt-3 text-sm font-semibold" style={{ color: palette.textSecondary }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="mb-2 text-xs leading-relaxed" style={{ color: palette.textPrimary }}>
                {children}
              </p>
            ),
            li: ({ children }) => (
              <li className="text-xs leading-relaxed" style={{ color: palette.textPrimary }}>
                {children}
              </li>
            ),
            strong: ({ children }) => (
              <strong style={{ color: palette.orange }}>{children}</strong>
            ),
          }}
        >
          {report}
        </ReactMarkdown>
      </div>
    </div>
  );
}
