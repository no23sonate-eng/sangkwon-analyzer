/* ── 본인 네트워크 ground truth 임대료 lookup ──
   build-time에 CSV → JSON 변환 (web/scripts/build-owner-network.mjs).
   (gu, dong) 단위로 1층/2층이상/지하 평당 월세 중위값·n 반환.
   rent-estimator의 `ownerNetworkRent`(가중치 0.5)에 직접 연결되는 최상위 신뢰 소스.

   prefix 매칭으로 법정동 vs 행정동 차이 흡수 (예: "성수동1가" ↔ "성수1가1동").
*/
import data from "./data/owner-network-rents.json";

interface FloorStat { rent: number; n: number }
interface DongRecord {
  gu: string;
  dong: string;
  "1층"?: FloorStat;
  "2층이상"?: FloorStat;
  "지하"?: FloorStat;
}
interface OwnerJson {
  _meta: { synced_at?: string; case_count?: number; dong_count?: number };
  by_dong: Record<string, DongRecord>;
}

const NET = data as OwnerJson;

function findRecord(gu: string, dongName: string): DongRecord | null {
  const direct = NET.by_dong[`${gu}|${dongName}`];
  if (direct) return direct;
  // prefix 매칭 (행정동 ↔ 법정동)
  for (const [, v] of Object.entries(NET.by_dong)) {
    if (v.gu !== gu) continue;
    if (v.dong.startsWith(dongName) || dongName.startsWith(v.dong)) return v;
  }
  return null;
}

export interface OwnerNetworkRent {
  rent: number;     // 평당 월세 중위값 (만원/평/월) — 1층 기준
  n: number;        // 표본 수
  detail: string;   // "한남동 ground truth (n=3)"
}

export function getOwnerNetworkRent(gu: string, dongName: string): OwnerNetworkRent | null {
  const rec = findRecord(gu, dongName);
  if (!rec) return null;
  const f1 = rec["1층"];
  if (!f1 || f1.rent <= 0) return null;
  return {
    rent: f1.rent,
    n: f1.n,
    detail: `${rec.dong} ground truth (n=${f1.n})`,
  };
}

/** 1층 외 다른 층 ground truth — analyze-area에서 2/지하 폴백 보완용 */
export function getOwnerNetworkRentByFloor(
  gu: string,
  dongName: string,
  floor: "1층" | "2층이상" | "지하",
): OwnerNetworkRent | null {
  const rec = findRecord(gu, dongName);
  if (!rec) return null;
  const fs = rec[floor];
  if (!fs || fs.rent <= 0) return null;
  return {
    rent: fs.rent,
    n: fs.n,
    detail: `${rec.dong} ${floor} ground truth (n=${fs.n})`,
  };
}

export function networkMeta() {
  return NET._meta;
}
