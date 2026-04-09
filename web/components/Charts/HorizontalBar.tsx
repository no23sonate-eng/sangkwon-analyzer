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
import { chartColors } from "@/lib/colors";
import { compactNumber } from "@/lib/formatters";

interface HorizontalBarProps {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  barColor?: string;
}

export default function HorizontalBar({
  data,
  height = 260,
  barColor,
}: HorizontalBarProps) {
  if (!data || data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">데이터가 없습니다</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 16 }}>
        <XAxis
          type="number"
          tickFormatter={compactNumber}
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={70}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => Number(value).toLocaleString("ko-KR")}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #f0ebe4",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((entry, i) => (
            <Cell
              key={`bar-${i}`}
              fill={entry.color ?? barColor ?? chartColors[i % chartColors.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
