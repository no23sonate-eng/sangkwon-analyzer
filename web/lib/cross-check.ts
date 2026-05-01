/* ── Cross-validation: 다중 소스 교차검증 ──

   같은 수치(예: 한남동 1층 임대료)를 2개 이상 독립 소스로 산출했을 때,
   변동계수(CV)로 일치도를 평가하고 다음을 결정:

   - CV < 15%: 교차검증 일치 → 신뢰 (cross_checked = true)
   - CV 15~30%: 출처별 차이 있음 (경고 표기, 중위값 채택)
   - CV > 30%: 차단 (자동 publish 금지, 수기 검토 필요)

   원칙: "값" 1개가 아니라 "값 + 출처 + 변동계수" 단위로 의사결정.
*/

import type { Provenance, SourceKind } from "./data-quality";
import { makeProvenance, BASE_TIER } from "./data-quality";

export interface SourceValue {
  source: SourceKind;
  value: number;
  sample_size: number;
  collected_at: string;
}

export type CrossVerdict = "agree" | "spread" | "block";

export interface CrossCheckResult {
  verdict: CrossVerdict;
  median: number;
  cv: number;             // 변동계수 (%)
  primary: Provenance;    // 채택된 주요 소스의 prov (이미 cross_checked·cv 반영)
  secondary?: Provenance; // 두 번째 소스 (citation 용)
  blocked_reason?: string;
  inputs: SourceValue[];  // 디버깅·admin 표시용
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

const SPREAD_THRESHOLD = 15;
const BLOCK_THRESHOLD = 30;

/* 입력 정렬 정책: Tier 1·2 우선 → 그 다음 base tier 낮은 순 (= 신뢰도 높은 순) → 표본 큰 순 */
function preferenceSort(a: SourceValue, b: SourceValue): number {
  const ta = BASE_TIER[a.source];
  const tb = BASE_TIER[b.source];
  if (ta !== tb) return ta - tb;
  return b.sample_size - a.sample_size;
}

export function crossCheck(
  inputs: SourceValue[],
  category: "rent" | "sale" | "default" = "default",
): CrossCheckResult {
  const valid = inputs.filter((i) => i.value > 0 && isFinite(i.value));

  // 입력이 1개면 cross-check 의미 없음 — 단독 소스 그대로 채택, cv=0
  if (valid.length === 0) {
    const fallback = makeProvenance({
      source: "hardcoded_fallback",
      sample_size: 0,
      collected_at: new Date().toISOString(),
      category,
    });
    return { verdict: "block", median: 0, cv: 0, primary: fallback, blocked_reason: "유효한 소스 0개", inputs };
  }
  if (valid.length === 1) {
    const sole = valid[0];
    const prov = makeProvenance({
      source: sole.source,
      sample_size: sole.sample_size,
      collected_at: sole.collected_at,
      category,
      cross_checked: false,
    });
    return { verdict: "agree", median: sole.value, cv: 0, primary: prov, inputs: valid };
  }

  // 2개 이상 — 변동계수 계산
  const values = valid.map((v) => v.value);
  const med = median(values);
  const sd = stdev(values, values.reduce((s, v) => s + v, 0) / values.length);
  const cv = med > 0 ? (sd / med) * 100 : 999;

  const sorted = [...valid].sort(preferenceSort);
  const primaryInput = sorted[0];
  const secondaryInput = sorted[1];

  // verdict
  let verdict: CrossVerdict;
  let blocked_reason: string | undefined;
  if (cv > BLOCK_THRESHOLD) {
    verdict = "block";
    blocked_reason = `소스간 분산 ${cv.toFixed(0)}% > ${BLOCK_THRESHOLD}% — 수기 검토 필요`;
  } else if (cv > SPREAD_THRESHOLD) {
    verdict = "spread";
  } else {
    verdict = "agree";
  }

  const primary = makeProvenance({
    source: primaryInput.source,
    sample_size: primaryInput.sample_size,
    collected_at: primaryInput.collected_at,
    category,
    spread_cv: cv,
    cross_checked: verdict === "agree",
  });
  const secondary = makeProvenance({
    source: secondaryInput.source,
    sample_size: secondaryInput.sample_size,
    collected_at: secondaryInput.collected_at,
    category,
  });

  return { verdict, median: Math.round(med * 10) / 10, cv: Math.round(cv * 10) / 10, primary, secondary, blocked_reason, inputs: valid };
}

/* ── 임대료 전용 헬퍼 ──
   estimateRent / rent-nearby 응답을 SourceValue 배열로 정규화.
*/
export interface RentSources {
  ownerNetwork?: { rent: number; n: number; collected_at?: string };
  rone?: { rent: number; n?: number; collected_at?: string };
  marketReport?: { rent: number; collected_at?: string };
  naverDeal?: { rent: number; n: number; collected_at?: string };
  naverListing?: { rent: number; n: number; collected_at?: string };
  dongRtmsInverse?: { rent: number; n: number; collected_at?: string };
  guAvg?: { rent: number; collected_at?: string };
}

export function crossCheckRent(sources: RentSources): CrossCheckResult {
  const inputs: SourceValue[] = [];
  const now = new Date().toISOString();
  if (sources.ownerNetwork && sources.ownerNetwork.rent > 0) {
    inputs.push({ source: "owner_network", value: sources.ownerNetwork.rent, sample_size: sources.ownerNetwork.n, collected_at: sources.ownerNetwork.collected_at ?? now });
  }
  if (sources.rone && sources.rone.rent > 0) {
    inputs.push({ source: "rone", value: sources.rone.rent, sample_size: sources.rone.n ?? 1, collected_at: sources.rone.collected_at ?? now });
  }
  if (sources.marketReport && sources.marketReport.rent > 0) {
    inputs.push({ source: "cbre_report", value: sources.marketReport.rent, sample_size: 1, collected_at: sources.marketReport.collected_at ?? now });
  }
  if (sources.naverDeal && sources.naverDeal.rent > 0) {
    inputs.push({ source: "naver_deal", value: sources.naverDeal.rent, sample_size: sources.naverDeal.n, collected_at: sources.naverDeal.collected_at ?? now });
  }
  if (sources.naverListing && sources.naverListing.rent > 0) {
    inputs.push({ source: "naver_listing", value: sources.naverListing.rent, sample_size: sources.naverListing.n, collected_at: sources.naverListing.collected_at ?? now });
  }
  if (sources.dongRtmsInverse && sources.dongRtmsInverse.rent > 0) {
    inputs.push({ source: "dong_rtms_inverse", value: sources.dongRtmsInverse.rent, sample_size: sources.dongRtmsInverse.n, collected_at: sources.dongRtmsInverse.collected_at ?? now });
  }
  if (sources.guAvg && sources.guAvg.rent > 0) {
    inputs.push({ source: "gu_avg", value: sources.guAvg.rent, sample_size: 1, collected_at: sources.guAvg.collected_at ?? now });
  }
  return crossCheck(inputs, "rent");
}
