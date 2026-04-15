import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 3600;

export async function GET(req: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const limited = rateLimit(req, "area-open-close", 120, 60_000);
  if (limited) return limited;
  const { trdar_cd } = await params;

  const { data } = await supabase
    .from("stores")
    .select("quarter_cd, open_count, close_count")
    .eq("trdar_cd", trdar_cd);

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }

  // quarter_cd 별 합산
  const byQ = new Map<string, { open: number; close: number }>();
  for (const r of data) {
    const q = r.quarter_cd ?? "";
    const e = byQ.get(q) ?? { open: 0, close: 0 };
    e.open += r.open_count ?? 0;
    e.close += r.close_count ?? 0;
    byQ.set(q, e);
  }

  const sortedQ = Array.from(byQ.entries()).sort(([a], [b]) => a.localeCompare(b));
  // 최근 8개 분기
  const recent = sortedQ.slice(-8);

  const monthly = recent.map(([q, v]) => ({
    month: `${q.slice(0, 4)} Q${q.slice(4)}`,
    개업: v.open,
    폐업: v.close,
  }));

  const totalOpen = monthly.reduce((s, r) => s + r.개업, 0);
  const totalClose = monthly.reduce((s, r) => s + r.폐업, 0);

  return NextResponse.json({
    monthly,
    netChange: totalOpen - totalClose,
    totalOpen,
    totalClose,
  });
}
