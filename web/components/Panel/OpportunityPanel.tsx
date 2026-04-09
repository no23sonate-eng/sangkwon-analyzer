"use client";

import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatCount } from "@/lib/formatters";
import Collapsible from "@/components/Collapsible";
import BrandSynergy from "@/components/Pro/BrandSynergy";
import GrowthPrediction from "@/components/Pro/GrowthPrediction";
import RevenueSim from "@/components/Pro/RevenueSim";
import type { OpportunityItem } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const tt = { contentStyle: { background: "#fff", border: "none", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: 12 } };

export default function OpportunityPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const opp = analysisData?.opportunities;
  const clickedGu = useAnalysisStore((s) => s.clickedGu);

  if (!opp) {
    return <p className="py-12 text-center text-sm text-muted">기회분석 데이터가 없습니다.</p>;
  }

  const { insights } = opp;
  const vScore = insights?.vitality_score ?? 50;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── 1. 상권 요약 ── */}
      {insights && (
        <>
          {insights.diagnosis && (
            <div className="rounded-xl bg-primary-50 px-4 py-3">
              <p className="text-[11px] font-semibold text-primary-600">{insights.area_type}</p>
              <p className="mt-0.5 text-[14px] font-bold text-gray-900">{insights.diagnosis}</p>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="활력" value={`${vScore}`} color={vScore >= 65 ? "#10B981" : vScore >= 45 ? "#F59E0B" : "#EF4444"} />
            <MiniStat label="피크" value={insights.peak_time || "-"} />
            <MiniStat label="연령" value={insights.dominant_age || "-"} />
            <MiniStat label="개/폐" value={`${insights.open_count ?? 0}/${insights.close_count ?? 0}`} />
          </div>
        </>
      )}

      {/* ── 2. 임대료 적정가 검증 ── */}
      <RentVerification guName={clickedGu || analysisData?.gu_name || ""} />

      {/* ── 3. 브랜드 시너지 ── */}
      <section>
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">브랜드 시너지</h3>
        <BrandSynergy />
      </section>

      {/* ── 6. 성장 예측 (열림) ── */}
      <section>
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">성장 예측</h3>
        <GrowthPrediction />
      </section>

      {/* ── 7. 매출 시뮬레이션 (열림) ── */}
      <section>
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">매출 시뮬레이션</h3>
        <RevenueSim />
      </section>

      {/* ── 7. 상담 CTA ── */}
      <ConsultCTA />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   임대료 적정가 검증
   ══════════════════════════════════════════════════════════════ */

// 평 기준 면적 옵션 + 체감 계수
const AREA_OPTIONS = [
  { pyeong: 10, m2: 33, label: "10평", discount: 1.0 },
  { pyeong: 30, m2: 99, label: "30평", discount: 0.88 },
  { pyeong: 50, m2: 165, label: "50평", discount: 0.78 },
  { pyeong: 100, m2: 330, label: "100평", discount: 0.65 },
  { pyeong: 200, m2: 660, label: "200평", discount: 0.52 },
];

function RentVerification({ guName }: { guName: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentNearby, setRentNearby] = useState<any>(null);
  const [inputRent, setInputRent] = useState("");
  const [selectedPyeong, setSelectedPyeong] = useState(10);
  const [inputFloor, setInputFloor] = useState("1층");
  const [verified, setVerified] = useState<null | { status: string; message: string; color: string }>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const clickedLat = useAnalysisStore((s) => s.clickedLat);
  const clickedLng = useAnalysisStore((s) => s.clickedLng);
  const radius = useAnalysisStore((s) => s.radius);

  const selectedOption = AREA_OPTIONS.find((a) => a.pyeong === selectedPyeong) ?? AREA_OPTIONS[0];
  const inputArea = selectedOption.m2;
  const areaDiscount = selectedOption.discount;

  useEffect(() => {
    if (clickedLat == null || clickedLng == null) return;
    setRentLoading(true);
    setRentNearby(null);
    const url = `${BASE_URL}/api/rent-nearby?lat=${clickedLat}&lng=${clickedLng}&radius=${radius}&target_pyeong=${selectedPyeong}&_t=${Date.now()}`;
    fetch(url, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        setRentNearby(data);
        setRentLoading(false);
      })
      .catch(() => setRentLoading(false));
  }, [clickedLat, clickedLng, radius, selectedPyeong]);

  const handleVerify = () => {
    const rent = parseInt(inputRent);
    if (!rent || !rentNearby) return;
    setVerifyLoading(true);
    setVerified(null);

    setTimeout(() => {
      const fs = rentNearby.stats[inputFloor];
      if (!fs || fs.count === 0) {
        setVerified({ status: "데이터 부족", message: "해당 층의 사례가 부족합니다", color: "#94A3B8" });
        setVerifyLoading(false);
        return;
      }
      const rentPP = rent / selectedPyeong;
      const avgPP = fs.avg_pyeong;
      const ratio = rentPP / avgPP;

      if (ratio <= 0.85) setVerified({ status: "저렴", message: `시세 대비 ${Math.round((1 - ratio) * 100)}% 저렴합니다. 좋은 조건입니다.`, color: "#10B981" });
      else if (ratio <= 1.1) setVerified({ status: "적정", message: "시세 범위 내 적정 수준입니다.", color: "#6366F1" });
      else if (ratio <= 1.3) setVerified({ status: "다소 높음", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. 협상 여지가 있습니다.`, color: "#F59E0B" });
      else setVerified({ status: "고가", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. 재검토를 권장합니다.`, color: "#EF4444" });
      setVerifyLoading(false);
    }, 2000);
  };

  const fs = rentNearby?.stats?.[inputFloor];

  return (
    <div className="rounded-xl border-2 border-primary-200 bg-white p-4">
      <h3 className="mb-3 text-[15px] font-bold text-gray-900">💰 임대료 적정가 검증</h3>

      {/* 면적 (평 기준) */}
      <div className="mb-2">
        <label className="mb-1 block text-[10px] font-medium text-muted">면적</label>
        <div className="flex gap-1">
          {AREA_OPTIONS.map((a) => (
            <button key={a.pyeong} onClick={() => { setSelectedPyeong(a.pyeong); setVerified(null); }}
              className={`flex-1 rounded-lg py-2 text-[11px] font-medium ${selectedPyeong === a.pyeong ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* 층 */}
      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-medium text-muted">층</label>
        <div className="flex gap-1">
          {["1층", "2층", "지하"].map((f) => (
            <button key={f} onClick={() => { setInputFloor(f); setVerified(null); }}
              className={`flex-1 rounded-lg py-2 text-[11px] font-medium ${inputFloor === f ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 월세 입력 */}
      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-medium text-muted">확인하고 싶은 월세 (만원)</label>
        <div className="flex gap-2">
          <input type="number" value={inputRent}
            onChange={(e) => { setInputRent(e.target.value); setVerified(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder="예: 300"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] font-bold outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
          <button onClick={handleVerify} disabled={!inputRent || !rentNearby || verifyLoading}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-primary-700 active:scale-95 disabled:opacity-40">
            {verifyLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : "검증"}
          </button>
        </div>
      </div>

      {/* 검증 결과 */}
      {verified && (
        <div className="mb-3 rounded-xl p-4" style={{ background: verified.color + "10" }}>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: verified.color }}>
              {verified.status}
            </span>
            <span className="text-[11px] text-gray-500">
              평당 {Math.round(parseInt(inputRent) / selectedPyeong)}만 vs 시세 {fs?.avg_pyeong ?? 0}만/평 ({selectedPyeong}평 기준)
            </span>
          </div>
          <p className="mt-2 text-[13px] font-medium text-gray-800">{verified.message}</p>
        </div>
      )}

      {/* 로딩 */}
      {rentLoading && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <p className="text-[11px] text-muted">{selectedPyeong}평 시세 분석 중...</p>
        </div>
      )}

      {/* 시세 — 로딩 완료 후 표시 */}
      {!rentLoading && rentNearby && rentNearby.total_cases > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-[11px] font-semibold text-gray-600">
            이 위치 시세 · {selectedPyeong}평 기준 · {rentNearby.stats?.["1층"]?.count ?? 0}개 상권
          </p>

          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-gray-50">
                <th className="px-3 py-2 text-left font-medium text-muted">층</th>
                <th className="px-3 py-2 text-right font-medium text-muted">사례</th>
                <th className="px-3 py-2 text-right font-medium text-muted">평당</th>
                <th className="px-3 py-2 text-right font-medium text-muted">{selectedPyeong}평 월세</th>
                <th className="px-3 py-2 text-right font-medium text-muted">보증금</th>
              </tr></thead>
              <tbody>
                {["1층", "2층", "지하"].map((floor) => {
                  const s = rentNearby.stats[floor];
                  if (!s || s.count === 0) return null;
                  const pp = s.avg_pyeong;
                  const totalRent = s.avg_rent;
                  const totalDep = s.avg_deposit;
                  return (
                    <tr key={floor} className={`border-t border-gray-50 ${floor === inputFloor ? "bg-primary-50" : ""}`}>
                      <td className={`px-3 py-2 font-semibold ${floor === inputFloor ? "text-primary-600" : "text-gray-700"}`}>{floor}</td>
                      <td className="px-3 py-2 text-right text-primary-600 font-semibold">{s.count}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{pp}만</td>
                      <td className="px-3 py-2 text-right text-gray-800">{totalRent.toLocaleString()}만</td>
                      <td className="px-3 py-2 text-right text-gray-600">{totalDep.toLocaleString()}만</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 시세 범위 바 */}
          {fs && fs.count > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] text-muted">{inputFloor} 월세 분포 ({fs.count}건)</p>
              <div className="relative h-6 rounded-full bg-gray-100">
                <div className="absolute top-0 h-full rounded-full bg-primary-100"
                  style={{ left: `${Math.max(0, (fs.min_rent / fs.max_rent) * 100 - 5)}%`, width: `${Math.min(100, 100 - (fs.min_rent / fs.max_rent) * 100 + 10)}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-primary-600"
                  style={{ left: `${(fs.avg_rent / fs.max_rent) * 100}%` }} />
                {inputRent && (
                  <div className="absolute -top-1 h-8 w-2 rounded-full bg-red-500"
                    style={{ left: `${Math.min(98, Math.max(2, (parseInt(inputRent) / fs.max_rent) * 100))}%` }} />
                )}
              </div>
              <div className="mt-1 flex justify-between text-[9px] text-muted">
                <span>{fs.min_rent}만</span>
                <span className="font-semibold text-primary-600">평균 {fs.avg_rent}만</span>
                <span>{fs.max_rent}만</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ── 서브 컴포넌트 ── */

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 text-center">
      <p className="text-[9px] text-muted">{label}</p>
      <p className="text-[14px] font-bold" style={{ color: color ?? "#1E293B" }}>{value}</p>
    </div>
  );
}

function ConsultCTA() {
  const selectedTrdar = useAnalysisStore((s) => s.selectedTrdar);
  const areaName = selectedTrdar?.trdar_nm ?? "";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
      <p className="text-[13px] font-semibold text-gray-800">이 상권에 진출을 고려하고 계신가요?</p>
      <a href={`/consultation${areaName ? `?area=${encodeURIComponent(areaName)}` : ""}`}
        className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-gray-900 px-5 py-2 text-[12px] font-semibold text-white hover:bg-gray-800 active:scale-[0.98]">
        무료 상담 신청
      </a>
    </div>
  );
}
