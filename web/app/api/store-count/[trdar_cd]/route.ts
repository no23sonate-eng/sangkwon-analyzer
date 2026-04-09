import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const { trdar_cd } = await params;

  const { data } = await supabase
    .from("stores")
    .select("svc_nm, store_count, open_count, close_count, franchise_count")
    .eq("trdar_cd", trdar_cd);

  if (!data || data.length === 0) {
    return NextResponse.json({ summary: { by_service: [], open_close: { open: 0, close: 0 } }, detail: [] });
  }

  let totalOpen = 0;
  let totalClose = 0;
  const byService = data.map((r) => {
    totalOpen += r.open_count ?? 0;
    totalClose += r.close_count ?? 0;
    return {
      "업종": r.svc_nm,
      "점포수": r.store_count ?? 0,
      "개업수": r.open_count ?? 0,
      "폐업수": r.close_count ?? 0,
      "프랜차이즈": r.franchise_count ?? 0,
    };
  });

  return NextResponse.json({
    summary: {
      by_service: byService,
      open_close: { open: totalOpen, close: totalClose },
    },
    detail: byService,
  });
}
