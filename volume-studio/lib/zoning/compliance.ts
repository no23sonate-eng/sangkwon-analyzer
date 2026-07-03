/* ── 법규 체크리스트 엔진 ──

   볼륨 산출 결과에 대해 건축법·조례상 요건을 전수 점검해 누락을 방지한다.
   상태: ok(충족/자동반영) · action(볼륨에 영향 — 조치 필요) ·
        review(대상지 확인 필요) · na(해당 없음)
   verified: 업로드 법령 원문에서 수치를 직접 대조한 항목.
*/

import type { VolumeStudy } from "./volume-study";
import { ZONES, type ZoneKey } from "./use-zones";

export interface CheckItem {
  id: string;
  category: "대지·접도" | "형태·높이" | "공지·조경" | "피난·설비" | "기타 의무";
  title: string;
  status: "ok" | "action" | "review" | "na";
  detail: string;
  basis: string;
  verified: boolean;
}

export interface ComplianceCtx {
  roadWidthM?: number; // 전면도로 너비
  hasResidential: boolean;
  commercialLikeGfaM2: number; // 공개공지 대상 용도(판매·업무·숙박 등) 바닥면적 합
}

export function runCompliance(study: VolumeStudy, ctx: ComplianceCtx): CheckItem[] {
  const items: CheckItem[] = [];
  const site = study.input.siteAreaM2;
  const gfaAbove = study.massing.effectiveGfaAboveM2;
  const gfaTotal = gfaAbove + study.parking.parkingAreaM2;
  const zone = ZONES[study.input.zoneKey as ZoneKey];
  const h = study.massing.buildingHeightM;
  const floors = study.massing.floorsAbove;

  // ── 대지·접도 ──
  if (ctx.roadWidthM == null) {
    items.push({
      id: "road", category: "대지·접도", title: "접도 요건", status: "review",
      detail: `전면도로 너비 미입력 — 대지는 2m 이상 도로에 접해야 하며, 연면적 2,000㎡ 이상(현재 ${Math.round(gfaTotal).toLocaleString()}㎡)이면 너비 6m 이상 도로에 4m 이상 접해야 합니다.`,
      basis: "건축법 §44 · 시행령 §28", verified: true,
    });
  } else {
    const need6 = gfaTotal >= 2000;
    const pass = need6 ? ctx.roadWidthM >= 6 : ctx.roadWidthM >= 2;
    items.push({
      id: "road", category: "대지·접도", title: "접도 요건",
      status: pass ? "ok" : "action",
      detail: need6
        ? `연면적 ${Math.round(gfaTotal).toLocaleString()}㎡ ≥ 2,000㎡ → 6m 이상 도로에 4m 이상 접함 필요 (전면도로 ${ctx.roadWidthM}m ${pass ? "충족" : "미달 — 규모 축소 또는 도로 조건 확인"})`
        : `2m 이상 접도 ${pass ? "충족" : "미달"} (전면도로 ${ctx.roadWidthM}m)`,
      basis: "건축법 §44 · 시행령 §28", verified: true,
    });
    if (ctx.roadWidthM < 4) {
      items.push({
        id: "setback-line", category: "대지·접도", title: "소요너비 미달 도로 — 건축선 후퇴", status: "action",
        detail: `전면도로 ${ctx.roadWidthM}m < 4m → 도로 중심선에서 2m 후퇴한 선이 건축선. 후퇴 면적은 대지면적(건폐율·용적률 산정)에서 제외되어 볼륨이 감소합니다.`,
        basis: "건축법 §46①", verified: false,
      });
    }
  }

  // ── 공지·조경 ──
  if (site >= 200) {
    const rate = site < 300 ? 5 : gfaTotal >= 2000 ? 15 : gfaTotal >= 1000 ? 10 : 5;
    const reqM2 = Math.round(site * rate / 100);
    const openGround = site - study.massing.footprintM2;
    items.push({
      id: "landscape", category: "공지·조경", title: `조경면적 확보 (대지의 ${rate}%)`,
      status: openGround >= reqM2 ? "ok" : "action",
      detail: `필요 조경 ${reqM2.toLocaleString()}㎡ / 건축면적 제외 공지 ${Math.round(openGround).toLocaleString()}㎡ ${openGround >= reqM2 ? "→ 확보 가능" : "→ 부족: 옥상조경(2/3 인정) 또는 건축면적 축소 검토"}`,
      basis: "건축법 §42 · 서울 건축조례(연면적 2천㎡↑ 15% / 1천㎡↑ 10% / 미만 5%, 200~300㎡ 대지 5%)",
      verified: true,
    });
  } else {
    items.push({ id: "landscape", category: "공지·조경", title: "조경 의무", status: "na", detail: "대지 200㎡ 미만 — 조경 의무 없음", basis: "건축법 §42", verified: true });
  }

  const popsZone = ["res1_general", "res2_general", "res3_general", "semi_residential", "central_commercial", "general_commercial", "neighborhood_commercial", "distribution_commercial", "semi_industrial"].includes(zone.key);
  if (popsZone && ctx.commercialLikeGfaM2 >= 5000) {
    items.push({
      id: "pops", category: "공지·조경", title: "공개공지 설치 의무", status: "action",
      detail: `문화·판매·업무·숙박 등 바닥면적 합계 ${Math.round(ctx.commercialLikeGfaM2).toLocaleString()}㎡ ≥ 5,000㎡ → 대지면적의 5~10%(조례) 공개공지 필요. 설치 시 용적률·높이 1.2배 완화 가능(인센티브 토글).`,
      basis: "건축법 §43 · 시행령 §27의2", verified: true,
    });
  } else if (popsZone) {
    items.push({
      id: "pops", category: "공지·조경", title: "공개공지 (자발 설치 시 인센티브)", status: "review",
      detail: "설치 의무 대상은 아니나, 기준에 맞게 자발 설치하면 용적률·높이 1.2배 완화를 준용받을 수 있습니다(⑤ 인센티브 참고).",
      basis: "건축법 시행령 §27의2⑤", verified: true,
    });
  }

  // ── 형태·높이 ──
  if (zone.key === "res1_general" && floors > 4) {
    items.push({
      id: "floor-cap", category: "형태·높이", title: "제1종일반주거 4층 제한 초과", status: "action",
      detail: `산출 ${floors}층 > 4층 — 서울 조례상 4층 이하로 계획해야 합니다(연면적 재배분 필요).`,
      basis: "서울 도시계획 조례", verified: false,
    });
  }
  items.push({
    id: "solar", category: "형태·높이", title: "정북 일조 사선",
    status: zone.solarRegulated ? (study.solar.applied ? "ok" : "review") : "na",
    detail: zone.solarRegulated
      ? (study.solar.applied ? "대지 형상 기반 계단 후퇴 반영됨" : "적용 지역이나 대지 형상 미입력 — 실제 연면적은 감소할 수 있음")
      : "정북 일조 미적용 용도지역",
    basis: "건축법 시행령 §86② (10m↓ 1.5m / 10m↑ h/2)", verified: true,
  });
  if (ctx.hasResidential) {
    items.push({
      id: "residential-light", category: "형태·높이", title: "공동주택 채광사선·인동거리", status: "review",
      detail: "채광창 벽면 기준: 높이 ≤ 인접대지경계선까지 거리×2(채광방향), 2개동 이상 마주보면 높이의 0.5배(도시형생활주택 0.25배) 이격. 세장한 대지·다동 배치 시 볼륨 감소 요인 — 본 엔진 미반영이므로 배치 계획에서 확인 필수.",
      basis: "건축법 시행령 §86③ · 서울 건축조례", verified: true,
    });
  }
  items.push({
    id: "street-height", category: "형태·높이", title: "가로구역별 최고높이", status: "review",
    detail: `서울시 지정 가로구역(간선가로변)이면 별도 높이 상한 적용 — 현재 높이 ${h}m 기준으로 해당 여부 확인 필요(서울도시계획포털).`,
    basis: "건축법 §60 · 서울 건축조례", verified: false,
  });

  // ── 피난·설비 ──
  const needElevator = floors >= 6 && gfaAbove >= 2000;
  items.push({
    id: "elevator", category: "피난·설비", title: "승용승강기",
    status: needElevator ? "ok" : "na",
    detail: needElevator
      ? `6층 이상 & 연면적 2,000㎡ 이상 → 승용승강기 설치 의무(코어 면적에 반영됨). 높이 31m 초과 시 비상용승강기 추가${h > 31 ? " — 해당(현재 " + h + "m)" : ""}.`
      : "6층 미만 또는 연면적 2,000㎡ 미만 — 승강기 의무 없음(계획상 설치는 별개)",
    basis: "건축법 §64 · 시행령 §89·§90", verified: true,
  });
  if (floors >= 5 || ctx.hasResidential) {
    items.push({
      id: "stairs", category: "피난·설비", title: "직통계단 (보행거리·2개소)", status: "review",
      detail: "거실 각 부분에서 계단까지 보행거리 30m(주요구조부 내화 시 50m) 이내. 공동주택 등 일정 규모는 직통계단 2개소 — 기준층 코어 계획에서 확인.",
      basis: "건축법 시행령 §34", verified: true,
    });
  }

  // ── 기타 의무 ──
  items.push({
    id: "parking", category: "기타 의무", title: "부설주차장",
    status: "ok",
    detail: `법정 ${study.parking.requiredStalls}대 산정·지하 ${study.parking.basementFloors}개층 반영됨 (서울 조례 원단위)`,
    basis: "주차장법 §19 · 서울 주차장 조례 별표2", verified: true,
  });
  if (gfaAbove >= 10000) {
    items.push({
      id: "art", category: "기타 의무", title: "미술작품 설치", status: "action",
      detail: `연면적 1만㎡ 이상 → 건축비의 일정 비율(0.5~0.7%) 미술작품 설치 또는 문화예술진흥기금 출연.`,
      basis: "문화예술진흥법 §9", verified: false,
    });
  }

  const order = { action: 0, review: 1, ok: 2, na: 3 };
  return items.sort((a, b) => order[a.status] - order[b.status]);
}
