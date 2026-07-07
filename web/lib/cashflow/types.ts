/* ── 캐쉬플로우 생성기 타입 ──
   학습 근거: docs/cashflow/model-spec.md + web/lib/data/cashflow-knowledge.json */

export type Category = "office" | "retail" | "hotel" | "senior";
export type DevMode = "dev" | "valueadd"; // 신축개발 | 매입+리모델링(밸류애드)

/* 모든 기본값은 근거를 달고 다닌다 — 학습(모델 근거) / 추정(근거 없음, 사용자 검증 필요) */
export type Basis = "학습" | "추정" | "입력";
export interface Assumption {
  value: number;
  basis: Basis;
  source?: string; // 근거 모델 id 또는 설명
}

/* ── 입력 (위저드 순서대로) ── */
export interface CashflowInput {
  // STEP 1. 카테고리·사업방식
  category: Category;
  devMode: DevMode;

  // STEP 2. 면적 (평)
  landPy: number;        // 대지면적
  gfaPy: number;         // 연면적
  efficiency: number;    // 전용률 (0~1)

  // 카테고리별 필수 요소 (STEP 2에서 파생, 수정 가능)
  rentPerPyMonthly?: number;  // office/retail: 임대료 (만원/전용평/월)
  mgmtFeePerPy?: number;      // office/retail: 관리비 (만원/전용평/월)
  roomCount?: number;         // hotel: 객실수
  adr?: number;               // hotel: ADR (원/박)
  unitCount?: number;         // senior: 세대수
  depositPerUnit?: number;    // senior: 세대당 보증금 (백만원)
  monthlyFeePerUnit?: number; // senior: 세대당 월 이용료 (만원)

  // STEP 3. 사업비
  landPricePerPy: number;    // 토지비 (만원/대지평) — 밸류애드는 건물 포함 매입가
  constCostPerPy: number;    // 도급공사비 (만원/연면적평)

  // STEP 4. 조달 (총사업비 대비 비율)
  equityRatio: number;       // 0~1
  trancheA: TrancheInput;
  trancheB: TrancheInput;    // amountRatio 0이면 미사용
  trancheC: TrancheInput;

  // STEP 5. 일정 (개월)
  permitMonths: number;      // 인허가·준비
  constMonths: number;       // 공사
  opsMonths: number;         // 운영 (매각까지)

  // STEP 6. Exit
  exitCap: number;           // terminal cap (0~1)
}

export interface TrancheInput {
  amountRatio: number; // 총사업비 대비 (0~1)
  rate: number;        // 연리 (0~1)
  upfront: number;     // 선취수수료 (0~1)
}

/* ── 산출 ── */
export interface TicLine {
  category: string;   // 대분류
  name: string;
  amount: number;     // 백만원
  formula: string;    // 산정 근거 표시용
  basis: Basis;
  source?: string;
}

export interface MonthlyCF {
  month: number;       // 사업 개시 후 경과월 (1-base)
  phase: "인허가" | "공사" | "운영" | "매각";
  revenue: number;     // 백만원
  opex: number;
  capex: number;       // 개발원가 지출 (금융비 제외)
  interest: number;
  loanDraw: number;
  loanRepay: number;
  equityDraw: number;
  netCF: number;       // 프로젝트 순현금흐름
  loanBalance: number;
}

export interface YearlyOps {
  year: number;        // 운영 1년차~
  gor: number;         // 총매출 (백만원)
  opex: number;
  noi: number;
  rampup: number;      // 적용 램프업 비율
}

export interface ExitScenario {
  cap: number;
  salePrice: number;      // 백만원
  saleCosts: number;
  netProceeds: number;
  profit: number;         // 사업이익
  profitMargin: number;
  unleveredIrr: number | null;
  leveredIrr: number | null;
  equityMultiple: number | null;
}

export interface CashflowResult {
  input: CashflowInput;
  assumptions: Array<{ label: string; text: string; basis: Basis; source?: string }>;
  tic: TicLine[];
  ticTotal: number;             // 백만원
  ticPerGfaPy: number;          // 만원/평
  financing: {
    equity: number;
    tranches: Array<{ name: string; amount: number; rate: number; upfront: number }>;
    totalDebt: number;
    ltc: number;
    interestTotal: number;      // 개발+운영 누적 이자
  };
  yearlyOps: YearlyOps[];
  stabilizedNoi: number;        // 안정화 NOI (백만원/년)
  yieldOnCost: number;          // 안정화 NOI / TIC
  dscr: { min: number; avg: number } | null;
  exits: ExitScenario[];        // cap 3안 (base ±0.5%p)
  monthly: MonthlyCF[];
  warnings: string[];
}
