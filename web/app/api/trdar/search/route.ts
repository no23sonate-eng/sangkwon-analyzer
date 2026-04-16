import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, "trdar-search", 120, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword") ?? "";
  if (!keyword) return NextResponse.json([]);

  // 상권명 검색
  const { data } = await supabase
    .from("areas")
    .select("trdar_cd, trdar_nm, gu, dong, lat, lng")
    .ilike("trdar_nm", `%${keyword}%`)
    .limit(20);

  // 동명으로도 검색
  const { data: data2 } = await supabase
    .from("areas")
    .select("trdar_cd, trdar_nm, gu, dong, lat, lng")
    .ilike("dong", `%${keyword}%`)
    .limit(20);

  const seen = new Set<string>();
  const results: typeof data = [];
  for (const d of [...(data ?? []), ...(data2 ?? [])]) {
    if (!seen.has(d.trdar_cd)) {
      seen.add(d.trdar_cd);
      results.push(d);
    }
  }

  return NextResponse.json(results.slice(0, 20));
}
