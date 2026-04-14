import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

export async function GET(_: Request, { params }: { params: Promise<{ gu: string }> }) {
  const { gu } = await params;

  const { data } = await supabase
    .from("district_income")
    .select("gu, income, rank, source, updated_at")
    .eq("gu", gu)
    .single();

  if (data) {
    const pct = Math.round(((25 - data.rank + 1) / 25) * 100);
    return NextResponse.json({ ...data, percentile: pct });
  }

  return NextResponse.json({ gu, income: 520, rank: 13, percentile: 52, source: "기본값" });
}
