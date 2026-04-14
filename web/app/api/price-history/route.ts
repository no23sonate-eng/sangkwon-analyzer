import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gu = searchParams.get("gu") ?? "";

  if (!gu) {
    return NextResponse.json({ error: "gu parameter required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("gu_price_history")
    .select("year, land_price, rent_price")
    .eq("gu", gu)
    .order("year", { ascending: true });

  if (data && data.length > 0) {
    return NextResponse.json({
      gu,
      years: data.map((r) => String(r.year)),
      land: data.map((r) => r.land_price),
      rent: data.map((r) => r.rent_price),
    });
  }

  return NextResponse.json({ gu, years: [], land: [], rent: [] });
}
