/* ── 용도별 프로그램 파라미터 (건축 계획 원단위) ──

   초기 볼륨 스터디용 표준 계획 계수. 실제 설계에서 프로젝트별로 달라지므로
   options 로 오버라이드 가능하게 설계한다.

   efficiency : 전용률/임대효율 = 순사용면적(전용·임대) ÷ 해당 용도 지상 연면적
                (코어·복도·공용 제외 후 실제 쓸 수 있는 면적 비율)
   floorHeight: 층고(m, floor-to-floor). 층수·건물높이 산정에 사용
   parkingUnitM2 : 시설면적당 주차 1대 원단위(㎡/대). 주거는 세대 기준이라 별도.
*/

import type { UseKey } from "./use-zones";

export const PYEONG_M2 = 3.3058; // 1평 = 3.3058㎡

export interface ProgramDef {
  key: UseKey;
  label: string;
  efficiency: number; // 전용률/임대효율
  floorHeight: number; // 층고 (m)
  // 주차: 'unit' = 주거(세대 기준), 'area' = 시설면적 원단위
  parkingBasis: "unit" | "area";
  parkingUnitM2?: number; // area 방식일 때 ㎡/대
  netAreaLabel: string; // 순면적 표기 라벨
  // 편면(기준층 평면) 산정용: 순면적을 이 모듈로 나눠 층당 세대·객실 수 산출
  countLabel?: string; // "세대" | "객실"
  countModuleM2?: number; // 세대/객실 1개당 순면적(㎡) 기본값
  stackOrder: number; // 적층 순서(작을수록 저층). 리테일→오피스→호텔→주거
  // 바닥면적 구성: 코어(계단·EV·화장실·PS) 비율. 나머지 = 공용(복도) + 전용/임대.
  //   전용/임대(efficiency) + 코어(coreRatio) + 공용복도 = 1.0
  coreRatio: number;
}

// 층 바닥면적 구성 = 전용/임대(efficiency) + 코어(coreRatio) + 공용복도(나머지)
export const PROGRAMS: Record<UseKey, ProgramDef> = {
  residential: {
    key: "residential", label: "주거", efficiency: 0.75, floorHeight: 2.9,
    parkingBasis: "unit", netAreaLabel: "전용면적",
    countLabel: "세대", countModuleM2: 60, stackOrder: 4, coreRatio: 0.13,
  },
  office: {
    key: "office", label: "오피스", efficiency: 0.72, floorHeight: 4.0,
    parkingBasis: "area", parkingUnitM2: 100, netAreaLabel: "임대면적", stackOrder: 2,
    coreRatio: 0.16,
  },
  retail: {
    key: "retail", label: "리테일", efficiency: 0.80, floorHeight: 4.5,
    parkingBasis: "area", parkingUnitM2: 134, netAreaLabel: "임대면적", stackOrder: 1,
    coreRatio: 0.10,
  },
  hotel: {
    key: "hotel", label: "호텔", efficiency: 0.65, floorHeight: 3.3,
    parkingBasis: "area", parkingUnitM2: 200, netAreaLabel: "객실부문 순면적",
    countLabel: "객실", countModuleM2: 26, stackOrder: 3, coreRatio: 0.15,
  },
};

export const USE_KEYS: UseKey[] = ["residential", "office", "retail", "hotel"];

/* ── 주차 원단위 (서울특별시 주차장 설치 및 관리 조례 별표2 요지) ──

   업무시설       : 시설면적 100㎡당 1대
   판매시설       : 시설면적 100㎡당 1대 (근린생활시설은 134㎡당 1대 → 리테일 기본값)
   숙박시설       : 시설면적 200㎡당 1대
   공동주택       : 세대당 주차대수 = 전용면적 규모별 계수 (아래 표)
   ※ 도시형생활주택(원룸형)·역세권 청년주택 등은 완화. 본 엔진 기본값은 일반 기준.

   대당 주차소요면적: 자주식 기준 대략 30㎡/대(주차구획+차로).
   기계식·부설 조건에 따라 25~40㎡ 편차. options.parkingStallAreaM2 로 조정.
*/
export const DEFAULT_STALL_AREA_M2 = 30;

// 공동주택 세대당 주차대수 (전용면적 구간별) — 서울시 조례 근사
export function residentialStallsPerUnit(avgUnitAreaM2: number): number {
  if (avgUnitAreaM2 <= 30) return 0.5;
  if (avgUnitAreaM2 <= 60) return 0.8;
  return 1.0;
}

// 주거 세대 산정용 기본 평균 전용면적(㎡)
export const DEFAULT_AVG_UNIT_AREA_M2 = 60;

// 호텔 객실 1실당 순면적(전용, ㎡) — 편면 객실수 산정 기본값. 비즈니스호텔 표준.
export const DEFAULT_AVG_ROOM_NET_M2 = 26;

export const m2ToPyeong = (m2: number) => m2 / PYEONG_M2;
export const pyeongToM2 = (py: number) => py * PYEONG_M2;
