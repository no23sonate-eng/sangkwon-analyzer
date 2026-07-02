/* ── 건축 볼륨 스터디 엔진 ──

   입력: 대지면적 + 용도지역 + 용도 믹스(주거/오피스/리테일/호텔 %)
   출력: 법규 검토(건폐율·용적률·주차·일조)를 반영한 볼륨 —
        용도별 지상 연면적·순사용면적·주차대수·층수·세대수 + 사업규모 요약.

   산출 기준: 서울시 도시계획/주차장 조례 적용값(면적 위주).
   순서:
     1) 용도지역 → 건폐율·용적률 → 건축면적·지상 연면적 상한
     2) 정북 일조(주거지역, 대지 형상 입력 시) → 봉투 연면적으로 상한 보정
     3) 용도 믹스로 지상 연면적 배분 → 용도별 순면적·세대수
     4) 주차장법 → 소요 주차대수 → 지하 주차 면적·층수(용적률 제외)
     5) 용도별 순사용면적 랭킹("어떤 용도가 면적이 가장 잘 나오는가")

   ⚠ 초기 검토용 개략치. 지구단위계획·가로구역별 최고높이·인동거리·
     대지안의공지 세부·주차 완화 등은 미반영. 인허가 도서 대체 불가.
*/

import { ZONES, getUseAllowance, type ZoneKey, type UseKey } from "./use-zones";
import {
  PROGRAMS, USE_KEYS, PYEONG_M2, DEFAULT_STALL_AREA_M2,
  DEFAULT_AVG_UNIT_AREA_M2, DEFAULT_AVG_ROOM_NET_M2, residentialStallsPerUnit, m2ToPyeong,
} from "./programs";
import { solarEnvelope, type SolarResult, type SolarSkipped } from "./solar-setback";
import { buildFloorStack, type FloorStack, type StackUseInfo } from "./floor-stack";

export interface VolumeOptions {
  useSeoulOrdinance?: boolean; // true(기본): 서울 조례값 / false: 법정 상한
  bcrOverride?: number; // 건폐율 % 직접 지정 (지구단위계획 등)
  farOverride?: number; // 용적률 % 직접 지정
  heightLimitM?: number; // 가로구역별 최고높이 등 (있으면 층수 캡)
  avgUnitAreaM2?: number; // 주거 평균 전용면적
  avgRoomAreaM2?: number; // 호텔 객실 평균 순면적(전용)
  parkingStallAreaM2?: number; // 대당 주차소요면적
  // 정북 일조 정밀 계산용 대지 형상 (없으면 주거지역 일조 미적용 경고)
  northLotWidthM?: number;
  lotDepthM?: number;
}

export interface UseResult {
  use: UseKey;
  label: string;
  sharePct: number; // 믹스 비율
  gfaAboveM2: number; // 배분된 지상 연면적
  netAreaM2: number; // 순사용면적 (전용/임대)
  netAreaLabel: string;
  gfaAbovePyeong: number;
  netAreaPyeong: number;
  units?: number; // 주거 세대수
  rooms?: number; // 호텔 객실수
  floors?: number; // 이 용도가 차지하는 지상 층수
  parkingStalls: number;
  allowance: "allowed" | "conditional" | "notAllowed";
  allowanceNote?: string;
}

export interface VolumeStudy {
  input: {
    siteAreaM2: number;
    siteAreaPyeong: number;
    zoneKey: ZoneKey;
    zoneName: string;
    mix: Partial<Record<UseKey, number>>;
  };
  regulation: {
    appliedBCR: number; // %
    appliedFAR: number; // %
    basis: "서울시 조례" | "법정 상한" | "직접 지정";
    legalMaxBCR: number;
    legalMaxFAR: number;
    seoulBCR: number;
    seoulFAR: number;
  };
  massing: {
    footprintM2: number; // 건축면적 (건폐율)
    maxGfaAboveM2: number; // 용적률 지상 연면적 상한
    effectiveGfaAboveM2: number; // 일조 보정 후 실제 확보 연면적
    floorsAbove: number; // 예상 지상 층수
    buildingHeightM: number;
    footprintPyeong: number;
    maxGfaAbovePyeong: number;
    effectiveGfaAbovePyeong: number;
  };
  parking: {
    requiredStalls: number;
    stallAreaM2: number;
    parkingAreaM2: number; // 지하 주차 총면적
    basementFloors: number; // 주차 지하 층수(개략)
  };
  solar: SolarResult | SolarSkipped;
  uses: UseResult[];
  stack: FloorStack; // 층별 적층 계획 + 기준층 편면
  totals: {
    netAreaM2: number; // 전체 순사용면적 합
    netAreaPyeong: number;
    totalUnits: number;
    totalRooms: number;
  };
  warnings: string[];
}

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** 믹스 정규화: 합이 100이 되도록. 빈 값이면 균등 배분 아님 — 명시된 것만 사용 */
function normalizeMix(mix: Partial<Record<UseKey, number>>): Record<UseKey, number> {
  const entries = USE_KEYS.map((k) => [k, Math.max(0, mix[k] ?? 0)] as const);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const out = {} as Record<UseKey, number>;
  for (const [k, v] of entries) out[k] = sum > 0 ? (v / sum) * 100 : 0;
  return out;
}

export function computeVolumeStudy(
  siteAreaM2: number,
  zoneKey: ZoneKey,
  mix: Partial<Record<UseKey, number>>,
  options: VolumeOptions = {},
): VolumeStudy {
  const zone = ZONES[zoneKey];
  const warnings: string[] = [];
  const useSeoul = options.useSeoulOrdinance ?? true;

  // ── 1. 건폐율·용적률 결정 ──
  let appliedBCR = useSeoul ? zone.seoulBCR : zone.legalMaxBCR;
  let appliedFAR = useSeoul ? zone.seoulFAR : zone.legalMaxFAR;
  let basis: VolumeStudy["regulation"]["basis"] = useSeoul ? "서울시 조례" : "법정 상한";
  if (options.bcrOverride != null || options.farOverride != null) {
    if (options.bcrOverride != null) appliedBCR = options.bcrOverride;
    if (options.farOverride != null) appliedFAR = options.farOverride;
    basis = "직접 지정";
  }

  const footprintM2 = siteAreaM2 * (appliedBCR / 100);
  const maxGfaAboveM2 = siteAreaM2 * (appliedFAR / 100);

  // ── 2. 정북 일조 보정 (주거지역 & 대지 형상 입력 시) ──
  const normMix = normalizeMix(mix);
  const weightedFloorHeight =
    USE_KEYS.reduce((s, k) => s + PROGRAMS[k].floorHeight * (normMix[k] / 100), 0) || 3.5;
  const groundFloorHeightM = Math.max(weightedFloorHeight, 4.0); // 1층은 상업/로비로 높게

  let effectiveGfaAboveM2 = maxGfaAboveM2;
  let solar: SolarResult | SolarSkipped;

  if (zone.solarRegulated) {
    if (options.northLotWidthM && options.lotDepthM) {
      const env = solarEnvelope({
        northLotWidthM: options.northLotWidthM,
        lotDepthM: options.lotDepthM,
        groundFloorHeightM,
        floorHeightM: weightedFloorHeight,
        footprintCapM2: footprintM2,
        farGfaM2: maxGfaAboveM2,
      });
      solar = env;
      effectiveGfaAboveM2 = Math.min(maxGfaAboveM2, env.gfaM2);
      if (env.limitedBySolar && env.gfaM2 < maxGfaAboveM2) {
        warnings.push(
          `정북 일조 사선으로 지상 연면적이 용적률 상한(${round(m2ToPyeong(maxGfaAboveM2))}평) 대비 ` +
          `약 ${round(m2ToPyeong(maxGfaAboveM2 - env.gfaM2))}평 감소했습니다.`,
        );
      }
    } else {
      solar = {
        applied: false,
        reason: "정북 일조 사선 적용 지역이나 대지 형상(북측 폭·남북 깊이) 미입력 — 일조 감소 미반영. 실제 연면적은 더 작을 수 있습니다.",
      };
      warnings.push(solar.reason);
    }
  } else {
    solar = { applied: false, reason: "정북 일조 사선 미적용 용도지역" };
  }

  // ── 3. 지상 층수·건물 높이 (일조 봉투가 있으면 그 값 우선) ──
  let floorsAbove: number;
  let buildingHeightM: number;
  if (solar.applied) {
    floorsAbove = solar.floors;
    buildingHeightM = solar.buildingHeightM;
  } else {
    floorsAbove = Math.max(1, Math.round(effectiveGfaAboveM2 / Math.max(footprintM2, 1)));
    buildingHeightM = round1(groundFloorHeightM + (floorsAbove - 1) * weightedFloorHeight);
  }
  // 가로구역별 최고높이 등 캡
  if (options.heightLimitM && buildingHeightM > options.heightLimitM) {
    const cappedFloors = Math.max(
      1,
      Math.floor((options.heightLimitM - groundFloorHeightM) / weightedFloorHeight) + 1,
    );
    if (cappedFloors < floorsAbove) {
      floorsAbove = cappedFloors;
      const cappedGfa = Math.min(effectiveGfaAboveM2, footprintM2 * floorsAbove);
      warnings.push(
        `높이제한 ${options.heightLimitM}m 적용 → 지상 ${floorsAbove}층으로 제한, ` +
        `연면적 약 ${round(m2ToPyeong(cappedGfa))}평.`,
      );
      effectiveGfaAboveM2 = cappedGfa;
      buildingHeightM = round1(groundFloorHeightM + (floorsAbove - 1) * weightedFloorHeight);
    }
  }

  // ── 4. 용도 믹스 배분 → 용도별 순면적·세대수·객실수·주차 ──
  const avgUnit = options.avgUnitAreaM2 ?? DEFAULT_AVG_UNIT_AREA_M2;
  const avgRoom = options.avgRoomAreaM2 ?? DEFAULT_AVG_ROOM_NET_M2;
  const stallArea = options.parkingStallAreaM2 ?? DEFAULT_STALL_AREA_M2;

  const uses: UseResult[] = [];
  const stackUses: StackUseInfo[] = [];
  let totalNetM2 = 0;
  let totalUnits = 0;
  let totalRooms = 0;
  let totalStalls = 0;

  for (const use of USE_KEYS) {
    const sharePct = normMix[use];
    if (sharePct <= 0) continue;
    const prog = PROGRAMS[use];
    const gfaAbove = effectiveGfaAboveM2 * (sharePct / 100);
    const netArea = gfaAbove * prog.efficiency;

    let units: number | undefined;
    let rooms: number | undefined;
    let stalls: number;
    if (prog.parkingBasis === "unit") {
      // 주거: 세대수 = 전용면적 합 / 평균 전용면적
      units = Math.floor(netArea / avgUnit);
      stalls = Math.ceil(units * residentialStallsPerUnit(avgUnit));
    } else {
      // 시설면적(지상 연면적) 원단위
      stalls = Math.ceil(gfaAbove / (prog.parkingUnitM2 ?? 100));
    }
    if (use === "hotel") rooms = Math.floor(netArea / avgRoom);

    // 편면(층당 세대·객실) 산정 모듈 — 옵션 반영
    const countModuleM2 =
      use === "residential" ? avgUnit : use === "hotel" ? avgRoom : prog.countModuleM2;

    const { allowance, note } = getUseAllowance(zoneKey, use);
    if (allowance === "notAllowed") {
      warnings.push(`[${prog.label}] ${zone.name}에서 원칙적으로 불허 — ${note}`);
    } else if (allowance === "conditional") {
      warnings.push(`[${prog.label}] ${zone.name} 조건부 허용 — ${note}`);
    }

    totalNetM2 += netArea;
    totalUnits += units ?? 0;
    totalRooms += rooms ?? 0;
    totalStalls += stalls;

    uses.push({
      use,
      label: prog.label,
      sharePct: round1(sharePct),
      gfaAboveM2: round(gfaAbove),
      netAreaM2: round(netArea),
      netAreaLabel: prog.netAreaLabel,
      gfaAbovePyeong: round(m2ToPyeong(gfaAbove)),
      netAreaPyeong: round(m2ToPyeong(netArea)),
      units,
      rooms,
      parkingStalls: stalls,
      allowance,
      allowanceNote: note,
    });

    stackUses.push({
      use, label: prog.label, gfaAboveM2: gfaAbove, efficiency: prog.efficiency,
      coreRatio: prog.coreRatio, floorHeightM: prog.floorHeight, stackOrder: prog.stackOrder,
      countModuleM2, countLabel: prog.countLabel,
    });
  }

  // ── 5. 주차 → 지하 면적·층수 ──
  const parkingAreaM2 = totalStalls * stallArea;
  const basementFloors = footprintM2 > 0 ? Math.ceil(parkingAreaM2 / footprintM2) : 0;

  // ── 6. 층별 적층 계획 + 기준층 편면 → 층수·높이 확정 ──
  // 정북 일조 봉투가 계산됐으면 층별 바닥면적(계단식 후퇴)을 그대로 적층에 사용
  const solarPlates = solar.applied ? solar.floorFootprints : undefined;
  const stack = buildFloorStack({
    footprintM2, uses: stackUses, groundFloorHeightM,
    basementFloors, parkingAreaM2, stallAreaM2: stallArea,
    floorPlatesM2: solarPlates,
  });
  // 적층 결과를 지상 층수·건물높이의 확정값으로 사용(스탯카드·표 일관성)
  if (stack.floorsAbove > 0) {
    floorsAbove = stack.floorsAbove;
    buildingHeightM = stack.buildingHeightM;
  }
  // 용도별 지상 층수 주입
  for (const u of uses) {
    u.floors = stack.typicalFloors.find((t) => t.use === u.use)?.floors ?? 0;
  }

  return {
    input: {
      siteAreaM2: round(siteAreaM2),
      siteAreaPyeong: round(m2ToPyeong(siteAreaM2)),
      zoneKey,
      zoneName: zone.name,
      mix: normMix,
    },
    regulation: {
      appliedBCR, appliedFAR, basis,
      legalMaxBCR: zone.legalMaxBCR, legalMaxFAR: zone.legalMaxFAR,
      seoulBCR: zone.seoulBCR, seoulFAR: zone.seoulFAR,
    },
    massing: {
      footprintM2: round(footprintM2),
      maxGfaAboveM2: round(maxGfaAboveM2),
      effectiveGfaAboveM2: round(effectiveGfaAboveM2),
      floorsAbove,
      buildingHeightM,
      footprintPyeong: round(m2ToPyeong(footprintM2)),
      maxGfaAbovePyeong: round(m2ToPyeong(maxGfaAboveM2)),
      effectiveGfaAbovePyeong: round(m2ToPyeong(effectiveGfaAboveM2)),
    },
    parking: {
      requiredStalls: totalStalls,
      stallAreaM2: stallArea,
      parkingAreaM2: round(parkingAreaM2),
      basementFloors,
    },
    solar,
    uses,
    stack,
    totals: {
      netAreaM2: round(totalNetM2),
      netAreaPyeong: round(m2ToPyeong(totalNetM2)),
      totalUnits,
      totalRooms,
    },
    warnings,
  };
}

/* ── 단일용도 랭킹: "어떤 용도가 면적이 가장 잘 나오는가" ──
   각 용도 100% 케이스를 돌려 순사용면적 기준 정렬.
   허용 불가(notAllowed) 용도는 penalized 표시하되 참고용으로 계산은 포함.
*/
export interface UseRanking {
  use: UseKey;
  label: string;
  netAreaM2: number;
  netAreaPyeong: number;
  gfaAboveM2: number;
  units?: number;
  parkingStalls: number;
  allowance: "allowed" | "conditional" | "notAllowed";
  efficiency: number;
}

export function rankSingleUses(
  siteAreaM2: number,
  zoneKey: ZoneKey,
  options: VolumeOptions = {},
): UseRanking[] {
  const rankings: UseRanking[] = USE_KEYS.map((use) => {
    const study = computeVolumeStudy(siteAreaM2, zoneKey, { [use]: 100 }, options);
    const u = study.uses[0];
    return {
      use,
      label: PROGRAMS[use].label,
      netAreaM2: u?.netAreaM2 ?? 0,
      netAreaPyeong: u?.netAreaPyeong ?? 0,
      gfaAboveM2: u?.gfaAboveM2 ?? 0,
      units: u?.units,
      parkingStalls: u?.parkingStalls ?? 0,
      allowance: u?.allowance ?? "notAllowed",
      efficiency: PROGRAMS[use].efficiency,
    };
  });

  // 허용>조건부>불허 우선, 같은 등급 내에서는 순면적 큰 순
  const rank = { allowed: 0, conditional: 1, notAllowed: 2 };
  return rankings.sort((a, b) => {
    if (rank[a.allowance] !== rank[b.allowance]) return rank[a.allowance] - rank[b.allowance];
    return b.netAreaM2 - a.netAreaM2;
  });
}

export { PYEONG_M2 };
