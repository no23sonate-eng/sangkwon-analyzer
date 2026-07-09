/* ── 시설군 테이블 (건축법 시행령 별표1 용도분류 기반) ──

   규모검토에서 다루는 10개 시설군. 각 시설은:
   - 근거 법령(law) · 용도지역 허용성(zone matrix) · 주차 원단위(서울 조례)
   - 계획 계수(전용률·코어·층고·적층순서) · 유닛 기본값(평)
   - 시설별 법적 유의사항(notes) — 규모검토 시 자동 표출

   주차(서울 주차장 조례 별표2 기준, 시설면적=지상연면적 근사):
   공동주택 세대당(전용면적 구간별) · 도시형생활주택 완화 · 오피스텔 실당 ·
   업무/판매 100㎡ · 근생 134㎡ · 숙박 200㎡ · 운동 100㎡당 1대
*/

import type { ZoneKey, UseKey, Allowance } from "./use-zones";

export type FacilityKey =
  | "apt" | "urban_house" | "officetel" | "office"
  | "retail1" | "retail2" | "sales"
  | "tourist_hotel" | "stay_hotel" | "sports";

export interface FacilityDef {
  key: FacilityKey;
  label: string;
  law: string; // 근거 법령
  rentGroup: UseKey; // 사업성·색상 폴백 그룹
  color: string;
  efficiency: number; // 전용/임대율
  coreRatio: number;
  floorHeight: number;
  stackOrder: number; // 저층(작음)→고층
  parkingBasis: "unit" | "area";
  parkingPerUnit?: number; // 유닛(세대·실)당 대수
  parkingUnitM2?: number; // 시설면적 ㎡/대
  unitLabel?: string; // 세대·실·호
  defaultUnitPy?: number; // 유닛 기본 전용면적(평)
  notes: string[]; // 법적 유의사항(자동 표출)
}

export const FACILITIES: Record<FacilityKey, FacilityDef> = {
  apt: {
    key: "apt", label: "공동주택(아파트·다세대)", law: "주택법·건축법 별표1 2호",
    rentGroup: "residential", color: "#5b6bf5",
    efficiency: 0.75, coreRatio: 0.13, floorHeight: 2.9, stackOrder: 6,
    parkingBasis: "unit", unitLabel: "세대", defaultUnitPy: 18,
    notes: [
      "30세대 이상 → 주택법 §15 사업계획승인 대상(단순 건축허가 아님)",
      "채광사선(높이 ≤ 인접대지경계선 거리×2)·2개동 이상 인동거리 0.5배 — 본 엔진 미반영, 배치 확인 필수 (영 §86③)",
      "주차: 세대당 전용 30㎡↓ 0.5 / 60㎡↓ 0.8 / 초과 1.0대 (서울조례)",
    ],
  },
  urban_house: {
    key: "urban_house", label: "도시형생활주택(소형)", law: "주택법 §2·시행령 §10",
    rentGroup: "residential", color: "#8b93f8",
    efficiency: 0.72, coreRatio: 0.14, floorHeight: 2.9, stackOrder: 5,
    parkingBasis: "unit", parkingPerUnit: 0.5, unitLabel: "세대", defaultUnitPy: 9,
    notes: [
      "전용 60㎡ 이하·300세대 미만 한정, 아파트(소형 제외)와 복합 제한",
      "주차 완화: 세대당 0.5대 내외(전용 30㎡↓, 조례) — 상업·준주거 추가 완화 가능",
      "일조 사선은 일반 공동주택과 동일 적용, 인동거리 0.25배 완화",
    ],
  },
  officetel: {
    key: "officetel", label: "오피스텔", law: "건축법 별표1 14호(업무시설)·오피스텔 건축기준(국토부 고시)",
    rentGroup: "office", color: "#22b8d6",
    efficiency: 0.55, coreRatio: 0.16, floorHeight: 3.0, stackOrder: 4,
    parkingBasis: "unit", parkingPerUnit: 0.8, unitLabel: "실", defaultUnitPy: 8,
    notes: [
      "법적으로 업무시설(준주택) — 주거지역 중 일부만 허용, 발코니 설치 불가",
      "전용률 50~60%로 낮음(분양면적 대비) — 본 엔진 55% 기본",
      "주차: 실당 0.5~1.0대(전용면적 구간·조례) — 기본 0.8대/실 적용",
    ],
  },
  office: {
    key: "office", label: "업무시설(오피스)", law: "건축법 별표1 14호",
    rentGroup: "office", color: "#1466ff",
    efficiency: 0.72, coreRatio: 0.16, floorHeight: 4.0, stackOrder: 3,
    parkingBasis: "area", parkingUnitM2: 100, unitLabel: "구획", defaultUnitPy: 50,
    notes: ["시설면적 100㎡당 1대(서울조례)", "일반업무시설 3천㎡ 초과 시 교통유발부담금·교통영향평가 검토"],
  },
  retail1: {
    key: "retail1", label: "제1종 근린생활시설", law: "건축법 별표1 3호",
    rentGroup: "retail", color: "#ffa92e",
    efficiency: 0.80, coreRatio: 0.10, floorHeight: 4.5, stackOrder: 1,
    parkingBasis: "area", parkingUnitM2: 134, unitLabel: "호", defaultUnitPy: 20,
    notes: [
      "용도별 바닥면적 상한 있음: 소매점·휴게음식점 1,000/300㎡ 미만 등 — 호당 규모 확인",
      "대부분 용도지역에서 허용(주거지역 포함) — 저층부 표준 상품",
    ],
  },
  retail2: {
    key: "retail2", label: "제2종 근린생활시설", law: "건축법 별표1 4호",
    rentGroup: "retail", color: "#ff8a1e",
    efficiency: 0.80, coreRatio: 0.10, floorHeight: 4.5, stackOrder: 2,
    parkingBasis: "area", parkingUnitM2: 134, unitLabel: "호", defaultUnitPy: 30,
    notes: [
      "일반음식점·학원(500㎡ 미만)·주점 등 — 주거지역은 용도·규모 제한 확인",
      "단란주점(150㎡ 미만)·안마시술소 등은 지역별 불허 많음",
    ],
  },
  sales: {
    key: "sales", label: "판매시설", law: "건축법 별표1 7호·유통산업발전법",
    rentGroup: "retail", color: "#ff6a3d",
    efficiency: 0.78, coreRatio: 0.12, floorHeight: 5.0, stackOrder: 1,
    parkingBasis: "area", parkingUnitM2: 100, unitLabel: "구획", defaultUnitPy: 100,
    notes: [
      "매장면적 3,000㎡ 이상 → 대규모점포 등록(유통산업발전법) + 교통영향평가",
      "근생 상한(1,000㎡)을 넘는 소매는 판매시설로 분류됨",
    ],
  },
  tourist_hotel: {
    key: "tourist_hotel", label: "관광호텔", law: "관광진흥법 §4·건축법 별표1 15호",
    rentGroup: "hotel", color: "#ff5c8a",
    efficiency: 0.65, coreRatio: 0.15, floorHeight: 3.3, stackOrder: 3,
    parkingBasis: "area", parkingUnitM2: 200, unitLabel: "객실", defaultUnitPy: 8,
    notes: [
      "관광숙박업 등록 필요(관광진흥법) — 객실 30실 이상 등 등급별 기준",
      "교육환경보호구역(학교경계 200m) 내는 심의 필요 — 대상지 학교 인접 여부 확인(교육환경법 §9)",
      "부대시설(로비·F&B·연회) 비중 커서 객실부 전용률 낮음(65% 기본)",
    ],
  },
  stay_hotel: {
    key: "stay_hotel", label: "일반·생활숙박시설", law: "공중위생관리법 §2·건축법 별표1 15호",
    rentGroup: "hotel", color: "#ff7fa6",
    efficiency: 0.65, coreRatio: 0.15, floorHeight: 3.1, stackOrder: 3,
    parkingBasis: "area", parkingUnitM2: 200, unitLabel: "객실", defaultUnitPy: 7,
    notes: [
      "⚠ 생활숙박시설은 주거 사용 불가 — 숙박업 신고 의무(미신고 시 이행강제금). 분양형 상품 리스크 확인",
      "숙박업 신고(공중위생관리법) + 주거지역 원칙 불허",
      "교육환경보호구역 내 숙박업 제한 — 학교 인접 확인",
    ],
  },
  sports: {
    key: "sports", label: "운동시설(체육시설)", law: "체육시설법·건축법 별표1 13호",
    rentGroup: "retail", color: "#12b886",
    efficiency: 0.80, coreRatio: 0.10, floorHeight: 5.5, stackOrder: 2,
    parkingBasis: "area", parkingUnitM2: 100, unitLabel: "면", defaultUnitPy: 150,
    notes: [
      "체육시설업 신고/등록(체육시설법 §10~) — 골프연습장·수영장 등 업종별 시설·안전 기준",
      "층고 큼(5.5m 기본) — 스크린골프 4.5m·수영장 6m+ 등 업종별 조정 필요",
      "골프연습장 주차는 타석당 산정(조례) — 본 엔진은 100㎡/대 근사",
    ],
  },
};

export const FACILITY_KEYS = Object.keys(FACILITIES) as FacilityKey[];

/* ── 용도지역 × 시설 허용 매트릭스 ── (건축법 시행령 별표2~22 요지, 초기검토용) */
const A: Allowance = "allowed", C: Allowance = "conditional", N: Allowance = "notAllowed";
type Row = Record<FacilityKey, Allowance>;
const M = (apt: Allowance, uh: Allowance, ot: Allowance, of: Allowance, r1: Allowance, r2: Allowance, sa: Allowance, th: Allowance, sh: Allowance, sp: Allowance): Row =>
  ({ apt, urban_house: uh, officetel: ot, office: of, retail1: r1, retail2: r2, sales: sa, tourist_hotel: th, stay_hotel: sh, sports: sp });

export const FACILITY_MATRIX: Record<ZoneKey, Row> = {
  res1_exclusive:         M(C, N, N, N, C, N, N, N, N, N),
  res2_exclusive:         M(A, C, N, N, C, C, N, N, N, N),
  res1_general:           M(A, A, N, N, A, C, N, N, N, C),
  res2_general:           M(A, A, C, C, A, A, N, N, N, C),
  res3_general:           M(A, A, C, C, A, A, N, N, N, C),
  semi_residential:       M(A, A, A, A, A, A, C, C, N, A),
  central_commercial:     M(C, C, A, A, A, A, A, A, A, A),
  general_commercial:     M(A, A, A, A, A, A, A, A, A, A),
  neighborhood_commercial:M(A, A, A, A, A, A, C, C, C, A),
  distribution_commercial:M(N, N, C, C, A, A, A, C, C, C),
  exclusive_industrial:   M(N, N, N, C, C, C, N, N, N, C),
  general_industrial:     M(C, C, C, C, A, A, C, N, N, C),
  semi_industrial:        M(C, C, A, A, A, A, A, C, C, A),
  conservation_green:     M(C, N, N, N, C, N, N, N, N, N),
  production_green:       M(C, N, N, N, C, C, N, N, N, C),
  natural_green:          M(C, N, N, N, C, C, N, C, C, C),
};

export function facilityAllowance(zone: ZoneKey, f: FacilityKey): Allowance {
  return FACILITY_MATRIX[zone][f];
}

/** 공동주택 세대당 주차(서울조례, 전용면적 구간) */
export function aptStallsPerUnit(unitNetM2: number): number {
  if (unitNetM2 <= 30) return 0.5;
  if (unitNetM2 <= 60) return 0.8;
  return 1.0;
}
