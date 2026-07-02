/* ── 용도지역 테이블 (서울시 도시계획조례 기준) ──

   건폐율·용적률: 국토계획법 시행령 상한(legalMaxBCR/legalMaxFAR)과
   서울특별시 도시계획조례 적용값(seoulBCR/seoulFAR)을 함께 보관한다.
   볼륨 스터디 산출은 서울 조례 적용값을 기본으로 사용하고,
   상한값은 참고(지구단위계획·완화 검토용)로 표시한다.

   출처:
   - 국토의 계획 및 이용에 관한 법률 시행령 §84(건폐율)·§85(용적률)
   - 서울특별시 도시계획 조례 §54(건폐율)·§55(용적률)
   ※ 도심부·역세권·지구단위계획구역 등은 별도 완화/강화가 적용될 수 있어
     실제 인허가 시 반드시 해당 구역 지침을 확인해야 한다.

   solarRegulated: 정북방향 일조 사선(건축법 시행령 §86②)이 적용되는
   전용주거·일반주거지역 여부. 준주거·상업·공업은 정북일조 미적용
   (단 공동주택은 인동거리 별도 규정 — 본 엔진 미반영).
*/

export type ZoneKey =
  | "res1_exclusive"
  | "res2_exclusive"
  | "res1_general"
  | "res2_general"
  | "res3_general"
  | "semi_residential"
  | "central_commercial"
  | "general_commercial"
  | "neighborhood_commercial"
  | "distribution_commercial"
  | "exclusive_industrial"
  | "general_industrial"
  | "semi_industrial"
  | "conservation_green"
  | "production_green"
  | "natural_green";

export interface ZoneDef {
  key: ZoneKey;
  name: string; // 한글 용도지역명
  group: "residential" | "commercial" | "industrial" | "green";
  legalMaxBCR: number; // 국토계획법 시행령 상한 건폐율 (%)
  legalMaxFAR: number; // 국토계획법 시행령 상한 용적률 (%)
  seoulBCR: number; // 서울시 조례 적용 건폐율 (%)
  seoulFAR: number; // 서울시 조례 적용 용적률 (%)
  solarRegulated: boolean; // 정북 일조 사선 적용 지역
  note?: string;
}

export const ZONES: Record<ZoneKey, ZoneDef> = {
  res1_exclusive: {
    key: "res1_exclusive", name: "제1종전용주거지역", group: "residential",
    legalMaxBCR: 50, legalMaxFAR: 100, seoulBCR: 50, seoulFAR: 100,
    solarRegulated: true, note: "단독주택 중심. 공동주택은 연립·다세대 등 조건부",
  },
  res2_exclusive: {
    key: "res2_exclusive", name: "제2종전용주거지역", group: "residential",
    legalMaxBCR: 50, legalMaxFAR: 150, seoulBCR: 40, seoulFAR: 120,
    solarRegulated: true,
  },
  res1_general: {
    key: "res1_general", name: "제1종일반주거지역", group: "residential",
    legalMaxBCR: 60, legalMaxFAR: 200, seoulBCR: 60, seoulFAR: 150,
    solarRegulated: true, note: "4층 이하 규모 제한(조례)",
  },
  res2_general: {
    key: "res2_general", name: "제2종일반주거지역", group: "residential",
    legalMaxBCR: 60, legalMaxFAR: 250, seoulBCR: 60, seoulFAR: 200,
    solarRegulated: true,
  },
  res3_general: {
    key: "res3_general", name: "제3종일반주거지역", group: "residential",
    legalMaxBCR: 50, legalMaxFAR: 300, seoulBCR: 50, seoulFAR: 250,
    solarRegulated: true,
  },
  semi_residential: {
    key: "semi_residential", name: "준주거지역", group: "residential",
    legalMaxBCR: 70, legalMaxFAR: 500, seoulBCR: 60, seoulFAR: 400,
    solarRegulated: false, note: "정북일조 미적용(상업·업무 혼합 허용)",
  },
  central_commercial: {
    key: "central_commercial", name: "중심상업지역", group: "commercial",
    legalMaxBCR: 90, legalMaxFAR: 1500, seoulBCR: 60, seoulFAR: 1000,
    solarRegulated: false, note: "도심부 등 구역별 용적률 차등(800~1000)",
  },
  general_commercial: {
    key: "general_commercial", name: "일반상업지역", group: "commercial",
    legalMaxBCR: 80, legalMaxFAR: 1300, seoulBCR: 60, seoulFAR: 800,
    solarRegulated: false, note: "도심부 600 등 구역별 차등",
  },
  neighborhood_commercial: {
    key: "neighborhood_commercial", name: "근린상업지역", group: "commercial",
    legalMaxBCR: 70, legalMaxFAR: 900, seoulBCR: 60, seoulFAR: 600,
    solarRegulated: false,
  },
  distribution_commercial: {
    key: "distribution_commercial", name: "유통상업지역", group: "commercial",
    legalMaxBCR: 80, legalMaxFAR: 1100, seoulBCR: 60, seoulFAR: 600,
    solarRegulated: false,
  },
  exclusive_industrial: {
    key: "exclusive_industrial", name: "전용공업지역", group: "industrial",
    legalMaxBCR: 70, legalMaxFAR: 300, seoulBCR: 60, seoulFAR: 200,
    solarRegulated: false,
  },
  general_industrial: {
    key: "general_industrial", name: "일반공업지역", group: "industrial",
    legalMaxBCR: 70, legalMaxFAR: 350, seoulBCR: 60, seoulFAR: 200,
    solarRegulated: false,
  },
  semi_industrial: {
    key: "semi_industrial", name: "준공업지역", group: "industrial",
    legalMaxBCR: 70, legalMaxFAR: 400, seoulBCR: 60, seoulFAR: 400,
    solarRegulated: false, note: "성수·문래 등. 오피스·지식산업센터 활발",
  },
  conservation_green: {
    key: "conservation_green", name: "보전녹지지역", group: "green",
    legalMaxBCR: 20, legalMaxFAR: 80, seoulBCR: 20, seoulFAR: 50,
    solarRegulated: true,
  },
  production_green: {
    key: "production_green", name: "생산녹지지역", group: "green",
    legalMaxBCR: 20, legalMaxFAR: 100, seoulBCR: 20, seoulFAR: 50,
    solarRegulated: true,
  },
  natural_green: {
    key: "natural_green", name: "자연녹지지역", group: "green",
    legalMaxBCR: 20, legalMaxFAR: 100, seoulBCR: 20, seoulFAR: 50,
    solarRegulated: true,
  },
};

export const ZONE_LIST: ZoneDef[] = Object.values(ZONES);

/* ── 용도지역 × 건축용도 허용 매트릭스 ──
   건축법 시행령 별표2~22(용도지역 안에서의 건축물 건축제한) 요지를 단순화.
   allowed  : 원칙적으로 허용
   conditional: 규모·조례·심의 조건부 허용(도시형생활주택, 근생 범위 등)
   notAllowed : 원칙적으로 불허
   → 초기 검토용 경고 표시이며 하드블록하지 않는다. 실제 가부는 조례 확인 필수.
*/
export type UseKey = "residential" | "office" | "retail" | "hotel";

export type Allowance = "allowed" | "conditional" | "notAllowed";

const A: Allowance = "allowed";
const C: Allowance = "conditional";
const N: Allowance = "notAllowed";

// [residential, office, retail, hotel]
const USE_MATRIX: Record<ZoneKey, Record<UseKey, Allowance>> = {
  res1_exclusive: { residential: C, office: N, retail: C, hotel: N },
  res2_exclusive: { residential: A, office: N, retail: C, hotel: N },
  res1_general: { residential: A, office: N, retail: C, hotel: N },
  res2_general: { residential: A, office: C, retail: C, hotel: N },
  res3_general: { residential: A, office: C, retail: C, hotel: N },
  semi_residential: { residential: A, office: A, retail: A, hotel: C },
  central_commercial: { residential: A, office: A, retail: A, hotel: A },
  general_commercial: { residential: A, office: A, retail: A, hotel: A },
  neighborhood_commercial: { residential: A, office: A, retail: A, hotel: C },
  distribution_commercial: { residential: N, office: C, retail: A, hotel: C },
  exclusive_industrial: { residential: N, office: C, retail: C, hotel: N },
  general_industrial: { residential: C, office: C, retail: C, hotel: N },
  semi_industrial: { residential: C, office: A, retail: A, hotel: C },
  conservation_green: { residential: C, office: N, retail: C, hotel: N },
  production_green: { residential: C, office: N, retail: C, hotel: N },
  natural_green: { residential: C, office: N, retail: C, hotel: C },
};

const ALLOWANCE_NOTE: Record<UseKey, Partial<Record<Allowance, string>>> = {
  residential: {
    conditional: "규모·형태 제한(도시형생활주택·연립·다세대 등 조례 확인)",
    notAllowed: "해당 용도지역에서 주거(공동주택)는 원칙적으로 불허",
  },
  office: {
    conditional: "바닥면적·층수 규모 제한. 조례/심의 확인 필요",
    notAllowed: "업무시설은 원칙적으로 불허",
  },
  retail: {
    conditional: "소규모 근린생활시설은 가능하나 대규모 판매시설은 제한",
    notAllowed: "판매시설 불허",
  },
  hotel: {
    conditional: "관광호텔 등 조건부. 학교·주거 인접 시 제한",
    notAllowed: "숙박시설은 원칙적으로 불허(주거지역 등)",
  },
};

export function getUseAllowance(zoneKey: ZoneKey, use: UseKey): {
  allowance: Allowance;
  note?: string;
} {
  const allowance = USE_MATRIX[zoneKey][use];
  const note = allowance === "allowed" ? undefined : ALLOWANCE_NOTE[use][allowance];
  return { allowance, note };
}
