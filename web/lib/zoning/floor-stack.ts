/* ── 층별 적층 계획 (Stacking) + 기준층 편면 산정 ──

   볼륨(용도별 지상 연면적)을 실제 "몇 개 층"으로 쌓는지 층 단위로 전개한다.
   - 적층 순서: 리테일(저층 가로변) → 오피스 → 호텔 → 주거(고층) — stackOrder 기준
   - 각 층 바닥면적 = 건축면적(footprint)을 상한으로, 용도별 잔여 연면적을 채움
   - 층고는 용도별 값을 사용(1층은 로비/리테일로 높게), 누적높이로 건물 전체 높이 산정
   - 편면(기준층 평면): 층당 순면적 ÷ 세대·객실 모듈 = 층당 세대/객실 수

   지하는 주차 소요면적을 건축면적으로 나눠 B1..Bn 으로 전개.
*/

import { PYEONG_M2 } from "./programs";
import type { UseKey } from "./use-zones";

export interface FloorRow {
  level: string; // "5F" | "B2"
  n: number; // 지상 양수(1,2..), 지하 음수(-1,-2..)
  use: UseKey | "parking";
  useLabel: string;
  plateM2: number; // 해당 층 바닥면적
  platePyeong: number;
  netM2: number; // 순사용면적(전용/임대) — 주차층은 주차면적
  netPyeong: number;
  count?: number; // 세대/객실 수 (해당 층)
  countLabel?: string; // "세대" | "객실"
  stalls?: number; // 주차층 대수
  floorHeightM: number;
  topHeightM: number; // 지상 기준 해당 층 상단 누적높이
}

export interface StackUseInfo {
  use: UseKey;
  label: string;
  gfaAboveM2: number;
  efficiency: number;
  floorHeightM: number;
  stackOrder: number;
  countModuleM2?: number;
  countLabel?: string;
}

export interface TypicalFloor {
  use: UseKey;
  label: string;
  floors: number; // 이 용도가 차지하는 층 수
  plateM2: number; // 기준층 바닥면적
  platePyeong: number;
  netPerFloorM2: number; // 기준층 순면적
  netPerFloorPyeong: number;
  countPerFloor?: number; // 기준층 세대/객실 수
  countLabel?: string;
  moduleM2?: number; // 세대/객실 1개 순면적
  floorHeightM: number;
}

export interface FloorStack {
  above: FloorRow[]; // 1F → 최상층
  below: FloorRow[]; // B1 → Bn
  floorsAbove: number;
  floorsBelow: number;
  buildingHeightM: number; // 지상 전체 높이
  typicalFloors: TypicalFloor[];
}

const r0 = (n: number) => Math.round(n);
const py = (m2: number) => Math.round(m2 / PYEONG_M2);

export function buildFloorStack(params: {
  footprintM2: number;
  uses: StackUseInfo[];
  groundFloorHeightM: number;
  basementFloors: number;
  parkingAreaM2: number;
  stallAreaM2: number;
}): FloorStack {
  const { footprintM2, groundFloorHeightM, basementFloors, parkingAreaM2, stallAreaM2 } = params;
  const uses = [...params.uses].sort((a, b) => a.stackOrder - b.stackOrder);

  // ── 지상 적층 ──
  const above: FloorRow[] = [];
  let level = 0;
  let cumH = 0;
  const perUseFloors = new Map<UseKey, number>();

  for (const u of uses) {
    let remaining = u.gfaAboveM2;
    while (remaining > 1 && level < 200) {
      level++;
      const plate = Math.min(footprintM2, remaining);
      const h = level === 1 ? groundFloorHeightM : u.floorHeightM;
      const net = plate * u.efficiency;
      const count = u.countModuleM2 ? Math.floor(net / u.countModuleM2) : undefined;
      cumH = Math.round((cumH + h) * 10) / 10;
      above.push({
        level: `${level}F`, n: level, use: u.use, useLabel: u.label,
        plateM2: r0(plate), platePyeong: py(plate),
        netM2: r0(net), netPyeong: py(net),
        count, countLabel: u.countLabel,
        floorHeightM: h, topHeightM: cumH,
      });
      perUseFloors.set(u.use, (perUseFloors.get(u.use) ?? 0) + 1);
      remaining -= plate;
    }
  }

  // ── 지하 주차 적층 ──
  const below: FloorRow[] = [];
  let bRemaining = parkingAreaM2;
  for (let bi = 1; bi <= basementFloors; bi++) {
    const plate = Math.min(footprintM2, bRemaining);
    bRemaining -= plate;
    const stalls = Math.floor(plate / stallAreaM2);
    below.push({
      level: `B${bi}`, n: -bi, use: "parking", useLabel: "주차",
      plateM2: r0(plate), platePyeong: py(plate),
      netM2: r0(plate), netPyeong: py(plate),
      stalls, floorHeightM: 3.5, topHeightM: 0,
    });
  }

  // ── 기준층 편면 요약 ──
  const typicalFloors: TypicalFloor[] = uses.map((u) => {
    const floors = perUseFloors.get(u.use) ?? 0;
    const plate = footprintM2;
    const netPerFloor = plate * u.efficiency;
    const countPerFloor = u.countModuleM2 ? Math.floor(netPerFloor / u.countModuleM2) : undefined;
    return {
      use: u.use, label: u.label, floors,
      plateM2: r0(plate), platePyeong: py(plate),
      netPerFloorM2: r0(netPerFloor), netPerFloorPyeong: py(netPerFloor),
      countPerFloor, countLabel: u.countLabel, moduleM2: u.countModuleM2,
      floorHeightM: u.floorHeightM,
    };
  });

  return {
    above, below,
    floorsAbove: above.length,
    floorsBelow: below.length,
    buildingHeightM: cumH,
    typicalFloors,
  };
}
