import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

// DB 실패 시 폴백
const FALLBACK: Record<string, { f1: number; b1: number; f2: number }> = {
  "강남구": { f1: 53.3, b1: 30.9, f2: 32.0 },
  "서초구": { f1: 42.5, b1: 24.7, f2: 25.5 },
  "마포구": { f1: 33.8, b1: 19.6, f2: 20.3 },
  "용산구": { f1: 38.5, b1: 22.3, f2: 23.1 },
  "종로구": { f1: 36.2, b1: 21.0, f2: 21.7 },
  "중구": { f1: 44.8, b1: 26.0, f2: 26.9 },
  "성동구": { f1: 30.5, b1: 17.7, f2: 18.3 },
  "송파구": { f1: 35.1, b1: 20.4, f2: 21.1 },
  "영등포구": { f1: 32.7, b1: 19.0, f2: 19.6 },
  "광진구": { f1: 28.9, b1: 16.8, f2: 17.3 },
  "동작구": { f1: 25.3, b1: 14.7, f2: 15.2 },
  "관악구": { f1: 22.1, b1: 12.8, f2: 13.3 },
  "강동구": { f1: 27.5, b1: 16.0, f2: 16.5 },
  "노원구": { f1: 20.8, b1: 12.1, f2: 12.5 },
  "은평구": { f1: 21.5, b1: 12.5, f2: 12.9 },
  "강서구": { f1: 24.3, b1: 14.1, f2: 14.6 },
  "강북구": { f1: 19.2, b1: 11.1, f2: 11.5 },
  "구로구": { f1: 23.8, b1: 13.8, f2: 14.3 },
  "금천구": { f1: 22.5, b1: 13.1, f2: 13.5 },
  "도봉구": { f1: 19.8, b1: 11.5, f2: 11.9 },
  "동대문구": { f1: 27.3, b1: 15.8, f2: 16.4 },
  "서대문구": { f1: 25.8, b1: 15.0, f2: 15.5 },
  "성북구": { f1: 22.9, b1: 13.3, f2: 13.7 },
  "양천구": { f1: 25.1, b1: 14.6, f2: 15.1 },
  "중랑구": { f1: 21.2, b1: 12.3, f2: 12.7 },
};

export async function GET(req: Request, { params }: { params: Promise<{ gu_name: string }> }) {
  const limited = rateLimit(req, "rent-gu", 120, 60_000);
  if (limited) return limited;

  const { gu_name } = await params;

  // DB에서 조회
  const { data } = await supabase
    .from("gu_rent_stats")
    .select("f1_pyeong, f2_pyeong, b1_pyeong, source, updated_at")
    .eq("gu", gu_name)
    .single();

  if (data && data.f1_pyeong > 0) {
    return NextResponse.json({
      gu: gu_name,
      "1층_평": data.f1_pyeong,
      "지하_평": data.b1_pyeong,
      "2층이상_평": data.f2_pyeong,
      source: `${gu_name} 권역 평균`,
      updated_at: data.updated_at,
    });
  }

  // 폴백
  const d = FALLBACK[gu_name];
  if (!d) {
    return NextResponse.json({ gu: gu_name, "1층_평": 25, "지하_평": 14, "2층이상_평": 15, source: "기본값" });
  }
  return NextResponse.json({
    gu: gu_name,
    "1층_평": d.f1,
    "지하_평": d.b1,
    "2층이상_평": d.f2,
    source: "권역 평균 (폴백)",
  });
}
