/* ── 임대·토지 시세 추이 ──
   좌표 기반: lat/lng → R-ONE 권역 + 행정구 매핑 → 시계열 반환
   - 임대 시세: R-ONE 임대동향조사 (권역, 분기→연 평균)  ← R-ONE 별도 키 필요
   - 토지 시세: RTMS 상업업무용 매매 실거래 평균 평당가  ← rtms-land-yearly.json (sync 결과)
   - 폴백: gu_price_history 자체 추정값 + "임시값" source 표시
*/
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { nearestRoneRegion } from "@/lib/rone-lookup";
import rtmsLandData from "@/lib/data/rtms-land-yearly.json";
import roneRentData from "@/lib/data/rone-rent-yearly.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

const HAS_PUBLIC_DATA_KEY = !!process.env.DATA_GO_KR_API_KEY;

// rtms-land-yearly.json 구조: { _meta, data: { gu: { year: { avg, n } } } }
const RTMS_LAND = (rtmsLandData as { data?: Record<string, Record<string, { avg: number | null; n: number }>> }).data ?? {};

// rone-rent-yearly.json 구조: { _meta, data: { region: { fullName, baseline, yearly: { year: 평당만 } } } }
type RoneRegion = { fullName?: string; baseline?: { wrttime: string; rent_per_sqm: number }; yearly: Record<string, number> };
const RONE_RENT = (roneRentData as { data?: Record<string, RoneRegion> }).data ?? {};

interface TrendResponse {
  gu: string;
  region?: { code: string; name: string; distanceKm: number };
  years: string[];
  rent: number[];   // 1층 평당 월세 (만원)
  land: number[];   // 토지 상업지역 평당가 (만원)
  source: {
    rent: "rone" | "estimate";   // R-ONE 실데이터 / 자체 추정
    land: "rtms" | "estimate";   // RTMS 실데이터 / 자체 추정
  };
  note?: string;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "price-history", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const guParam = searchParams.get("gu") ?? "";

  // 좌표 우선, 없으면 gu 호환 (legacy)
  let gu = guParam;
  let region: { code: string; name: string; distanceKm: number } | undefined;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const r = nearestRoneRegion(lat, lng);
    region = { code: r.region.code, name: r.region.name, distanceKm: r.distanceKm };
    gu = r.region.gu;
  } else if (!gu) {
    return NextResponse.json({ error: "lat/lng 또는 gu 파라미터 필요" }, { status: 400 });
  }

  /* ── 1차: R-ONE 임대 시계열 — rone-rent-yearly.json (정적, R-ONE API 동기화 결과) ── */
  let rentSource: "rone" | "estimate" = "estimate";
  let rentSeries: Array<{ year: number; value: number }> = [];
  if (region) {
    // 권역명(name) 기반 R-ONE 매칭 (예: "압구정", "강남대로", "신사역")
    const roneEntry = RONE_RENT[region.name];
    if (roneEntry?.yearly) {
      const entries = Object.entries(roneEntry.yearly)
        .map(([y, v]) => ({ year: Number(y), value: typeof v === "number" ? v : 0 }))
        .filter((r) => r.value > 0);
      if (entries.length >= 3) {
        rentSeries = entries;
        rentSource = "rone";
      }
    }
  }

  /* ── 2차: RTMS 토지 시계열 — rtms-land-yearly.json (정적, sync 결과) ── */
  let landSource: "rtms" | "estimate" = "estimate";
  let landSeries: Array<{ year: number; value: number }> = [];
  const rtmsGu = RTMS_LAND[gu];
  if (rtmsGu) {
    const entries = Object.entries(rtmsGu)
      .map(([y, v]) => ({ year: Number(y), value: v?.avg ?? null, n: v?.n ?? 0 }))
      .filter((r) => r.value != null && r.n >= 3) // 최소 3건 이상 거래된 연도만
      .map((r) => ({ year: r.year, value: r.value as number }));
    if (entries.length >= 3) {
      landSeries = entries;
      landSource = "rtms";
    }
  }

  /* ── 폴백: 자체 추정값 (gu_price_history) ── */
  if (rentSeries.length === 0 || landSeries.length === 0) {
    const { data } = await supabase
      .from("gu_price_history")
      .select("year, land_price, rent_price")
      .eq("gu", gu)
      .order("year", { ascending: true });
    if (data && data.length > 0) {
      if (rentSeries.length === 0) {
        rentSeries = data.map((r) => ({ year: r.year, value: r.rent_price }));
      }
      if (landSeries.length === 0) {
        landSeries = data.map((r) => ({ year: r.year, value: r.land_price }));
      }
    }
  }

  /* ── 시계열 정렬·연도 통일 ── */
  const allYears = Array.from(new Set([
    ...rentSeries.map((r) => r.year),
    ...landSeries.map((r) => r.year),
  ])).sort((a, b) => a - b);

  const rentMap = new Map(rentSeries.map((r) => [r.year, r.value]));
  const landMap = new Map(landSeries.map((r) => [r.year, r.value]));

  const response: TrendResponse = {
    gu,
    region,
    years: allYears.map(String),
    rent: allYears.map((y) => rentMap.get(y) ?? 0),
    land: allYears.map((y) => landMap.get(y) ?? 0),
    source: { rent: rentSource, land: landSource },
  };

  if (rentSource === "estimate" || landSource === "estimate") {
    response.note = HAS_PUBLIC_DATA_KEY
      ? "공공 API 데이터 동기화 진행 중 — 일부 항목은 임시 추정값입니다."
      : "공공 API 키 미연결 — 자체 추정값입니다. R-ONE / RTMS 연동 시 실데이터로 갱신됩니다.";
  }

  return NextResponse.json(response);
}
