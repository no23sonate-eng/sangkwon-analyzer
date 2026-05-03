import data from "./data/category-economics.json";

export interface CategoryEconomics {
  rent_ratio: number;
  avg_pyeong: number;
  source: string;
}

/* 세부업종 → 대분류 매핑.
   세부업종은 부모 대분류의 rent_ratio/avg_pyeong을 상속받지만
   특수 업종(신발·명품·편의점 등)은 별도 override 가능 (subcategory_overrides).

   13개 그룹 = trdar 7개 + 자동수집(places) 6개.
   from_places: true 인 그룹은 trdar 분류로 안 잡혀서 places 테이블에서 카운트. */
export const CATEGORY_GROUPS: Record<string, { label: string; icon: string; subs: string[]; from_places?: boolean }> = {
  외식: {
    label: "외식",
    icon: "🍽️",
    subs: ["한식음식점", "중식음식점", "일식음식점", "양식음식점", "분식전문점", "패스트푸드점", "치킨전문점", "제과점", "반찬가게"],
  },
  "카페/주류": {
    label: "카페/주류",
    icon: "☕",
    subs: ["커피-음료", "호프-간이주점", "주류도매"],
  },
  "소매/유통": {
    label: "소매",
    icon: "🛒",
    subs: ["편의점", "슈퍼마켓", "일반의류", "한복점", "유아의류", "화장품", "신발", "가방", "시계및귀금속", "안경", "서적", "문구", "가전제품", "핸드폰", "운동/경기용품", "예술품", "의약품", "육류판매", "중고가구", "가구", "철물점", "청과상", "수산물판매", "미곡판매", "조명용품", "섬유제품", "완구", "악기", "화초", "애완동물", "미용재료", "컴퓨터및주변장치판매", "의류임대", "가정용품임대", "재생용품 판매점", "비디오/서적임대", "중고차판매", "자전거 및 기타운송장비", "모터사이클및부품"],
  },
  "뷰티/건강": {
    label: "뷰티/의료",
    icon: "💇",
    subs: ["미용실", "피부관리실", "네일숍", "일반의원", "치과의원", "한의원", "동물병원", "의료기기"],
  },
  교육: {
    label: "교육",
    icon: "📚",
    subs: ["외국어학원", "일반교습학원", "예술학원", "컴퓨터학원", "스포츠 강습", "독서실"],
  },
  "생활서비스": {
    label: "생활서비스",
    icon: "🔧",
    subs: ["세탁소", "부동산중개업", "변호사사무소", "회계사사무소", "세무사사무소", "인테리어", "전자상거래업", "자동차수리", "사진관", "여행사", "통번역서비스", "법무사사무소", "변리사사무소", "기타법무서비스", "건축물청소", "자동차미용", "자동차부품", "모터사이클수리", "가전제품수리", "통신기기수리", "주유소", "녹음실"],
  },
  "여가/오락": {
    label: "여가",
    icon: "🏋️",
    subs: ["스포츠클럽", "골프연습장", "PC방", "노래방", "당구장", "볼링장", "게스트하우스", "여관", "고시원", "DVD방", "전자게임장", "기타오락장", "복권방"],
  },
  "명품/럭셔리": {
    label: "명품",
    icon: "💎",
    subs: [],
    from_places: true,
  },
  "플래그십": {
    label: "플래그십",
    icon: "🏛️",
    subs: [],
    from_places: true,
  },
  "갤러리": {
    label: "갤러리",
    icon: "🎨",
    subs: [],
    from_places: true,
  },
  "파인다이닝": {
    label: "파인다이닝",
    icon: "🍷",
    subs: [],
    from_places: true,
  },
  "편집숍": {
    label: "편집숍",
    icon: "🛍️",
    subs: [],
    from_places: true,
  },
  "라이프스타일": {
    label: "라이프스타일",
    icon: "🪴",
    subs: [],
    from_places: true,
  },
};

/* place_crawler.py 가 산출한 카테고리 → CATEGORY_GROUPS 키 매핑 */
export const PLACE_CATEGORY_TO_GROUP: Record<string, string> = {
  luxury: "명품/럭셔리",
  flagship: "플래그십",
  contemporary: "플래그십",
  gallery: "갤러리",
  fine_dining: "파인다이닝",
  select_shop: "편집숍",
  streetwear_premium: "편집숍",
  lifestyle: "라이프스타일",
};

const SUB_TO_PARENT: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [parent, g] of Object.entries(CATEGORY_GROUPS)) {
    for (const sub of g.subs) m[sub] = parent;
  }
  return m;
})();

export function getParentCategory(svcNm: string): string | null {
  return SUB_TO_PARENT[svcNm] ?? null;
}

const RAW = data.categories as Record<string, CategoryEconomics>;
const SUB_OVERRIDES = (data.subcategory_overrides ?? {}) as unknown as Record<string, CategoryEconomics>;
const CONST = data._constants as { rent_burden_warn: number; rent_burden_max: number };

export const RENT_BURDEN_WARN = CONST.rent_burden_warn;
export const RENT_BURDEN_MAX = CONST.rent_burden_max;

export function getCategoryEconomics(category: string): CategoryEconomics {
  return RAW[category] ?? { rent_ratio: 0.10, avg_pyeong: 20, source: "기본값 (산업 통계 미정의)" };
}

/* 세부업종 economics — override 우선, 없으면 부모 카테고리 상속 */
export function getSubcategoryEconomics(svcNm: string): CategoryEconomics {
  const override = SUB_OVERRIDES[svcNm];
  if (override && typeof override.rent_ratio === "number") return override;
  const parent = getParentCategory(svcNm);
  if (parent) return getCategoryEconomics(parent);
  return { rent_ratio: 0.10, avg_pyeong: 20, source: "기본값 (대분류 미매핑)" };
}

export interface RentEconomy {
  monthlyRentMan: number;       // 카테고리 평균 면적 기준 예상 월세 (만원)
  appropriateSalesMan: number;  // 임대 부담 적정 점포당 매출 (만원/월)
  actualSalesMan: number;       // 실제 카테고리 점포당 매출 (만원/월)
  rentBurden: number;           // 실제월세 / 적정월세. 1.0 = 적정, 1.5+ = 추천 제외
  rentRatioActual: number;      // 실제 매출 대비 임대료 비중
  source: string;
}

export function calcRentEconomy(
  category: string,
  rent1fPerPyeongMan: number,  // 1층 평당 시세 (만원/평/월)
  perStoreSalesWon: number,    // 카테고리 점포당 매출 (원/월)
  useSubcategory = false,      // true면 세부업종 override 적용
): RentEconomy {
  const eco = useSubcategory ? getSubcategoryEconomics(category) : getCategoryEconomics(category);
  const monthlyRentMan = rent1fPerPyeongMan * eco.avg_pyeong;
  const monthlyRentWon = monthlyRentMan * 10000;
  const appropriateRentWon = perStoreSalesWon * eco.rent_ratio;
  const appropriateSalesWon = monthlyRentWon / Math.max(eco.rent_ratio, 0.01);

  const rentBurden = appropriateRentWon > 0 && monthlyRentWon > 0
    ? monthlyRentWon / appropriateRentWon
    : 0;
  const rentRatioActual = perStoreSalesWon > 0 ? monthlyRentWon / perStoreSalesWon : 0;

  return {
    monthlyRentMan: Math.round(monthlyRentMan),
    appropriateSalesMan: Math.round(appropriateSalesWon / 10000),
    actualSalesMan: Math.round(perStoreSalesWon / 10000),
    rentBurden: Math.round(rentBurden * 100) / 100,
    rentRatioActual: Math.round(rentRatioActual * 1000) / 1000,
    source: eco.source,
  };
}

/* 임대 적정 점수 (0~100). rentBurden 1.0 = 50점 (적정), 0.7 = 80점, 1.5 = 0점 */
export function rentFitScore(rentBurden: number): number {
  if (rentBurden <= 0) return 50;
  if (rentBurden >= RENT_BURDEN_MAX) return 0;
  if (rentBurden <= 0.7) return 90;
  if (rentBurden <= 1.0) return 80 - (rentBurden - 0.7) * 100;     // 0.7→80, 1.0→50
  if (rentBurden <= 1.2) return 50 - (rentBurden - 1.0) * 100;     // 1.0→50, 1.2→30
  return Math.max(0, 30 - (rentBurden - 1.2) * 100);                // 1.2→30, 1.5→0
}

/* 추천 가중평균 — 임대료가 흑자 결정변수임을 반영
   합계 100. */
export const SCORE_WEIGHTS = {
  rentFit: 0.30,       // 임대 적정 — 한남동 같은 프라임에선 결정변수
  demand: 0.20,        // 1인당 카테고리 소비 (서울 median 대비)
  ticket: 0.15,        // 객단가 (서울 median 대비)
  supplySlack: 0.15,   // 공급 여유 (밀도 역수)
  openRate: 0.12,      // 개폐업률 (서울 카테고리 평균 대비)
  entryEase: 0.08,     // 진입 용이 (프랜차이즈 비율 역수)
} as const;

/* ── 세부업종 단위 추천 ──
   카테고리 합산 평균은 패션 라인(한남대로) 같은 특화 권역을 묻어버림.
   세부업종 단위로 임대 부담을 재계산해 매출 큰 업종이 임대료를 감당 가능한지 표시.
   D 시나리오: 평당 시세 → 임대료 감당 매출 임계치 산출 → 실측 매출과 대비.
*/
export interface SubcategoryRec {
  svcNm: string;
  parent: string;
  storeCount: number;
  perStoreSalesMan: number;     // 점포당 매출 (만원/월)
  monthlyRentMan: number;        // 예상 월세 (만원/월)
  thresholdSalesMan: number;     // 임대료 감당 매출 임계치 (만원/월)
  rentBurden: number;            // 실제월세/적정월세
  rentFit: number;               // 0-100
  verdict: "적정" | "주의" | "부담" | "데이터부족";
  pyeong: number;
  rentRatio: number;
  source: string;
}

export function rankSubcategories(
  perStore: { 업종: string; 점포당_매출: number }[],
  bySubcategory: Record<string, { count: number; ratio: number }>,
  rent1fPerPyeongMan: number,
): SubcategoryRec[] {
  const results: SubcategoryRec[] = [];

  for (const p of perStore) {
    if (!p.업종 || p.점포당_매출 <= 0) continue;
    if (!getParentCategory(p.업종)) continue; // 매핑 안 되는 업종 스킵

    const eco = getSubcategoryEconomics(p.업종);
    const parent = getParentCategory(p.업종) ?? "기타";
    const econ = calcRentEconomy(p.업종, rent1fPerPyeongMan, p.점포당_매출, true);
    const thresholdSales = rent1fPerPyeongMan > 0 && eco.rent_ratio > 0
      ? Math.round((rent1fPerPyeongMan * eco.avg_pyeong) / eco.rent_ratio)
      : 0;
    const storeCount = bySubcategory[p.업종]?.count ?? 0;

    let verdict: SubcategoryRec["verdict"];
    if (econ.rentBurden === 0) verdict = "데이터부족";
    else if (econ.rentBurden < 1.0) verdict = "적정";
    else if (econ.rentBurden < RENT_BURDEN_WARN) verdict = "주의";
    else verdict = "부담";

    results.push({
      svcNm: p.업종,
      parent,
      storeCount,
      perStoreSalesMan: Math.round(p.점포당_매출 / 10000),
      monthlyRentMan: econ.monthlyRentMan,
      thresholdSalesMan: thresholdSales,
      rentBurden: econ.rentBurden,
      rentFit: rentFitScore(econ.rentBurden),
      verdict,
      pyeong: eco.avg_pyeong,
      rentRatio: eco.rent_ratio,
      source: eco.source,
    });
  }

  // 정렬: 적정 → 주의 → 부담 순, 같은 등급 내에서는 매출 큰 순
  const order = { "적정": 0, "주의": 1, "부담": 2, "데이터부족": 3 };
  results.sort((a, b) => {
    if (order[a.verdict] !== order[b.verdict]) return order[a.verdict] - order[b.verdict];
    return b.perStoreSalesMan - a.perStoreSalesMan;
  });

  return results;
}
