"use client";

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { chartColors } from "@/lib/colors";
import { useAnalysisStore } from "@/store/analysisStore";

interface DonutChartProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export default function DonutChart({
  data,
  height = 260,
  innerRadius = 55,
  outerRadius = 90,
}: DonutChartProps) {
  const highlightCategory = useAnalysisStore((s) => s.highlightCategory);
  const setHighlightCategory = useAnalysisStore((s) => s.setHighlightCategory);

  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">데이터가 없습니다</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          stroke="none"
          onClick={(_: unknown, index: number) => {
            const name = data[index]?.name;
            setHighlightCategory(highlightCategory === name ? null : name);
          }}
          style={{ cursor: "pointer" }}
        >
          {data.map((entry, i) => {
            const isActive = !highlightCategory || entry.name === highlightCategory;
            const isHighlighted = highlightCategory === entry.name;
            return (
              <Cell
                key={`cell-${i}`}
                fill={entry.color ?? chartColors[i % chartColors.length]}
                opacity={isActive ? 1 : 0.25}
                strokeWidth={isHighlighted ? 3 : 0}
                stroke={isHighlighted ? "#fff" : "none"}
              />
            );
          })}
        </Pie>
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("ko-KR")}
          contentStyle={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
          onClick={(e) => {
            const name = String(e.value ?? "");
            setHighlightCategory(highlightCategory === name ? null : name || null);
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
