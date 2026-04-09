"use client";

import { palette } from "@/lib/colors";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export default function MetricCard({
  label,
  value,
  sub,
  color = palette.orange,
}: MetricCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: palette.border, background: "white" }}
    >
      <p className="text-xs" style={{ color: palette.textSecondary }}>
        {label}
      </p>
      <p className="mt-1 text-xl font-bold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: palette.textSecondary }}>
          {sub}
        </p>
      )}
    </div>
  );
}
