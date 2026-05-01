/* ── 본인 네트워크 ground truth 임대료 lookup ──
   build-time에 CSV → JSON 변환 (web/scripts/build-owner-network.mjs).
   (gu, dong) 단위로 1층/2층이상/지하 평당 월세 중위값·n·수집일 반환.

   prefix 매칭으로 법정동 vs 행정동 차이 흡수 (예: "성수동1가" ↔ "성수1가1동").

   v2: collected_at + cv 메타 노출. n<3·만료 자동 다운그레이드는 data-quality.makeProvenance 가 처리.
*/
import data from "./data/owner-network-rents.json";
import { makeProvenance, type Provenance } from "./data-quality";

interface FloorStat { rent: number; n: number; collected_at?: string; cv?: number }
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
  rent: number;     // 평당 월세 중위값 (만원/평/월)
  n: number;        // 표본 수
  detail: string;   // "한남동 ground truth (n=3)"
  prov: Provenance; // 신뢰도 메타 (Tier·만료·CV 자동 적용)
}

function build(rec: DongRecord, fs: FloorStat, floor: string): OwnerNetworkRent {
  return {
    rent: fs.rent,
    n: fs.n,
    detail: `${rec.dong} ${floor} 네트워크 실거래 (n=${fs.n})`,
    prov: makeProvenance({
      source: "owner_network",
      sample_size: fs.n,
      collected_at: fs.collected_at || NET._meta.synced_at || new Date().toISOString(),
      category: "rent",
      spread_cv: fs.cv,
    }),
  };
}

export function getOwnerNetworkRent(gu: string, dongName: string): OwnerNetworkRent | null {
  const rec = findRecord(gu, dongName);
  if (!rec) return null;
  const f1 = rec["1층"];
  if (!f1 || f1.rent <= 0) return null;
  return build(rec, f1, "1층");
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
  return build(rec, fs, floor);
}

export function networkMeta() {
  return NET._meta;
}

/** 전체 네트워크 GT 인덱스 — admin 데이터 헬스 패널용 */
export function listAllOwnerNetwork(): Array<{ gu: string; dong: string; floor: string; stat: FloorStat }> {
  const out: Array<{ gu: string; dong: string; floor: string; stat: FloorStat }> = [];
  for (const rec of Object.values(NET.by_dong)) {
    for (const f of ["1층", "2층이상", "지하"] as const) {
      const fs = rec[f];
      if (fs && fs.rent > 0) out.push({ gu: rec.gu, dong: rec.dong, floor: f, stat: fs });
    }
  }
  return out;
}
