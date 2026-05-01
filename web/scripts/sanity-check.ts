/* 회귀 테스트 — 본인 측정 실거래값 기준.
 * 분기 자동 갱신 후 자동 산출값이 본인 수기 분석값과 ±25% 안에 들어오는지 검증.
 * exit 0: 통과 / exit 1: 실패 (CI/스케줄러용).
 *
 * 회귀 케이스 추가: 컨설팅에서 본인이 직접 측정한 실거래값만 CASES 배열에 추가.
 * 가정값·추정값·시장감각 추측 금지.
 */
import { findDongByCoord } from "../lib/dong-lookup";
import { getDongLandPrice, inverseRentFromDongLand } from "../lib/dong-sale-data";
import { estimateRent } from "../lib/rent-estimator";
import { calcRentEconomy, RENT_BURDEN_MAX } from "../lib/category-economics";
import { crossCheck, type SourceValue } from "../lib/cross-check";
import { makeProvenance, isExpired } from "../lib/data-quality";

interface SanityCase {
  name: string;
  lat: number;
  lng: number;
  expected: {
    gu: string;
    dong: string;
    rentPyeong1F: { low: number; mid: number; high: number };  // 본인 수기 분석값
    landPyeongPyeong: { low: number; high: number };           // 토지 평당가 추정 (만원/평)
    capRate: number;
  };
  toleranceP: number; // 허용 오차 % (보통 25)
}

// 회귀 케이스는 본인 측정 실거래값이 들어올 때만 추가.
// 가정값·시장감각 추측은 GT가 아니므로 제외.
const CASES: SanityCase[] = [];

let failed = 0;
let passed = 0;

for (const c of CASES) {
  console.log(`\n━━━ ${c.name} ━━━`);

  // 1. 좌표 → 동 매핑
  const dong = findDongByCoord(c.lat, c.lng);
  if (!dong) { console.log(`  ✗ 좌표 → 동 매핑 실패`); failed++; continue; }
  if (dong.gu_name !== c.expected.gu || dong.dong_name !== c.expected.dong) {
    console.log(`  ✗ 동 매핑 불일치: 기대 ${c.expected.gu} ${c.expected.dong}, 실제 ${dong.gu_name} ${dong.dong_name}`);
    failed++; continue;
  }
  console.log(`  ✓ 동 매핑: ${dong.full_name}`);

  // 2. 토지 평당가 범위 검증
  const price = getDongLandPrice(c.expected.gu, c.expected.dong, dong.dong_code);
  if (!price) { console.log(`  ✗ 토지 평당가 데이터 없음`); failed++; continue; }
  const inLandRange = price.pricePerPyeong >= c.expected.landPyeongPyeong.low
    && price.pricePerPyeong <= c.expected.landPyeongPyeong.high;
  if (!inLandRange) {
    console.log(`  ✗ 토지 평당가 범위 이탈: ${price.pricePerPyeong.toLocaleString()}만/평 (기대 ${c.expected.landPyeongPyeong.low.toLocaleString()}~${c.expected.landPyeongPyeong.high.toLocaleString()})`);
    failed++; continue;
  }
  console.log(`  ✓ 토지 평당가: ${price.pricePerPyeong.toLocaleString()} 만원/평 (${price.detail})`);

  // 3. 매매역산 → 1층 임대료 추정
  const inverse = inverseRentFromDongLand(c.expected.gu, c.expected.dong, dong.dong_code, c.expected.capRate);
  const inverseRent1F = inverse ? inverse.rent * 1.7 : 0; // 1층 보정 (rent-estimator 동일 로직)

  // 4. estimateRent 호출 — 동 단위 매매역산만 활용 (다른 소스 없을 때 동작 확인)
  const est = estimateRent(
    c.expected.gu, null, null, null,
    33, "1층",
    {
      dongLandPricePyeong: price.pricePerPyeong,
      capRate: c.expected.capRate,
    },
  );
  const rent1F = est.floors.find((f) => f.floor === "1층")?.rent_per_pyeong ?? 0;

  // 5. 기대값 비교 (±toleranceP%)
  const expMid = c.expected.rentPyeong1F.mid;
  const diffP = ((rent1F - expMid) / expMid) * 100;
  const passed1f = Math.abs(diffP) <= c.toleranceP;

  console.log(`  ${passed1f ? "✓" : "✗"} 1층 임대료 추정: ${rent1F} 만원/평/월 (기대 ${expMid} ± ${c.toleranceP}% → ${diffP.toFixed(1)}% 차이)`);
  console.log(`     매매역산 단독 (1.7배 보정): ${Math.round(inverseRent1F)} 만원/평/월`);
  console.log(`     소스: ${est.sources.join(", ")}`);

  if (passed1f) passed++; else failed++;
}

/* ── 카테고리 임대 경제성 회귀 ──
   고임대 입지(평당 100만 이상)에서 카페/주류 점포당 매출이 서울 평균~프라임 보정
   범위(3천만~6천만/월)일 때 임대 부담이 RENT_BURDEN_MAX(1.5) 이상이라야 함.
   → 추천 hard filter에서 빠져야 함.
*/
console.log(`\n━━━ 카테고리 임대 경제성 회귀 ━━━`);

interface EconCase {
  name: string;
  category: string;
  rent1fMan: number;          // 1층 평당 만원/월
  perStoreSalesWon: number;   // 점포당 월매출 원
  expect: "exclude" | "warn" | "ok";
}

const ECON_CASES: EconCase[] = [
  {
    name: "고임대 입지 카페/주류 (평당 100만 + 서울 카페 평균 매출)",
    category: "카페/주류",
    rent1fMan: 100,
    perStoreSalesWon: 32_459_511, // seoul-benchmark avg_per_store_sales
    expect: "exclude",
  },
  {
    name: "고임대 입지 카페/주류 (평당 100만 + 프라임 객단가 보정 6천만)",
    category: "카페/주류",
    rent1fMan: 100,
    perStoreSalesWon: 60_000_000,
    expect: "exclude",
  },
  {
    name: "외곽 권역 외식 (평당 25만 + 점포당 7천만 매출 → 흑자형)",
    category: "외식",
    rent1fMan: 25,
    perStoreSalesWon: 70_000_000,
    expect: "ok",
  },
  {
    name: "성수 일반 외식 (평당 40만 + 서울 평균 매출 → 적정 경계)",
    category: "외식",
    rent1fMan: 40,
    perStoreSalesWon: 56_838_786,
    expect: "warn",
  },
];

for (const c of ECON_CASES) {
  const econ = calcRentEconomy(c.category, c.rent1fMan, c.perStoreSalesWon);
  const isExcluded = econ.rentBurden >= RENT_BURDEN_MAX;
  const isWarn = econ.rentBurden >= 1.2 && econ.rentBurden < RENT_BURDEN_MAX;
  const verdict: EconCase["expect"] = isExcluded ? "exclude" : isWarn ? "warn" : "ok";
  const ok = verdict === c.expect;
  console.log(`  ${ok ? "✓" : "✗"} ${c.name}`);
  console.log(`     월세 ${econ.monthlyRentMan}만 / 적정 ${Math.round(econ.actualSalesMan * (econ.rentBurden > 0 ? econ.monthlyRentMan / (econ.actualSalesMan * econ.rentBurden) : 0.1))}만 → 부담 ${(econ.rentBurden * 100).toFixed(0)}% (${verdict}, 기대 ${c.expect})`);
  if (ok) passed++; else failed++;
}

/* ── Cross-validation 회귀 ──
   crossCheck 함수가 verdict 정책대로 동작하는지 보장.
   여기 케이스는 실측이 아니라 모듈 단위 동작 검증용 (브랜드/건물주 데이터 무관).
*/
console.log(`\n━━━ Cross-validation 모듈 회귀 ━━━`);

interface CrossCase {
  name: string;
  inputs: SourceValue[];
  expect: "agree" | "spread" | "block";
  cvBound?: { min: number; max: number };
}

const now = new Date().toISOString();
const CROSS_CASES: CrossCase[] = [
  {
    name: "agree: owner_network 130 / rone 125 / cbre 132 (CV ~3%)",
    inputs: [
      { source: "owner_network", value: 130, sample_size: 4, collected_at: now },
      { source: "rone", value: 125, sample_size: 1, collected_at: now },
      { source: "cbre_report", value: 132, sample_size: 1, collected_at: now },
    ],
    expect: "agree",
    cvBound: { min: 0, max: 15 },
  },
  {
    name: "spread: rone 100 vs naver_listing 140 (CV ~16.7%)",
    inputs: [
      { source: "rone", value: 100, sample_size: 1, collected_at: now },
      { source: "naver_listing", value: 140, sample_size: 5, collected_at: now },
    ],
    expect: "spread",
    cvBound: { min: 16, max: 18 },
  },
  {
    name: "block: rone 50 vs owner_network 150 (CV ~50%)",
    inputs: [
      { source: "rone", value: 50, sample_size: 1, collected_at: now },
      { source: "owner_network", value: 150, sample_size: 4, collected_at: now },
    ],
    expect: "block",
    cvBound: { min: 30, max: 100 },
  },
  {
    name: "agree: 단일 소스 (cv 의미 없음)",
    inputs: [{ source: "owner_network", value: 100, sample_size: 4, collected_at: now }],
    expect: "agree",
    cvBound: { min: 0, max: 0 },
  },
];

for (const c of CROSS_CASES) {
  const r = crossCheck(c.inputs, "rent");
  const verdictOk = r.verdict === c.expect;
  const cvOk = !c.cvBound || (r.cv >= c.cvBound.min && r.cv <= c.cvBound.max);
  const ok = verdictOk && cvOk;
  console.log(`  ${ok ? "✓" : "✗"} ${c.name}`);
  console.log(`     verdict: ${r.verdict} (기대 ${c.expect}) · CV ${r.cv}% · median ${r.median}`);
  if (ok) passed++; else failed++;
}

/* ── DataPoint 메타: 다운그레이드 정책 회귀 ── */
console.log(`\n━━━ DataPoint 다운그레이드 정책 ━━━`);

interface MetaCase {
  name: string;
  source: "owner_network" | "rone" | "naver_listing";
  sample_size: number;
  collected_at: string;
  spread_cv?: number;
  expectTier: 1 | 2 | 3 | 4;
}

// 만료 케이스용: 12개월 전 날짜
const longAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();

const META_CASES: MetaCase[] = [
  { name: "owner_network n=4 신선 → Tier 2 유지", source: "owner_network", sample_size: 4, collected_at: now, expectTier: 2 },
  { name: "owner_network n=1 → Tier 3 (n<3)", source: "owner_network", sample_size: 1, collected_at: now, expectTier: 3 },
  { name: "owner_network n=4 만료 → Tier 3 (만료)", source: "owner_network", sample_size: 4, collected_at: longAgo, expectTier: 3 },
  { name: "rone n=1 신선 → Tier 4 (n<3)", source: "rone", sample_size: 1, collected_at: now, expectTier: 4 },
  { name: "naver_listing n=10 CV 35 → Tier 4 (이미 4)", source: "naver_listing", sample_size: 10, collected_at: now, spread_cv: 35, expectTier: 4 },
  { name: "rone n=5 CV 35 → Tier 4 (CV>30 다운)", source: "rone", sample_size: 5, collected_at: now, spread_cv: 35, expectTier: 4 },
];

for (const c of META_CASES) {
  const prov = makeProvenance({
    source: c.source,
    sample_size: c.sample_size,
    collected_at: c.collected_at,
    spread_cv: c.spread_cv,
    category: "rent",
  });
  const ok = prov.tier === c.expectTier;
  console.log(`  ${ok ? "✓" : "✗"} ${c.name}: tier=${prov.tier} (기대 ${c.expectTier})`);
  if (prov.downgrade_reasons?.length) console.log(`     사유: ${prov.downgrade_reasons.join(", ")}`);
  if (ok) passed++; else failed++;
}

// isExpired 단위 검증
const expiredOk = isExpired(longAgo, "rent") === true && isExpired(now, "rent") === false;
console.log(`  ${expiredOk ? "✓" : "✗"} isExpired() 정책 동작`);
if (expiredOk) passed++; else failed++;

const totalCases = CASES.length + ECON_CASES.length + CROSS_CASES.length + META_CASES.length + 1;
console.log(`\n━━━ 결과 ━━━`);
console.log(`통과 ${passed} / 실패 ${failed} / 총 ${totalCases}`);
process.exit(failed > 0 ? 1 : 0);
