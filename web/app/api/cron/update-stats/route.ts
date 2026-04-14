/* ── Vercel Cron: 서울 열린데이터 → Supabase 자동 갱신 ──
   스케줄: 매일 04:00 (vercel.json 참조)
   호출: curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/update-stats
*/

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SEOUL_API_KEY = process.env.SEOUL_SALES_API_KEY ?? "";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

const GU_CODE: Record<string, string> = {
  "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
  "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
  "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
  "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
  "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

interface SeoulRentRow {
  CGG_CD?: string;
  RCPT_YR?: string;
  RENT_SE?: string;
  RENT_AREA?: number | string;
  RENT_GTN?: number | string;  // 보증금 (만원)
  MT_RENT_CHRGE?: number | string;  // 월세 (만원)
}

interface SeoulSaleRow {
  CGG_CD?: string;
  RCPT_YR?: string;    // 실제 API 필드명
  BLDG_USG?: string;
  ARCH_AREA?: number | string;  // 건축 면적 (m²)
  THING_AMT?: number | string;  // 거래금액 (만원)
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

async function fetchRentData(): Promise<SeoulRentRow[]> {
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/tbLnOpendataRentV/1/1000/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.tbLnOpendataRentV?.row ?? [];
}

async function fetchSaleData(): Promise<SeoulSaleRow[]> {
  const url = `http://openapi.seoul.go.kr:8088/${SEOUL_API_KEY}/json/tbLnOpendataRtmsV/1/1000/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.tbLnOpendataRtmsV?.row ?? [];
}

async function updateRentStats(rows: SeoulRentRow[]) {
  let updated = 0;
  const year = new Date().getFullYear();
  const acceptedYears = new Set([String(year), String(year - 1)]);

  for (const [guName, guCode] of Object.entries(GU_CODE)) {
    const guPrefix = guCode.slice(0, 5);
    const filtered = rows.filter((r) => {
      return (r.CGG_CD ?? "").toString().slice(0, 5) === guPrefix
        && acceptedYears.has(String(r.RCPT_YR ?? ""))
        && r.RENT_SE === "월세"
        && num(r.RENT_AREA) > 0;
    });

    if (filtered.length === 0) continue;

    const deposits = filtered.map((r) => num(r.RENT_GTN));
    const rents = filtered.map((r) => num(r.MT_RENT_CHRGE));
    const rentsPerM2 = filtered.map((r) => num(r.MT_RENT_CHRGE) / num(r.RENT_AREA)).filter((v) => v > 0 && isFinite(v));

    const avgDeposit = Math.round(deposits.reduce((s, v) => s + v, 0) / deposits.length);
    const avgRent = Math.round(rents.reduce((s, v) => s + v, 0) / rents.length);
    const avgPerM2 = rentsPerM2.length > 0
      ? Math.round((rentsPerM2.reduce((s, v) => s + v, 0) / rentsPerM2.length) * 10) / 10
      : 0;

    const f1 = Math.round(avgPerM2 * 3.3 * 10) / 10;

    await supabase.from("gu_rent_stats").upsert({
      gu: guName,
      avg_deposit: avgDeposit,
      avg_monthly_rent: avgRent,
      avg_rent_per_m2: avgPerM2,
      f1_pyeong: f1,
      f2_pyeong: Math.round(f1 * 0.6 * 10) / 10,
      b1_pyeong: Math.round(f1 * 0.58 * 10) / 10,
      source: `서울 열린데이터 실거래 (${year})`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "gu" });
    updated++;
  }
  return updated;
}

async function updateSaleStats(rows: SeoulSaleRow[]) {
  let updated = 0;
  const year = new Date().getFullYear();
  const acceptedYears = new Set([String(year), String(year - 1)]);  // 올해 + 작년 포함
  // tbLnOpendataRtmsV는 주거용 실거래. 상업성이 가장 높은 오피스텔만 사용.
  const validUsages = new Set(["오피스텔"]);

  for (const [guName, guCode] of Object.entries(GU_CODE)) {
    const guPrefix = guCode.slice(0, 5);
    const filtered = rows.filter((r) => {
      return (r.CGG_CD ?? "").toString().slice(0, 5) === guPrefix
        && acceptedYears.has(String(r.RCPT_YR ?? ""))
        && validUsages.has(r.BLDG_USG ?? "")
        && num(r.ARCH_AREA) > 0
        && num(r.THING_AMT) > 0;
    });

    if (filtered.length === 0) continue;

    const prices = filtered.map((r) => num(r.THING_AMT));
    const pricesPerM2 = filtered.map((r) => num(r.THING_AMT) / num(r.ARCH_AREA)).filter((v) => v > 0 && isFinite(v));

    const avgPrice = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
    const avgPerM2 = pricesPerM2.length > 0
      ? Math.round(pricesPerM2.reduce((s, v) => s + v, 0) / pricesPerM2.length)
      : 0;

    await supabase.from("gu_sale_stats").upsert({
      gu: guName,
      m2_price: avgPerM2,
      avg_price: avgPrice,
      source: `서울 열린데이터 실거래 (${year})`,
      updated_at: new Date().toISOString(),
    }, { onConflict: "gu" });
    updated++;
  }
  return updated;
}

async function updateDashboardStats() {
  const { data } = await supabase
    .from("stores")
    .select("store_count, open_count, close_count");

  if (!data) return 0;

  const totalStores = data.reduce((s, r) => s + (r.store_count ?? 0), 0);
  const totalOpen = data.reduce((s, r) => s + (r.open_count ?? 0), 0);
  const totalClose = data.reduce((s, r) => s + (r.close_count ?? 0), 0);

  const now = new Date().toISOString();
  await supabase.from("dashboard_stats").upsert([
    { metric_key: "total_stores", value: totalStores, label: "총 상가 데이터", updated_at: now },
    { metric_key: "monthly_open", value: totalOpen, label: "이번 분기 신규 개업", updated_at: now },
    { metric_key: "monthly_close", value: totalClose, label: "이번 분기 폐업", updated_at: now },
  ], { onConflict: "metric_key" });

  return 3;
}

export async function GET(request: Request) {
  // Vercel Cron은 Authorization 헤더로 인증
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const result: Record<string, unknown> = { started_at: startedAt };

  try {
    const [rentRows, saleRows] = await Promise.all([fetchRentData(), fetchSaleData()]);
    result.rent_fetched = rentRows.length;
    result.sale_fetched = saleRows.length;

    const rentUpdated = await updateRentStats(rentRows);
    const saleUpdated = await updateSaleStats(saleRows);
    const dashboardUpdated = await updateDashboardStats();

    result.rent_updated = rentUpdated;
    result.sale_updated = saleUpdated;
    result.dashboard_updated = dashboardUpdated;
    result.status = "ok";
    result.finished_at = new Date().toISOString();

    return NextResponse.json(result);
  } catch (err) {
    result.status = "error";
    result.error = err instanceof Error ? err.message : String(err);
    return NextResponse.json(result, { status: 500 });
  }
}

// Vercel Cron은 POST도 지원
export const POST = GET;

// 최대 실행 시간 (기본 10초 → 5분으로 확장)
export const maxDuration = 300;
