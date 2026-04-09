/* ── 임대료 추정 엔진 v2 ──

   3가지 소스를 교차하여 층별 임대료 추정:
   1. 매매 실거래 역산법: 평당 매매가 × 수익률 ÷ 12
   2. 부동산원 호가: 구별 층별 평균 (천원/평/월)
   3. 네이버 호가 (추정 실거래): DB에서 조회 (Phase 3)

   각 소스에 가중치를 부여하여 최종 추정치 산출.
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

export function estimateRent(
  guName: string,
  rentApi: RentApiData | null,       // 부동산원 호가
  rentLive: RentLiveData | null,     // 임대 실거래/폴백
  saleLive: SaleLiveData | null,     // 매매 실거래/폴백
  targetArea: number = 33,
  targetFloor: string = "1층",
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

  // ── 방법 2: 부동산원 호가 ──
  let method2_rent = 0;
  if (rentApi?.["1층_평"]) {
    method2_rent = Math.round(rentApi["1층_평"] / 10); // 천원 → 만원
    methods.push({ method: "부동산원 호가 (1층)", value: method2_rent, weight: 0.2 });
    sources.push("한국부동산원 호가");
  }

  // ── 방법 3: 임대 실거래/폴백 ──
  let method3_rent = 0;
  const rentDeals1f = (rentLive?.recent_deals ?? [])
    .filter((d) => String(d.floor) === "1" && (d.area_m2 ?? 0) > 0 && (d.monthly_rent ?? 0) > 0);

  if (rentDeals1f.length > 0) {
    const rentsPerPyeong = rentDeals1f.map((d) => (d.monthly_rent ?? 0) / ((d.area_m2 ?? 1) / 3.3));
    rentsPerPyeong.sort((a, b) => a - b);
    method3_rent = Math.round(rentsPerPyeong[Math.floor(rentsPerPyeong.length / 2)]);
    methods.push({ method: `임대 실거래 중위값 (${rentDeals1f.length}건)`, value: method3_rent, weight: 0.6 });
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
      floorRent = Math.round(rentApi["2층이상_평"] / 10);
    }
    if (floor === "지하" && rentApi?.["지하_평"]) {
      floorRent = Math.round(rentApi["지하_평"] / 10);
    }

    const depositMonths = DEPOSIT_MONTHS[floor] ?? 50;

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
