import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET(req: Request, { params }: { params: Promise<{ gu_name: string }> }) {
  const limited = rateLimit(req, "sale-live", 120, 60_000);
  if (limited) return limited;

  const { gu_name } = await params;

  const { data } = await supabase
    .from("gu_sale_stats")
    .select("m2_price, avg_price, source, updated_at")
    .eq("gu", gu_name)
    .single();

  if (data && data.m2_price > 0) {
    return NextResponse.json({
      avg_price_per_m2: data.m2_price,
      avg_price: data.avg_price,
      source: data.source,
      updated_at: data.updated_at,
    });
  }

  return NextResponse.json({
    avg_price_per_m2: 1500, avg_price: 50000,
    source: "기본값",
  });
}
