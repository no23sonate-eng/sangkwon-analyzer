"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Store, Hotel, HeartPulse, AlertTriangle, TrendingUp } from "lucide-react";
import { computeCashflow } from "@/lib/cashflow/engine";
import { buildDefaultInput, CATEGORY_DEFAULTS, CATEGORY_LABEL, DEV_MODE_LABEL } from "@/lib/cashflow/defaults";
import type { Category, CashflowInput, DevMode } from "@/lib/cashflow/types";

/* 백만원 → 억/조 표기 (1억원 = 100백만원, 1조원 = 1,000,000백만원) */
function mm(v: number | null | undefined): string {
  if (v == null) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}조원`;
  if (abs >= 100) return `${sign}${Math.round(abs / 100).toLocaleString()}억원`;
  return `${sign}${Math.round(abs).toLocaleString()}백만`;
}
function pct(v: number | null | undefined, d = 1): string {
  if (v == null || !isFinite(v)) return "-";
  return `${(v * 100).toFixed(d)}%`;
}

const CATEGORY_ICON: Record<Category, typeof Building2> = {
  office: Building2, retail: Store, hotel: Hotel, senior: HeartPulse,
};
const BASIS_STYLE: Record<string, string> = {
  학습: "bg-emerald-50 text-emerald-700",
  추정: "bg-amber-50 text-amber-700",
  입력: "bg-indigo-50 text-indigo-700",
};

export default function CashflowPage() {
  const [category, setCategory] = useState<Category>("office");
  const [devMode, setDevMode] = useState<DevMode>("dev");
  const [input, setInput] = useState<CashflowInput>(() => buildDefaultInput("office", "dev"));

  function reset(cat: Category, mode: DevMode) {
    setCategory(cat); setDevMode(mode);
    setInput(buildDefaultInput(cat, mode));
  }
  function patch(p: Partial<CashflowInput>) { setInput((s) => ({ ...s, ...p })); }
  function patchTranche(k: "trancheA" | "trancheB" | "trancheC", p: Partial<CashflowInput["trancheA"]>) {
    setInput((s) => ({ ...s, [k]: { ...s[k], ...p } }));
  }

  const result = useMemo(() => {
    try { return computeCashflow(input); } catch { return null; }
  }, [input]);

  const d = CATEGORY_DEFAULTS[category];
  const base = exitBase(result);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="mx-auto max-w-[1200px] px-6 py-6">
        {/* 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <Link href="/" className="mb-1 flex items-center gap-1 text-[12px] text-gray-400 hover:text-primary-600">
              <ArrowLeft size={12} /> 대시보드
            </Link>
            <h1 className="text-[22px] font-bold text-gray-900">캐쉬플로우 생성기</h1>
            <p className="text-[13px] text-muted">카테고리·면적만 정하면 학습된 요율로 TIC·조달·운영·Exit·수익률을 자동 산출합니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[400px_1fr]">
          {/* ── 입력 (순차) ── */}
          <div className="space-y-4">
            {/* STEP 1 */}
            <Section step={1} title="카테고리 · 사업방식">
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  return (
                    <button key={c} onClick={() => reset(c, devMode)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition ${
                        category === c ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      <Icon size={16} /> {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                {(Object.keys(DEV_MODE_LABEL) as DevMode[]).map((m) => (
                  <button key={m} onClick={() => reset(category, m)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-[12px] font-medium transition ${
                      devMode === m ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    {DEV_MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </Section>

            {/* STEP 2 면적 + 필수요소 */}
            <Section step={2} title="면적 · 필수 요소">
              <Field label="대지면적 (평)" value={input.landPy} onChange={(v) => patch({ landPy: v })} />
              <Field label="연면적 (평)" value={input.gfaPy} onChange={(v) => patch({ gfaPy: v })} />
              <Field label="전용률 (%)" value={Math.round(input.efficiency * 100)} onChange={(v) => patch({ efficiency: v / 100 })} hint={d.efficiency.basis} />
              {(category === "office" || category === "retail") && <>
                <Field label="임대료 (만원/전용평/월)" value={input.rentPerPyMonthly ?? 0} onChange={(v) => patch({ rentPerPyMonthly: v })} hint={d.rentPerPyMonthly?.basis} />
                <Field label="관리비 (만원/전용평/월)" value={input.mgmtFeePerPy ?? 0} onChange={(v) => patch({ mgmtFeePerPy: v })} hint={d.mgmtFeePerPy?.basis} />
              </>}
              {category === "hotel" && <>
                <Field label="객실수" value={input.roomCount ?? 0} onChange={(v) => patch({ roomCount: v })} hint={`${d.gfaPerRoom?.value}평/실`} />
                <Field label="ADR (원/박)" value={input.adr ?? 0} onChange={(v) => patch({ adr: v })} hint={d.adr?.basis} step={5000} />
              </>}
              {category === "senior" && <>
                <Field label="세대수" value={input.unitCount ?? 0} onChange={(v) => patch({ unitCount: v })} hint={`${d.gfaPerUnit?.value}평/세대`} />
                <Field label="세대당 보증금 (백만원)" value={input.depositPerUnit ?? 0} onChange={(v) => patch({ depositPerUnit: v })} hint={d.depositPerUnit?.basis} step={100} />
                <Field label="세대당 월 이용료 (만원)" value={input.monthlyFeePerUnit ?? 0} onChange={(v) => patch({ monthlyFeePerUnit: v })} hint={d.monthlyFeePerUnit?.basis} />
              </>}
            </Section>

            {/* STEP 3 사업비 */}
            <Section step={3} title="사업비 단가">
              <Field label={devMode === "valueadd" ? "매입가 (만원/대지평)" : "토지비 (만원/대지평)"} value={input.landPricePerPy} onChange={(v) => patch({ landPricePerPy: v })} step={500} />
              <Field label="도급공사비 (만원/연면적평)" value={input.constCostPerPy} onChange={(v) => patch({ constCostPerPy: v })} step={50} hint={d.constCostPerPy[devMode].basis} />
            </Section>

            {/* STEP 4 조달 */}
            <Section step={4} title="조달 구조 (총사업비 대비)">
              <Field label="Equity 비율 (%)" value={Math.round(input.equityRatio * 100)} onChange={(v) => patch({ equityRatio: v / 100 })} />
              <TrancheRow label="Tr.A" t={input.trancheA} onChange={(p) => patchTranche("trancheA", p)} />
              <TrancheRow label="Tr.B" t={input.trancheB} onChange={(p) => patchTranche("trancheB", p)} />
              <TrancheRow label="Tr.C" t={input.trancheC} onChange={(p) => patchTranche("trancheC", p)} />
              <p className="mt-1 text-[11px] text-gray-400">합계 {Math.round((input.equityRatio + input.trancheA.amountRatio + input.trancheB.amountRatio + input.trancheC.amountRatio) * 100)}% (100% 목표)</p>
            </Section>

            {/* STEP 5 일정 */}
            <Section step={5} title="일정 (개월)">
              <Field label="인허가·준비" value={input.permitMonths} onChange={(v) => patch({ permitMonths: v })} />
              <Field label="공사" value={input.constMonths} onChange={(v) => patch({ constMonths: v })} />
              <Field label="운영 (매각까지)" value={input.opsMonths} onChange={(v) => patch({ opsMonths: v })} />
            </Section>

            {/* STEP 6 Exit */}
            <Section step={6} title="Exit">
              <Field label="Terminal Cap (%)" value={round2(input.exitCap * 100)} onChange={(v) => patch({ exitCap: v / 100 })} step={0.1} hint={d.exitCap.basis} />
            </Section>
          </div>

          {/* ── 결과 ── */}
          {!result ? (
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-white p-8 text-[13px] text-muted">입력값을 확인해주세요.</div>
          ) : (
            <div className="space-y-4">
              {/* 요약 KPI */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="총사업비" value={mm(result.ticTotal)} sub={`평당 ${result.ticPerGfaPy.toLocaleString()}만`} />
                <Kpi label="Equity" value={mm(result.financing.equity)} sub={`LTC ${pct(result.financing.ltc, 0)}`} />
                <Kpi label="안정화 NOI" value={mm(result.stabilizedNoi)} sub={`Yield ${pct(result.yieldOnCost)}`} />
                <Kpi label="Levered IRR" value={pct(base?.leveredIrr)} sub={`MoM ${base?.equityMultiple?.toFixed(2) ?? "-"}x`} highlight />
              </div>

              {/* 경고 */}
              {result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 py-0.5 text-[12px] text-amber-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}
                    </div>
                  ))}
                </div>
              )}

              {/* TIC */}
              <Card title="총사업비 (TIC)">
                <table className="w-full text-[12px]">
                  <tbody>
                    {result.tic.map((l, i) => {
                      const first = i === 0 || result.tic[i - 1].category !== l.category;
                      return (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="w-[70px] py-1 align-top text-[11px] text-gray-400">{first ? l.category : ""}</td>
                          <td className="py-1 text-gray-700">
                            {l.name}
                            <span className={`ml-1.5 rounded px-1 py-0.5 text-[9px] ${BASIS_STYLE[l.basis]}`}>{l.basis}</span>
                            <div className="text-[10px] text-gray-400">{l.formula}</div>
                          </td>
                          <td className="py-1 text-right font-medium tabular-nums text-gray-900">{mm(l.amount)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-gray-200 font-bold">
                      <td colSpan={2} className="py-1.5 text-gray-900">합계</td>
                      <td className="py-1.5 text-right tabular-nums text-primary-600">{mm(result.ticTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              {/* 조달 */}
              <Card title="조달">
                <div className="space-y-1.5 text-[12px]">
                  <Row l={`Equity (${pct(input.equityRatio, 0)})`} r={mm(result.financing.equity)} />
                  {result.financing.tranches.map((t) => (
                    <Row key={t.name} l={`${t.name} · ${pct(t.rate, 1)} · 선취 ${pct(t.upfront, 1)}`} r={mm(t.amount)} />
                  ))}
                  <Row l="총 대출" r={mm(result.financing.totalDebt)} bold />
                  <Row l="누적 이자" r={mm(result.financing.interestTotal)} muted />
                  <Row l="LTC" r={pct(result.financing.ltc)} muted />
                </div>
              </Card>

              {/* 운영 */}
              <Card title="운영 (연간 NOI)">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-[10px] text-gray-400">
                    <th className="text-left font-normal">연차</th><th className="text-right font-normal">램프업</th>
                    <th className="text-right font-normal">GOR</th><th className="text-right font-normal">NOI</th>
                  </tr></thead>
                  <tbody>
                    {result.yearlyOps.map((y) => (
                      <tr key={y.year} className="border-b border-gray-50">
                        <td className="py-1 text-gray-700">{y.year}년차</td>
                        <td className="py-1 text-right tabular-nums text-gray-500">{pct(y.rampup, 0)}</td>
                        <td className="py-1 text-right tabular-nums text-gray-700">{mm(y.gor)}</td>
                        <td className="py-1 text-right tabular-nums font-medium text-gray-900">{mm(y.noi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.dscr && <p className="mt-2 text-[11px] text-gray-400">운영기간 DSCR: 최소 {result.dscr.min.toFixed(2)} · 평균 {result.dscr.avg.toFixed(2)}</p>}
              </Card>

              {/* Exit 3안 */}
              <Card title="Exit 시나리오 (cap ±0.5%p)">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-[10px] text-gray-400">
                    <th className="text-left font-normal">Cap</th><th className="text-right font-normal">매각가</th>
                    <th className="text-right font-normal">사업이익</th><th className="text-right font-normal">U-IRR</th>
                    <th className="text-right font-normal">L-IRR</th><th className="text-right font-normal">MoM</th>
                  </tr></thead>
                  <tbody>
                    {result.exits.map((e, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${Math.abs(e.cap - input.exitCap) < 1e-6 ? "bg-primary-50/40 font-medium" : ""}`}>
                        <td className="py-1 tabular-nums text-gray-700">{pct(e.cap)}</td>
                        <td className="py-1 text-right tabular-nums text-gray-700">{mm(e.salePrice)}</td>
                        <td className="py-1 text-right tabular-nums text-gray-900">{mm(e.profit)} <span className="text-[10px] text-gray-400">{pct(e.profitMargin, 0)}</span></td>
                        <td className="py-1 text-right tabular-nums text-gray-600">{pct(e.unleveredIrr)}</td>
                        <td className="py-1 text-right tabular-nums font-semibold text-primary-600">{pct(e.leveredIrr)}</td>
                        <td className="py-1 text-right tabular-nums text-gray-600">{e.equityMultiple?.toFixed(2) ?? "-"}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* 수입 가정 */}
              <Card title="수입·운영 가정">
                {result.assumptions.map((a, i) => (
                  <div key={i} className="border-b border-gray-50 py-1.5 text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-700">{a.label}</span>
                      <span className={`rounded px-1 py-0.5 text-[9px] ${BASIS_STYLE[a.basis]}`}>{a.basis}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">{a.text}</div>
                    {a.source && <div className="text-[10px] text-gray-400">└ {a.source}</div>}
                  </div>
                ))}
                <p className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                  <TrendingUp size={11} /> 요율 근거: docs/cashflow/model-spec.md · 학습 파라미터: cashflow-knowledge.json
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function exitBase(r: ReturnType<typeof computeCashflow> | null) {
  if (!r) return null;
  return r.exits.find((e) => Math.abs(e.cap - r.input.exitCap) < 1e-6) ?? r.exits[0] ?? null;
}
function round2(v: number) { return Math.round(v * 100) / 100; }

/* ── 프리미티브 ── */
function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">{step}</span>
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Field({ label, value, onChange, hint, step = 1 }: { label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-gray-600">{label}{hint && <span className={`ml-1 rounded px-1 text-[9px] ${BASIS_STYLE[hint] ?? "text-gray-400"}`}>{hint}</span>}</span>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-[120px] rounded-md border border-gray-200 px-2 py-1 text-right text-[12px] tabular-nums focus:border-primary-600 focus:outline-none" />
    </label>
  );
}
function TrancheRow({ label, t, onChange }: { label: string; t: CashflowInput["trancheA"]; onChange: (p: Partial<CashflowInput["trancheA"]>) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[34px] text-[12px] font-medium text-gray-600">{label}</span>
      <NumBox v={Math.round(t.amountRatio * 100)} suffix="%" onChange={(v) => onChange({ amountRatio: v / 100 })} title="비율" />
      <NumBox v={round2(t.rate * 100)} suffix="%금리" step={0.1} onChange={(v) => onChange({ rate: v / 100 })} title="금리" />
      <NumBox v={round2(t.upfront * 100)} suffix="%선취" step={0.1} onChange={(v) => onChange({ upfront: v / 100 })} title="선취" />
    </div>
  );
}
function NumBox({ v, suffix, onChange, step = 1, title }: { v: number; suffix: string; onChange: (v: number) => void; step?: number; title?: string }) {
  return (
    <div className="flex flex-1 items-center rounded-md border border-gray-200 px-1.5 py-1" title={title}>
      <input type="number" value={v} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full text-right text-[11px] tabular-nums focus:outline-none" />
      <span className="ml-0.5 text-[9px] text-gray-400">{suffix}</span>
    </div>
  );
}
function Kpi({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-primary-200 bg-primary-50" : "border-gray-100 bg-white"}`}>
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-[17px] font-bold ${highlight ? "text-primary-700" : "text-gray-900"}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}
function Row({ l, r, bold, muted }: { l: string; r: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-gray-100 pt-1.5 font-semibold text-gray-900" : muted ? "text-gray-400" : "text-gray-600"}`}>
      <span>{l}</span><span className="tabular-nums">{r}</span>
    </div>
  );
}
