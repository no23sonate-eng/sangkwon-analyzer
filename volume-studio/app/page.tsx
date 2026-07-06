"use client";

/* ── Volume Studio — 주소 검색 → 3D 매스 + 규모검토 (밸류맵 Buildit류) ──
   좌: 대지 입력(주소 자동조회) · 중: 필지+매스 3D · 우: 건축개요/층별 면적표
   엔진(lib/zoning)은 순수 TS라 전부 클라이언트에서 계산한다.
*/

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  computeFacilityStudy, computeEconomics, runCompliance, combineIncentives,
  INCENTIVES, SITE_SPECIFIC_INCENTIVES, FACILITIES, FACILITY_KEYS,
  ZONE_LIST, VOLUME_DISCLAIMER, CAP_RATES,
  type ZoneKey, type UseKey, type FacilityKey, type FacilityStudy, type Allocation,
} from "@/lib/zoning";
import {
  ringToLocalMeters, rectRing, ringArea, scaleToArea, clipToAreaFromNorth, type Pt,
} from "@/lib/massing-geometry";
import type { MassFloor } from "@/components/MassingViewer";

const MassingViewer = dynamic(() => import("@/components/MassingViewer"), { ssr: false });

const USE_LABELS: Record<UseKey, string> = { residential: "주거", office: "오피스", retail: "리테일", hotel: "호텔" };
const USE_COLORS: Record<UseKey, string> = { residential: "#6366f1", office: "#0ea5e9", retail: "#f59e0b", hotel: "#ec4899" };
const USE_KEYS: UseKey[] = ["residential", "office", "retail", "hotel"];
const py = (m2: number) => Math.round(m2 / 3.3058).toLocaleString();
const n0 = (v: number) => Math.round(v).toLocaleString();

export default function Home() {
  // ── 입력 상태 ──
  const [address, setAddress] = useState("");
  const [areaM2, setAreaM2] = useState("660");
  const [zoneKey, setZoneKey] = useState<ZoneKey>("res2_general");
  const [progRows, setProgRows] = useState<Array<{
    facility: FacilityKey; unitPy: string; unitCount: string; targetPy: string; fill: boolean;
  }>>([
    { facility: "retail1", unitPy: "20", unitCount: "", targetPy: "", fill: false },
    { facility: "apt", unitPy: "18", unitCount: "", targetPy: "", fill: true },
  ]);
  const [parcelRing, setParcelRing] = useState<[number, number][] | null>(null);
  const [northW, setNorthW] = useState("");
  const [depth, setDepth] = useState("");
  const [jibun, setJibun] = useState<string | null>(null);

  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [study, setStudy] = useState<FacilityStudy | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // 사업성 입력 (만원/평/월 · 만원/평 · 억원)
  const [rents, setRents] = useState<Record<UseKey, string>>({ residential: "", office: "", retail: "", hotel: "" });
  const [constCost, setConstCost] = useState("");
  const [landCost, setLandCost] = useState("");
  const [roadW, setRoadW] = useState("");
  const [districts, setDistricts] = useState<{ layer: string; names: string[] }[]>([]);
  const [heightLim, setHeightLim] = useState("");
  const [easySel, setEasySel] = useState<Record<string, boolean>>({ apt: true });
  const [withRetail, setWithRetail] = useState(true);
  const [incSel, setIncSel] = useState<string[]>([]);

  const zone = ZONE_LIST.find((z) => z.key === zoneKey);

  // ── 주소 자동조회 ──
  async function lookup() {
    if (!address.trim()) { setLookupMsg({ ok: false, text: "주소를 입력하세요." }); return; }
    setLookupBusy(true); setLookupMsg(null);
    try {
      const res = await fetch(`/api/land-lookup?address=${encodeURIComponent(address.trim())}`);
      const d = await res.json();
      if (!res.ok) { setLookupMsg({ ok: false, text: d.error ?? "조회 실패" }); return; }
      const parts: string[] = [];
      if (d.parcel?.areaM2) {
        setAreaM2(String(d.parcel.areaM2));
        setParcelRing(d.parcel.ring ?? null);
        setNorthW(String(d.parcel.northWidthM ?? ""));
        setDepth(String(d.parcel.lotDepthM ?? ""));
        setJibun(d.parcel.jibun ?? null);
        parts.push(`대지 ${d.parcel.areaM2.toLocaleString()}㎡ (${py(d.parcel.areaM2)}평)`);
      }
      if (d.zoneKey) { setZoneKey(d.zoneKey); parts.push(d.zoneName); }
      setDistricts(d.districts ?? []);
      if (d.heightLimitM) { setHeightLim(String(d.heightLimitM)); parts.push(`고도제한 ${d.heightLimitM}m 자동 적용`); }
      setLookupMsg({
        ok: true,
        text: (d.refined ? `${d.refined} — ` : "") + parts.join(" · ") +
          (d.warnings?.length ? ` ⚠ ${d.warnings.join(" / ")}` : ""),
      });
    } catch {
      setLookupMsg({ ok: false, text: "네트워크 오류 — 국내 네트워크·VWorld 키를 확인하세요." });
    } finally { setLookupBusy(false); }
  }

  // ── 쉬운 모드: 선택한 상품으로 자동 구성 ──
  const EASY: Array<{ key: FacilityKey; label: string; desc: string }> = [
    { key: "apt", label: "아파트·빌라", desc: "일반 공동주택" },
    { key: "urban_house", label: "원룸(소형주거)", desc: "도시형생활주택" },
    { key: "officetel", label: "오피스텔", desc: "주거+업무 겸용" },
    { key: "office", label: "사무실", desc: "업무시설" },
    { key: "tourist_hotel", label: "호텔·숙박", desc: "관광호텔 기준" },
    { key: "sports", label: "운동시설", desc: "헬스·골프연습장 등" },
  ];
  function runEasy() {
    setErr(null);
    const site = parseFloat(areaM2);
    if (!site || site <= 0) { setErr("① 에서 주소를 조회하거나 대지면적을 입력해 주세요."); return; }
    const mains = EASY.filter((e) => easySel[e.key]).map((e) => e.key);
    if (mains.length === 0 && !withRetail) { setErr("짓고 싶은 상품을 1개 이상 선택해 주세요."); return; }
    const z = ZONE_LIST.find((x) => x.key === zoneKey)!;
    const inc = combineIncentives(incSel);
    const allocations: Allocation[] = [];
    const footPy = (site * z.seoulBCR / 100) / 3.3058;
    const estMaxPy = (site * z.seoulFAR * (inc.farMultiplier || 1) / 100) / 3.3058;
    let remainPy = estMaxPy;
    if (withRetail) {
      const retailPy = Math.min(Math.round(footPy * 2), Math.round(estMaxPy * 0.4));
      allocations.push({ facility: "retail1", targetGfaPy: retailPy });
      remainPy -= retailPy;
    }
    mains.forEach((f, i) => {
      if (i === mains.length - 1) allocations.push({ facility: f, fillRemainder: true });
      else allocations.push({ facility: f, targetGfaPy: Math.floor(remainPy / mains.length) });
    });
    if (allocations.length === 0) allocations.push({ facility: "retail1", fillRemainder: true });
    try {
      setStudy(computeFacilityStudy(site, zoneKey, allocations, {
        northLotWidthM: parseFloat(northW) || undefined,
        lotDepthM: parseFloat(depth) || undefined,
        heightLimitM: parseFloat(heightLim) || undefined,
        farOverride: inc.farMultiplier > 1 ? Math.round(z.seoulFAR * inc.farMultiplier) : undefined,
      }));
    } catch (e) { setErr(e instanceof Error ? e.message : "산출 오류"); }
  }

  // ── 산출 (고급: 시설 프로그램 직접 구성) ──
  function run() {
    setErr(null);
    const site = parseFloat(areaM2);
    if (!site || site <= 0) { setErr("대지면적을 입력하세요."); return; }
    if (progRows.length === 0) { setErr("시설을 1개 이상 추가하세요."); return; }
    try {
      const inc = combineIncentives(incSel);
      const z = ZONE_LIST.find((x) => x.key === zoneKey)!;
      const allocations: Allocation[] = progRows.map((r) => ({
        facility: r.facility,
        unitPy: parseFloat(r.unitPy) || undefined,
        unitCount: parseFloat(r.unitCount) || undefined,
        targetGfaPy: parseFloat(r.targetPy) || undefined,
        fillRemainder: r.fill,
      }));
      setStudy(computeFacilityStudy(site, zoneKey, allocations, {
        northLotWidthM: parseFloat(northW) || undefined,
        lotDepthM: parseFloat(depth) || undefined,
        heightLimitM: parseFloat(heightLim) || undefined,
        farOverride: inc.farMultiplier > 1 ? Math.round(z.seoulFAR * inc.farMultiplier) : undefined,
      }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "산출 오류");
    }
  }

  const current = study ? { study } : null;

  // ── 사업성 (현재 안 + 대안 카드용) ──
  const econInput = useMemo(() => ({
    rents: Object.fromEntries(
      USE_KEYS.map((u) => [u, parseFloat(rents[u]) || 0]).filter(([, v]) => (v as number) > 0),
    ) as Partial<Record<UseKey, number>>,
    constructionCostPerPyeong: parseFloat(constCost) || undefined,
    landCostEok: parseFloat(landCost) || undefined,
  }), [rents, constCost, landCost]);
  const econ = useMemo(
    () => (current ? computeEconomics(current.study, econInput) : null),
    [current, econInput],
  );

  // ── 법규 체크리스트 ──
  const checks = useMemo(() => {
    if (!current) return [];
    const st = current.study;
    const commercialLike = st.uses
      .filter((u) => u.use !== "residential")
      .reduce((s, u) => s + u.gfaAboveM2, 0);
    return runCompliance(st, {
      roadWidthM: parseFloat(roadW) || undefined,
      hasResidential: st.uses.some((u) => u.use === "residential"),
      commercialLikeGfaM2: commercialLike,
    });
  }, [current, roadW]);
  const incApplied = useMemo(() => combineIncentives(incSel), [incSel]);

  // ── 3D 매스 데이터 ──
  const { parcelLocal, massFloors } = useMemo(() => {
    const s = current?.study;
    const site = parseFloat(areaM2) || 0;
    // 대지 링: 실필지 > 폭×깊이 직사각형 > 정사각형
    let base: Pt[] | null = null;
    if (parcelRing && parcelRing.length >= 3) base = ringToLocalMeters(parcelRing);
    else if (parseFloat(northW) > 0 && parseFloat(depth) > 0) base = rectRing(parseFloat(northW), parseFloat(depth));
    else if (site > 0) { const w = Math.sqrt(site); base = rectRing(w, w); }
    if (!s || !base) return { parcelLocal: base, massFloors: [] as MassFloor[] };

    const fullArea = ringArea(base);
    const foot = scaleToArea(base, Math.min(s.massing.footprintM2, fullArea * 0.98));
    const footArea = ringArea(foot);

    const floors: MassFloor[] = [];
    for (const f of s.stack.above) {
      const ring = f.plateM2 < footArea * 0.985 ? clipToAreaFromNorth(foot, f.plateM2) : foot;
      floors.push({
        ring, z0: f.topHeightM - f.floorHeightM, h: f.floorHeightM,
        color: (FACILITIES as Record<string, { color: string }>)[f.use]?.color ?? USE_COLORS[f.use as UseKey] ?? "#94a3b8",
      });
    }
    s.stack.below.forEach((b, i) => {
      floors.push({ ring: foot, z0: -3.5 * (i + 1), h: 3.4, color: "#94a3b8", below: true });
    });
    return { parcelLocal: base, massFloors: floors };
  }, [current, parcelRing, areaM2, northW, depth]);

  const s = current?.study;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="logo"><span className="mark">V</span> Volume Studio</div>
        <span className="sub">주소 → 법규 검토 → 3D 매스·규모검토 (초기 검토용)</span>
      </header>

      <div className="main">
        {/* ── 좌: 입력 ── */}
        <aside className="lpanel">
          <div className="sec">
            <div className="sec-t">① 대지</div>
            <div className="field">
              <label>주소 — 조회 시 면적·용도지역·필지형상 자동</label>
              <div className="row">
                <input className="inp" value={address} placeholder="예: 서울 성동구 성수동2가 277-52"
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && lookup()} />
                <button className="btn btn-dark" onClick={lookup} disabled={lookupBusy}>
                  {lookupBusy ? "…" : "조회"}
                </button>
              </div>
              {lookupMsg && <div className={lookupMsg.ok ? "note-ok" : "note-bad"}>{lookupMsg.ok ? "✓ " : ""}{lookupMsg.text}</div>}
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>대지면적 (㎡)</label>
                <input className="inp" type="number" value={areaM2} onChange={(e) => { setAreaM2(e.target.value); setParcelRing(null); }} />
              </div>
              <div className="field" style={{ width: 90 }}>
                <label>평</label>
                <input className="inp" disabled value={areaM2 ? py(parseFloat(areaM2) || 0) : ""} />
              </div>
            </div>
            <div className="field">
              <label>용도지역 {zone && `· 건폐율 ${zone.seoulBCR}% / 용적률 ${zone.seoulFAR}% (서울조례)`}</label>
              <select className="inp" value={zoneKey} onChange={(e) => setZoneKey(e.target.value as ZoneKey)}>
                {ZONE_LIST.map((z) => <option key={z.key} value={z.key}>{z.name}</option>)}
              </select>
            </div>
            {districts.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {districts.map((d) => (
                  <div key={d.layer} className="check review" style={{ marginBottom: 4 }}>
                    <div className="check-h"><b>{d.layer}</b></div>
                    <div className="check-b">{d.names.join(" · ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sec">
            <div className="sec-t">② 무엇을 짓고 싶으세요? (복수 선택)</div>
            <div className="chips">
              {EASY.map((e) => (
                <button key={e.key} className={`chip${easySel[e.key] ? " on" : ""}`}
                  style={easySel[e.key] ? { background: FACILITIES[e.key].color, borderColor: FACILITIES[e.key].color } : {}}
                  onClick={() => setEasySel((s) => ({ ...s, [e.key]: !s[e.key] }))}>
                  <span className="dot" style={{ background: easySel[e.key] ? "#fff" : FACILITIES[e.key].color }} />
                  <span>{e.label}<small style={{ display: "block", fontSize: 10, fontWeight: 500, opacity: .75 }}>{e.desc}</small></span>
                </button>
              ))}
            </div>
            <label className="prog-fill" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={withRetail} onChange={(e) => setWithRetail(e.target.checked)} />
              1~2층에 상가(근린생활시설) 자동 포함
            </label>
          </div>

          <button className="btn btn-primary" onClick={runEasy}>이 땅에 뭘 지을 수 있는지 보기</button>
          {err && <div className="note-bad">{err}</div>}
          <p className="hint">법규(건폐율·용적률·일조·고도·주차)를 자동 반영해 최대 규모를 계산합니다. 유닛 평수·면적을 직접 지정하려면 아래 고급 설정을 여세요.</p>

          <details className="advbox">
            <summary>고급 설정 (전문가용 — 유닛·면적 직접 지정, 인센티브, 사업성)</summary>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>북측 폭 (m)</label>
                <input className="inp" type="number" value={northW} onChange={(e) => { setNorthW(e.target.value); setParcelRing(null); }} placeholder="일조 검토용" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>남북 깊이 (m)</label>
                <input className="inp" type="number" value={depth} onChange={(e) => { setDepth(e.target.value); setParcelRing(null); }} placeholder="선택" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>전면도로 (m)</label>
                <input className="inp" type="number" value={roadW} onChange={(e) => setRoadW(e.target.value)} placeholder="접도검토" />
              </div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>높이제한 (m, 고도지구·가로구역)</label>
                <input className="inp" type="number" value={heightLim} placeholder="주소 조회 시 자동"
                  onChange={(e) => setHeightLim(e.target.value)} />
              </div>
            </div>

          <div className="sec">
            <div className="sec-t">② 시설 프로그램 — 면적·유닛(평×개수)으로 직접 구성</div>
            {progRows.map((r, i) => {
              const d = FACILITIES[r.facility];
              return (
                <div key={i} className="prog-row">
                  <div className="prog-head">
                    <span className="dot" style={{ background: d.color }} />
                    <select className="inp prog-sel" value={r.facility}
                      onChange={(e) => setProgRows((rs) => rs.map((x, j) => j === i
                        ? { ...x, facility: e.target.value as FacilityKey, unitPy: String(FACILITIES[e.target.value as FacilityKey].defaultUnitPy ?? 20) } : x))}>
                      {FACILITY_KEYS.map((k) => <option key={k} value={k}>{FACILITIES[k].label}</option>)}
                    </select>
                    <button className="prog-x" onClick={() => setProgRows((rs) => rs.filter((_, j) => j !== i))}>×</button>
                  </div>
                  <div className="row">
                    <div className="field" style={{ flex: 1, margin: 0 }}>
                      <label>{d.unitLabel} 전용(평)</label>
                      <input className="inp" type="number" value={r.unitPy}
                        onChange={(e) => setProgRows((rs) => rs.map((x, j) => j === i ? { ...x, unitPy: e.target.value } : x))} />
                    </div>
                    <div className="field" style={{ flex: 1, margin: 0 }}>
                      <label>{d.unitLabel} 수(목표)</label>
                      <input className="inp" type="number" placeholder="—" value={r.unitCount}
                        onChange={(e) => setProgRows((rs) => rs.map((x, j) => j === i ? { ...x, unitCount: e.target.value, fill: false } : x))} />
                    </div>
                    <div className="field" style={{ flex: 1, margin: 0 }}>
                      <label>또는 연면적(평)</label>
                      <input className="inp" type="number" placeholder="—" value={r.targetPy} disabled={r.fill || !!r.unitCount}
                        onChange={(e) => setProgRows((rs) => rs.map((x, j) => j === i ? { ...x, targetPy: e.target.value } : x))} />
                    </div>
                  </div>
                  <label className="prog-fill">
                    <input type="checkbox" checked={r.fill} disabled={!!r.unitCount}
                      onChange={(e) => setProgRows((rs) => rs.map((x, j) => j === i ? { ...x, fill: e.target.checked, targetPy: "" } : x))} />
                    잔여 용적률 전부 배정
                  </label>
                </div>
              );
            })}
            <button className="btn btn-dark" style={{ width: "100%", marginTop: 4 }}
              onClick={() => setProgRows((rs) => [...rs, { facility: "office", unitPy: "50", unitCount: "", targetPy: "", fill: false }])}>
              + 시설 추가
            </button>
            {s && (
              <div className="gauge">
                <div className="gauge-bar">
                  <i style={{ width: `${Math.min(100, (s.capacity.usedGfaPy / Math.max(s.capacity.maxGfaPy, 1)) * 100)}%` }} />
                </div>
                <span>가용 {s.capacity.maxGfaPy.toLocaleString()}평 중 {s.capacity.usedGfaPy.toLocaleString()}평 사용 · 잔여 {s.capacity.remainingGfaPy.toLocaleString()}평</span>
              </div>
            )}
            <p className="hint">유닛 수를 넣으면 필요 연면적을 역산합니다. 순서 = 적층 순서와 무관(시설별 표준 저층→고층 자동).</p>
          </div>

          <button className="btn btn-dark" style={{ width: "100%" }} onClick={run}>고급 구성으로 산출</button>

          <div className="sec">
            <div className="sec-t">④ 사업성 (선택 — 입력 시 수익·가치 산출)</div>
            <div className="chips" style={{ marginBottom: 8 }}>
              {USE_KEYS.map((u) => (
                <div className="field" key={u} style={{ margin: 0 }}>
                  <label style={{ color: USE_COLORS[u] }}>{USE_LABELS[u]} 임대료 (만원/평/월)</label>
                  <input className="inp" type="number" value={rents[u]} placeholder="—"
                    onChange={(e) => setRents((r) => ({ ...r, [u]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>공사비 (만원/평)</label>
                <input className="inp" type="number" value={constCost} placeholder="예: 900"
                  onChange={(e) => setConstCost(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>토지비 (억원)</label>
                <input className="inp" type="number" value={landCost} placeholder="선택"
                  onChange={(e) => setLandCost(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="sec">
            <div className="sec-t">⑤ 용적률 인센티브 (완화 적용 시뮬레이션)</div>
            {INCENTIVES.map((inc) => (
              <label key={inc.id} className="inc-row">
                <input type="checkbox" checked={incSel.includes(inc.id)}
                  onChange={(e) => setIncSel((s) => e.target.checked ? [...s, inc.id] : s.filter((x) => x !== inc.id))} />
                <span>
                  <b>{inc.title}</b> <em>×{inc.farMultiplier}{inc.verified ? " · 원문대조" : ""}</em>
                  <small>{inc.condition}</small>
                </span>
              </label>
            ))}
            {incApplied.farMultiplier > 1 && zone && (
              <div className="note-ok">용적률 {zone.seoulFAR}% → <b>{Math.round(zone.seoulFAR * incApplied.farMultiplier)}%</b> 적용{incApplied.stacked ? " · ⚠ 복수 완화 중복은 건축위원회 심의 사항" : ""}</div>
            )}
          </div>

          </details>

          <p className="disclaimer">{VOLUME_DISCLAIMER}</p>
        </aside>

        {/* ── 중: 3D 매스 ── */}
        <section className="viewer">
          <MassingViewer parcel={parcelLocal} floors={massFloors} />
          {s ? (
            <>
              <div className="overlay">
                <div className="big">지상 {s.massing.floorsAbove}층 · {s.massing.buildingHeightM}m</div>
                <div className="small">
                  연면적 {n0(s.massing.effectiveGfaAboveM2)}㎡ ({py(s.massing.effectiveGfaAboveM2)}평)
                  · 지하 {s.parking.basementFloors}층 · 주차 {s.parking.requiredStalls}대
                  {jibun ? ` · ${jibun}` : ""}
                </div>
              </div>
              <div className="legend">
                {(s as FacilityStudy).programRows.filter((r) => r.gfaPy > 0).map((r) => (
                  <span key={r.facility}><i style={{ background: FACILITIES[r.facility].color }} />{r.label.split("(")[0]}</span>
                ))}
                <span><i style={{ background: "#94a3b8" }} />주차(지하)</span>
              </div>
              <div className="viewer-hint">드래그 회전 · 휠 줌 · 우클릭 이동 | 빨간 콘 = 정북</div>
            </>
          ) : (
            <div className="viewer-empty">
              주소를 조회하거나 대지 정보를 입력하고<br />
              <b>볼륨 산출</b>을 누르면 이 자리에 매스가 올라갑니다
            </div>
          )}
        </section>

        {/* ── 우: 건축개요 / 층별 면적표 ── */}
        <aside className="rpanel">
          {!s ? (
            <p className="hint">산출 후 대안 비교·건축개요·층별 면적표가 표시됩니다.</p>
          ) : (
            <>
              {/* 쉬운 요약 */}
              <div className="reco">
                <div className="t">한눈에 보기</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e3a8a", lineHeight: 1.6 }}>
                  이 땅에는 <u>지상 {s.massing.floorsAbove}층 · 연면적 약 {py(s.massing.effectiveGfaAboveM2)}평</u>까지 지을 수 있어요.
                </div>
                <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4, lineHeight: 1.7 }}>
                  {(s as FacilityStudy).programRows.filter((r) => r.gfaPy > 0).map((r) =>
                    `${r.label.split("(")[0]} ${r.floors}개층${r.achievedUnits > 0 && FACILITIES[r.facility].unitLabel !== "구획" ? ` ${r.achievedUnits}${FACILITIES[r.facility].unitLabel}` : ""}`
                  ).join(" + ")} · 주차 {s.parking.requiredStalls}대(지하 {s.parking.basementFloors}층)
                </div>
              </div>

              {/* 시설 프로그램 결과 */}
              <div className="sec">
                <div className="sec-t">시설 프로그램 산출 — 유닛·층당 배치</div>
                <table className="spec">
                  <thead><tr><th>시설</th><th>연면적</th><th>전용</th><th>유닛</th><th>층당</th><th>층수·주차</th></tr></thead>
                  <tbody>
                    {(s as FacilityStudy).programRows.map((r) => (
                      <tr key={r.facility} style={r.clamped ? { background: "#fff7f7" } : {}}>
                        <td><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: FACILITIES[r.facility].color, marginRight: 5 }} />
                          {r.label}
                          <span className={`badge ${r.allowance === "allowed" ? "ok" : r.allowance === "conditional" ? "cond" : "no"}`} style={{ marginLeft: 4 }}>
                            {r.allowance === "allowed" ? "허용" : r.allowance === "conditional" ? "조건부" : "불허"}</span>
                        </td>
                        <td>{r.gfaPy.toLocaleString()}평</td>
                        <td><b>{r.netPy.toLocaleString()}평</b></td>
                        <td>{r.achievedUnits}{r.requestedUnits ? `/${r.requestedUnits}` : ""}{FACILITIES[r.facility].unitLabel}<div style={{ fontSize: 10, color: "var(--muted)" }}>{r.unitPy}평/유닛</div></td>
                        <td>{r.unitsPerFloor}</td>
                        <td>{r.floors}층 · {r.stalls}대</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 시설별 법규 유의사항 */}
              <div className="sec">
                <div className="sec-t">시설별 법규 유의사항 (주택법·관광진흥법·체육시설법 등)</div>
                {(s as FacilityStudy).programRows.map((r) => (
                  <div key={r.facility} className="check review">
                    <div className="check-h"><b>{r.label}</b><span style={{ fontSize: 10, color: "var(--muted)" }}>{FACILITIES[r.facility].law}</span></div>
                    {r.notes.map((n, i) => <div key={i} className="check-b">· {n}</div>)}
                  </div>
                ))}
              </div>

              {/* 사업성 검토 */}
              {econ && (
                <div className="sec">
                  <div className="sec-t">사업성 검토 (개략)</div>
                  <div className="kv">
                    <span className="k">월 임대수익</span><span className="v">{econ.monthlyRentManwon.toLocaleString()}만원</span>
                    <span className="k">연 임대수익</span><span className="v">{econ.annualRentEok.toLocaleString()}억</span>
                    <span className="k">보증금 추정</span><span className="v">{econ.depositEok.toLocaleString()}억</span>
                    {econ.valueAtCap.map((v) => (
                      <span key={v.cap} style={{ display: "contents" }}>
                        <span className="k">자산가치 @{v.cap}%</span>
                        <span className="v" style={v.cap === 5.0 ? { color: "var(--accent)" } : {}}>{v.valueEok.toLocaleString()}억</span>
                      </span>
                    ))}
                    {econ.totalCostEok != null && <>
                      <span className="k">총사업비 (토지+공사)</span><span className="v">{econ.totalCostEok.toLocaleString()}억</span>
                      <span className="k">Yield on Cost</span><span className="v">{econ.yieldOnCostPct}%</span>
                      <span className="k">마진 (가치@5.0−사업비)</span>
                      <span className="v" style={{ color: (econ.marginEok ?? 0) >= 0 ? "var(--ok)" : "var(--bad)" }}>
                        {econ.marginEok?.toLocaleString()}억
                      </span>
                    </>}
                  </div>
                  <p className="hint">순면적 기준 · 공실/운영비/금융비 미반영 · 보증금 = 월세×(리테일12/기타10개월) · 캡레이트 {CAP_RATES.join("/")}%</p>
                </div>
              )}

              <div className="sec">
                <div className="sec-t">건축개요</div>
                <div className="kv">
                  <span className="k">대지면적</span><span className="v">{n0(s.input.siteAreaM2)}㎡ ({py(s.input.siteAreaM2)}평)</span>
                  <span className="k">용도지역</span><span className="v">{s.input.zoneName}</span>
                  <span className="k">건축면적</span><span className="v">{n0(s.massing.footprintM2)}㎡</span>
                  <span className="k">건폐율</span><span className="v">{s.regulation.appliedBCR}% 적용</span>
                  <span className="k">지상 연면적</span><span className="v">{n0(s.massing.effectiveGfaAboveM2)}㎡</span>
                  <span className="k">지하 연면적</span><span className="v">{n0(s.parking.parkingAreaM2)}㎡</span>
                  <span className="k">용적률</span><span className="v">{s.regulation.appliedFAR}% 적용</span>
                  <span className="k">규모</span><span className="v">지하 {s.parking.basementFloors}층 / 지상 {s.massing.floorsAbove}층</span>
                  <span className="k">최고 높이</span><span className="v">{s.massing.buildingHeightM}m</span>
                  <span className="k">주차대수</span><span className="v">{s.parking.requiredStalls}대 (법정)</span>
                  {s.totals.totalUnits > 0 && <><span className="k">세대수</span><span className="v">{s.totals.totalUnits}세대</span></>}
                  {s.totals.totalRooms > 0 && <><span className="k">객실수</span><span className="v">{s.totals.totalRooms}실</span></>}
                </div>
              </div>

              <div className="sec">
                <div className="sec-t">층별 면적표 (위 → 아래)</div>
                <table className="spec">
                  <thead><tr><th>층</th><th>용도</th><th>바닥(㎡)</th><th>전용(㎡)</th><th>비고</th></tr></thead>
                  <tbody>
                    {[...s.stack.above].reverse().map((f) => (
                      <tr key={f.level}>
                        <td>{f.level}</td>
                        <td><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: USE_COLORS[f.use as UseKey] ?? "#94a3b8", marginRight: 5 }} />{f.useLabel}</td>
                        <td>{n0(f.plateM2)}</td>
                        <td>{n0(f.netM2)}</td>
                        <td>{f.count != null ? `${f.count}${f.countLabel}` : ""}</td>
                      </tr>
                    ))}
                    {s.stack.below.map((f) => (
                      <tr key={f.level} style={{ color: "var(--muted)" }}>
                        <td>{f.level}</td><td>주차</td><td>{n0(f.plateM2)}</td><td>—</td><td>{f.stalls}대</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 법규 체크리스트 */}
              <div className="sec">
                <div className="sec-t">법규 체크리스트 — {checks.filter((c) => c.status === "action").length}건 조치 · {checks.filter((c) => c.status === "review").length}건 확인</div>
                {checks.map((c) => (
                  <div key={c.id} className={`check ${c.status}`}>
                    <div className="check-h">
                      <span className={`badge ${c.status === "ok" ? "ok" : c.status === "action" ? "no" : c.status === "review" ? "cond" : ""}`}>
                        {c.status === "ok" ? "충족" : c.status === "action" ? "조치" : c.status === "review" ? "확인" : "해당없음"}
                      </span>
                      <b>{c.title}</b>
                      {c.verified && <em>원문대조</em>}
                    </div>
                    <div className="check-b">{c.detail}</div>
                    <div className="check-f">{c.basis}</div>
                  </div>
                ))}
              </div>

              {/* 추가 완화 검토 대상 (대상지 조건부) */}
              <div className="sec">
                <div className="sec-t">추가 인센티브 검토 대상 (대상지 조건 확인 필요)</div>
                {SITE_SPECIFIC_INCENTIVES.map((i) => (
                  <div key={i.title} className="check review">
                    <div className="check-h"><b>{i.title}</b></div>
                    <div className="check-b">{i.note}</div>
                    <div className="check-f">{i.basis}</div>
                  </div>
                ))}
              </div>

              {s.solar.applied === false && s.solar.reason.includes("미입력") && (
                <div className="warnbox">⚠ {s.solar.reason}</div>
              )}
              {s.warnings.length > 0 && (
                <div className="warnbox" style={{ marginTop: 8 }}>
                  {s.warnings.map((w, i) => <div key={i}>· {w}</div>)}
                </div>
              )}
              <p className="disclaimer">{VOLUME_DISCLAIMER}</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
