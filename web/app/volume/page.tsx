"use client";

/* ── 건축 볼륨 스터디 페이지 ──
   대지 주소·면적·용도지역 + 용도 믹스를 입력 → 서울시 조례 기준 법규 검토
   (건폐율·용적률·주차·일조)를 반영한 볼륨과 "어떤 용도가 면적이 가장 잘
   나오는지" 랭킹을 산출한다. 초기 검토용 개략치.
*/

import { useEffect, useMemo, useState } from "react";
import {
  Building2, Ruler, Car, Sun, AlertTriangle, Layers, Trophy, Loader2, Sparkles,
} from "lucide-react";

type UseKey = "residential" | "office" | "retail" | "hotel";

interface ZoneOpt {
  key: string; name: string; group: string;
  seoulBCR: number; seoulFAR: number;
  legalMaxBCR: number; legalMaxFAR: number;
  solarRegulated: boolean; note?: string;
}

interface UseResult {
  use: UseKey; label: string; sharePct: number;
  gfaAboveM2: number; netAreaM2: number; netAreaLabel: string;
  gfaAbovePyeong: number; netAreaPyeong: number;
  units?: number; rooms?: number; floors?: number; parkingStalls: number;
  allowance: "allowed" | "conditional" | "notAllowed"; allowanceNote?: string;
}

interface FloorRow {
  level: string; n: number; use: string; useLabel: string;
  plateM2: number; platePyeong: number; netM2: number; netPyeong: number;
  coreM2: number; serviceM2: number;
  count?: number; countLabel?: string; stalls?: number;
  floorHeightM: number; topHeightM: number;
}
interface TypicalFloor {
  use: UseKey; label: string; floors: number;
  plateM2: number; platePyeong: number; netPerFloorM2: number; netPerFloorPyeong: number;
  coreM2: number; serviceM2: number; efficiency: number; coreRatio: number;
  countPerFloor?: number; countLabel?: string; moduleM2?: number; floorHeightM: number;
}
interface FloorStack {
  above: FloorRow[]; below: FloorRow[];
  floorsAbove: number; floorsBelow: number; buildingHeightM: number; stepped: boolean;
  typicalFloors: TypicalFloor[];
}
interface Ranking {
  use: UseKey; label: string; netAreaM2: number; netAreaPyeong: number;
  gfaAboveM2: number; units?: number; parkingStalls: number;
  allowance: "allowed" | "conditional" | "notAllowed"; efficiency: number;
}
interface Study {
  input: { siteAreaM2: number; siteAreaPyeong: number; zoneName: string; mix: Record<string, number> };
  regulation: {
    appliedBCR: number; appliedFAR: number; basis: string;
    legalMaxBCR: number; legalMaxFAR: number; seoulBCR: number; seoulFAR: number;
  };
  massing: {
    footprintM2: number; maxGfaAboveM2: number; effectiveGfaAboveM2: number;
    floorsAbove: number; buildingHeightM: number;
    footprintPyeong: number; maxGfaAbovePyeong: number; effectiveGfaAbovePyeong: number;
  };
  parking: { requiredStalls: number; stallAreaM2: number; parkingAreaM2: number; basementFloors: number };
  solar: { applied: boolean; floors?: number; gfaM2?: number; buildingHeightM?: number; limitedBySolar?: boolean; reason?: string };
  uses: UseResult[];
  stack: FloorStack;
  totals: { netAreaM2: number; netAreaPyeong: number; totalUnits: number; totalRooms: number };
  warnings: string[];
}

const USE_LABELS: Record<UseKey, string> = {
  residential: "주거", office: "오피스", retail: "리테일", hotel: "호텔",
};
const USE_COLORS: Record<UseKey, string> = {
  residential: "#6366F1", office: "#0EA5E9", retail: "#F59E0B", hotel: "#EC4899",
};
const colorFor = (use: string) =>
  use === "parking" ? "#94A3B8" : (USE_COLORS[use as UseKey] ?? "#94A3B8");
const ALLOWANCE_BADGE: Record<string, { label: string; cls: string }> = {
  allowed: { label: "허용", cls: "bg-emerald-50 text-emerald-600" },
  conditional: { label: "조건부", cls: "bg-amber-50 text-amber-600" },
  notAllowed: { label: "불허", cls: "bg-rose-50 text-rose-600" },
};

const GROUP_LABEL: Record<string, string> = {
  residential: "주거지역", commercial: "상업지역", industrial: "공업지역", green: "녹지지역",
};

export default function VolumePage() {
  const [zones, setZones] = useState<ZoneOpt[]>([]);
  const [address, setAddress] = useState("");
  const [areaM2, setAreaM2] = useState("660");
  const [zoneKey, setZoneKey] = useState("res2_general");
  const [mix, setMix] = useState<Record<UseKey, number>>({
    residential: 100, office: 0, retail: 0, hotel: 0,
  });
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [desired, setDesired] = useState<Record<UseKey, boolean>>({
    residential: true, office: false, retail: true, hotel: false,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useSeoul, setUseSeoul] = useState(true);
  const [avgUnit, setAvgUnit] = useState("60");
  const [avgRoom, setAvgRoom] = useState("26");
  const [northWidth, setNorthWidth] = useState("");
  const [lotDepth, setLotDepth] = useState("");
  const [heightLimit, setHeightLimit] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    study: Study; ranking: Ranking[];
    recommendation?: null | {
      recommendedMix: Record<string, number>; primaryUse: UseKey; podiumUse?: UseKey;
      rationale: string[]; excluded: { use: UseKey; reason: string }[];
    };
    legal_refs?: { topic: string; basis: string; detail: string; verified: boolean }[];
    disclaimer?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/volume")
      .then((r) => r.json())
      .then((d) => setZones(d.zones ?? []))
      .catch(() => {});
  }, []);

  const selectedZone = useMemo(() => zones.find((z) => z.key === zoneKey), [zones, zoneKey]);
  const mixSum = (Object.values(mix) as number[]).reduce((s, v) => s + v, 0);

  const groupedZones = useMemo(() => {
    const g: Record<string, ZoneOpt[]> = {};
    for (const z of zones) (g[z.group] ??= []).push(z);
    return g;
  }, [zones]);

  function setMixValue(use: UseKey, val: number) {
    setMix((m) => ({ ...m, [use]: Math.max(0, Math.min(100, val)) }));
  }

  const desiredList = (Object.keys(desired) as UseKey[]).filter((u) => desired[u]);

  async function compute() {
    setError(null);
    const site = parseFloat(areaM2);
    if (!site || site <= 0) { setError("대지면적을 입력하세요."); return; }
    if (mode === "auto" ? desiredList.length === 0 : mixSum <= 0) {
      setError(mode === "auto" ? "목표 용도를 1개 이상 선택하세요." : "용도 믹스를 1개 이상 지정하세요."); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/volume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          siteAreaM2: site,
          zoneKey,
          ...(mode === "auto" ? { desiredUses: desiredList } : { mix }),
          address: address || undefined,
          options: {
            useSeoulOrdinance: useSeoul,
            avgUnitAreaM2: parseFloat(avgUnit) || undefined,
            avgRoomAreaM2: parseFloat(avgRoom) || undefined,
            northLotWidthM: parseFloat(northWidth) || undefined,
            lotDepthM: parseFloat(lotDepth) || undefined,
            heightLimitM: parseFloat(heightLimit) || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "산출 실패"); setResult(null); }
      else setResult(data);
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ml-[60px] min-h-full bg-surface px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-[1100px]">
        {/* ── 헤더 ── */}
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 text-white">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold text-gray-900">건축 볼륨 스터디</h1>
            <p className="text-[13px] text-gray-500">
              대지·용도지역·용도 믹스 → 서울시 조례 기준 법규 검토(건폐율·용적률·주차·일조) 볼륨 산출
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          {/* ── 입력 폼 ── */}
          <section className="rounded-[20px] bg-white p-5 shadow-card">
            <h2 className="mb-4 text-[15px] font-bold text-gray-900">대지 정보</h2>

            <label className="mb-1 block text-[12px] font-medium text-gray-500">주소 (선택)</label>
            <input
              value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울 성동구 성수동2가 000-0"
              className="mb-4 w-full rounded-[14px] border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-500"
            />

            <label className="mb-1 block text-[12px] font-medium text-gray-500">대지면적 (㎡)</label>
            <div className="mb-4 flex items-center gap-2">
              <input
                type="number" value={areaM2} onChange={(e) => setAreaM2(e.target.value)}
                className="w-full rounded-[14px] border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-500"
              />
              <span className="whitespace-nowrap text-[12px] text-gray-400">
                ≈ {areaM2 ? Math.round(parseFloat(areaM2) / 3.3058).toLocaleString() : 0}평
              </span>
            </div>

            <label className="mb-1 block text-[12px] font-medium text-gray-500">용도지역</label>
            <select
              value={zoneKey} onChange={(e) => setZoneKey(e.target.value)}
              className="mb-2 w-full rounded-[14px] border border-gray-200 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-primary-500"
            >
              {Object.entries(groupedZones).map(([group, zs]) => (
                <optgroup key={group} label={GROUP_LABEL[group] ?? group}>
                  {zs.map((z) => (
                    <option key={z.key} value={z.key}>{z.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedZone && (
              <p className="mb-4 text-[11px] text-gray-400">
                서울조례 건폐율 {selectedZone.seoulBCR}% · 용적률 {selectedZone.seoulFAR}%
                {selectedZone.solarRegulated && " · 정북일조 적용"}
                {selectedZone.note && ` · ${selectedZone.note}`}
              </p>
            )}

            {/* ── 모드 토글 ── */}
            <div className="mb-3 flex rounded-[12px] bg-gray-100 p-0.5 text-[12px] font-semibold">
              <button onClick={() => setMode("auto")}
                className={`flex-1 rounded-[10px] py-1.5 transition ${mode === "auto" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500"}`}>
                목표 용도 자동최적
              </button>
              <button onClick={() => setMode("manual")}
                className={`flex-1 rounded-[10px] py-1.5 transition ${mode === "manual" ? "bg-white text-primary-600 shadow-sm" : "text-gray-500"}`}>
                직접 배분
              </button>
            </div>

            {mode === "auto" ? (
              /* ── 목표 용도 선택 (최대치 자동 배분) ── */
              <div className="mb-4">
                <label className="mb-2 block text-[12px] font-medium text-gray-500">
                  원하는 용도 (복수 선택 → 최대치로 자동 배분)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(USE_LABELS) as UseKey[]).map((use) => (
                    <button key={use}
                      onClick={() => setDesired((d) => ({ ...d, [use]: !d[use] }))}
                      className={`flex items-center gap-1.5 rounded-[12px] border-2 px-3 py-2.5 text-[13px] font-semibold transition ${
                        desired[use] ? "text-white" : "border-gray-200 bg-white text-gray-500"
                      }`}
                      style={desired[use] ? { background: USE_COLORS[use], borderColor: USE_COLORS[use] } : {}}>
                      <span className="h-2.5 w-2.5 rounded-full"
                        style={{ background: desired[use] ? "#fff" : USE_COLORS[use] }} />
                      {USE_LABELS[use]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-gray-400">
                  리테일+주력용도 선택 시 리테일은 저층 포디움으로, 용도지역 불허 용도는 자동 제외됩니다.
                </p>
              </div>
            ) : (
              /* ── 직접 배분 (슬라이더) ── */
              <>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[12px] font-medium text-gray-500">용도 믹스</label>
                  <span className={`text-[12px] font-bold ${mixSum === 100 ? "text-emerald-600" : "text-amber-600"}`}>합계 {mixSum}%</span>
                </div>
                {(Object.keys(USE_LABELS) as UseKey[]).map((use) => (
                  <div key={use} className="mb-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium text-gray-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: USE_COLORS[use] }} />
                        {USE_LABELS[use]}
                      </span>
                      <span className="text-[12px] font-semibold text-gray-600">{mix[use]}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={5} value={mix[use]}
                      onChange={(e) => setMixValue(use, parseInt(e.target.value))}
                      className="w-full accent-primary-600" />
                  </div>
                ))}
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {([
                    { label: "주거 100", v: { residential: 100, office: 0, retail: 0, hotel: 0 } },
                    { label: "오피스 100", v: { residential: 0, office: 100, retail: 0, hotel: 0 } },
                    { label: "주상복합", v: { residential: 60, office: 0, retail: 20, hotel: 0 } },
                    { label: "오피스+리테일", v: { residential: 0, office: 80, retail: 20, hotel: 0 } },
                  ] as { label: string; v: Record<UseKey, number> }[]).map((preset) => (
                    <button key={preset.label} onClick={() => setMix(preset.v)}
                      className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:border-primary-400 hover:text-primary-600">
                      {preset.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── 고급 옵션 ── */}
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="mb-2 text-[12px] font-medium text-primary-600"
            >
              {showAdvanced ? "− 고급 옵션 닫기" : "+ 고급 옵션 (일조·높이·기준)"}
            </button>
            {showAdvanced && (
              <div className="mb-4 space-y-3 rounded-[14px] bg-gray-50 p-3">
                <label className="flex items-center gap-2 text-[12px] text-gray-600">
                  <input type="checkbox" checked={useSeoul} onChange={(e) => setUseSeoul(e.target.checked)} />
                  서울시 조례 기준 (해제 시 법정 상한)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-500">주거 평균 전용 (㎡/세대)</label>
                    <input type="number" value={avgUnit} onChange={(e) => setAvgUnit(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-500">호텔 객실 순면적 (㎡/실)</label>
                    <input type="number" value={avgRoom} onChange={(e) => setAvgRoom(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-primary-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-500">북측 폭 (m, 일조용)</label>
                    <input type="number" value={northWidth} onChange={(e) => setNorthWidth(e.target.value)}
                      placeholder="선택" className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-gray-500">남북 깊이 (m)</label>
                    <input type="number" value={lotDepth} onChange={(e) => setLotDepth(e.target.value)}
                      placeholder="선택" className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-gray-500">높이제한 (m, 가로구역 등)</label>
                  <input type="number" value={heightLimit} onChange={(e) => setHeightLimit(e.target.value)}
                    placeholder="선택" className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-[12px] outline-none focus:border-primary-500" />
                </div>
                <p className="text-[10px] leading-relaxed text-gray-400">
                  주거지역 정북일조는 대지 형상(북측 폭·남북 깊이) 입력 시에만 연면적 감소를 반영합니다.
                </p>
              </div>
            )}

            <button
              onClick={compute} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary-600 py-3 text-[14px] font-bold text-white transition hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Ruler size={16} />}
              볼륨 산출
            </button>
            {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
          </section>

          {/* ── 결과 ── */}
          <section className="space-y-5">
            {!result && (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-[20px] border border-dashed border-gray-200 bg-white/50 text-center">
                <Building2 size={40} className="mb-3 text-gray-300" />
                <p className="text-[14px] font-medium text-gray-400">대지 정보를 입력하고 볼륨을 산출하세요</p>
                <p className="mt-1 text-[12px] text-gray-300">용도별 면적·주차·층수와 최적 용도 랭킹을 확인할 수 있습니다</p>
              </div>
            )}
            {result && <Results study={result.study} ranking={result.ranking} legalRefs={result.legal_refs} recommendation={result.recommendation} />}
          </section>
        </div>

        {/* ── 면책 ── */}
        <p className="mx-auto mt-8 max-w-[900px] text-center text-[11px] leading-relaxed text-gray-400">
          ⚠ 본 산출은 서울시 도시계획·주차장 조례 적용값 기준의 <b>초기 검토용 개략치</b>입니다.
          지구단위계획·가로구역별 최고높이·인동거리·대지안의공지 세부·주차 완화·문화재/고도지구 등
          개별 규제는 반영되지 않으며, 실제 인허가 도서를 대체하지 않습니다. 최종 검토는 건축사와 협의하세요.
        </p>
      </div>
    </div>
  );
}

/* ── 결과 렌더 ── */
function Results({ study, ranking, legalRefs, recommendation }: {
  study: Study; ranking: Ranking[];
  legalRefs?: { topic: string; basis: string; detail: string; verified: boolean }[];
  recommendation?: null | {
    recommendedMix: Record<string, number>; primaryUse: UseKey; podiumUse?: UseKey;
    rationale: string[]; excluded: { use: UseKey; reason: string }[];
  };
}) {
  const s = study;
  const maxNet = Math.max(...ranking.map((r) => r.netAreaPyeong), 1);

  return (
    <>
      {/* 자동 최적 추천 배너 */}
      {recommendation && (
        <div className="rounded-[20px] border border-primary-100 bg-primary-50/60 p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-primary-700">
            <Sparkles size={15} /> 최대치 상품계획 (자동 추천)
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {Object.entries(recommendation.recommendedMix).filter(([, v]) => v > 0).map(([u, v]) => (
              <span key={u} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-white"
                style={{ background: USE_COLORS[u as UseKey] }}>
                {USE_LABELS[u as UseKey]} {v}%{recommendation.podiumUse === u ? " · 포디움" : ""}
              </span>
            ))}
          </div>
          <ul className="space-y-1">
            {recommendation.rationale.map((r, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-primary-900/70">· {r}</li>
            ))}
          </ul>
        </div>
      )}
      {/* 규제 + 매싱 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="건폐율" value={`${s.regulation.appliedBCR}%`} sub={s.regulation.basis} />
        <Stat label="용적률" value={`${s.regulation.appliedFAR}%`}
          sub={s.regulation.basis === "직접 지정" ? "직접 지정" : `법정상한 ${s.regulation.legalMaxFAR}%`} />
        <Stat label="건축면적" value={`${s.massing.footprintPyeong.toLocaleString()}평`} sub={`${s.massing.footprintM2.toLocaleString()}㎡`} />
        <Stat label="지상 연면적" value={`${s.massing.effectiveGfaAbovePyeong.toLocaleString()}평`}
          sub={s.massing.effectiveGfaAboveM2 < s.massing.maxGfaAboveM2 ? `상한 ${s.massing.maxGfaAbovePyeong}평` : `${s.massing.effectiveGfaAboveM2.toLocaleString()}㎡`} />
      </div>

      {/* 층수/높이/주차 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="예상 지상층수" value={`${s.massing.floorsAbove}층`} icon={<Layers size={13} />} />
        <Stat label="건물 높이" value={`${s.massing.buildingHeightM}m`} icon={<Building2 size={13} />} />
        <Stat label="필요 주차" value={`${s.parking.requiredStalls}대`} sub={`${s.parking.parkingAreaM2.toLocaleString()}㎡`} icon={<Car size={13} />} />
        <Stat label="주차 지하층" value={`B${s.parking.basementFloors}`} sub={`대당 ${s.parking.stallAreaM2}㎡`} icon={<Layers size={13} />} />
      </div>

      {/* 용도별 결과 */}
      <div className="rounded-[20px] bg-white p-5 shadow-card">
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">용도별 면적 산출</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-400">
                <th className="pb-2 font-medium">용도</th>
                <th className="pb-2 font-medium">비율</th>
                <th className="pb-2 font-medium">지상 연면적</th>
                <th className="pb-2 font-medium">순사용면적</th>
                <th className="pb-2 font-medium">층수·세대/객실·주차</th>
                <th className="pb-2 font-medium">허용</th>
              </tr>
            </thead>
            <tbody>
              {s.uses.map((u) => {
                const badge = ALLOWANCE_BADGE[u.allowance];
                return (
                  <tr key={u.use} className="border-b border-gray-50">
                    <td className="py-2.5">
                      <span className="flex items-center gap-1.5 font-semibold text-gray-800">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: USE_COLORS[u.use] }} />
                        {u.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600">{u.sharePct}%</td>
                    <td className="py-2.5 text-gray-800">{u.gfaAbovePyeong.toLocaleString()}평</td>
                    <td className="py-2.5">
                      <span className="font-semibold text-gray-900">{u.netAreaPyeong.toLocaleString()}평</span>
                      <span className="ml-1 text-[10px] text-gray-400">{u.netAreaLabel}</span>
                    </td>
                    <td className="py-2.5 text-gray-600">
                      {u.floors != null ? `${u.floors}층 · ` : ""}
                      {u.units != null ? `${u.units}세대 · ` : u.rooms != null ? `${u.rooms}객실 · ` : ""}
                      {u.parkingStalls}대
                    </td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold text-gray-900">
                <td className="pt-2.5" colSpan={3}>합계 순사용면적</td>
                <td className="pt-2.5">{s.totals.netAreaPyeong.toLocaleString()}평</td>
                <td className="pt-2.5" colSpan={2}>
                  {s.totals.totalUnits > 0 ? `${s.totals.totalUnits}세대 · ` : ""}
                  {s.totals.totalRooms > 0 ? `${s.totals.totalRooms}객실 · ` : ""}
                  {s.parking.requiredStalls}대
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 층별 적층 계획 + 기준층 편면 */}
      <StackSection stack={s.stack} totals={s.totals} />

      {/* 단일용도 랭킹 */}
      <div className="rounded-[20px] bg-white p-5 shadow-card">
        <h3 className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-gray-900">
          <Trophy size={15} className="text-amber-500" /> 어떤 용도가 면적이 가장 잘 나오는가
        </h3>
        <p className="mb-3 text-[11px] text-gray-400">
          각 용도 100% 가정 · 순사용면적(전용/임대) 기준 · {s.input.zoneName}
        </p>
        <div className="space-y-2">
          {ranking.map((r, i) => {
            const badge = ALLOWANCE_BADGE[r.allowance];
            return (
              <div key={r.use} className="flex items-center gap-3">
                <span className="w-4 text-[12px] font-bold text-gray-400">{i + 1}</span>
                <span className="w-14 text-[12px] font-semibold text-gray-700">{r.label}</span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-gray-50">
                  <div className="h-full rounded-md transition-all"
                    style={{ width: `${(r.netAreaPyeong / maxNet) * 100}%`, background: USE_COLORS[r.use], opacity: r.allowance === "notAllowed" ? 0.35 : 0.85 }} />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-white mix-blend-plus-lighter">
                    {r.netAreaPyeong.toLocaleString()}평
                  </span>
                </div>
                <span className={`w-11 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 일조 정보 */}
      <div className="rounded-[20px] bg-white p-4 shadow-card">
        <div className="flex items-start gap-2">
          <Sun size={16} className="mt-0.5 text-amber-500" />
          <div className="text-[12px] text-gray-600">
            <b className="text-gray-800">정북 일조 검토: </b>
            {s.solar.applied
              ? `대지 형상 반영 — 봉투 지상 ${s.solar.floors}층, 연면적 약 ${Math.round((s.solar.gfaM2 ?? 0) / 3.3058).toLocaleString()}평` +
                (s.solar.limitedBySolar ? " (일조 사선으로 상부 감소)" : " (용적률 상한 내 수용)")
              : s.solar.reason}
          </div>
        </div>
      </div>

      {/* 경고 */}
      {s.warnings.length > 0 && (
        <div className="rounded-[20px] border border-amber-100 bg-amber-50/60 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-amber-700">
            <AlertTriangle size={15} /> 법규 검토 유의사항
          </div>
          <ul className="space-y-1.5">
            {s.warnings.map((w, i) => (
              <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-amber-800">
                <span className="text-amber-400">•</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 법적 근거 */}
      {legalRefs && legalRefs.length > 0 && (
        <details className="rounded-[20px] bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-[13px] font-bold text-gray-800">
            법적 근거 (조문 인용)
          </summary>
          <div className="mt-3 space-y-2.5">
            {legalRefs.map((r) => (
              <div key={r.topic} className="border-l-2 border-primary-200 pl-3">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-800">
                  {r.topic}
                  {r.verified && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] text-emerald-600">
                      원문대조
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-primary-600">{r.basis}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{r.detail}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

/* ── 층별 적층 계획 + 기준층 편면 ── */
function StackSection({ stack, totals }: {
  stack: FloorStack;
  totals: { totalUnits: number; totalRooms: number };
}) {
  const maxPlate = Math.max(1, ...stack.above.map((f) => f.plateM2));

  // 지상: 연속 동일용도 층을 밴드로 묶음 (균일 적층일 때)
  type Band = { use: string; label: string; from: number; to: number; floors: number; count?: number; countLabel?: string };
  const bands: Band[] = [];
  for (const f of stack.above) {
    const last = bands[bands.length - 1];
    if (last && last.use === f.use) { last.to = f.n; last.floors++; }
    else bands.push({ use: f.use, label: f.useLabel, from: f.n, to: f.n, floors: 1, count: f.count, countLabel: f.countLabel });
  }
  const maxFloors = Math.max(1, ...bands.map((b) => b.floors));

  return (
    <div className="rounded-[20px] bg-white p-5 shadow-card">
      <h3 className="mb-1 text-[14px] font-bold text-gray-900">층별 적층 계획</h3>
      <p className="mb-4 text-[11px] text-gray-400">
        지상 {stack.floorsAbove}층 · 지하 {stack.floorsBelow}층 · 건물높이 {stack.buildingHeightM}m
        {totals.totalUnits > 0 && ` · 총 ${totals.totalUnits}세대`}
        {totals.totalRooms > 0 && ` · 총 ${totals.totalRooms}객실`}
        {stack.stepped && <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">정북 일조 사선 후퇴 반영</span>}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[250px_1fr]">
        {/* 적층 다이어그램 (위=최상층) */}
        <div className="flex flex-col gap-1">
          {stack.stepped
            // 사선 후퇴: 층별 바닥면적 비례 폭으로 계단식 표현
            ? [...stack.above].reverse().map((f) => (
                <div key={f.level} className="flex items-center gap-2" title={`${f.plateM2}㎡`}>
                  <span className="w-7 shrink-0 text-right text-[10px] font-bold text-gray-400">{f.level}</span>
                  <div className="flex h-[26px] items-center rounded-r-md px-2 text-white"
                    style={{ background: colorFor(f.use), width: `${40 + (f.plateM2 / maxPlate) * 60}%` }}>
                    <span className="truncate text-[10px] font-semibold">
                      {f.useLabel} {f.platePyeong}평{f.count != null && ` · ${f.count}${f.countLabel}`}
                    </span>
                  </div>
                </div>
              ))
            // 균일 적층: 용도 밴드
            : [...bands].reverse().map((b) => (
                <div key={`a-${b.use}-${b.from}`}
                  className="flex items-center gap-2 rounded-lg px-3 text-white"
                  style={{ background: colorFor(b.use), minHeight: 34, height: 30 + (b.floors / maxFloors) * 70 }}>
                  <span className="text-[11px] font-bold">{b.from === b.to ? `${b.from}F` : `${b.from}–${b.to}F`}</span>
                  <span className="ml-auto text-right text-[11px] font-semibold">
                    {b.label} · {b.floors}개층
                    {b.count != null && <div className="text-[10px] font-normal opacity-90">층당 {b.count}{b.countLabel}</div>}
                  </span>
                </div>
              ))}
          {stack.below.map((f) => (
            <div key={f.level}
              className="flex items-center gap-2 rounded-lg bg-slate-400 px-3 text-white" style={{ minHeight: 26 }}>
              <span className="text-[11px] font-bold">{f.level}</span>
              <span className="ml-auto text-[11px] font-semibold">주차 · {f.stalls}대</span>
            </div>
          ))}
        </div>

        {/* 기준층 편면 카드 */}
        <div>
          <div className="mb-2 text-[12px] font-bold text-gray-700">기준층 편면 · 코어/전용 구성</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stack.typicalFloors.map((t) => (
              <div key={t.use} className="rounded-[14px] border border-gray-100 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(t.use) }} />
                    {t.label}
                  </span>
                  <span className="text-[11px] text-gray-400">{t.floors}개층 · 층고 {t.floorHeightM}m</span>
                </div>
                {/* 코어/공용/전용 구성 바 */}
                <CompositionBar t={t} color={colorFor(t.use)} />
                <div className="mb-2 mt-1 text-[10px] text-gray-500">
                  전용/임대 {t.netPerFloorPyeong}평({Math.round(t.efficiency * 100)}%)
                  {" · 공용 "}{Math.round(t.serviceM2 / 3.3058)}평
                  {" · 코어 "}{Math.round(t.coreM2 / 3.3058)}평({Math.round(t.coreRatio * 100)}%)
                  {t.countPerFloor != null && (
                    <span className="font-semibold text-gray-700"> · 층당 {t.countPerFloor}{t.countLabel}<span className="font-normal text-gray-400">(모듈 {t.moduleM2}㎡)</span></span>
                  )}
                </div>
                <FloorPlanSchematic count={t.countPerFloor} coreRatio={t.coreRatio} color={colorFor(t.use)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 코어/공용/전용 구성 스택 바 */
function CompositionBar({ t, color }: { t: TypicalFloor; color: string }) {
  const netPct = t.efficiency * 100;
  const corePct = t.coreRatio * 100;
  const svcPct = Math.max(0, 100 - netPct - corePct);
  return (
    <div className="flex h-3.5 w-full overflow-hidden rounded-full">
      <div style={{ width: `${netPct}%`, background: color }} title={`전용/임대 ${Math.round(netPct)}%`} />
      <div style={{ width: `${svcPct}%`, background: "#CBD5E1" }} title={`공용 ${Math.round(svcPct)}%`} />
      <div style={{ width: `${corePct}%`, background: "#475569" }} title={`코어 ${Math.round(corePct)}%`} />
    </div>
  );
}

/* 기준층 편면 스키매틱 — 중앙 코어 + 중복도(double-loaded) 세대·객실/개방형 */
function FloorPlanSchematic({ count, coreRatio, color }: { count?: number; coreRatio: number; color: string }) {
  const W = 260, H = 82, pad = 4, corr = 14;
  const coreW = Math.max(20, Math.min(70, Math.sqrt(coreRatio) * 150)); // 코어 폭(면적감 반영)
  const coreX = (W - coreW) / 2;
  const roomH = (H - corr) / 2 - pad;
  const usableW = W - pad * 2;

  const rooms = (row: 0 | 1) => {
    if (count == null) return null;
    const n = row === 0 ? Math.ceil(Math.min(count, 16) / 2) : Math.floor(Math.min(count, 16) / 2);
    const cellW = usableW / Math.max(n, 1);
    const y = row === 0 ? pad : pad + roomH + corr;
    return Array.from({ length: n }, (_, i) => (
      <rect key={`${row}-${i}`} x={pad + i * cellW + 1} y={y} width={cellW - 2} height={roomH} rx={2} fill={color} opacity={0.82} />
    ));
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 88 }}>
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} rx={4} fill="none" stroke="#E2E8F0" />
      {count != null ? (
        <>
          {rooms(0)}
          <rect x={pad} y={pad + roomH} width={usableW} height={corr} fill="#F1F5F9" />
          <text x={pad + 20} y={pad + roomH + corr / 2 + 3} textAnchor="middle" fontSize="7.5" fill="#94A3B8">복도</text>
          {rooms(1)}
          {count > 16 && <text x={W - 6} y={H - 5} textAnchor="end" fontSize="9" fontWeight="700" fill={color}>×{count}</text>}
        </>
      ) : (
        <>
          <rect x={pad} y={pad} width={usableW} height={H - pad * 2} rx={3} fill={color} opacity={0.14} />
          <text x={W * 0.28} y={H / 2 + 3} textAnchor="middle" fontSize="8.5" fill={color} fontWeight="600">개방형 임대</text>
        </>
      )}
      {/* 중앙 코어 */}
      <rect x={coreX} y={pad + 2} width={coreW} height={H - pad * 2 - 4} rx={2} fill="#475569" />
      <text x={W / 2} y={H / 2 + 3} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700">코어</text>
    </svg>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-white p-3.5 shadow-card">
      <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-gray-400">
        {icon}{label}
      </div>
      <div className="text-[18px] font-extrabold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}
