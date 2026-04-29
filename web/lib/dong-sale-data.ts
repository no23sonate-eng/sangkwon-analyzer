/* ── 동 단위 RTMS 토지 평당가 lookup ──
   web/lib/data/rtms-land-yearly-dong.json (sync-rtms-land-dong.mjs로 갱신)에서
   동 단위 최근 연도 토지 평당가 조회. 표본 적으면 인접동 가중평균 폴백.

   매매역산 흐름:
     토지 평당가(만원/대지평) × 캡레이트 ÷ 12 = 평당 월세 추정 (대지 기준)
     1층 임대료는 입지 프리미엄 별도 — 매매역산은 평균값 추정에 강함.
*/
import data from "./data/rtms-land-yearly-dong.json";
import { adjacentDongs } from "./dong-lookup";

interface YearStat { avg: number; n: number }
interface DongData { [year: string]: YearStat }
interface SaleJson {
  _meta: unknown;
  data: { [gu: string]: { [dong: string]: DongData } };
}

const SALE = data as SaleJson;

const MIN_SAMPLE_N = 5; // 동 단위 신뢰 최소 표본
const ADJACENT_FALLBACK_N = 5;

export interface DongLandPrice {
  source: "exact" | "adjacent_avg" | "gu_avg";
  pricePerPyeong: number;   // 만원/평 (대지)
  year: number;
  sampleN: number;
  detail: string;            // "한남동 2025 (n=32)" 또는 "인접 5동 가중평균 (n=42)"
}

/** 가장 최신 연도 데이터를 추출 (표본 ≥ MIN_SAMPLE_N 충족하는 가장 최근 연도) */
function pickLatestYear(d: DongData): { year: number; stat: YearStat } | null {
  const entries = Object.entries(d).map(([y, s]) => ({ year: Number(y), stat: s }));
  entries.sort((a, b) => b.year - a.year);
  // 우선 표본 충분한 최신
  for (const e of entries) if (e.stat.n >= MIN_SAMPLE_N) return e;
  // 없으면 표본 무관 최신
  return entries[0] ?? null;
}

/** 법정동명·행정동명 모두 매칭 (prefix 포함) */
function findDongData(gu: string, dongName: string): DongData | null {
  const guData = SALE.data[gu];
  if (!guData) return null;
  if (guData[dongName]) return guData[dongName];
  // prefix 매칭 (예: "성수1가1동" → "성수동1가" 시도)
  for (const [k, v] of Object.entries(guData)) {
    if (k.startsWith(dongName) || dongName.startsWith(k)) return v;
  }
  return null;
}

export function getDongLandPrice(
  gu: string,
  dongName: string,
  dongCode?: string,
): DongLandPrice | null {
  // 1. 정확 매칭
  const exact = findDongData(gu, dongName);
  if (exact) {
    const latest = pickLatestYear(exact);
    if (latest && latest.stat.n >= MIN_SAMPLE_N) {
      return {
        source: "exact",
        pricePerPyeong: latest.stat.avg,
        year: latest.year,
        sampleN: latest.stat.n,
        detail: `${dongName} ${latest.year} (n=${latest.stat.n})`,
      };
    }
  }

  // 2. 인접동 가중평균 폴백 (dongCode 있을 때만)
  if (dongCode) {
    const adjacent = adjacentDongs(dongCode, ADJACENT_FALLBACK_N);
    let sum = 0, totalN = 0;
    const usedNames: string[] = [];
    let pickedYear = 0;
    for (const adj of adjacent) {
      const d = findDongData(adj.gu_name, adj.dong_name);
      if (!d) continue;
      const latest = pickLatestYear(d);
      if (!latest || latest.stat.n < 1) continue;
      sum += latest.stat.avg * latest.stat.n;
      totalN += latest.stat.n;
      usedNames.push(adj.dong_name);
      pickedYear = Math.max(pickedYear, latest.year);
    }
    if (totalN >= MIN_SAMPLE_N) {
      return {
        source: "adjacent_avg",
        pricePerPyeong: Math.round(sum / totalN),
        year: pickedYear,
        sampleN: totalN,
        detail: `인접 ${usedNames.length}동 가중평균 [${usedNames.join(", ")}] (n=${totalN})`,
      };
    }
  }

  // 3. 구 평균 폴백
  const guData = SALE.data[gu];
  if (guData) {
    let sum = 0, totalN = 0;
    let pickedYear = 0;
    for (const [, dongStats] of Object.entries(guData)) {
      const latest = pickLatestYear(dongStats);
      if (!latest || latest.stat.n < 1) continue;
      sum += latest.stat.avg * latest.stat.n;
      totalN += latest.stat.n;
      pickedYear = Math.max(pickedYear, latest.year);
    }
    if (totalN >= MIN_SAMPLE_N) {
      return {
        source: "gu_avg",
        pricePerPyeong: Math.round(sum / totalN),
        year: pickedYear,
        sampleN: totalN,
        detail: `${gu} 전체 평균 (n=${totalN})`,
      };
    }
  }

  return null;
}

/** 매매역산 한 줄 도우미: 동 단위 토지 평당가 → 평당 월세 추정 (대지 기준).
 *  주의: 토지평당가는 "대지면적 평당". 1층 임대료는 보통 토지평당가 × cap/12의 1.5~2.5배.
 *        평균값 추정 (4중 검증의 한 입력)으로 활용. */
export function inverseRentFromDongLand(
  gu: string,
  dongName: string,
  dongCode: string | undefined,
  yieldRate: number,  // % (4.5, 5.0, 5.5 등)
): { rent: number; price: DongLandPrice } | null {
  const price = getDongLandPrice(gu, dongName, dongCode);
  if (!price) return null;
  // 토지 평당가 × yield% / 12 = 대지 평당 월세
  // 1층 임대료는 별도 가중치(method 통합 시 1.5~2.0배 보정)로 반영.
  const rent = Math.round((price.pricePerPyeong * (yieldRate / 100)) / 12);
  return { rent, price };
}
