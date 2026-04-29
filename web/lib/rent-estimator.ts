/* ── 임대료 추정 엔진 v2 (4중 검증 확장) ──

   소스 (있으면 가중평균 자동 포함):
   1. 매매 실거래 역산: 구 단위 거래 / 평균 (saleLive)
   1b. 동 단위 매매역산: dong-sale-data.ts JSON (dongLandPrice 인자)
   2. 부동산원 호가: gu_rent_stats (rentApi)
   3. 임대 실거래/호가: naver_estimated_deals (rentLive) + 보정계수 (calibration)
   4. 시장 보고서 앵커: market_reports (marketReportRent)
   5. 본인 네트워크 ground truth: owner_network_rents (ownerNetworkRent)

   ground truth(5)이 있으면 가중치 최상위 0.5. 호가는 보정계수 자동 적용.
*/

export interface FloorRent {
  floor: string;           // "1층", "2층", "지하"
  rent_per_pyeong: number; // 만원/평/월
  deposit_per_pyeong: number; // 만원/평
  confidence: number;      // 0~1
}

export interface RentEstimate {
  floors: FloorRent[];
  // 특정 면적 기준 총액
  area_m2: number;
  selected_floor: string;
  total_rent: { low: number; mid: number; high: number };
  total_deposit: { low: number; mid: number; high: number };
  // 메타
  sources: string[];
  confidence: "높음" | "보통" | "참고";
  method_details: Array<{ method: string; value: number; weight: number }>;
}

// 구별 평균 임대수익률 (한국감정원 2025년 기준, 연 %)
const YIELD_RATES: Record<string, number> = {
  "강남구": 3.8, "서초구": 3.9, "송파구": 4.2, "마포구": 4.5,
  "용산구": 4.0, "성동구": 4.3, "중구": 3.5, "종로구": 3.7,
  "영등포구": 4.4, "광진구": 4.6, "동대문구": 5.0, "중랑구": 5.5,
  "성북구": 5.2, "강북구": 5.8, "도봉구": 5.9, "노원구": 5.5,
  "은평구": 5.3, "서대문구": 5.0, "양천구": 5.1, "강서구": 5.4,
  "구로구": 5.3, "금천구": 5.5, "동작구": 4.8, "관악구": 5.2,
  "강동구": 4.7,
};

// 층별 임대료 비율 (1층 = 1.0 기준)
const FLOOR_RATIO: Record<string, number> = {
  "1층": 1.0,
  "2층": 0.55,
  "지하": 0.45,
};

// 보증금/월세 비율 (보증금 = 월세 × N개월) — 실제 시세 기준
const DEPOSIT_MONTHS: Record<string, number> = {
  "1층": 12,
  "2층": 10,
  "지하": 8,
};

interface RentApiData {
  "1층_평"?: number;
  "지하_평"?: number;
  "2층이상_평"?: number;
}

interface DealRecord {
  area_m2?: number;
  deposit?: number;
  monthly_rent?: number;
  floor?: string;
  price?: number;
}

interface RentLiveData {
  avg_deposit?: number;
  avg_monthly_rent?: number;
  recent_deals?: DealRecord[];
}

interface SaleLiveData {
  avg_price_per_m2?: number;
  recent_deals?: DealRecord[];
}

/* 4중 검증용 새 입력 — 모두 optional, 있으면 가중평균에 자동 추가 */
export interface RentEstimatorExtra {
  dongLandPricePyeong?: number;     // 동 단위 토지 평당가 (만원/대지평) — dong-sale-data.ts
  marketReportRent?: number;        // 시장 보고서 권역 앵커 (만원/평/월, 1층 기준)
  ownerNetworkRent?: { rent: number; n: number };  // 본인 네트워크 중위값 (만원/평/월)
  calibrationPct?: number;          // 호가 보정계수 (예: -22 = 호가 -22%)
  capRate?: number;                 // 매매역산 캡레이트 % (기본 4.5)
}

export function estimateRent(
  guName: string,
  rentApi: RentApiData | null,       // 부동산원 호가
  rentLive: RentLiveData | null,     // 임대 실거래/폴백
  saleLive: SaleLiveData | null,     // 매매 실거래/폴백
  targetArea: number = 33,
  targetFloor: string = "1층",
  extra: RentEstimatorExtra = {},
): RentEstimate {
  const pyeong = targetArea / 3.3;
  const sources: string[] = [];
  const methods: Array<{ method: string; value: number; weight: number }> = [];

  // ── 방법 1: 매매 실거래 역산법 ──
  let method1_rent = 0;
  const yieldRate = YIELD_RATES[guName] ?? 4.5;

  // 1층 매매 실거래에서 평당 가격
  const saleDeals1f = (saleLive?.recent_deals ?? [])
    .filter((d) => String(d.floor) === "1" && (d.area_m2 ?? 0) > 0 && (d.price ?? 0) > 0);

  if (saleDeals1f.length > 0) {
    const pricesPerPyeong = saleDeals1f.map((d) => (d.price ?? 0) / ((d.area_m2 ?? 1) / 3.3));
    pricesPerPyeong.sort((a, b) => a - b);
    const medianPrice = pricesPerPyeong[Math.floor(pricesPerPyeong.length / 2)];
    method1_rent = Math.round(medianPrice * (yieldRate / 100) / 12);
    methods.push({ method: `매매역산 (수익률 ${yieldRate}%, ${saleDeals1f.length}건)`, value: method1_rent, weight: 0.2 });
    sources.push("매매 실거래 역산");
  } else if (saleLive?.avg_price_per_m2) {
    const avgPricePyeong = saleLive.avg_price_per_m2 * 3.3;
    method1_rent = Math.round(avgPricePyeong * (yieldRate / 100) / 12);
    methods.push({ method: `매매역산-추정 (수익률 ${yieldRate}%)`, value: method1_rent, weight: 0.15 });
    sources.push("매매가 추정 역산");
  }

  // ── 방법 1b: 동 단위 매매역산 ──
  // 토지 평당가(대지) → 1층 임대료 추정 시 입지 프리미엄 ×1.7 보정 (실측 기반)
  if (extra.dongLandPricePyeong) {
    const cap = extra.capRate ?? yieldRate;
    const baseRentPerLandPyeong = (extra.dongLandPricePyeong * (cap / 100)) / 12;
    // 1층 임대료 ≈ 대지 평당 월세 × 1.7 (한남/신사 등 A급 입지 실측 평균 보정)
    const dongInverse = Math.round(baseRentPerLandPyeong * 1.7);
    methods.push({ method: `동 단위 매매역산 (cap ${cap}%)`, value: dongInverse, weight: 0.15 });
    sources.push("동 단위 RTMS 매매역산");
  }

  // ── 방법 2: 부동산원 호가 ──
  let method2_rent = 0;
  if (rentApi?.["1층_평"]) {
    method2_rent = Math.round(rentApi["1층_평"]); // 만원/평/월
    methods.push({ method: "권역 호가 (1층)", value: method2_rent, weight: 0.2 });
    sources.push("권역 호가 DB");
  }

  // ── 방법 4: 시장 보고서 권역 앵커 (CBRE/JLL/쿠시먼) ──
  if (extra.marketReportRent && extra.marketReportRent > 0) {
    methods.push({ method: "시장 보고서 권역 앵커", value: Math.round(extra.marketReportRent), weight: 0.2 });
    sources.push("시장 보고서");
  }

  // ── 방법 5: 본인 네트워크 ground truth (가장 높은 가중치) ──
  if (extra.ownerNetworkRent && extra.ownerNetworkRent.rent > 0) {
    const w = extra.ownerNetworkRent.n >= 5 ? 0.5 : 0.35;
    methods.push({
      method: `본인 네트워크 (n=${extra.ownerNetworkRent.n})`,
      value: Math.round(extra.ownerNetworkRent.rent),
      weight: w,
    });
    sources.push(`네트워크 실거래 ${extra.ownerNetworkRent.n}건`);
  }

  // ── 방법 3: 임대 실거래/폴백 ──
  let method3_rent = 0;
  const rentDeals1f = (rentLive?.recent_deals ?? [])
    .filter((d) => String(d.floor) === "1" && (d.area_m2 ?? 0) > 0 && (d.monthly_rent ?? 0) > 0);

  if (rentDeals1f.length > 0) {
    const rentsPerPyeong = rentDeals1f.map((d) => (d.monthly_rent ?? 0) / ((d.area_m2 ?? 1) / 3.3));
    rentsPerPyeong.sort((a, b) => a - b);
    method3_rent = Math.round(rentsPerPyeong[Math.floor(rentsPerPyeong.length / 2)]);
    // 호가 기반 데이터에 보정계수 자동 적용 (실거래로 변환)
    if (extra.calibrationPct) method3_rent = Math.round(method3_rent * (1 + extra.calibrationPct / 100));
    const label = extra.calibrationPct
      ? `호가 ${rentDeals1f.length}건 + 보정 ${extra.calibrationPct}%`
      : `임대 실거래 중위값 (${rentDeals1f.length}건)`;
    methods.push({ method: label, value: method3_rent, weight: extra.ownerNetworkRent ? 0.25 : 0.6 });
    sources.push(`임대 실거래 ${rentDeals1f.length}건`);
  } else if (rentLive?.avg_monthly_rent) {
    method3_rent = Math.round(rentLive.avg_monthly_rent / Math.max(pyeong, 1));
    methods.push({ method: "임대 추정 평균", value: method3_rent, weight: 0.2 });
    sources.push("임대 추정치");
  }

  // ── 가중 평균 계산 ──
  const validMethods = methods.filter((m) => m.value > 0);
  let baseRent1f = 15; // 최소 폴백

  if (validMethods.length > 0) {
    const totalWeight = validMethods.reduce((s, m) => s + m.weight, 0);
    baseRent1f = Math.round(
      validMethods.reduce((s, m) => s + m.value * (m.weight / totalWeight), 0)
    );
  }

  // ── 층별 산출 ──
  const floors: FloorRent[] = Object.entries(FLOOR_RATIO).map(([floor, ratio]) => {
    let floorRent = Math.round(baseRent1f * ratio);

    // 부동산원 호가가 있으면 해당 층 값으로 보정
    if (floor === "2층" && rentApi?.["2층이상_평"]) {
      floorRent = Math.round(rentApi["2층이상_평"]); // 만원/평/월
    }
    if (floor === "지하" && rentApi?.["지하_평"]) {
      floorRent = Math.round(rentApi["지하_평"]); // 만원/평/월
    }

    const depositMonths = DEPOSIT_MONTHS[floor] ?? 12;

    return {
      floor,
      rent_per_pyeong: floorRent,
      deposit_per_pyeong: Math.round(floorRent * depositMonths),
      confidence: validMethods.length >= 2 ? 0.8 : 0.5,
    };
  });

  // 선택 층
  const selected = floors.find((f) => f.floor === targetFloor) ?? floors[0];
  const rentMid = Math.round(selected.rent_per_pyeong * pyeong);
  const depositMid = Math.round(selected.deposit_per_pyeong * pyeong);

  const confidence = validMethods.length >= 3 ? "높음" : validMethods.length >= 2 ? "보통" : "참고";

  return {
    floors,
    area_m2: targetArea,
    selected_floor: targetFloor,
    total_rent: {
      low: Math.round(rentMid * 0.85),
      mid: rentMid,
      high: Math.round(rentMid * 1.2),
    },
    total_deposit: {
      low: Math.round(depositMid * 0.7),
      mid: depositMid,
      high: Math.round(depositMid * 1.3),
    },
    sources,
    confidence,
    method_details: validMethods,
  };
}
