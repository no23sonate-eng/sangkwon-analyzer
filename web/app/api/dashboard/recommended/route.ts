import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // 매출 상위 상권 조회
  const { data: salesData } = await supabase
    .from("sales")
    .select("trdar_cd, trdar_nm, monthly_sales")
    .order("monthly_sales", { ascending: false })
    .limit(200);

  if (!salesData) return NextResponse.json([]);

  // 상권별 총 매출 집계
  const byArea = new Map<string, { trdar_cd: string; trdar_nm: string; total: number }>();
  for (const r of salesData) {
    const existing = byArea.get(r.trdar_cd);
    if (existing) {
      existing.total += r.monthly_sales ?? 0;
    } else {
      byArea.set(r.trdar_cd, { trdar_cd: r.trdar_cd, trdar_nm: r.trdar_nm, total: r.monthly_sales ?? 0 });
    }
  }

  const sorted = Array.from(byArea.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // 좌표 조회
  const codes = sorted.map((s) => s.trdar_cd);
  const { data: areas } = await supabase.from("areas").select("trdar_cd, lat, lng, gu").in("trdar_cd", codes);
  const areaMap = new Map((areas ?? []).map((a) => [a.trdar_cd, a]));

  const results = sorted.map((s) => {
    const area = areaMap.get(s.trdar_cd);
    return {
      trdar_cd: s.trdar_cd,
      trdar_nm: s.trdar_nm,
      monthly_sales: s.total,
      lat: area?.lat ?? 0,
      lng: area?.lng ?? 0,
      gu: area?.gu ?? "",
    };
  });

  return NextResponse.json(results);
}
