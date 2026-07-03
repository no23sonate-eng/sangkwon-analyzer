/* ── 사업성 개략 검토 ──

   볼륨 스터디의 용도별 순사용면적 × 임대시세 → 수익·자산가치·수익률.
   기준(상권분석기 컨설팅 표준과 동일):
   - 임대료 단위: 만원/평/월 (순사용면적 기준)
   - 캡레이트 시나리오: 4.5% / 5.0% / 5.5% 3종 모두 산출
   - 보증금: 월 임대료 × N개월 (용도별 기본 — 리테일 12 / 오피스·주거·호텔 10)

   ⚠ 개략치: 공실률·운영비(NOI 보정)·금융비 미반영. 호텔은 마스터리스
     임대 가정(운영수익 모델 아님). 컨설팅 초기 스크리닝용.
*/

import type { VolumeStudy } from "./volume-study";
import type { UseKey } from "./use-zones";

export const CAP_RATES = [4.5, 5.0, 5.5];

const DEFAULT_DEPOSIT_MONTHS: Record<UseKey, number> = {
  residential: 10, office: 10, retail: 12, hotel: 10,
};

export interface EconomicsInput {
  /** 용도별 임대료 (만원/평/월, 순면적 기준). 없는 용도는 수익 제외 */
  rents: Partial<Record<UseKey, number>>;
  /** 공사비 (만원/평, 지상+지하 연면적 기준). 미입력 시 사업비 생략 */
  constructionCostPerPyeong?: number;
  /** 토지비 (억원) */
  landCostEok?: number;
  /** 설계·감리·금융 등 부대비 % (공사비 대비, 기본 10) */
  softCostPct?: number;
}

export interface EconomicsResult {
  perUse: Array<{ use: UseKey; label: string; netPyeong: number; rent: number; monthlyManwon: number }>;
  monthlyRentManwon: number;
  annualRentEok: number;
  depositEok: number;
  /** 캡레이트별 자산가치 (억) */
  valueAtCap: Array<{ cap: number; valueEok: number }>;
  /** 사업비 (공사비 입력 시) */
  gfaTotalPyeong: number;
  constructionEok?: number;
  totalCostEok?: number;
  yieldOnCostPct?: number;
  /** 가치(@5.0%) − 총사업비 */
  marginEok?: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function computeEconomics(study: VolumeStudy, input: EconomicsInput): EconomicsResult | null {
  const perUse: EconomicsResult["perUse"] = [];
  let monthly = 0; // 만원/월
  let depositManwon = 0;

  for (const u of study.uses) {
    const rent = input.rents[u.use];
    if (!rent || rent <= 0) continue;
    const netPyeong = u.netAreaM2 / 3.3058;
    const m = netPyeong * rent;
    monthly += m;
    depositManwon += m * (DEFAULT_DEPOSIT_MONTHS[u.use] ?? 10);
    perUse.push({ use: u.use, label: u.label, netPyeong: Math.round(netPyeong), rent, monthlyManwon: Math.round(m) });
  }
  if (perUse.length === 0) return null;

  const annualEok = (monthly * 12) / 10_000;
  const valueAtCap = CAP_RATES.map((cap) => ({ cap, valueEok: r1(annualEok / (cap / 100)) }));

  // 사업비
  const gfaTotalPyeong = (study.massing.effectiveGfaAboveM2 + study.parking.parkingAreaM2) / 3.3058;
  let constructionEok: number | undefined;
  let totalCostEok: number | undefined;
  let yieldOnCostPct: number | undefined;
  let marginEok: number | undefined;
  if (input.constructionCostPerPyeong && input.constructionCostPerPyeong > 0) {
    const soft = 1 + (input.softCostPct ?? 10) / 100;
    constructionEok = r1((gfaTotalPyeong * input.constructionCostPerPyeong * soft) / 10_000);
    totalCostEok = r1(constructionEok + (input.landCostEok ?? 0));
    if (totalCostEok > 0) {
      yieldOnCostPct = r1((annualEok / totalCostEok) * 100);
      marginEok = r1(annualEok / 0.05 - totalCostEok);
    }
  }

  return {
    perUse,
    monthlyRentManwon: Math.round(monthly),
    annualRentEok: r1(annualEok),
    depositEok: r1(depositManwon / 10_000),
    valueAtCap,
    gfaTotalPyeong: Math.round(gfaTotalPyeong),
    constructionEok, totalCostEok, yieldOnCostPct, marginEok,
  };
}
