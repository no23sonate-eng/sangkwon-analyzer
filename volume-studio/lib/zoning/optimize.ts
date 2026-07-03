/* ── 최대치 상품계획 자동 최적화 ──

   "원하는 용도만 고르면 → 법정 최대치로 배분한 볼륨을 자동으로 올려준다" (랜드북류)

   목표(objective):
   - maxArea(기본): 순사용면적(전용/임대) 합을 최대화
   - 허용(allowed) > 조건부(conditional) 우선, 불허(notAllowed)는 제외

   배분 로직(상품 현실성 반영):
   - 목표 용도가 1개 → 그 용도 100% (그 용도로 뽑을 수 있는 법정 최대)
   - 리테일 + 주력용도(주거/오피스/호텔) 동시 선택 → 리테일을 저층 포디움으로
     (포디움 비중 ≈ 2개층분 연면적 = 2 × 건폐율 ÷ 용적률), 나머지는 주력용도
   - 주력용도만 여러 개 → 순사용면적 최대인 1개에 집중(대안은 랭킹으로 제시)
*/

import { computeVolumeStudy, rankSingleUses, type VolumeStudy, type VolumeOptions } from "./volume-study";
import { ZONES, getUseAllowance, type ZoneKey, type UseKey } from "./use-zones";
import { PROGRAMS } from "./programs";

export interface OptimizeResult {
  recommendedMix: Partial<Record<UseKey, number>>;
  primaryUse: UseKey;
  podiumUse?: UseKey;
  rationale: string[];
  excluded: { use: UseKey; reason: string }[];
  study: VolumeStudy;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function optimizeProgram(
  siteAreaM2: number,
  zoneKey: ZoneKey,
  desiredUses: UseKey[],
  options: VolumeOptions = {},
): OptimizeResult {
  const zone = ZONES[zoneKey];
  const rationale: string[] = [];
  const excluded: { use: UseKey; reason: string }[] = [];

  // 1) 불허 용도 제외
  const allowed = desiredUses.filter((u) => {
    const { allowance, note } = getUseAllowance(zoneKey, u);
    if (allowance === "notAllowed") {
      excluded.push({ use: u, reason: note ?? "해당 용도지역 불허" });
      return false;
    }
    return true;
  });
  const pool = allowed.length > 0 ? allowed : (["office"] as UseKey[]); // 전부 불허면 오피스 폴백

  // 2) 각 용도 100% 순사용면적 랭킹(허용 우선)
  const ranking = rankSingleUses(siteAreaM2, zoneKey, options)
    .filter((r) => pool.includes(r.use));

  // 3) 주력용도 = 리테일 제외 후 순면적 최대(없으면 리테일)
  const nonRetail = ranking.filter((r) => r.use !== "retail");
  const primary = (nonRetail[0] ?? ranking[0]).use;

  // 4) 배분 결정
  let recommendedMix: Partial<Record<UseKey, number>>;
  let podiumUse: UseKey | undefined;

  if (pool.includes("retail") && primary !== "retail") {
    // 리테일 저층 포디움 + 주력용도
    const podiumPct = clamp(Math.round((2 * zone.seoulBCR / zone.seoulFAR) * 100), 5, 40);
    recommendedMix = { [primary]: 100 - podiumPct, retail: podiumPct };
    podiumUse = "retail";
    rationale.push(`주력용도 ${PROGRAMS[primary].label} + 저층 리테일 포디움 ${podiumPct}% 배분 (건폐율/용적률 기준 약 2개층분).`);
  } else {
    recommendedMix = { [primary]: 100 };
    rationale.push(`${PROGRAMS[primary].label} 100% — 선택 용도 중 순사용면적이 가장 큰 구성.`);
  }

  if (excluded.length > 0) {
    rationale.push(`제외: ${excluded.map((e) => PROGRAMS[e.use].label).join(", ")} (해당 용도지역 원칙적 불허).`);
  }
  const alt = ranking.filter((r) => r.use !== primary && r.use !== podiumUse);
  if (alt.length > 0) {
    rationale.push(`대안 용도(순면적순): ${alt.map((r) => `${PROGRAMS[r.use].label} ${r.netAreaPyeong}평`).join(" · ")}.`);
  }

  const study = computeVolumeStudy(siteAreaM2, zoneKey, recommendedMix, options);
  return { recommendedMix, primaryUse: primary, podiumUse, rationale, excluded, study };
}

/* ── 대안 자동 생성 ──
   한 번의 산출로 비교 가능한 설계 대안들을 만든다 (Buildit "다른 설계결과"류).
   추천안 + 허용 용도 100% 단일안 + 주력용도+리테일 포디움안. 중복 믹스 제거, 최대 7개.
*/
export interface Alternative {
  id: string;
  label: string;
  mix: Partial<Record<UseKey, number>>;
  study: VolumeStudy;
  recommended?: boolean;
  rationale?: string[];
}

const mixKey = (m: Partial<Record<UseKey, number>>) =>
  (Object.keys(m) as UseKey[]).sort().map((k) => `${k}:${Math.round(m[k] ?? 0)}`).join("|");

export function generateAlternatives(
  siteAreaM2: number,
  zoneKey: ZoneKey,
  desiredUses: UseKey[],
  options: VolumeOptions = {},
): Alternative[] {
  const zone = ZONES[zoneKey];
  const opt = optimizeProgram(siteAreaM2, zoneKey, desiredUses, options);
  const list: Alternative[] = [{
    id: "reco", label: "추천안", mix: opt.recommendedMix, study: opt.study,
    recommended: true, rationale: opt.rationale,
  }];
  const seen = new Set([mixKey(opt.recommendedMix)]);

  const podiumPct = clamp(Math.round((2 * zone.seoulBCR / zone.seoulFAR) * 100), 5, 40);
  const allUses: UseKey[] = ["residential", "office", "retail", "hotel"];
  const candidates: { label: string; mix: Partial<Record<UseKey, number>> }[] = [];
  for (const u of allUses) {
    if (getUseAllowance(zoneKey, u).allowance === "notAllowed") continue;
    candidates.push({ label: `${PROGRAMS[u].label} 100%`, mix: { [u]: 100 } });
    if (u !== "retail" && getUseAllowance(zoneKey, "retail").allowance !== "notAllowed") {
      candidates.push({
        label: `${PROGRAMS[u].label} + 리테일`,
        mix: { [u]: 100 - podiumPct, retail: podiumPct },
      });
    }
  }
  for (const c of candidates) {
    if (list.length >= 7) break;
    const k = mixKey(c.mix);
    if (seen.has(k)) continue;
    seen.add(k);
    list.push({ id: k, label: c.label, mix: c.mix, study: computeVolumeStudy(siteAreaM2, zoneKey, c.mix, options) });
  }
  return list;
}
