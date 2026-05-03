/* ── 임대·토지 시세 추이 ──
   좌표 기반: lat/lng → 행정동 + R-ONE 권역 + 구 매핑 → 위치 맞춤 시계열 반환
   - 토지 시세: 동 단위 RTMS anchor × 구 RTMS 변동률 = 위치 맞춤 토지 시계열
   - 임대 시세: 동 토지 평당가 매매역산 anchor × R-ONE 권역 인덱스 변동률 = 위치 맞춤 임대 시계열
   - 폴백 단계: 위치 맞춤 → R-ONE/RTMS 권역 절대값 → gu_price_history 추정 → 자체 추정
*/
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { nearestRoneRegion } from "@/lib/rone-lookup";
import { findDongByCoord } from "@/lib/dong-lookup";
import { getDongLandPrice } from "@/lib/dong-sale-data";
import rtmsLandData from "@/lib/data/rtms-land-yearly.json";
import rtmsLandDongData from "@/lib/data/rtms-land-yearly-dong.json";
import roneRentData from "@/lib/data/rone-rent-yearly.json";
import roneRentFloor1Data from "@/lib/data/rone-rent-floor1-yearly.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

const HAS_PUBLIC_DATA_KEY = !!process.env.DATA_GO_KR_API_KEY;

// rtms-land-yearly.json — 구 단위 시계열 (2016~)
const RTMS_LAND = (rtmsLandData as { data?: Record<string, Record<string, { avg: number | null; n: number }>> }).data ?? {};

// rtms-land-yearly-dong.json — 동 단위 (2024~). { gu: { dong: { year: {avg, n} } } }
const RTMS_LAND_DONG = (rtmsLandDongData as { data?: Record<string, Record<string, Record<string, { avg: number | null; n: number }>>> }).data ?? {};

type RoneRegion = { fullName?: string; baseline?: { wrttime: string; rent_per_sqm: number }; yearly: Record<string, number> };
const RONE_RENT_AVG = (roneRentData as { data?: Record<string, RoneRegion> }).data ?? {};

type RoneFloor1 = { fullName?: string; yearly: Record<string, number> };
const RONE_RENT_FLOOR1 = (roneRentFloor1Data as { data?: Record<string, RoneFloor1> }).data ?? {};

// 매매역산 상수 (rent-estimator.ts와 동일)
const DEFAULT_CAP_RATE = 0.05;       // 5% (4.5/5/5.5 시나리오 중 중앙)
const FLOOR1_BOOST = 1.7;             // 대지 평당 월세 → 1층 임대료 보정 (실측 평균)

type RentSource =
  | "dong_anchor_rone_index"   // 동 매매역산 anchor × R-ONE 인덱스 변동률 (위치 맞춤)
  | "rone_floor1_indexed"      // R-ONE 1층 anchor × 권역 인덱스 (권역 평균)
  | "rone_floor1"              // R-ONE 1층 (4년)
  | "rone_avg"                 // R-ONE 권역 평균
  | "estimate";

type LandSource =
  | "dong_anchor_gu_trend"     // 동 anchor × 구 RTMS 변동률 (위치 맞춤)
  | "rtms"                     // 구 단위 RTMS
  | "estimate";

interface TrendResponse {
  gu: string;
  dong?: string;
  region?: { code: string; name: string; distanceKm: number };
  years: string[];
  rent: number[];
  land: number[];
  source: { rent: RentSource; land: LandSource };
  anchor?: {
    landPyeong?: number;       // 동 단위 anchor 토지 평당가 (만원)
    rentPyeong1F?: number;     // 동 매매역산 1층 임대료 anchor (만원/평/월)
    capRate?: number;          // 사용된 캡레이트 (0.05 = 5%)
    detail?: string;           // 동 anchor 산출 근거
  };
  note?: string;
}

/* ── 시계열 helper ── */
type Series = Array<{ year: number; value: number }>;

function toSeries(yearly: Record<string, unknown>): Series {
  return Object.entries(yearly)
    .map(([y, v]) => ({ year: Number(y), value: typeof v === "number" ? v : 0 }))
    .filter((r) => Number.isFinite(r.year) && r.value > 0)
    .sort((a, b) => a.year - b.year);
}

function rescaleSeriesToAnchor(series: Series, anchorValue: number): Series {
  if (series.length === 0 || anchorValue <= 0) return series;
  const latest = series[series.length - 1].value;
  if (latest <= 0) return series;
  const scale = anchorValue / latest;
  return series.map((p) => ({ year: p.year, value: Math.round(p.value * scale * 10) / 10 }));
}

export async function GET(request: Request) {
  const limited = rateLimit(request, "price-history", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const guParam = searchParams.get("gu") ?? "";

  let gu = guParam;
  let region: { code: string; name: string; distanceKm: number } | undefined;
  let dongName: string | undefined;
  let dongCode: string | undefined;
  let dongLandAnchor: { value: number; year: number; detail: string } | null = null;
  let rentAnchor1F: number | null = null;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const r = nearestRoneRegion(lat, lng);
    region = { code: r.region.code, name: r.region.name, distanceKm: r.distanceKm };
    gu = r.region.gu;

    // 행정동 매핑 → 동 단위 토지 anchor 산출
    const dong = findDongByCoord(lat, lng);
    if (dong) {
      dongName = dong.dong_name;
      dongCode = dong.dong_code;
      gu = dong.gu_name; // 동 매핑이 더 정확
      const price = getDongLandPrice(dong.gu_name, dong.dong_name, dong.dong_code);
      if (price) {
        dongLandAnchor = { value: price.pricePerPyeong, year: price.year, detail: price.detail };
        // 매매역산 1층 임대료 anchor: 토지평당가 × cap/12 × 1.7
        rentAnchor1F = Math.round((price.pricePerPyeong * DEFAULT_CAP_RATE) / 12 * FLOOR1_BOOST);
      }
    }
  } else if (!gu) {
    return NextResponse.json({ error: "lat/lng 또는 gu 파라미터 필요" }, { status: 400 });
  }

  /* ── 1차: 임대료 시계열 ──
     변동률 시계열 (R-ONE 권역 인덱스, 13년) × 위치별 anchor (동 매매역산 1층) = 위치 맞춤 시계열
  */
  let rentSource: RentSource = "estimate";
  let rentSeries: Series = [];
  if (region) {
    const f1Entry = RONE_RENT_FLOOR1[region.name];
    const avgEntry = RONE_RENT_AVG[region.name];
    const f1Series = f1Entry?.yearly ? toSeries(f1Entry.yearly) : [];
    const avgSeries = avgEntry?.yearly ? toSeries(avgEntry.yearly) : [];

    // (a) R-ONE 권역 13년 1층 추정 시계열 만들기 (인덱스 합성)
    let regionSeries: Series = [];
    if (f1Series.length >= 2 && avgSeries.length >= 5) {
      const overlap = f1Series
        .map((f) => ({ year: f.year, f1: f.value, avg: avgSeries.find((a) => a.year === f.year)?.value }))
        .filter((r): r is { year: number; f1: number; avg: number } => r.avg != null && r.avg > 0);
      if (overlap.length >= 2) {
        const ratio = overlap.reduce((s, r) => s + r.f1 / r.avg, 0) / overlap.length;
        regionSeries = avgSeries.map((a) => ({ year: a.year, value: Math.round(a.value * ratio * 10) / 10 }));
      }
    }
    if (regionSeries.length === 0 && f1Series.length >= 2) regionSeries = f1Series;
    if (regionSeries.length === 0 && avgSeries.length >= 3) regionSeries = avgSeries;

    // (b) 위치별 anchor 있으면 권역 시계열을 anchor에 맞춰 재스케일 → 위치 맞춤
    if (regionSeries.length > 0 && rentAnchor1F && rentAnchor1F > 0) {
      rentSeries = rescaleSeriesToAnchor(regionSeries, rentAnchor1F);
      rentSource = "dong_anchor_rone_index";
    } else if (regionSeries.length > 0) {
      rentSeries = regionSeries;
      rentSource = f1Series.length >= 2 && avgSeries.length >= 5 ? "rone_floor1_indexed"
        : f1Series.length >= 2 ? "rone_floor1"
        : "rone_avg";
    }
  }

  /* ── 2차: 토지 시계열 ──
     변동률 시계열 (구 RTMS, 11년) × 위치별 anchor (동 RTMS 평당가) = 위치 맞춤 시계열
  */
  let landSource: LandSource = "estimate";
  let landSeries: Series = [];
  const rtmsGu = RTMS_LAND[gu];
  if (rtmsGu) {
    const guSeries: Series = Object.entries(rtmsGu)
      .map(([y, v]) => ({ year: Number(y), value: v?.avg ?? 0, n: v?.n ?? 0 }))
      .filter((r) => r.value > 0 && r.n >= 3)
      .map((r) => ({ year: r.year, value: r.value }))
      .sort((a, b) => a.year - b.year);

    if (guSeries.length >= 3) {
      // 위치 맞춤: 동 anchor (또는 동 시계열 평균/구 시계열 평균 비율) × 구 시계열
      if (dongLandAnchor && dongLandAnchor.value > 0) {
        // 동 시계열이 2개 이상 있으면 동/구 비율 평균을 scale로 사용 (anchor 단일 값보다 안정적)
        const dongSeriesData = (dongName && RTMS_LAND_DONG[gu]?.[dongName]) || null;
        let scale: number | null = null;
        if (dongSeriesData) {
          const overlap = Object.entries(dongSeriesData)
            .map(([y, v]) => ({ year: Number(y), dong: v?.avg ?? 0, n: v?.n ?? 0 }))
            .filter((r) => r.dong > 0 && r.n >= 3)
            .map((r) => ({ year: r.year, dong: r.dong, gu: guSeries.find((g) => g.year === r.year)?.value ?? 0 }))
            .filter((r) => r.gu > 0);
          if (overlap.length >= 2) {
            scale = overlap.reduce((s, r) => s + r.dong / r.gu, 0) / overlap.length;
          }
        }
        // 폴백: 단일 anchor / 같은 연도 구 평균
        if (scale == null) {
          const guSameYear = guSeries.find((g) => g.year === dongLandAnchor!.year)?.value;
          if (guSameYear && guSameYear > 0) scale = dongLandAnchor.value / guSameYear;
        }
        if (scale != null && scale > 0) {
          landSeries = guSeries.map((g) => ({ year: g.year, value: Math.round(g.value * scale!) }));
          landSource = "dong_anchor_gu_trend";
        }
      }
      if (landSeries.length === 0) {
        landSeries = guSeries;
        landSource = "rtms";
      }
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
    dong: dongName,
    region,
    years: allYears.map(String),
    rent: allYears.map((y) => rentMap.get(y) ?? 0),
    land: allYears.map((y) => landMap.get(y) ?? 0),
    source: { rent: rentSource, land: landSource },
  };

  if (dongLandAnchor || rentAnchor1F) {
    response.anchor = {
      landPyeong: dongLandAnchor?.value,
      rentPyeong1F: rentAnchor1F ?? undefined,
      capRate: rentAnchor1F ? DEFAULT_CAP_RATE : undefined,
      detail: dongLandAnchor?.detail,
    };
  }

  const notes: string[] = [];
  if (rentSource === "dong_anchor_rone_index") notes.push(`임대 = 동 매매역산 anchor × R-ONE 권역 변동률 (1층, cap ${DEFAULT_CAP_RATE * 100}%)`);
  else if (rentSource === "rone_floor1_indexed") notes.push("임대 = R-ONE 1층 anchor × 권역 임대지수 변동률 (2013~)");
  else if (rentSource === "rone_floor1") notes.push("임대 = R-ONE 1층 전용 데이터 (2022~)");
  else if (rentSource === "rone_avg") notes.push("임대 = R-ONE 중대형 상가 권역 평균");
  else if (rentSource === "estimate") notes.push("임대 = 자체 추정값");
  if (landSource === "dong_anchor_gu_trend") notes.push("토지 = 동 단위 RTMS anchor × 구 RTMS 변동률 (위치 맞춤)");
  if (notes.length > 0) response.note = notes.join(" · ");
  if (!HAS_PUBLIC_DATA_KEY && rentSource === "estimate") {
    response.note = "공공 API 키 미연결 — 자체 추정값입니다.";
  }

  return NextResponse.json(response);
}
