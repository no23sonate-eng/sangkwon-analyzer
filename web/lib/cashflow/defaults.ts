/* ── 카테고리별 기본 가정 ──
   학습값은 docs/cashflow/models/ 실전 모델에서 추출. `추정`은 학습 근거가 없어
   사용자 검증이 필요한 값 (CLAUDE.md: 근거 없는 항목은 추정 표기). */

import type { Assumption, Category, CashflowInput, DevMode } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  office: "오피스",
  retail: "리테일",
  hotel: "호텔",
  senior: "시니어 레지던스",
};

export const DEV_MODE_LABEL: Record<DevMode, string> = {
  dev: "신축 개발",
  valueadd: "매입 + 리모델링 (밸류애드)",
};

/* ── 공통 학습 요율 (cashflow-knowledge.json 동기) ── */
export const RATES = {
  // 취득세
  acqTaxLand: { value: 0.046, basis: "학습", source: "soho" } as Assumption,
  acqTaxBuildingNew: { value: 0.0316, basis: "학습", source: "brix730dev·soho — 원시취득, 과표=공사비+부대+용역+금융" } as Assumption,
  acqTaxRenovation: { value: 0.022, basis: "학습", source: "workstay — 대수선" } as Assumption,
  // 예비비
  constContingency: { value: 0.05, basis: "학습", source: "soho·workstay — 도급공사비의 5%" } as Assumption,
  projContingency: { value: 0.0184, basis: "학습", source: "brix730dev — 대상사업비의 1.84%" } as Assumption,
  // 간접공사비 (만원/연면적평)
  designPerPy: { value: 25, basis: "학습", source: "brix730dev 18.25 ~ soho 30 천원→만원/평 환산 중앙" } as Assumption,
  supervisionPerPy: { value: 12, basis: "학습", source: "brix730dev 14.3만원/평·soho 월정액 환산" } as Assumption,
  utilityConnPerPy: { value: 21, basis: "학습", source: "brix730dev·soho 20~21.7만원/평" } as Assumption,
  // 용역·SPC
  amcMgmtAnnual: { value: 0.005, basis: "학습", source: "brix730dev 0.36% ~ soho 0.73% 중앙" } as Assumption,
  trustFee: { value: 0.015, basis: "학습", source: "brix730dev 관리형토지신탁 사업비의 ~1.5%" } as Assumption,
  professionalFees: { value: 0.006, basis: "추정", source: "법률·세무·감평·시장조사 일식 합산비율 (soho 29억/1,650억 근사)" } as Assumption,
  // 매각
  saleCost: { value: 0.01, basis: "학습", source: "soho 0.5% ~ workstay 1.5% 중앙" } as Assumption,
  saleBaseFee: { value: 0.007, basis: "학습", source: "soho 0.4% ~ workstay 1.0% 중앙" } as Assumption,
  // 임대안정화
  leasingCommission: { value: 2.5, basis: "학습", source: "workstay — 신규계약 월임대료의 250%" } as Assumption,
  // 운영 공통
  escalation: { value: 0.025, basis: "학습", source: "4건 공통 — 연 2.5%" } as Assumption,
  reserveFfe: { value: 0.015, basis: "학습", source: "brix730ops·brix730dev — 총매출의 1.5%" } as Assumption,
  // 세금 (연간 보유세 근사: 토지 공시지가 기반 정밀 엔진은 v2)
  holdingTaxOnTic: { value: 0.002, basis: "추정", source: "재산세+종부세 연간, TIC 대비 근사 (730 운영기 709백만/5,700억≈0.12%~soho 0.3%)" } as Assumption,
};

/* ── 조달 기본값 (트랜치 금리 학습 레인지 중앙) ── */
export const FINANCING_DEFAULTS = {
  equityRatio: { value: 0.25, basis: "학습", source: "730 15.2%·soho 20%·workstay 31.4% 레인지 내" } as Assumption,
  trancheA: { ratio: 0.55, rate: 0.062, upfront: 0.011, basisNote: "학습 — PF Tr.A all-in 5.7~6.6%, LTC 50~60%" },
  trancheB: { ratio: 0.12, rate: 0.075, upfront: 0.036, basisNote: "학습 — PF Tr.B 7~8%" },
  trancheC: { ratio: 0.08, rate: 0.093, upfront: 0, basisNote: "학습 — Tr.C(계정대) 9~9.6%" },
  unusedCommitment: { value: 0.005, basis: "학습", source: "brix730dev — 미인출 한도 연 0.5%" } as Assumption,
  advisory: { value: 0.012, basis: "학습", source: "soho 1.0%~730 1.46% — 대출총액 대비" } as Assumption,
};

/* ── 카테고리별 기본값 ── */
export interface CategoryDefaults {
  efficiency: Assumption;          // 전용률
  landPricePerPy: Assumption;      // 토지비 만원/대지평 (baseline; 실입지로 override)
  farAssumed: number;              // 용적률 가정 (연면적/대지 근사)
  constCostPerPy: { dev: Assumption; valueadd: Assumption }; // 도급공사비 만원/연면적평
  // 수입
  rentPerPyMonthly?: Assumption;   // 만원/전용평/월
  mgmtFeePerPy?: Assumption;
  vacancy?: Assumption;
  gfaPerRoom?: Assumption;         // hotel: 객실당 연면적(평)
  adr?: Assumption;                // hotel: 원
  occStabilized?: Assumption;
  roomRevShare?: Assumption;       // hotel 마스터리스: 객실매출 연동율
  ancillaryRatio?: Assumption;     // hotel: 부대매출/객실매출
  gfaPerUnit?: Assumption;         // senior: 세대당 연면적(평)
  depositPerUnit?: Assumption;     // senior: 백만원/세대
  monthlyFeePerUnit?: Assumption;  // senior: 만원/세대/월
  occupancy?: Assumption;          // senior 입주율
  depositYield?: Assumption;
  // 운영비
  opexRatio: Assumption;           // GOR 대비 운영비 비율 (소유주 관점)
  // 램프업 (연차별 수입 실현율)
  rampup: { value: number[]; basis: "학습" | "추정"; source?: string };
  rentFreeMonths: Assumption;
  // Exit
  exitCap: Assumption;
  // 일정 기본 (개월)
  schedule: { permit: number; constDev: number; constValueadd: number; ops: number };
}

export const CATEGORY_DEFAULTS: Record<Category, CategoryDefaults> = {
  office: {
    efficiency: { value: 0.55, basis: "추정", source: "서울 오피스 통상 50~60%" },
    landPricePerPy: { value: 5000, basis: "추정", source: "서울 주요 업무권역 baseline — 실입지 공시지가·실거래로 override" },
    farAssumed: 8,
    constCostPerPy: {
      dev: { value: 1100, basis: "추정", source: "soho 1,200만/평(호텔·클럽 고사양) 대비 하향" },
      valueadd: { value: 450, basis: "학습", source: "workstay 리모델링 512만/평 준용" },
    },
    rentPerPyMonthly: { value: 20, basis: "추정", source: "학습 모델에 오피스 없음 — 서울 프라임 전용평당 18~25만" },
    mgmtFeePerPy: { value: 6, basis: "추정" },
    vacancy: { value: 0.05, basis: "추정", source: "자연공실 5%" },
    opexRatio: { value: 0.15, basis: "추정", source: "관리비 상계 후 소유주 순비용" },
    rampup: { value: [0.7, 0.9, 1.0], basis: "추정", source: "soho 55/85/100 임대형 준용 완화" },
    rentFreeMonths: { value: 3, basis: "추정", source: "오피스 통상 연 1개월 RF 환산" },
    exitCap: { value: 0.045, basis: "추정", source: "서울 프라임 오피스 4~4.5%" },
    schedule: { permit: 12, constDev: 30, constValueadd: 10, ops: 24 },
  },
  retail: {
    efficiency: { value: 0.6, basis: "추정" },
    landPricePerPy: { value: 7000, basis: "추정", source: "가로변 리테일 baseline — 실입지로 override" },
    farAssumed: 5,
    constCostPerPy: {
      dev: { value: 1000, basis: "추정" },
      valueadd: { value: 500, basis: "학습", source: "workstay 512만/평" },
    },
    rentPerPyMonthly: { value: 20, basis: "추정", source: "1층 환산 blended — rent-estimator 권역값으로 대체 권장" },
    mgmtFeePerPy: { value: 3, basis: "학습", source: "workstay 리테일 관리비 0.92~2.79백만/58~169평" },
    vacancy: { value: 0.03, basis: "학습", source: "workstay turnover vacancy 3% (재계약 60%·downtime 4개월)" },
    opexRatio: { value: 0.12, basis: "추정" },
    rampup: { value: [0.55, 0.85, 1.0], basis: "학습", source: "soho" },
    rentFreeMonths: { value: 6, basis: "학습", source: "soho·workstay fit-out 6개월" },
    exitCap: { value: 0.05, basis: "학습", source: "CLAUDE.md 표준 시나리오 중앙 5.0%" },
    schedule: { permit: 12, constDev: 24, constValueadd: 10, ops: 24 },
  },
  hotel: {
    efficiency: { value: 0.68, basis: "학습", source: "workstay 호텔부 전용률 68.3%" },
    landPricePerPy: { value: 5000, basis: "추정", source: "서울 호텔 입지 baseline — 실입지로 override" },
    farAssumed: 6,
    constCostPerPy: {
      dev: { value: 1200, basis: "학습", source: "soho 도급 평당 1,200만 (호텔+클럽)" },
      valueadd: { value: 512, basis: "학습", source: "workstay 9,183백만/1,792평" },
    },
    gfaPerRoom: { value: 20, basis: "학습", source: "workstay 1,792평/90실·soho 객실층 구성" },
    adr: { value: 250000, basis: "추정", source: "서울 부티크호텔 baseline (workstay 제주 90~105천원 대비 상향). Trunk Hotel 학습 후 갱신 예정" },
    occStabilized: { value: 0.88, basis: "학습", source: "workstay 안정화 88%" },
    roomRevShare: { value: 0.38, basis: "학습", source: "workstay — 납부임대료 = MAX(MRG, 객실매출 38%+부대 연동)" },
    ancillaryRatio: { value: 0.25, basis: "학습", source: "workstay 부대수입/객실매출 ≈ 24%" },
    opexRatio: { value: 0.1, basis: "학습", source: "마스터리스 임대인 비용 — workstay 보험·수선·공용관리" },
    rampup: { value: [0.76, 0.88, 0.98, 1.0], basis: "학습", source: "workstay OCC 67→77.7→86.2→88%" },
    rentFreeMonths: { value: 6, basis: "학습", source: "workstay RF 6개월" },
    exitCap: { value: 0.055, basis: "학습", source: "workstay terminal cap 6.0%·soho 5.3% 중앙" },
    schedule: { permit: 12, constDev: 30, constValueadd: 10, ops: 36 },
  },
  senior: {
    efficiency: { value: 0.75, basis: "학습", source: "brix730ops 전용률 75.06% (계약면적 기준)" },
    landPricePerPy: { value: 4000, basis: "추정", source: "brix730 한남 대비 하향 baseline — 실입지로 override" },
    farAssumed: 4,
    constCostPerPy: {
      dev: { value: 1730, basis: "학습", source: "brix730dev 도급 2,073억/11,970평" },
      valueadd: { value: 600, basis: "추정" },
    },
    gfaPerUnit: { value: 108, basis: "학습", source: "brix730dev 11,970평/111세대 (하이엔드; 미드엔드는 40~60평 추정)" },
    depositPerUnit: { value: 5200, basis: "학습", source: "brix730dev 표준형 세대당 51~58억 → 백만원 단위. 미드엔드는 대폭 하향 필요" },
    monthlyFeePerUnit: { value: 800, basis: "학습", source: "brix730ops 1인 800만·2인 950만/월 (VAT 별도)" },
    occupancy: { value: 0.95, basis: "학습", source: "brix730ops 입주율 95%" },
    depositYield: { value: 0.03, basis: "학습", source: "brix730ops 보증금 운용이율 3.0%" },
    opexRatio: { value: 0.82, basis: "학습", source: "brix730ops OpEx/GOR = 11,874/14,458 (위탁운영·인건비 포함)" },
    rampup: { value: [0.6, 0.85, 1.0], basis: "추정", source: "brix730ops 개시 50%→100% 24개월 안정화 준용" },
    rentFreeMonths: { value: 0, basis: "학습", source: "임대형 아님 — 입주 즉시 이용료" },
    exitCap: { value: 0.045, basis: "추정", source: "시니어 운영자산 거래사례 부족 — CLAUDE.md 하단 4.5%" },
    schedule: { permit: 12, constDev: 35, constValueadd: 12, ops: 24 },
  },
};

/* 카테고리 + 사업방식 → 초기 입력값 생성 */
export function buildDefaultInput(category: Category, devMode: DevMode): CashflowInput {
  const d = CATEGORY_DEFAULTS[category];
  const gfaPy = category === "senior" ? 12000 : 3000;
  const landPy = Math.round(gfaPy / d.farAssumed); // 용적률 가정으로 대지 근사
  const base: CashflowInput = {
    category,
    devMode,
    landPy,
    gfaPy,
    efficiency: d.efficiency.value,
    landPricePerPy: d.landPricePerPy.value,
    constCostPerPy: d.constCostPerPy[devMode].value,
    equityRatio: FINANCING_DEFAULTS.equityRatio.value,
    trancheA: { amountRatio: FINANCING_DEFAULTS.trancheA.ratio, rate: FINANCING_DEFAULTS.trancheA.rate, upfront: FINANCING_DEFAULTS.trancheA.upfront },
    trancheB: { amountRatio: FINANCING_DEFAULTS.trancheB.ratio, rate: FINANCING_DEFAULTS.trancheB.rate, upfront: FINANCING_DEFAULTS.trancheB.upfront },
    trancheC: { amountRatio: FINANCING_DEFAULTS.trancheC.ratio, rate: FINANCING_DEFAULTS.trancheC.rate, upfront: FINANCING_DEFAULTS.trancheC.upfront },
    permitMonths: d.schedule.permit,
    constMonths: devMode === "dev" ? d.schedule.constDev : d.schedule.constValueadd,
    opsMonths: d.schedule.ops,
    exitCap: d.exitCap.value,
  };
  if (category === "office" || category === "retail") {
    base.rentPerPyMonthly = d.rentPerPyMonthly!.value;
    base.mgmtFeePerPy = d.mgmtFeePerPy!.value;
  } else if (category === "hotel") {
    base.roomCount = Math.round(gfaPy / d.gfaPerRoom!.value);
    base.adr = d.adr!.value;
  } else {
    base.unitCount = Math.round(gfaPy / d.gfaPerUnit!.value);
    base.depositPerUnit = d.depositPerUnit!.value;
    base.monthlyFeePerUnit = d.monthlyFeePerUnit!.value;
  }
  return base;
}
