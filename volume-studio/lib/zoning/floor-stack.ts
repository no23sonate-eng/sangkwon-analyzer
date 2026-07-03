/* ── 층별 적층 계획 (Stacking) + 기준층 편면 + 코어 분리 ──

   볼륨(용도별 지상 연면적)을 실제 "몇 개 층"으로 쌓는지 층 단위로 전개한다.
   - 적층 순서: 리테일(저층 가로변) → 오피스 → 호텔 → 주거(고층) — stackOrder 기준
   - 각 층 바닥면적 = 건축면적(footprint)을 상한으로 용도별 잔여 연면적을 채움
   - 바닥면적 구성 분리: 전용/임대(efficiency) + 코어(coreRatio) + 공용복도(나머지)
   - 층고는 용도별 값(1층은 로비/리테일로 높게), 누적높이로 건물 전체 높이 산정
   - 편면(기준층 평면): 층당 순면적 ÷ 세대·객실 모듈 = 층당 세대/객실 수

   floorPlatesM2 (선택): 정북 일조 사선 봉투의 층별 바닥면적(하부→상부).
   주어지면 층별 바닥면적을 이 값으로 고정 → 상부층이 계단식으로 후퇴(stepped).

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
  coreM2: number; // 코어(계단·EV·화장실·PS)
  serviceM2: number; // 공용복도 등
  count?: number; // 세대/객실 수 (해당 층)
  countLabel?: string;
  stalls?: number; // 주차층 대수
  floorHeightM: number;
  topHeightM: number; // 지상 기준 해당 층 상단 누적높이
}

export interface StackUseInfo {
  use: UseKey;
  label: string;
  gfaAboveM2: number;
  efficiency: number;
  coreRatio: number;
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
  netPerFloorM2: number; // 기준층 순면적(전용/임대)
  netPerFloorPyeong: number;
  coreM2: number; // 기준층 코어
  serviceM2: number; // 기준층 공용복도
  efficiency: number;
  coreRatio: number;
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
  stepped: boolean; // 정북 일조 사선으로 상부층 후퇴 반영 여부
  typicalFloors: TypicalFloor[];
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const py = (m2: number) => Math.round(m2 / PYEONG_M2);

export function buildFloorStack(params: {
  footprintM2: number;
  uses: StackUseInfo[];
  groundFloorHeightM: number;
  basementFloors: number;
  parkingAreaM2: number;
  stallAreaM2: number;
  floorPlatesM2?: number[]; // 일조 봉투 층별 바닥면적(하부→상부)
}): FloorStack {
  const { footprintM2, groundFloorHeightM, basementFloors, parkingAreaM2, stallAreaM2, floorPlatesM2 } = params;
  const uses = [...params.uses].sort((a, b) => a.stackOrder - b.stackOrder);

  const above: FloorRow[] = [];
  let cumH = 0;
  const perUseFloors = new Map<UseKey, number>();

  const pushFloor = (u: StackUseInfo, plate: number, isGround: boolean) => {
    const level = above.length + 1;
    const h = isGround ? groundFloorHeightM : u.floorHeightM;
    const net = plate * u.efficiency;
    const core = plate * u.coreRatio;
    const service = Math.max(0, plate - net - core);
    const count = u.countModuleM2 ? Math.floor(net / u.countModuleM2) : undefined;
    cumH = r1(cumH + h);
    above.push({
      level: `${level}F`, n: level, use: u.use, useLabel: u.label,
      plateM2: r0(plate), platePyeong: py(plate),
      netM2: r0(net), netPyeong: py(net),
      coreM2: r0(core), serviceM2: r0(service),
      count, countLabel: u.countLabel,
      floorHeightM: h, topHeightM: cumH,
    });
    perUseFloors.set(u.use, (perUseFloors.get(u.use) ?? 0) + 1);
  };

  const stepped = !!(floorPlatesM2 && floorPlatesM2.length);

  if (stepped) {
    // 일조 봉투: 층별 바닥면적 고정, 용도 순서대로 채움 (각 층은 한 용도)
    let ui = 0;
    let remaining = uses[ui]?.gfaAboveM2 ?? 0;
    for (let i = 0; i < floorPlatesM2!.length; i++) {
      while (ui < uses.length && remaining <= 0) { ui++; remaining = uses[ui]?.gfaAboveM2 ?? 0; }
      const u = uses[ui];
      if (!u) break;
      const plate = floorPlatesM2![i];
      if (plate <= 0) break;
      pushFloor(u, plate, i === 0);
      remaining -= plate;
    }
  } else {
    for (const u of uses) {
      let rem = u.gfaAboveM2;
      while (rem > 1 && above.length < 200) {
        pushFloor(u, Math.min(footprintM2, rem), above.length === 0);
        rem -= footprintM2;
      }
    }
  }

  // ── 지하 주차 적층 ──
  const below: FloorRow[] = [];
  let bRemaining = parkingAreaM2;
  for (let bi = 1; bi <= basementFloors; bi++) {
    const plate = Math.min(footprintM2, bRemaining);
    bRemaining -= plate;
    below.push({
      level: `B${bi}`, n: -bi, use: "parking", useLabel: "주차",
      plateM2: r0(plate), platePyeong: py(plate),
      netM2: r0(plate), netPyeong: py(plate),
      coreM2: 0, serviceM2: 0,
      stalls: Math.floor(plate / stallAreaM2), floorHeightM: 3.5, topHeightM: 0,
    });
  }

  // ── 기준층 편면 요약 (건축면적 기준 대표 층) ──
  const typicalFloors: TypicalFloor[] = uses.map((u) => {
    const plate = footprintM2;
    const net = plate * u.efficiency;
    const core = plate * u.coreRatio;
    const service = Math.max(0, plate - net - core);
    return {
      use: u.use, label: u.label, floors: perUseFloors.get(u.use) ?? 0,
      plateM2: r0(plate), platePyeong: py(plate),
      netPerFloorM2: r0(net), netPerFloorPyeong: py(net),
      coreM2: r0(core), serviceM2: r0(service),
      efficiency: u.efficiency, coreRatio: u.coreRatio,
      countPerFloor: u.countModuleM2 ? Math.floor(net / u.countModuleM2) : undefined,
      countLabel: u.countLabel, moduleM2: u.countModuleM2,
      floorHeightM: u.floorHeightM,
    };
  });

  return {
    above, below,
    floorsAbove: above.length,
    floorsBelow: below.length,
    buildingHeightM: cumH,
    stepped,
    typicalFloors,
  };
}
