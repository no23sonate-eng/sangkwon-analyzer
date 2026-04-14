import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET() {
  const { data } = await supabase
    .from("dashboard_stats")
    .select("metric_key, value, label, change_pct, updated_at");

  if (data && data.length > 0) {
    const map: Record<string, { value: number; label: string; change_pct: number; updated_at: string }> = {};
    for (const row of data) {
      map[row.metric_key] = {
        value: row.value,
        label: row.label,
        change_pct: row.change_pct ?? 0,
        updated_at: row.updated_at,
      };
    }
    return NextResponse.json(map);
  }

  // 폴백
  return NextResponse.json({
    total_stores: { value: 12840000, label: "총 상가 데이터", change_pct: 0 },
    monthly_open: { value: 3241, label: "이번 달 신규 개업", change_pct: 8.2 },
    monthly_close: { value: 2103, label: "이번 달 폐업", change_pct: -3.1 },
  });
}
