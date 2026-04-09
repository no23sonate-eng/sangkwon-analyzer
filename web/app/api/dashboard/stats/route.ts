import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { count: areaCount } = await supabase.from("areas").select("*", { count: "exact", head: true });
  const { data: storeData } = await supabase.from("stores").select("store_count");
  const totalStores = storeData?.reduce((s, r) => s + (r.store_count ?? 0), 0) ?? 0;

  return NextResponse.json({
    total_areas: areaCount ?? 0,
    total_stores: totalStores,
  });
}
