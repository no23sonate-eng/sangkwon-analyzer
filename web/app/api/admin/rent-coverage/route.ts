import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

/* ── 서울시 25개 구 ── */
const SEOUL_GU = [
  "강남구", "강동구", "강북구", "강서구", "관악구",
  "광진구", "구로구", "금천구", "노원구", "도봉구",
  "동대문구", "동작구", "마포구", "서대문구", "서초구",
  "성동구", "성북구", "송파구", "양천구", "영등포구",
  "용산구", "은평구", "종로구", "중구", "중랑구",
];

async function countByGu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  table: string,
  guColumn: string,
  filters?: (q: unknown) => unknown,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  await Promise.all(
    SEOUL_GU.map(async (gu) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = sb.from(table).select("*", { count: "exact", head: true }).eq(guColumn, gu);
      if (filters) q = filters(q);
      const { count } = await q;
      result[gu] = count ?? 0;
    })
  );
  return result;
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "admin-rent-coverage", 30, 60_000);
  if (limited) return limited;

  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (key !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "missing credentials" }, { status: 503 });
  }
  const sb = createClient(url, serviceKey);

  // rents: gu 컬럼 없을 수 있음 → 샘플링으로 lat 분포만 확인
  // naver_estimated_deals, naver_listings: gu 컬럼 있음
  const [rentsTotal, naverDealsByGu, naverListingsByGu, guStatsRows] = await Promise.all([
    sb.from("rents").select("*", { count: "exact", head: true }).eq("target_pyeong", 10),
    countByGu(sb, "naver_estimated_deals", "gu", (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).gt("rent_per_pyeong", 0)
    ),
    countByGu(sb, "naver_listings", "gu", (q) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (q as any).gt("monthly_rent", 0)
    ),
    sb
      .from("gu_rent_stats")
      .select("gu, f1_pyeong, source, updated_at")
      .order("gu", { ascending: true }),
  ]);

  // 요약: 네이버 데이터가 MIN_CASES(3) 이상 있어야 실질적으로 폴백이 작동
  const MIN = 3;
  const coverage = SEOUL_GU.map((gu) => {
    const nd = naverDealsByGu[gu] ?? 0;
    const nl = naverListingsByGu[gu] ?? 0;
    const guAvg = guStatsRows.data?.find((r: { gu: string }) => r.gu === gu);
    let tier: "실측미점검" | "네이버 추정실거래" | "네이버 호가" | "구평균" | "하드코딩" = "하드코딩";
    if (nd >= MIN) tier = "네이버 추정실거래";
    else if (nl >= MIN) tier = "네이버 호가";
    else if (guAvg?.f1_pyeong > 0) tier = "구평균";
    return {
      gu,
      naver_deals: nd,
      naver_listings: nl,
      gu_avg_pyeong: guAvg?.f1_pyeong ?? null,
      gu_avg_source: guAvg?.source ?? null,
      expected_fallback_tier: tier,
    };
  });

  return NextResponse.json({
    seoul_rents_target10_total: rentsTotal.count ?? 0,
    per_gu: coverage,
    note: "rents 테이블은 lat/lng 기반이라 gu별 집계가 아닌 전체 카운트만 제공합니다. 실측 판단은 /api/rent-nearby 호출로 위치별 검증 필요.",
  });
}
