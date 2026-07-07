/* ── 캐쉬플로우 엔진 ──
   학습 골격: docs/cashflow/model-spec.md
   순차 로직: ①카테고리 → ②면적·필수요소 → ③TIC(요율 자동) → ④조달(Equity→Tr.A→B→C)
             → ⑤운영(램프업·NOI) → ⑥Exit(cap) → ⑦지표(IRR·MoM·DSCR)

   단위: 내부 계산 전부 백만원. 입력 단가는 만원/평 (÷100), ADR은 원.
   간소화(기본 툴 v1 — 정밀 모델과 차이):
   - 이자 매월 지급 (학습 모델은 Tr.A·B 분기 적립-지급)
   - 보유세는 TIC 대비 연 요율 근사 (정밀 Tax 엔진은 v2)
   - 공사비 S-curve는 sin 근사 (학습 모델은 공정표 lookup)
*/

import type {
  CashflowInput, CashflowResult, ExitScenario, MonthlyCF, TicLine, YearlyOps, Basis,
} from "./types";
import { CATEGORY_DEFAULTS, FINANCING_DEFAULTS, RATES } from "./defaults";

const MAN_TO_MM = 1 / 100; // 만원 → 백만원

/* ── 유틸 ── */
function sCurveWeights(n: number): number[] {
  // 공사 진행률 근사: sin 곡선 (초반·후반 완만, 중반 집중)
  const raw = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / n));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

function irr(cfs: number[], periodsPerYear = 12): number | null {
  // 월별 CF → 연 환산 IRR (bisection)
  const hasNeg = cfs.some((c) => c < -1e-9);
  const hasPos = cfs.some((c) => c > 1e-9);
  if (!hasNeg || !hasPos) return null;
  const npv = (r: number) => cfs.reduce((acc, c, t) => acc + c / Math.pow(1 + r, t), 0);
  let lo = -0.95 / periodsPerYear;
  let hi = 1.5 / periodsPerYear;
  let fLo = npv(lo);
  const fHi = npv(hi);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-10) break;
    if (fLo * fMid <= 0) hi = mid;
    else { lo = mid; fLo = fMid; }
  }
  const rMonthly = (lo + hi) / 2;
  return Math.pow(1 + rMonthly, periodsPerYear) - 1;
}

/* ── 수입 엔진: 카테고리별 안정화 연간 GOR/NOI (백만원, 1차년 물가 기준) ── */
interface OpsModel {
  stabilizedGor: number;      // 안정화 연 매출 (램프업 100%)
  stabilizedNoi: number;
  opexRatio: number;
  rampup: number[];
  rentFreeMonths: number;
  depositInflow: number;      // senior: 입주 시 보증금 유입 (백만원)
  depositModel: boolean;      // true=보증금 회수(분양)형 — cap 매각 대신 보증금이 수입
  notes: Array<{ label: string; text: string; basis: Basis; source?: string }>;
}

function buildOpsModel(input: CashflowInput): OpsModel {
  const d = CATEGORY_DEFAULTS[input.category];
  const notes: OpsModel["notes"] = [];
  const netPy = input.gfaPy * input.efficiency; // 전용면적
  let gor = 0;
  let depositInflow = 0;

  if (input.category === "office" || input.category === "retail") {
    const rent = (input.rentPerPyMonthly ?? 0) * MAN_TO_MM;
    const mgmt = (input.mgmtFeePerPy ?? 0) * MAN_TO_MM;
    const vac = d.vacancy?.value ?? 0.05;
    gor = netPy * (rent + mgmt) * 12 * (1 - vac);
    notes.push({
      label: "임대수입",
      text: `전용 ${Math.round(netPy).toLocaleString()}평 × (임대료 ${input.rentPerPyMonthly}만 + 관리비 ${input.mgmtFeePerPy}만)/평/월 × (1-공실 ${(vac * 100).toFixed(0)}%)`,
      basis: d.rentPerPyMonthly?.basis ?? "추정",
      source: d.rentPerPyMonthly?.source,
    });
  } else if (input.category === "hotel") {
    // 마스터리스 임대인 관점: 임대수입 = 객실매출 × 연동율 (MRG 생략 — 연동만, 보수적)
    const rooms = input.roomCount ?? 0;
    const adrMm = (input.adr ?? 0) / 1_000_000;
    const occ = d.occStabilized?.value ?? 0.88;
    const roomRev = rooms * adrMm * 365 * occ;
    const totalRev = roomRev * (1 + (d.ancillaryRatio?.value ?? 0.25));
    gor = totalRev * (d.roomRevShare?.value ?? 0.38);
    notes.push({
      label: "호텔 임대수입 (마스터리스)",
      text: `객실 ${rooms}실 × ADR ${(input.adr ?? 0).toLocaleString()}원 × OCC ${(occ * 100).toFixed(0)}% × 365일 × (1+부대 ${((d.ancillaryRatio?.value ?? 0) * 100).toFixed(0)}%) × 연동율 ${((d.roomRevShare?.value ?? 0) * 100).toFixed(0)}%`,
      basis: "학습",
      source: "workstay — MAX(MRG, 매출연동)의 연동부만 적용 (보수적)",
    });
  } else {
    // senior: 보증금 운용이익 + 월 이용료
    const units = input.unitCount ?? 0;
    const occ = d.occupancy?.value ?? 0.95;
    const depositTotal = units * (input.depositPerUnit ?? 0) * occ; // 백만원
    const feeRev = units * (input.monthlyFeePerUnit ?? 0) * MAN_TO_MM * 12 * occ;
    const depositRev = depositTotal * (d.depositYield?.value ?? 0.03);
    gor = feeRev + depositRev;
    depositInflow = depositTotal;
    notes.push({
      label: "시니어 수입",
      text: `${units}세대 × 입주율 ${(occ * 100).toFixed(0)}% — 이용료 ${input.monthlyFeePerUnit}만/월 + 보증금 ${((input.depositPerUnit ?? 0) / 100).toFixed(0)}억/세대 × 운용 ${((d.depositYield?.value ?? 0) * 100).toFixed(1)}%`,
      basis: "학습",
      source: "brix730 — 보증금은 입주 시 유입·매각 시 승계(차감). 간이 로직",
    });
  }

  const opexRatio = d.opexRatio.value;
  notes.push({ label: "운영비용", text: `GOR의 ${(opexRatio * 100).toFixed(0)}%`, basis: d.opexRatio.basis, source: d.opexRatio.source });

  return {
    stabilizedGor: gor,
    stabilizedNoi: gor * (1 - opexRatio),
    opexRatio,
    rampup: d.rampup.value,
    rentFreeMonths: d.rentFreeMonths.value,
    depositInflow,
    depositModel: input.category === "senior",
    notes,
  };
}

/* ── TIC 빌드 (금융비용은 시뮬레이션 결과를 주입받아 확정) ── */
function buildTic(input: CashflowInput, financeCost: number, opsModel: OpsModel): { lines: TicLine[]; total: number } {
  const L: TicLine[] = [];
  const push = (category: string, name: string, amount: number, formula: string, basis: Basis, source?: string) => {
    if (Math.abs(amount) < 0.5) return;
    L.push({ category, name, amount: Math.round(amount), formula, basis, source });
  };

  const land = input.landPy * input.landPricePerPy * MAN_TO_MM;
  const isVA = input.devMode === "valueadd";
  push("토지관련비", isVA ? "매입가 (토지+건물)" : "토지비", land, `${input.landPy.toLocaleString()}평 × ${input.landPricePerPy.toLocaleString()}만원/평`, "입력");
  const acqLand = land * RATES.acqTaxLand.value;
  push("토지관련비", "취득세 등", acqLand, `매입가 × 4.6%`, "학습", RATES.acqTaxLand.source);
  push("토지관련비", "채권할인·법무사 등", land * 0.003, "매입가 × 0.3%", "추정", "국민주택채권 5%×할인+법무사 근사");

  const direct = input.gfaPy * input.constCostPerPy * MAN_TO_MM;
  push("공사비(직접)", "도급공사비", direct, `연면적 ${input.gfaPy.toLocaleString()}평 × ${input.constCostPerPy.toLocaleString()}만원/평`, "입력");
  const contingency = direct * RATES.constContingency.value;
  push("공사비(직접)", "공사예비비", contingency, "도급공사비 × 5%", "학습", RATES.constContingency.source);
  const utilConn = input.gfaPy * RATES.utilityConnPerPy.value * MAN_TO_MM;
  push("공사비(직접)", "인입공사비", utilConn, "연면적 × 21만원/평", "학습", RATES.utilityConnPerPy.source);

  const design = input.gfaPy * RATES.designPerPy.value * MAN_TO_MM;
  const supervision = input.gfaPy * RATES.supervisionPerPy.value * MAN_TO_MM;
  push("공사비(간접)", "설계비", design, "연면적 × 25만원/평", "학습", RATES.designPerPy.source);
  push("공사비(간접)", "감리·CM", supervision, "연면적 × 12만원/평", "학습", RATES.supervisionPerPy.source);
  const levies = direct * 0.006;
  push("공사비(간접)", "각종부담금", levies, "도급공사비 × 0.6%", "학습", "soho 374백만/667억 ≈ 0.56%");

  const constTotal = direct + contingency + utilConn + design + supervision + levies;

  // 건물 취득세: 신축=원시취득 3.16% (과표: 공사 관련비 누계), 밸류애드=대수선 2.2% (공사비)
  const acqBldg = isVA
    ? constTotal * RATES.acqTaxRenovation.value
    : (constTotal + financeCost) * RATES.acqTaxBuildingNew.value;
  push("부대비·제세", isVA ? "취득세 (대수선 2.2%)" : "취득세 (원시취득 3.16%)", acqBldg,
    isVA ? "공사비 × 2.2%" : "(공사비+금융비) × 3.16%", "학습",
    isVA ? RATES.acqTaxRenovation.source : RATES.acqTaxBuildingNew.source);
  const projCont = (land + constTotal) * RATES.projContingency.value;
  push("부대비·제세", "사업예비비", projCont, "(토지+공사비) × 1.84%", "학습", RATES.projContingency.source);
  const devMonths = input.permitMonths + input.constMonths;
  const holdingTax = (land + constTotal) * RATES.holdingTaxOnTic.value * (devMonths / 12);
  push("부대비·제세", "개발기간 보유세 등", holdingTax, `(토지+공사비) × 연 0.2% × ${devMonths}개월`, "추정", RATES.holdingTaxOnTic.source);

  const professional = (land + constTotal) * RATES.professionalFees.value;
  push("용역수수료", "법률·세무·감평·시장조사 등", professional, "(토지+공사비) × 0.6%", "추정", RATES.professionalFees.source);

  const amc = (land + constTotal) * RATES.amcMgmtAnnual.value * (devMonths / 12);
  push("SPC·AMC", "AMC 운용보수", amc, `(토지+공사비) × 연 0.5% × ${devMonths}개월`, "학습", RATES.amcMgmtAnnual.source);
  const trust = (land + constTotal) * RATES.trustFee.value;
  push("SPC·AMC", "신탁수수료 등", trust, "(토지+공사비) × 1.5%", "학습", RATES.trustFee.source);

  // 임대안정화 (senior 제외 — 이용료 모델)
  let stabilization = 0;
  if (input.category !== "senior") {
    stabilization = (opsModel.stabilizedGor / 12) * RATES.leasingCommission.value;
    push("임대안정화", "임대수수료", stabilization, "신규계약 월임대료 × 250%", "학습", RATES.leasingCommission.source);
  }

  push("금융비용", "이자·선취·자문 (시뮬레이션)", financeCost, "월별 CF 조달 시뮬레이션 산출", "학습", "Equity 선투입 → Tr.A→B→C 순 인출, 월리=연리/12");

  const total = L.reduce((a, b) => a + b.amount, 0);
  return { lines: L, total };
}

/* ── 월별 시뮬레이션 ── */
interface SimResult {
  monthly: MonthlyCF[];
  interestTotal: number;
  financeCost: number; // 이자 + 선취 + 자문
  equityUsed: number;
  fundingGap: number;
  debtPeak: number;
  opsNoiTotal: number; // 운영기간 누적 NOI (보증금·매각 제외)
  unleveredCfs: number[];
  leveredCfs: number[];
  dscrs: number[];
}

function simulate(input: CashflowInput, tic: number, opsModel: OpsModel, exitCap: number): SimResult {
  const { permitMonths: pm, constMonths: cm, opsMonths: om } = input;
  const total = pm + cm + om;
  const isVA = input.devMode === "valueadd";

  // 조달 한도
  const equityCap = tic * input.equityRatio;
  const tranches = [
    { name: "Tr.A", cap: tic * input.trancheA.amountRatio, rate: input.trancheA.rate, upfront: input.trancheA.upfront, bal: 0 },
    { name: "Tr.B", cap: tic * input.trancheB.amountRatio, rate: input.trancheB.rate, upfront: input.trancheB.upfront, bal: 0 },
    { name: "Tr.C", cap: tic * input.trancheC.amountRatio, rate: input.trancheC.rate, upfront: input.trancheC.upfront, bal: 0 },
  ];

  // ── 지출 스케줄 (금융비 제외 TIC 안분) ──
  const capexByMonth = new Array<number>(total).fill(0);
  const land = input.landPy * input.landPricePerPy * MAN_TO_MM;
  const landCosts = land * (1 + RATES.acqTaxLand.value + 0.003);
  const direct = input.gfaPy * input.constCostPerPy * MAN_TO_MM;
  const constDirect = direct * (1 + RATES.constContingency.value) + input.gfaPy * RATES.utilityConnPerPy.value * MAN_TO_MM;
  const indirect = input.gfaPy * (RATES.designPerPy.value + RATES.supervisionPerPy.value) * MAN_TO_MM + direct * 0.006;
  const constTotal = constDirect + indirect;
  const softMonthly = (land + constTotal) * (RATES.projContingency.value + RATES.holdingTaxOnTic.value * ((pm + cm) / 12) + RATES.professionalFees.value + RATES.amcMgmtAnnual.value * ((pm + cm) / 12) + RATES.trustFee.value) / (pm + cm);
  const acqBldg = isVA ? constTotal * RATES.acqTaxRenovation.value : NaN; // 신축 원시취득은 아래에서 근사 갱신

  // 토지: 신축 = 계약금 10% 1개월차 + 잔금 90% 인허가 종료월 / 밸류애드 = 1개월차 일시
  if (isVA) capexByMonth[0] += landCosts;
  else {
    capexByMonth[0] += landCosts * 0.1;
    capexByMonth[pm - 1] += landCosts * 0.9;
  }
  // 공사비: S-curve
  const sw = sCurveWeights(cm);
  for (let i = 0; i < cm; i++) capexByMonth[pm + i] += constDirect * sw[i] + indirect / cm;
  // 소프트코스트 균등
  for (let i = 0; i < pm + cm; i++) capexByMonth[i] += softMonthly;
  // 건물 취득세: 준공월
  const acqBldgFinal = isVA ? acqBldg : constTotal * RATES.acqTaxBuildingNew.value * 1.1; // 신축 과표에 금융비 일부 포함 근사
  capexByMonth[pm + cm - 1] += acqBldgFinal;
  // 임대안정화: 운영 개시월
  if (input.category !== "senior") capexByMonth[pm + cm] = (capexByMonth[pm + cm] ?? 0) + (opsModel.stabilizedGor / 12) * RATES.leasingCommission.value;

  // 선취·자문 (기표 시점 = 토지 잔금월)
  const drawMonth = isVA ? 0 : pm - 1;
  const upfrontTotal = tranches.reduce((a, t) => a + t.cap * t.upfront, 0)
    + tranches.reduce((a, t) => a + t.cap, 0) * FINANCING_DEFAULTS.advisory.value;
  capexByMonth[drawMonth] += upfrontTotal;

  // ── 운영 수입 ──
  const revByMonth = new Array<number>(total).fill(0);
  const opexByMonth = new Array<number>(total).fill(0);
  const esc = RATES.escalation.value;
  for (let i = 0; i < om; i++) {
    const m = pm + cm + i;
    const opsYear = Math.floor(i / 12);
    const ramp = opsModel.rampup[Math.min(opsYear, opsModel.rampup.length - 1)];
    const rentFree = i < opsModel.rentFreeMonths ? 0 : 1;
    const gorM = (opsModel.stabilizedGor / 12) * ramp * rentFree * Math.pow(1 + esc, opsYear);
    revByMonth[m] = gorM;
    opexByMonth[m] = gorM * opsModel.opexRatio;
  }

  // Exit: forward NOI(N+1) = 안정화 NOI × 물가 (매각 익년)
  const exitYears = Math.ceil(om / 12);
  const fwdNoi = opsModel.stabilizedNoi * Math.pow(1 + esc, exitYears);
  const salePrice = fwdNoi / exitCap;
  const saleCosts = salePrice * (RATES.saleCost.value + RATES.saleBaseFee.value);

  // ── 월별 루프 ──
  const monthly: MonthlyCF[] = [];
  let equityUsed = 0;
  let fundingGap = 0;
  let interestTotal = 0;
  let debtPeak = 0;
  let cash = 0; // 운영 잉여현금 (배당 전 유보)
  let opsNoiTotal = 0;
  const unleveredCfs: number[] = [];
  const leveredCfs: number[] = [];
  const dscrs: number[] = [];

  for (let m = 0; m < total; m++) {
    const phase: MonthlyCF["phase"] = m < pm ? "인허가" : m < pm + cm ? "공사" : m === total - 1 ? "매각" : "운영";
    const capex = capexByMonth[m];
    const rev = revByMonth[m];
    const opex = opexByMonth[m];

    // 이자 (월리 = 연리/12, 매월 지급 간소화)
    let interest = 0;
    for (const t of tranches) interest += t.bal * (t.rate / 12);
    interestTotal += interest;

    // senior 보증금 유입 (운영 개시월) → 고금리 트랜치부터 상환
    let loanRepay = 0;
    let depositIn = 0;
    if (opsModel.depositInflow > 0 && m === pm + cm) {
      depositIn = opsModel.depositInflow;
      let avail = depositIn;
      for (const t of [...tranches].reverse()) {
        const rp = Math.min(t.bal, avail);
        t.bal -= rp; avail -= rp; loanRepay += rp;
      }
      cash += avail;
    }

    // 자금 수지: 지출(capex+이자+운영비) − 수입(rev)
    let need = capex + interest + opex - rev;
    let equityDraw = 0;
    let loanDraw = 0;
    if (need > 0) {
      // 운영 유보현금 → Equity → Tr.A → B → C
      const fromCash = Math.min(cash, need);
      cash -= fromCash; need -= fromCash;
      equityDraw = Math.min(equityCap - equityUsed, need);
      equityUsed += equityDraw; need -= equityDraw;
      for (const t of tranches) {
        if (need <= 0) break;
        const draw = Math.min(t.cap - t.bal, need);
        t.bal += draw; loanDraw += draw; need -= draw;
      }
      if (need > 1e-6) { fundingGap += need; need = 0; } // 조달 부족 — 경고로 표출
    } else {
      cash += -need;
    }

    // 종료월: (yield형) 매각대금으로 대출 상환·보증금 반환 / (보증금형) 매각 없이 잔여현금 정산
    let saleNet = 0;
    if (m === total - 1) {
      // 보증금형은 cap 매각 없음 — 보증금은 입주 시 이미 유입·부채로 잔존, 반환 안 함(간이)
      saleNet = opsModel.depositModel ? 0 : salePrice - saleCosts - opsModel.depositInflow;
      let avail = saleNet + cash;
      cash = 0;
      for (const t of [...tranches].reverse()) {
        const rp = Math.min(t.bal, avail);
        t.bal -= rp; avail -= rp; loanRepay += rp;
      }
      cash = avail; // 잔여 = equity 분배 재원
    }

    const bal = tranches.reduce((a, t) => a + t.bal, 0);
    debtPeak = Math.max(debtPeak, bal);

    // 운영 NOI 누적 (보증금·매각 유입 제외 — rev/opex는 순수 운영수입)
    if (phase === "운영" || phase === "매각") opsNoiTotal += rev - opex;

    // DSCR (운영기간 중 수입 발생월만 — 렌트프리 구간 제외해 의미있는 min 산출)
    if (phase === "운영" && interest > 0 && rev > 0) dscrs.push((rev - opex) / interest);

    // Unlevered: 금융 제거 — capex(선취 제외) + 운영 NOI + (yield형) 매각순대금 + 보증금 유입
    // 보증금형은 매각 없이 보증금(depositIn, 반환 안 함)이 이익 원천
    const capexExFin = capex - (m === drawMonth ? upfrontTotal : 0);
    const exitInflow = m === total - 1 && !opsModel.depositModel ? salePrice - saleCosts - opsModel.depositInflow : 0;
    const unlev = -capexExFin + (rev - opex) + exitInflow + depositIn;
    unleveredCfs.push(unlev);

    // Levered (Equity 관점): 출자 − / 배당 +. 운영 잉여는 매각 시 일괄 분배 간소화
    const lev = -equityDraw + (m === total - 1 ? cash : 0);
    leveredCfs.push(lev);

    monthly.push({
      month: m + 1, phase,
      revenue: Math.round(rev + depositIn + (m === total - 1 && !opsModel.depositModel ? salePrice - saleCosts : 0)),
      opex: Math.round(opex), capex: Math.round(capex - interest < 0 ? capex : capex),
      interest: Math.round(interest), loanDraw: Math.round(loanDraw), loanRepay: Math.round(loanRepay),
      equityDraw: Math.round(equityDraw),
      netCF: Math.round(-capex - interest - opex + rev + loanDraw - loanRepay + equityDraw + depositIn + (m === total - 1 ? salePrice - saleCosts - opsModel.depositInflow : 0)),
      loanBalance: Math.round(bal),
    });
  }

  return {
    monthly, interestTotal,
    financeCost: interestTotal + upfrontTotal,
    equityUsed, fundingGap, debtPeak, opsNoiTotal, unleveredCfs, leveredCfs, dscrs,
  };
}

/* ── 메인: TIC ↔ 금융비 순환 수렴 후 결과 조립 ── */
export function computeCashflow(input: CashflowInput): CashflowResult {
  const opsModel = buildOpsModel(input);

  // 금융비용 순환: TIC → 대출한도 → 이자 → TIC (5회 수렴)
  let financeCost = 0;
  let tic = 0;
  let sim: SimResult | null = null;
  for (let i = 0; i < 5; i++) {
    const t = buildTic(input, financeCost, opsModel);
    tic = t.total;
    sim = simulate(input, tic, opsModel, input.exitCap);
    if (Math.abs(sim.financeCost - financeCost) < 1) { financeCost = sim.financeCost; break; }
    financeCost = sim.financeCost;
  }
  const ticBuild = buildTic(input, financeCost, opsModel);
  tic = ticBuild.total;
  const finalSim = simulate(input, tic, opsModel, input.exitCap)!;

  // Exit 시나리오 (yield형: cap 3안 base±0.5%p / 보증금형: cap 무관 단일)
  const esc = RATES.escalation.value;
  const exitYears = Math.ceil(input.opsMonths / 12);
  const caps = opsModel.depositModel
    ? [input.exitCap]
    : [input.exitCap - 0.005, input.exitCap, input.exitCap + 0.005].filter((c) => c > 0.01);
  const exits: ExitScenario[] = caps.map((cap) => {
    const s = simulate(input, tic, opsModel, cap);
    const fwdNoi = opsModel.stabilizedNoi * Math.pow(1 + esc, exitYears);
    // yield형: 매각가 = forward NOI / cap. 보증금형: 수입 = 보증금총액(반환 안 하는 간이 이익원).
    const salePrice = opsModel.depositModel ? opsModel.depositInflow : fwdNoi / cap;
    const saleCosts = opsModel.depositModel ? 0 : salePrice * (RATES.saleCost.value + RATES.saleBaseFee.value);
    // 사업이익 = (매각순대금 or 보증금수입) + 운영 누적 NOI − 총사업비.
    const profit = (salePrice - saleCosts) + s.opsNoiTotal - tic;
    const uIrr = irr(s.unleveredCfs);
    const lIrr = irr(s.leveredCfs);
    const eqIn = s.leveredCfs.filter((c) => c < 0).reduce((a, b) => a - b, 0);
    const eqOut = s.leveredCfs.filter((c) => c > 0).reduce((a, b) => a + b, 0);
    return {
      cap, salePrice: Math.round(salePrice), saleCosts: Math.round(saleCosts),
      netProceeds: Math.round(salePrice - saleCosts),
      profit: Math.round(profit),
      profitMargin: tic > 0 ? profit / tic : 0,
      unleveredIrr: uIrr, leveredIrr: lIrr,
      equityMultiple: eqIn > 0 ? eqOut / eqIn : null,
    };
  });

  // 연간 운영 테이블
  const yearlyOps: YearlyOps[] = [];
  for (let y = 0; y < Math.ceil(input.opsMonths / 12); y++) {
    const ramp = opsModel.rampup[Math.min(y, opsModel.rampup.length - 1)];
    const months = Math.min(12, input.opsMonths - y * 12);
    const rfAdj = y === 0 ? Math.max(0, months - opsModel.rentFreeMonths) / months : 1;
    const gor = opsModel.stabilizedGor * (months / 12) * ramp * rfAdj * Math.pow(1 + esc, y);
    yearlyOps.push({
      year: y + 1, gor: Math.round(gor),
      opex: Math.round(gor * opsModel.opexRatio),
      noi: Math.round(gor * (1 - opsModel.opexRatio)),
      rampup: ramp,
    });
  }

  // 경고
  const warnings: string[] = [];
  if (finalSim.fundingGap > 0) warnings.push(`조달 부족 ${Math.round(finalSim.fundingGap).toLocaleString()}백만원 — Equity 비율 또는 트랜치 한도를 올리세요.`);
  const dscrMin = finalSim.dscrs.length ? Math.min(...finalSim.dscrs) : null;
  if (dscrMin !== null && dscrMin < 1) warnings.push(`운영기간 최소 DSCR ${dscrMin.toFixed(2)} < 1.0 — 램프업 구간 이자 부족 (soho도 min 0.887, 학습 모델 관행상 매각차익으로 해소).`);
  if (input.category === "senior") warnings.push("시니어는 간이 로직(보증금 승계 차감형) — 분양형 정밀 모델(계좌 워터폴)은 model-spec.md §4 참조.");
  const estimated = ticBuild.lines.filter((l) => l.basis === "추정").map((l) => l.name);
  if (estimated.length) warnings.push(`추정 항목(학습 근거 없음): ${estimated.join(", ")} — 실제 견적으로 검증 필요.`);

  const tranches = [
    { name: "Tr.A", amount: Math.round(tic * input.trancheA.amountRatio), rate: input.trancheA.rate, upfront: input.trancheA.upfront },
    { name: "Tr.B", amount: Math.round(tic * input.trancheB.amountRatio), rate: input.trancheB.rate, upfront: input.trancheB.upfront },
    { name: "Tr.C", amount: Math.round(tic * input.trancheC.amountRatio), rate: input.trancheC.rate, upfront: input.trancheC.upfront },
  ].filter((t) => t.amount > 0);
  const totalDebt = tranches.reduce((a, t) => a + t.amount, 0);

  return {
    input,
    assumptions: opsModel.notes,
    tic: ticBuild.lines,
    ticTotal: Math.round(tic),
    ticPerGfaPy: Math.round((tic / input.gfaPy) * 100), // 만원/평
    financing: {
      equity: Math.round(finalSim.equityUsed),
      tranches, totalDebt,
      ltc: totalDebt / tic,
      interestTotal: Math.round(finalSim.interestTotal),
    },
    yearlyOps,
    stabilizedNoi: Math.round(opsModel.stabilizedNoi),
    yieldOnCost: opsModel.stabilizedNoi / tic,
    dscr: finalSim.dscrs.length
      ? { min: Math.min(...finalSim.dscrs), avg: finalSim.dscrs.reduce((a, b) => a + b, 0) / finalSim.dscrs.length }
      : null,
    exits,
    monthly: finalSim.monthly,
    warnings,
  };
}
