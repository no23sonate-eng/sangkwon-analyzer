"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { compactNumber } from "@/lib/formatters";
import { palette } from "@/lib/colors";
import { useAnalysisStore } from "@/store/analysisStore";

interface TimeSlotBarProps {
  data: { name: string; value: number }[];
  height?: number;
  color?: string;
  clickable?: boolean;
}

export default function TimeSlotBar({
  data,
  height = 220,
  color = palette.orange,
  clickable = false,
}: TimeSlotBarProps) {
  const highlightTimeSlot = useAnalysisStore((s) => s.highlightTimeSlot);
  const setHighlightTimeSlot = useAnalysisStore((s) => s.setHighlightTimeSlot);

  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">데이터가 없습니다</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        onClick={
          clickable
            ? (state) => {
                if (state?.activeLabel != null) {
                  const label = String(state.activeLabel);
                  setHighlightTimeSlot(
                    highlightTimeSlot === label ? null : label,
                  );
                }
              }
            : undefined
        }
        style={clickable ? { cursor: "pointer" } : undefined}
      >
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={compactNumber}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("ko-KR")}
          contentStyle={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20}>
          {data.map((entry) => {
            const active = !highlightTimeSlot || entry.name === highlightTimeSlot;
            return (
              <Cell
                key={entry.name}
                fill={color}
                opacity={active ? 1 : 0.2}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
