import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  computeVolumeStudy, rankSingleUses, optimizeProgram,
  ZONE_LIST, LEGAL_REFS, VOLUME_DISCLAIMER,
  type ZoneKey, type UseKey, type VolumeOptions,
} from "@/lib/zoning";

/* ── 건축 볼륨 스터디 API ──
   GET  : 용도지역 목록 반환(폼 초기화용)
   POST : { siteAreaM2, zoneKey, mix, options } → 볼륨 스터디 + 단일용도 랭킹
*/

export async function GET() {
  return NextResponse.json({
    zones: ZONE_LIST.map((z) => ({
      key: z.key, name: z.name, group: z.group,
      seoulBCR: z.seoulBCR, seoulFAR: z.seoulFAR,
      legalMaxBCR: z.legalMaxBCR, legalMaxFAR: z.legalMaxFAR,
      solarRegulated: z.solarRegulated, note: z.note,
    })),
  });
}

interface VolumeBody {
  siteAreaM2?: number;
  zoneKey?: ZoneKey;
  mix?: Partial<Record<UseKey, number>>;
  desiredUses?: UseKey[]; // 지정 시 자동 최적(최대치) 모드
  options?: VolumeOptions;
  address?: string;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, "volume", 60, 60_000);
  if (limited) return limited;

  let body: VolumeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문 파싱 실패" }, { status: 400 });
  }

  const siteAreaM2 = Number(body.siteAreaM2);
  if (!Number.isFinite(siteAreaM2) || siteAreaM2 <= 0) {
    return NextResponse.json({ error: "대지면적(siteAreaM2)이 유효하지 않습니다." }, { status: 400 });
  }
  const zoneKey = body.zoneKey;
  if (!zoneKey || !ZONE_LIST.some((z) => z.key === zoneKey)) {
    return NextResponse.json({ error: "용도지역(zoneKey)이 유효하지 않습니다." }, { status: 400 });
  }
  const options = body.options ?? {};

  // ── 자동 최적(최대치) 모드: 목표 용도만 받으면 배분 자동 산출 ──
  const desired = (body.desiredUses ?? []).filter((u): u is UseKey =>
    ["residential", "office", "retail", "hotel"].includes(u));

  let study;
  let recommendation: null | {
    recommendedMix: Partial<Record<UseKey, number>>;
    primaryUse: UseKey; podiumUse?: UseKey;
    rationale: string[]; excluded: { use: UseKey; reason: string }[];
  } = null;

  if (desired.length > 0) {
    const opt = optimizeProgram(siteAreaM2, zoneKey, desired, options);
    study = opt.study;
    recommendation = {
      recommendedMix: opt.recommendedMix, primaryUse: opt.primaryUse,
      podiumUse: opt.podiumUse, rationale: opt.rationale, excluded: opt.excluded,
    };
  } else {
    const mix = body.mix ?? {};
    const mixSum = Object.values(mix).reduce((s, v) => s + (Number(v) || 0), 0);
    if (mixSum <= 0) {
      return NextResponse.json({ error: "용도 믹스 또는 목표 용도를 1개 이상 지정하세요." }, { status: 400 });
    }
    study = computeVolumeStudy(siteAreaM2, zoneKey, mix, options);
  }

  const ranking = rankSingleUses(siteAreaM2, zoneKey, options);

  return NextResponse.json({
    study, ranking, recommendation,
    address: body.address ?? null,
    legal_refs: LEGAL_REFS,
    disclaimer: VOLUME_DISCLAIMER,
  });
}
