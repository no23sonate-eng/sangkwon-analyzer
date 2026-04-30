/* 한남동 726-54 회귀 테스트.
 * 분기 자동 갱신 후 자동 산출값이 본인 수기 분석값과 ±25% 안에 들어오는지 검증.
 * exit 0: 통과 / exit 1: 실패 (CI/스케줄러용).
 *
 * 회귀 케이스 추가: 컨설팅 받은 케이스마다 CASES 배열에 추가.
 */
import { findDongByCoord } from "../lib/dong-lookup";
import { getDongLandPrice, inverseRentFromDongLand } from "../lib/dong-sale-data";
import { estimateRent } from "../lib/rent-estimator";
import { calcRentEconomy, RENT_BURDEN_MAX } from "../lib/category-economics";

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

const CASES: SanityCase[] = [
  {
    name: "한남동 726-54 (한남동 리포트 기준)",
    lat: 37.5374, lng: 127.0029,
    expected: {
      gu: "용산구",
      dong: "한남동",
      rentPyeong1F: { low: 90, mid: 120, high: 150 },     // 한남동 리포트 1층 가정값
      landPyeongPyeong: { low: 12000, high: 18000 },      // 한남동 시장 감각
      capRate: 5.0,
    },
    toleranceP: 25,
  },
];

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
   한남동 1층 평당 120만/월에서 카페/주류 점포당 매출(서울 평균 ~3천만/월,
   한남동 프라임 가정 6천만/월 이내)는 임대 부담이 RENT_BURDEN_MAX(1.5) 이상이라야 함.
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
    name: "한남동 대로변 카페/주류 (서울 카페 평균 매출)",
    category: "카페/주류",
    rent1fMan: 120,
    perStoreSalesWon: 32_459_511, // seoul-benchmark avg_per_store_sales
    expect: "exclude",
  },
  {
    name: "한남동 대로변 카페/주류 (한남동 객단가 보정 +85%)",
    category: "카페/주류",
    rent1fMan: 120,
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

console.log(`\n━━━ 결과 ━━━`);
console.log(`통과 ${passed} / 실패 ${failed} / 총 ${CASES.length + ECON_CASES.length}`);
process.exit(failed > 0 ? 1 : 0);
