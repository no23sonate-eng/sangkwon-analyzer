/* ── 시설 프로그램 규모검토 엔진 (면적·유닛 지정 모드) ──

   각 시설의 목표 연면적(평) 또는 유닛(전용 평 × 개수)을 지정하면:
   1) 필요 연면적 합산 → 용적률 가용 연면적과 대조(초과 시 마지막 항목 클램프+경고)
   2) 정북 일조 봉투(주거지역) 반영 층별 적층
   3) 시설별 주차(세대·실당 / 시설면적 원단위) 합산 → 지하층
   4) 유닛 달성 수량(목표 대비) · 층당 유닛 수 산출
   5) 시설별 법적 유의사항(관광진흥법·주택법·체육시설법 등) 자동 표출

   반환은 VolumeStudy와 구조 호환(uses[].use=rentGroup) — 기존 UI·사업성·
   법규 체크리스트가 그대로 동작한다.
*/

import { ZONES, type ZoneKey } from "./use-zones";
import { PYEONG_M2, m2ToPyeong } from "./programs";
import { solarEnvelope } from "./solar-setback";
import { buildFloorStack, type StackUseInfo } from "./floor-stack";
import {
  FACILITIES, facilityAllowance, aptStallsPerUnit, type FacilityKey,
} from "./facilities";
import type { VolumeStudy, VolumeOptions, UseResult } from "./volume-study";

export interface Allocation {
  facility: FacilityKey;
  /** 유닛 전용면적(평). 미지정 시 시설 기본값 */
  unitPy?: number;
  /** 목표 유닛 수 — 지정 시 필요 연면적을 역산 */
  unitCount?: number;
  /** 목표 지상 연면적(평) — unitCount 미지정 시 사용. 0/미지정+fillRemainder면 잔여 전부 */
  targetGfaPy?: number;
  /** true면 남는 용적률 전부 배정 */
  fillRemainder?: boolean;
}

export interface ProgramRow {
  facility: FacilityKey;
  label: string;
  unitPy: number;
  requestedUnits?: number;
  achievedUnits: number; // 실제 수용 유닛
  unitsPerFloor: number;
  gfaPy: number; // 배정 지상 연면적(평)
  netPy: number; // 전용/임대(평)
  floors: number;
  stalls: number;
  allowance: "allowed" | "conditional" | "notAllowed";
  clamped: boolean; // 용적률 부족으로 축소됨
  notes: string[];
}

export interface FacilityStudy extends VolumeStudy {
  programRows: ProgramRow[];
  capacity: { maxGfaPy: number; usedGfaPy: number; remainingGfaPy: number };
}

const r0 = Math.round;

export function computeFacilityStudy(
  siteAreaM2: number,
  zoneKey: ZoneKey,
  allocations: Allocation[],
  options: VolumeOptions = {},
): FacilityStudy {
  const zone = ZONES[zoneKey];
  const warnings: string[] = [];

  // ── 1. 건폐율·용적률 ──
  const appliedBCR = options.bcrOverride ?? zone.seoulBCR;
  const appliedFAR = options.farOverride ?? zone.seoulFAR;
  const basis = options.bcrOverride != null || options.farOverride != null ? "직접 지정" : "서울시 조례";
  const footprintM2 = siteAreaM2 * appliedBCR / 100;
  const maxGfaM2 = siteAreaM2 * appliedFAR / 100;

  // ── 2. 정북 일조 봉투 (가중 층고: 배정 비중 근사 — 대표 층고 사용) ──
  const defs = allocations.map((a) => FACILITIES[a.facility]);
  const avgFloorH = defs.length ? defs.reduce((s, d) => s + d.floorHeight, 0) / defs.length : 3.5;
  const groundH = Math.max(avgFloorH, 4.0);
  let effGfaM2 = maxGfaM2;
  let solar: VolumeStudy["solar"];
  if (zone.solarRegulated) {
    if (options.northLotWidthM && options.lotDepthM) {
      const env = solarEnvelope({
        northLotWidthM: options.northLotWidthM, lotDepthM: options.lotDepthM,
        groundFloorHeightM: groundH, floorHeightM: avgFloorH,
        footprintCapM2: footprintM2, farGfaM2: maxGfaM2,
      });
      solar = env;
      effGfaM2 = Math.min(maxGfaM2, env.gfaM2);
      if (env.limitedBySolar && env.gfaM2 < maxGfaM2)
        warnings.push(`정북 일조 사선으로 가용 연면적이 약 ${r0(m2ToPyeong(maxGfaM2 - env.gfaM2))}평 감소.`);
    } else {
      solar = { applied: false, reason: "정북 일조 적용 지역 — 대지 형상(북측 폭·남북 깊이) 미입력, 감소 미반영" };
      warnings.push(solar.reason);
    }
  } else {
    solar = { applied: false, reason: "정북 일조 미적용 용도지역" };
  }
  const maxGfaPy = m2ToPyeong(effGfaM2);

  // ── 3. 배정: 요청 연면적 산출 → 잔여 클램프 ──
  const rows: ProgramRow[] = [];
  const stackUses: StackUseInfo[] = [];
  const uses: UseResult[] = [];
  let usedGfaM2 = 0;
  let totalStalls = 0, totalUnits = 0, totalRooms = 0, totalNetM2 = 0;

  for (const a of allocations) {
    const d = FACILITIES[a.facility];
    const unitPy = a.unitPy && a.unitPy > 0 ? a.unitPy : (d.defaultUnitPy ?? 20);
    const unitNetM2 = unitPy * PYEONG_M2;

    // 요청 연면적(㎡)
    let reqGfaM2: number;
    if (a.unitCount && a.unitCount > 0) {
      reqGfaM2 = (a.unitCount * unitNetM2) / d.efficiency;
    } else if (a.fillRemainder || !a.targetGfaPy) {
      reqGfaM2 = Math.max(0, effGfaM2 - usedGfaM2);
    } else {
      reqGfaM2 = a.targetGfaPy * PYEONG_M2;
    }

    const remaining = Math.max(0, effGfaM2 - usedGfaM2);
    const gfaM2 = Math.min(reqGfaM2, remaining);
    const clamped = gfaM2 < reqGfaM2 - 0.5;
    if (clamped) warnings.push(`[${d.label}] 용적률 부족 — 요청 ${r0(m2ToPyeong(reqGfaM2))}평 중 ${r0(m2ToPyeong(gfaM2))}평만 배정.`);
    usedGfaM2 += gfaM2;
    if (gfaM2 <= 0.5) {
      rows.push({ facility: a.facility, label: d.label, unitPy, requestedUnits: a.unitCount, achievedUnits: 0, unitsPerFloor: 0, gfaPy: 0, netPy: 0, floors: 0, stalls: 0, allowance: facilityAllowance(zoneKey, a.facility), clamped: true, notes: d.notes });
      continue;
    }

    const netM2 = gfaM2 * d.efficiency;
    const achievedUnits = Math.floor(netM2 / unitNetM2);
    if (a.unitCount && achievedUnits < a.unitCount)
      warnings.push(`[${d.label}] 목표 ${a.unitCount}${d.unitLabel} 중 ${achievedUnits}${d.unitLabel}만 수용 가능.`);

    // 주차
    let stalls: number;
    if (d.parkingBasis === "unit") {
      const per = d.parkingPerUnit ?? aptStallsPerUnit(unitNetM2);
      stalls = Math.ceil(achievedUnits * per);
    } else {
      stalls = Math.ceil(gfaM2 / (d.parkingUnitM2 ?? 100));
    }

    const allowance = facilityAllowance(zoneKey, a.facility);
    if (allowance === "notAllowed") warnings.push(`[${d.label}] ${zone.name}에서 원칙적 불허 — 용도지역 확인 필수.`);
    else if (allowance === "conditional") warnings.push(`[${d.label}] ${zone.name} 조건부 — 규모·조례 확인.`);

    totalStalls += stalls;
    totalNetM2 += netM2;
    if (d.rentGroup === "residential") totalUnits += achievedUnits;
    if (d.rentGroup === "hotel") totalRooms += achievedUnits;

    rows.push({
      facility: a.facility, label: d.label, unitPy,
      requestedUnits: a.unitCount, achievedUnits,
      unitsPerFloor: 0, gfaPy: r0(m2ToPyeong(gfaM2)), netPy: r0(m2ToPyeong(netM2)),
      floors: 0, stalls, allowance, clamped, notes: d.notes,
    });
    stackUses.push({
      use: a.facility, label: d.label, gfaAboveM2: gfaM2,
      efficiency: d.efficiency, coreRatio: d.coreRatio,
      floorHeightM: d.floorHeight, stackOrder: d.stackOrder,
      countModuleM2: unitNetM2, countLabel: d.unitLabel,
    });
    uses.push({
      use: d.rentGroup, label: d.label, sharePct: 0,
      gfaAboveM2: r0(gfaM2), netAreaM2: r0(netM2), netAreaLabel: "전용/임대",
      gfaAbovePyeong: r0(m2ToPyeong(gfaM2)), netAreaPyeong: r0(m2ToPyeong(netM2)),
      units: d.rentGroup === "residential" ? achievedUnits : undefined,
      rooms: d.rentGroup === "hotel" ? achievedUnits : undefined,
      parkingStalls: stalls, allowance,
    });
  }
  uses.forEach((u) => { u.sharePct = usedGfaM2 > 0 ? Math.round((u.gfaAboveM2 / usedGfaM2) * 1000) / 10 : 0; });

  // ── 4. 적층 + 지하주차 ──
  const stallArea = options.parkingStallAreaM2 ?? 30;
  const parkingAreaM2 = totalStalls * stallArea;
  const basementFloors = footprintM2 > 0 ? Math.ceil(parkingAreaM2 / footprintM2) : 0;
  const solarPlates = solar.applied ? solar.floorFootprints : undefined;
  const stack = buildFloorStack({
    footprintM2, uses: stackUses, groundFloorHeightM: groundH,
    basementFloors, parkingAreaM2, stallAreaM2: stallArea,
    floorPlatesM2: solarPlates,
  });
  for (const row of rows) {
    const t = stack.typicalFloors.find((x) => x.use === row.facility);
    row.floors = t?.floors ?? 0;
    row.unitsPerFloor = t?.countPerFloor ?? 0;
  }
  const i2u = new Map(rows.map((r) => [r.facility, uses.find((u) => u.label === r.label)]));
  rows.forEach((r) => { const u = i2u.get(r.facility); if (u) u.floors = r.floors; });

  // 1종일반주거 4층 제한
  if (zoneKey === "res1_general" && stack.floorsAbove > 4)
    warnings.push(`제1종일반주거 4층 제한 초과(산출 ${stack.floorsAbove}층) — 서울 조례상 4층 이하로 재배분 필요.`);

  return {
    input: { siteAreaM2: r0(siteAreaM2), siteAreaPyeong: r0(m2ToPyeong(siteAreaM2)), zoneKey, zoneName: zone.name, mix: {} },
    regulation: {
      appliedBCR, appliedFAR, basis: basis as VolumeStudy["regulation"]["basis"],
      legalMaxBCR: zone.legalMaxBCR, legalMaxFAR: zone.legalMaxFAR,
      seoulBCR: zone.seoulBCR, seoulFAR: zone.seoulFAR,
    },
    massing: {
      footprintM2: r0(footprintM2), maxGfaAboveM2: r0(maxGfaM2), effectiveGfaAboveM2: r0(usedGfaM2),
      floorsAbove: stack.floorsAbove, buildingHeightM: stack.buildingHeightM,
      footprintPyeong: r0(m2ToPyeong(footprintM2)), maxGfaAbovePyeong: r0(maxGfaPy),
      effectiveGfaAbovePyeong: r0(m2ToPyeong(usedGfaM2)),
    },
    parking: { requiredStalls: totalStalls, stallAreaM2: stallArea, parkingAreaM2: r0(parkingAreaM2), basementFloors },
    solar, uses, stack,
    totals: { netAreaM2: r0(totalNetM2), netAreaPyeong: r0(m2ToPyeong(totalNetM2)), totalUnits, totalRooms },
    warnings,
    programRows: rows,
    capacity: {
      maxGfaPy: r0(maxGfaPy),
      usedGfaPy: r0(m2ToPyeong(usedGfaM2)),
      remainingGfaPy: r0(Math.max(0, maxGfaPy - m2ToPyeong(usedGfaM2))),
    },
  };
}
