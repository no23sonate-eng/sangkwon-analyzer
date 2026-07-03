"use client";

/* ── Volume Studio — 주소 검색 → 3D 매스 + 규모검토 (밸류맵 Buildit류) ──
   좌: 대지 입력(주소 자동조회) · 중: 필지+매스 3D · 우: 건축개요/층별 면적표
   엔진(lib/zoning)은 순수 TS라 전부 클라이언트에서 계산한다.
*/

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  generateAlternatives, computeEconomics, ZONE_LIST, VOLUME_DISCLAIMER, CAP_RATES,
  type ZoneKey, type UseKey, type Alternative,
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
  const [desired, setDesired] = useState<Record<UseKey, boolean>>({
    residential: true, office: false, retail: true, hotel: false,
  });
  const [parcelRing, setParcelRing] = useState<[number, number][] | null>(null);
  const [northW, setNorthW] = useState("");
  const [depth, setDepth] = useState("");
  const [avgUnit, setAvgUnit] = useState("60");
  const [avgRoom, setAvgRoom] = useState("26");
  const [jibun, setJibun] = useState<string | null>(null);

  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [alts, setAlts] = useState<Alternative[]>([]);
  const [sel, setSel] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  // 사업성 입력 (만원/평/월 · 만원/평 · 억원)
  const [rents, setRents] = useState<Record<UseKey, string>>({ residential: "", office: "", retail: "", hotel: "" });
  const [constCost, setConstCost] = useState("");
  const [landCost, setLandCost] = useState("");

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
      setLookupMsg({
        ok: true,
        text: (d.refined ? `${d.refined} — ` : "") + parts.join(" · ") +
          (d.warnings?.length ? ` ⚠ ${d.warnings.join(" / ")}` : ""),
      });
    } catch {
      setLookupMsg({ ok: false, text: "네트워크 오류 — 국내 네트워크·VWorld 키를 확인하세요." });
    } finally { setLookupBusy(false); }
  }

  // ── 산출 ──
  function run() {
    setErr(null);
    const site = parseFloat(areaM2);
    const uses = USE_KEYS.filter((u) => desired[u]);
    if (!site || site <= 0) { setErr("대지면적을 입력하세요."); return; }
    if (uses.length === 0) { setErr("원하는 용도를 1개 이상 선택하세요."); return; }
    try {
      const list = generateAlternatives(site, zoneKey, uses, {
        avgUnitAreaM2: parseFloat(avgUnit) || undefined,
        avgRoomAreaM2: parseFloat(avgRoom) || undefined,
        northLotWidthM: parseFloat(northW) || undefined,
        lotDepthM: parseFloat(depth) || undefined,
      });
      setAlts(list);
      setSel(0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "산출 오류");
    }
  }

  const current = alts[sel] ?? null;

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
        color: USE_COLORS[f.use as UseKey] ?? "#94a3b8",
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
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>북측 폭 (m)</label>
                <input className="inp" type="number" value={northW} onChange={(e) => { setNorthW(e.target.value); setParcelRing(null); }} placeholder="일조 검토용" />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>남북 깊이 (m)</label>
                <input className="inp" type="number" value={depth} onChange={(e) => { setDepth(e.target.value); setParcelRing(null); }} placeholder="선택" />
              </div>
            </div>
          </div>

          <div className="sec">
            <div className="sec-t">② 원하는 용도 (최대치 자동 배분)</div>
            <div className="chips">
              {USE_KEYS.map((u) => (
                <button key={u} className={`chip${desired[u] ? " on" : ""}`}
                  style={desired[u] ? { background: USE_COLORS[u], borderColor: USE_COLORS[u] } : {}}
                  onClick={() => setDesired((d) => ({ ...d, [u]: !d[u] }))}>
                  <span className="dot" style={{ background: desired[u] ? "#fff" : USE_COLORS[u] }} />
                  {USE_LABELS[u]}
                </button>
              ))}
            </div>
            <p className="hint">리테일+주력용도 → 리테일은 저층 포디움. 용도지역 불허 용도는 자동 제외.</p>
          </div>

          <div className="sec">
            <div className="sec-t">③ 상품 모듈</div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>주거 전용 (㎡/세대)</label>
                <input className="inp" type="number" value={avgUnit} onChange={(e) => setAvgUnit(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>호텔 객실 (㎡/실)</label>
                <input className="inp" type="number" value={avgRoom} onChange={(e) => setAvgRoom(e.target.value)} />
              </div>
            </div>
          </div>

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

          <button className="btn btn-primary" onClick={run}>볼륨 산출</button>
          {err && <div className="note-bad">{err}</div>}
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
                {s.uses.map((u) => (
                  <span key={u.use}><i style={{ background: USE_COLORS[u.use] }} />{u.label}</span>
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
              {/* 대안 비교 카드 */}
              <div className="sec">
                <div className="sec-t">설계 대안 비교 — 클릭하면 매스·표 전환</div>
                {alts.map((a, i) => {
                  const e = computeEconomics(a.study, econInput);
                  const st = a.study;
                  return (
                    <button key={a.id} className={`altcard${i === sel ? " on" : ""}`} onClick={() => setSel(i)}>
                      <div className="altcard-h">
                        <b>{i + 1}. {a.label}</b>
                        {a.recommended && <span className="badge ok">추천</span>}
                      </div>
                      <div className="altcard-b">
                        지상 {st.massing.floorsAbove}층 · 연면적 {py(st.massing.effectiveGfaAboveM2)}평
                        {st.totals.totalUnits > 0 && ` · ${st.totals.totalUnits}세대`}
                        {st.totals.totalRooms > 0 && ` · ${st.totals.totalRooms}실`}
                        {` · 주차 ${st.parking.requiredStalls}대`}
                        {e && <span className="altcard-v"> · 가치 {e.valueAtCap[1].valueEok.toLocaleString()}억<i>@5.0%</i></span>}
                      </div>
                      <div className="altcard-mix">
                        {(Object.entries(st.input.mix) as [UseKey, number][]).filter(([, v]) => v > 0).map(([u, v]) => (
                          <i key={u} style={{ width: `${v}%`, background: USE_COLORS[u] }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>

              {current?.rationale?.length ? (
                <div className="reco">
                  <div className="t">추천 배분 근거</div>
                  <ul>{current.rationale.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              ) : null}

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
                <div className="sec-t">용도별 구성</div>
                <table className="spec">
                  <thead><tr><th>용도</th><th>비율</th><th>연면적</th><th>전용/임대</th><th>층수</th></tr></thead>
                  <tbody>
                    {s.uses.map((u) => (
                      <tr key={u.use}>
                        <td><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: USE_COLORS[u.use], marginRight: 5 }} />
                          {u.label} <span className={`badge ${u.allowance === "allowed" ? "ok" : u.allowance === "conditional" ? "cond" : "no"}`}>
                            {u.allowance === "allowed" ? "허용" : u.allowance === "conditional" ? "조건부" : "불허"}</span></td>
                        <td>{u.sharePct}%</td>
                        <td>{py(u.gfaAboveM2)}평</td>
                        <td><b>{py(u.netAreaM2)}평</b></td>
                        <td>{u.floors ?? 0}층{u.units != null ? ` · ${u.units}세대` : u.rooms != null ? ` · ${u.rooms}실` : ""}</td>
                      </tr>
                    ))}
                    <tr className="total">
                      <td>합계</td><td /><td>{py(s.massing.effectiveGfaAboveM2)}평</td>
                      <td>{py(s.totals.netAreaM2)}평</td><td />
                    </tr>
                  </tbody>
                </table>
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
