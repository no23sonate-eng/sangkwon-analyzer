import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "서울 전체";

  // 점포 개폐업 트렌드
  let storeQuery = supabase.from("stores").select("trdar_cd, svc_nm, store_count, open_count, close_count");
  if (area !== "서울 전체") {
    const { data: areaData } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${area}%`);
    if (areaData && areaData.length > 0) {
      storeQuery = storeQuery.in("trdar_cd", areaData.map((a) => a.trdar_cd));
    }
  }
  const { data: storeData } = await storeQuery.limit(5000);

  // 업종별 집계
  const bySvc = new Map<string, { 점포수: number; 개업수: number; 폐업수: number }>();
  for (const r of storeData ?? []) {
    const nm = r.svc_nm ?? "기타";
    const existing = bySvc.get(nm) ?? { 점포수: 0, 개업수: 0, 폐업수: 0 };
    existing.점포수 += r.store_count ?? 0;
    existing.개업수 += r.open_count ?? 0;
    existing.폐업수 += r.close_count ?? 0;
    bySvc.set(nm, existing);
  }

  const trend = Array.from(bySvc.entries())
    .map(([name, v]) => ({ 업종: name, ...v }))
    .sort((a, b) => b.점포수 - a.점포수)
    .slice(0, 10);

  return NextResponse.json({ store_trend: trend });
}
