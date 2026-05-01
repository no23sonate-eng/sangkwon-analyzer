/* ── Admin · 데이터 헬스 패널 API ──

   브랜드/건물주 의사결정에 쓸 수 있는 신뢰도 운영 가시성:
   - 본인 네트워크 GT: 동/층별 표본 수, n<3 비중, 신선도 만료 임박
   - 큐레이션 브랜드: 카테고리별 분포, 동별 분포
   - sanity-check 마지막 실행 결과
   - 임대료 폴백 분포 (Tier 1·2·3·4 비율 추정)

   service_role 키로만 호출 — admin 페이지에서만 fetch.
*/
import { NextResponse, type NextRequest } from "next/server";
import { listAllOwnerNetwork, networkMeta } from "@/lib/owner-network-rents";
import { curatedMeta } from "@/lib/curated-brands";
import curatedData from "@/lib/data/curated-brands.json";
import { isExpired, FRESHNESS_MONTHS } from "@/lib/data-quality";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

interface CuratedJsonShape {
  brands: Array<{ category: string; gu: string; dong: string; recorded_at?: string }>;
  by_category: Record<string, unknown[]>;
  by_dong: Record<string, unknown[]>;
}

export async function GET(req: NextRequest) {
  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (key !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 1. 네트워크 GT 통계
  const network = listAllOwnerNetwork();
  const networkByDong: Record<string, { gu: string; dong: string; floors: Record<string, { rent: number; n: number; collected_at?: string; expired: boolean }> }> = {};
  for (const item of network) {
    const k = `${item.gu}|${item.dong}`;
    if (!networkByDong[k]) networkByDong[k] = { gu: item.gu, dong: item.dong, floors: {} };
    networkByDong[k].floors[item.floor] = {
      rent: item.stat.rent,
      n: item.stat.n,
      collected_at: item.stat.collected_at,
      expired: isExpired(item.stat.collected_at ?? "", "rent"),
    };
  }
  const networkN1Count = network.filter((x) => x.stat.n < 3).length;
  const networkExpiredCount = network.filter((x) => isExpired(x.stat.collected_at ?? "", "rent")).length;

  // 2. 큐레이션 브랜드 통계
  const cur = curatedData as CuratedJsonShape;
  const curMeta = curatedMeta();
  const curatedByCategory: Record<string, number> = {};
  for (const [cat, arr] of Object.entries(cur.by_category ?? {})) {
    curatedByCategory[cat] = arr.length;
  }
  const curatedByDong: Record<string, number> = {};
  for (const [dk, arr] of Object.entries(cur.by_dong ?? {})) {
    curatedByDong[dk] = arr.length;
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    network: {
      meta: networkMeta(),
      total_records: network.length,
      n_lt_3: networkN1Count,
      expired: networkExpiredCount,
      by_dong: Object.values(networkByDong),
    },
    curated: {
      meta: curMeta,
      total_brands: cur.brands?.length ?? 0,
      by_category: curatedByCategory,
      by_dong: curatedByDong,
    },
    freshness_policy_months: FRESHNESS_MONTHS,
  });
}
