/* ── 용적률·높이 인센티브 (완화) 엔진 ──

   정량 적용 가능(quantifiable=true)한 것은 토글 시 용적률에 반영,
   대상지 조건에 따라 달라지는 것은 "검토 대상"으로 나열해 누락을 방지한다.

   ⚠ 서로 다른 근거의 완화 중복 적용은 허가권자·건축위원회 심의 사항.
     복수 선택 시 곱연산으로 시뮬레이션하되 경고를 표시한다.
*/

export interface Incentive {
  id: string;
  title: string;
  farMultiplier?: number; // 용적률 배수 (정량)
  heightMultiplier?: number;
  condition: string;
  basis: string;
  verified: boolean; // 업로드 법령 원문 대조 여부
  quantifiable: boolean;
}

export const INCENTIVES: Incentive[] = [
  {
    id: "pops", title: "공개공지 설치",
    farMultiplier: 1.2, heightMultiplier: 1.2,
    condition: "대지면적의 10% 이하(조례 5~10%)를 일반 공중이 이용하는 공개공지로 제공. 설치 의무 대상이 아니어도 자발 설치 시 준용.",
    basis: "건축법 §43 · 시행령 §27의2④~⑤ (용적률·높이 각 1.2배 이하)",
    verified: true, quantifiable: true,
  },
  {
    id: "ibs", title: "지능형건축물(IBS) 인증",
    farMultiplier: 1.15, heightMultiplier: 1.15,
    condition: "지능형건축물 인증 취득(설비·IT 통합). 조경면적 85%로 완화 병행 가능.",
    basis: "건축법 §65의2⑥ (용적률·높이 115%, 조경 85%)",
    verified: false, quantifiable: true,
  },
  {
    id: "green", title: "녹색건축·에너지 인증 (ZEB 등)",
    farMultiplier: 1.15,
    condition: "녹색건축인증+에너지효율등급/제로에너지건축물 등급 조합. 등급별 3~15% 차등(서울시 녹색건축물 설계기준).",
    basis: "녹색건축물 조성 지원법 §15 (최대 115%)",
    verified: false, quantifiable: true,
  },
];

/** 대상지 조건에 따라 달라져 정량화 불가 — 반드시 해당 여부를 확인해야 할 완화 제도 */
export const SITE_SPECIFIC_INCENTIVES: Array<{ title: string; note: string; basis: string }> = [
  { title: "지구단위계획 공공기여(기부채납)", note: "기준→허용→상한용적률 구조. 임대주택·공공시설 제공 시 상한까지 상향", basis: "국토계획법 §52 · 서울 지구단위계획 수립기준" },
  { title: "역세권 활성화 사업", note: "역세권 350m 내 용도지역 상향(최대 준주거/상업) + 용적률 대폭 상향", basis: "서울시 역세권 활성화 운영기준" },
  { title: "역세권 청년안심주택", note: "역세권 250~350m, 준주거 최대 500%·상업 상향 + 주차 완화", basis: "서울시 청년안심주택 조례" },
  { title: "리모델링 활성화 구역", note: "연면적 30% 범위 증축 특례", basis: "건축법 §5 · 서울 건축조례" },
  { title: "특별건축구역·건축협정", note: "높이·조경·일조 등 개별 규정 적용 배제/완화 가능", basis: "건축법 §69~ · §77의4~" },
  { title: "소규모주택정비(가로주택 등)", note: "노후 주거지 조례 용적률·건폐율 완화, 임대 공급 시 법정상한", basis: "빈집 및 소규모주택 정비 특례법" },
];

export interface IncentiveResult {
  farMultiplier: number;
  appliedTitles: string[];
  stacked: boolean; // 2개 이상 중복 → 심의 경고
}

export function combineIncentives(selectedIds: string[]): IncentiveResult {
  const sel = INCENTIVES.filter((i) => selectedIds.includes(i.id) && i.farMultiplier);
  const farMultiplier = sel.reduce((m, i) => m * (i.farMultiplier ?? 1), 1);
  return { farMultiplier, appliedTitles: sel.map((i) => i.title), stacked: sel.length >= 2 };
}
