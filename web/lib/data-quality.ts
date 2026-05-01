/* ── 데이터 품질·신뢰도 통합 모듈 ──

   브랜드/건물주가 의사결정에 쓸 수 있을 만큼 데이터가 정확해야 한다는 전제에서,
   모든 수치에 출처(provenance), 신뢰등급(Tier 1~4), 신선도(freshness)를
   강제로 동반시키기 위한 타입·헬퍼.

   - Tier 1 : 공증·관청 실거래   (RTMS, 등기부)
   - Tier 2 : 본인 네트워크 GT    (n≥3)
   - Tier 3 : 권역 통계 발표값    (R-ONE, CBRE/JLL/쿠시먼 PDF)
   - Tier 4 : 추정·폴백          (구 평균, 호가 역산, 동→구 가중평균)

   원칙:
   - n < 3 단일사례는 자동 한 단계 다운그레이드 (참고용으로만 표시).
   - 신선도 만료 시 자동 한 단계 다운그레이드.
   - Tier 4 단독은 컨설팅 리포트 인용 금지(리포트 출력 시 차단).
*/

export type SourceKind =
  // Tier 1
  | "rtms_sale" | "rtms_rent" | "registry"
  // Tier 2
  | "owner_network"
  // Tier 3
  | "rone" | "cbre_report" | "jll_report" | "cushman_report"
  // Tier 4
  | "naver_deal" | "naver_listing" | "dong_rtms_inverse" | "gu_avg" | "hardcoded_fallback";

export type Tier = 1 | 2 | 3 | 4;

export interface Provenance {
  source: SourceKind;
  source_label: string;        // 사용자 표시용 한글 ("R-ONE 권역 평균")
  tier: Tier;                  // 정책 등급 (다운그레이드 후 최종값)
  base_tier: Tier;             // 다운그레이드 전 원래 등급
  sample_size: number;         // n
  collected_at: string;        // ISO date — 수집/발표 시점
  spread_cv?: number;          // 변동계수(%) — cross-check 결과
  cross_checked?: boolean;     // 2개 이상 독립 소스 일치
  downgrade_reasons?: string[]; // 다운그레이드 이유 (만료, n<3, CV 초과)
}

export interface DataPoint<T> {
  value: T;
  prov: Provenance;
}

/* ── 카테고리별 신선도 만료 정책 (개월) ── */
export const FRESHNESS_MONTHS: Record<string, number> = {
  rent: 6,            // 임대료 (시장 빠름)
  sale: 12,           // 매매가
  foot_traffic: 1,    // 유동인구 (서울시 매월)
  store_count: 3,     // 점포 수 (분기)
  market_report: 6,   // CBRE/JLL/쿠시먼 분기
  default: 6,
};

export function isExpired(collected_at: string, category: keyof typeof FRESHNESS_MONTHS = "default"): boolean {
  if (!collected_at) return true;
  const months = FRESHNESS_MONTHS[category] ?? FRESHNESS_MONTHS.default;
  const ms = months * 30 * 24 * 3600 * 1000;
  const t = new Date(collected_at).getTime();
  if (!isFinite(t)) return true;
  return Date.now() - t > ms;
}

/* ── 출처별 baseline Tier ── */
export const BASE_TIER: Record<SourceKind, Tier> = {
  rtms_sale: 1, rtms_rent: 1, registry: 1,
  owner_network: 2,
  rone: 3, cbre_report: 3, jll_report: 3, cushman_report: 3,
  naver_deal: 4, naver_listing: 4, dong_rtms_inverse: 4, gu_avg: 4, hardcoded_fallback: 4,
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  rtms_sale: "RTMS 매매 실거래",
  rtms_rent: "RTMS 임대 실거래",
  registry: "등기부",
  owner_network: "네트워크 실거래",
  rone: "R-ONE 권역 발표",
  cbre_report: "CBRE 보고서",
  jll_report: "JLL 보고서",
  cushman_report: "쿠시먼 보고서",
  naver_deal: "네이버 추정실거래",
  naver_listing: "네이버 호가",
  dong_rtms_inverse: "동 RTMS 매매역산",
  gu_avg: "구 평균 폴백",
  hardcoded_fallback: "하드코딩 폴백",
};

/* ── DataPoint 생성: 정책 자동 적용 ── */
export interface MakeProvenanceInput {
  source: SourceKind;
  sample_size: number;
  collected_at: string;
  category?: keyof typeof FRESHNESS_MONTHS;
  spread_cv?: number;
  cross_checked?: boolean;
}

export function makeProvenance(input: MakeProvenanceInput): Provenance {
  const base = BASE_TIER[input.source];
  let tier: Tier = base;
  const reasons: string[] = [];

  // 정책 1: n < 3 자동 다운그레이드
  if (input.sample_size < 3 && tier < 4) {
    tier = (tier + 1) as Tier;
    reasons.push(`표본 부족 (n=${input.sample_size})`);
  }
  // 정책 2: 만료 시 다운그레이드
  if (isExpired(input.collected_at, input.category) && tier < 4) {
    tier = (tier + 1) as Tier;
    reasons.push("데이터 만료");
  }
  // 정책 3: CV > 30% 다운그레이드
  if (input.spread_cv != null && input.spread_cv > 30 && tier < 4) {
    tier = (tier + 1) as Tier;
    reasons.push(`교차검증 분산 큼 (CV ${input.spread_cv.toFixed(0)}%)`);
  }

  return {
    source: input.source,
    source_label: SOURCE_LABEL[input.source],
    tier,
    base_tier: base,
    sample_size: input.sample_size,
    collected_at: input.collected_at,
    spread_cv: input.spread_cv,
    cross_checked: input.cross_checked,
    downgrade_reasons: reasons.length ? reasons : undefined,
  };
}

export function makeDataPoint<T>(value: T, input: MakeProvenanceInput): DataPoint<T> {
  return { value, prov: makeProvenance(input) };
}

/* ── 컨설팅 리포트 인용 형식 ──
   "출처: 본인 네트워크 (n=4) ± R-ONE 한남 2026Q1 (118만), 변동계수 11%. 갱신 2026-04-12."
*/
export function formatCitation(prov: Provenance, secondary?: Provenance): string {
  const parts: string[] = [];
  parts.push(`출처: ${prov.source_label}`);
  if (prov.sample_size > 0 && prov.sample_size < 999) parts.push(`(n=${prov.sample_size})`);

  if (secondary) {
    parts.push(`± ${secondary.source_label}`);
    if (secondary.sample_size > 0 && secondary.sample_size < 999) parts.push(`(n=${secondary.sample_size})`);
  }
  if (prov.spread_cv != null) parts.push(`· 변동계수 ${prov.spread_cv.toFixed(0)}%`);

  const dateOnly = (prov.collected_at || "").slice(0, 10);
  if (dateOnly) parts.push(`· 갱신 ${dateOnly}`);

  if (prov.downgrade_reasons?.length) parts.push(`(주의: ${prov.downgrade_reasons.join(", ")})`);

  return parts.join(" ");
}

/* ── UI 라벨 (배지 색) ── */
export const TIER_LABEL: Record<Tier, { label: string; tone: "emerald" | "violet" | "indigo" | "amber" }> = {
  1: { label: "Tier 1 · 실거래", tone: "emerald" },
  2: { label: "Tier 2 · 네트워크", tone: "violet" },
  3: { label: "Tier 3 · 권역 통계", tone: "indigo" },
  4: { label: "Tier 4 · 추정", tone: "amber" },
};

/** 컨설팅 리포트 인용 가능 여부 — Tier 4 단독은 차단 */
export function isReportable(prov: Provenance, hasSecondary: boolean = false): boolean {
  if (prov.tier <= 3) return true;
  return hasSecondary; // Tier 4 단독은 금지, 보조 소스 있으면 OK
}
