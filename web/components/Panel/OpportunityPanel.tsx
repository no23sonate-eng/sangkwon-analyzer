"use client";

import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import BrandSynergy from "@/components/Pro/BrandSynergy";
import GrowthPrediction from "@/components/Pro/GrowthPrediction";
import { useIsAdmin } from "@/lib/use-admin";

const BASE_URL = "";

/* ── 구별 토지 시세 (만원/평) ── 국토부 공시지가 기반 상업지역 실거래 추정 */
const LAND_PRICE: Record<string, number> = {
  "강남구": 12500, "서초구": 9800, "중구": 11000, "종로구": 8500,
  "마포구": 6200, "용산구": 7800, "성동구": 5800, "송파구": 6500,
  "영등포구": 5500, "광진구": 4800, "동작구": 3800, "관악구": 3200,
  "강동구": 4500, "노원구": 2800, "은평구": 3000, "강서구": 3500,
  "강북구": 2500, "구로구": 3400, "금천구": 3100, "도봉구": 2600,
  "동대문구": 4200, "서대문구": 3900, "성북구": 3300, "양천구": 3700,
  "중랑구": 2900,
};

export default function OpportunityPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const opp = analysisData?.opportunities;
  const clickedGu = useAnalysisStore((s) => s.clickedGu);

  if (!opp) {
    return <p className="py-12 text-center text-sm text-muted">기회분석 데이터가 없습니다.</p>;
  }

  const { insights } = opp;
  const vScore = insights?.vitality_score ?? 50;
  const guName = clickedGu || analysisData?.gu_name || "";

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

      {/* ── 2. 임대료 적정성 ── */}
      <RentVerification guName={guName} />

      {/* ── 3. 매매가격 적정성 ── */}
      <LandPriceVerification guName={guName} />

      {/* ── 4. 브랜드 시너지 ── */}
      <section>
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">브랜드 시너지</h3>
        <BrandSynergy />
      </section>

      {/* ── 5. 성장 예측 ── */}
      <section>
        <h3 className="mb-3 text-[14px] font-bold text-gray-900">성장 예측</h3>
        <GrowthPrediction />
      </section>

      {/* ── 6. 상담 CTA ── */}
      <ConsultCTA />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   임대료 적정가 검증
   ══════════════════════════════════════════════════════════════ */

const RENT_AREA_OPTIONS = [
  { pyeong: 10, label: "10평" },
  { pyeong: 30, label: "30평" },
  { pyeong: 50, label: "50평" },
  { pyeong: 100, label: "100평" },
  { pyeong: 200, label: "200평" },
  { pyeong: 300, label: "그 이상" },
];

function RentVerification({ guName }: { guName: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentNearby, setRentNearby] = useState<any>(null);
  const [inputRent, setInputRent] = useState("");
  const [selectedPyeong, setSelectedPyeong] = useState(10);
  const [inputFloor, setInputFloor] = useState("1층");
  const [verified, setVerified] = useState<null | { status: string; message: string; color: string; avgPP?: number }>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const clickedLat = useAnalysisStore((s) => s.clickedLat);
  const clickedLng = useAnalysisStore((s) => s.clickedLng);
  const radius = useAnalysisStore((s) => s.radius);

  useEffect(() => {
    if (clickedLat == null || clickedLng == null) return;
    setRentLoading(true);
    setRentNearby(null);
    fetch(`${BASE_URL}/api/rent-nearby?lat=${clickedLat}&lng=${clickedLng}&radius=${radius}&target_pyeong=${selectedPyeong}&gu=${encodeURIComponent(guName)}&_t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { setRentNearby(data); setRentLoading(false); })
      .catch(() => setRentLoading(false));
  }, [clickedLat, clickedLng, radius, selectedPyeong, guName]);

  const handleVerify = () => {
    const rent = parseInt(inputRent);
    if (!rent || !rentNearby) return;
    setVerifyLoading(true);
    setVerified(null);
    setTimeout(() => {
      const fs = rentNearby.stats[inputFloor];
      let avgPP: number;
      let estimated = false;

      if (fs && fs.count > 0) {
        avgPP = fs.avg_pyeong;
      } else {
        const FLOOR_FACTOR: Record<string, number> = { "1층": 1.0, "2층": 0.65, "지하": 0.5 };
        const targetFactor = FLOOR_FACTOR[inputFloor] ?? 1.0;
        let fallbackPP = 0;
        for (const [floor, factor] of Object.entries(FLOOR_FACTOR)) {
          const other = rentNearby.stats[floor];
          if (other && other.count > 0) {
            fallbackPP = (other.avg_pyeong / factor) * targetFactor;
            break;
          }
        }
        if (fallbackPP <= 0) {
          setVerified({ status: "데이터 부족", message: "주변 임대 사례가 없습니다. 반경을 넓혀 다시 시도해주세요.", color: "#94A3B8" });
          setVerifyLoading(false);
          return;
        }
        avgPP = Math.round(fallbackPP * 10) / 10;
        estimated = true;
      }

      const rentPP = rent / selectedPyeong;
      const ratio = rentPP / avgPP;
      const suffix = estimated ? " (다른 층 기준 추정)" : "";

      if (ratio <= 0.85) setVerified({ status: "저렴", message: `시세 대비 ${Math.round((1 - ratio) * 100)}% 저렴합니다.${suffix}`, color: "#10B981", avgPP });
      else if (ratio <= 1.1) setVerified({ status: "적정", message: `시세 범위 내 적정 수준입니다.${suffix}`, color: "#6366F1", avgPP });
      else if (ratio <= 1.3) setVerified({ status: "다소 높음", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다.${suffix}`, color: "#F59E0B", avgPP });
      else setVerified({ status: "고가", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. 재검토를 권장합니다.${suffix}`, color: "#EF4444", avgPP });
      setVerifyLoading(false);
    }, 2000);
  };

  const fs = rentNearby?.stats?.[inputFloor];

  return (
    <div className="rounded-xl border-2 border-primary-200 bg-white p-4">
      <h3 className="mb-3 text-[15px] font-bold text-gray-900">💰 임대료 적정성</h3>
      <div className="mb-2">
        <label className="mb-1 block text-[10px] font-medium text-muted">면적</label>
        <div className="flex gap-1">
          {RENT_AREA_OPTIONS.map((a) => (
            <button key={a.pyeong} onClick={() => { setSelectedPyeong(a.pyeong); setVerified(null); }}
              className={`flex-1 rounded-lg py-2 text-[11px] font-medium ${selectedPyeong === a.pyeong ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
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
            {verifyLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "검증"}
          </button>
        </div>
      </div>
      {verified && (
        <div className="mb-3 space-y-2">
          <div className="rounded-xl p-4" style={{ background: verified.color + "10" }}>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: verified.color }}>{verified.status}</span>
              <span className="text-[11px] text-gray-500">평당 {Math.round(parseInt(inputRent) / selectedPyeong)}만 vs 시세 {verified.avgPP ?? fs?.avg_pyeong ?? 0}만/평</span>
            </div>
            <p className="mt-2 text-[13px] font-medium text-gray-800">{verified.message}</p>
          </div>
        </div>
      )}
      {rentLoading && (
        <div className="flex flex-col items-center gap-2 py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          <p className="text-[11px] text-muted">{selectedPyeong}평 시세 분석 중...</p>
        </div>
      )}
      {!rentLoading && rentNearby && rentNearby.total_cases > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] font-semibold text-gray-600">이 위치 시세 · {selectedPyeong}평 기준</p>
            {(() => {
              // 출처 배지 + 신뢰도(actual/dong_estimate/gu_fallback)
              const src = rentNearby.fallback_source ?? "";
              const conf = rentNearby.confidence ?? "actual";
              let tone = "emerald";
              let label = `공공 DB ${rentNearby.stats?.["1층"]?.count ?? 0}건`;
              if (src.startsWith("본인 네트워크")) { tone = "violet"; label = "네트워크 실거래"; }
              else if (src.startsWith("동 RTMS")) { tone = "indigo"; label = "동 RTMS 역산"; }
              else if (rentNearby.fallback) {
                if (src.startsWith("추정 실거래") || src.startsWith("현재 호가")) {
                  tone = conf === "gu_fallback" ? "amber" : "indigo";
                  label = src.startsWith("추정 실거래") ? "추정 실거래" : "현재 호가";
                } else {
                  tone = "amber";
                  label = "권역 평균";
                }
              }
              const palette: Record<string, { bg: string; text: string }> = {
                emerald: { bg: "#D1FAE5", text: "#047857" },
                violet: { bg: "#EDE9FE", text: "#5B21B6" },
                indigo: { bg: "#E0E7FF", text: "#4338CA" },
                amber: { bg: "#FEF3C7", text: "#B45309" },
              };
              const p = palette[tone];
              return (
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                  style={{ background: p.bg, color: p.text }}
                  title={src || "반경 내 실측 임대사례 기반"}
                >
                  {label}
                </span>
              );
            })()}
          </div>
          {rentNearby.confidence === "gu_fallback" && (
            <div className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5">
              <p className="text-[10px] font-semibold text-amber-800 leading-snug">
                ⚠️ 동 단위 데이터 부족으로 구 평균을 사용 중입니다. 한남·청담·신사 등 프라임 입지에서는 실시장보다 낮게 잡혀 있을 수 있습니다.
              </p>
            </div>
          )}
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
                  return (
                    <tr key={floor} className={`border-t border-gray-50 ${floor === inputFloor ? "bg-primary-50" : ""}`}>
                      <td className={`px-3 py-2 font-semibold ${floor === inputFloor ? "text-primary-600" : "text-gray-700"}`}>{floor}</td>
                      <td className="px-3 py-2 text-right text-primary-600 font-semibold">{s.count}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{s.avg_pyeong}만</td>
                      <td className="px-3 py-2 text-right text-gray-800">{s.avg_rent.toLocaleString()}만</td>
                      <td className="px-3 py-2 text-right text-gray-600">{s.avg_deposit.toLocaleString()}만</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fs && fs.count > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-[10px] text-muted">{inputFloor} 월세 분포 ({fs.count}건)</p>
              <div className="relative h-6 rounded-full bg-gray-100">
                <div className="absolute top-0 h-full rounded-full bg-primary-100"
                  style={{ left: `${Math.max(0, (fs.min_rent / fs.max_rent) * 100 - 5)}%`, width: `${Math.min(100, 100 - (fs.min_rent / fs.max_rent) * 100 + 10)}%` }} />
                <div className="absolute top-0 h-full w-0.5 bg-primary-600" style={{ left: `${(fs.avg_rent / fs.max_rent) * 100}%` }} />
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

          {/* ── 이 주소 근처 임대 사례 상세 (실측/추정 거래/호가) ── */}
          <RentCasesSection rentNearby={rentNearby} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   매매가격 적정성 + 수익률 분석
   ══════════════════════════════════════════════════════════════ */

const LAND_AREA_OPTIONS = [
  { pyeong: 100, label: "100평" },
  { pyeong: 200, label: "200평" },
  { pyeong: 300, label: "300평" },
  { pyeong: 500, label: "500평" },
  { pyeong: 1000, label: "1000평" },
  { pyeong: 2000, label: "그 이상" },
];

// 면적 대형화 할인율
const LAND_DISCOUNT: Record<number, number> = {
  100: 1.0, 200: 0.92, 300: 0.85, 500: 0.78, 1000: 0.68, 2000: 0.55,
};

function LandPriceVerification({ guName }: { guName: string }) {
  const isAdmin = useIsAdmin();
  const [selectedPyeong, setSelectedPyeong] = useState(100);
  const [inputPrice, setInputPrice] = useState("");
  const [verified, setVerified] = useState<null | { status: string; message: string; color: string; ratio: number }>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // 임대료 데이터 (수익률 계산용)
  const [rentData, setRentData] = useState<{ avg_pyeong: number; avg_rent: number } | null>(null);
  const clickedLat = useAnalysisStore((s) => s.clickedLat);
  const clickedLng = useAnalysisStore((s) => s.clickedLng);
  const radius = useAnalysisStore((s) => s.radius);

  useEffect(() => {
    if (clickedLat == null || clickedLng == null) return;
    fetch(`${BASE_URL}/api/rent-nearby?lat=${clickedLat}&lng=${clickedLng}&radius=${radius}&target_pyeong=30&_t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const f1 = data?.stats?.["1층"];
        if (f1 && f1.count > 0) setRentData({ avg_pyeong: f1.avg_pyeong, avg_rent: f1.avg_rent });
      })
      .catch(() => {});
  }, [clickedLat, clickedLng, radius]);

  // 구별 기준 토지 시세
  const basePricePerPyeong = LAND_PRICE[guName] ?? 4000;
  const discount = LAND_DISCOUNT[selectedPyeong] ?? 0.55;
  const adjustedPricePerPyeong = Math.round(basePricePerPyeong * discount);
  const estimatedTotal = adjustedPricePerPyeong * selectedPyeong;

  // 수익률 계산
  const rentPerPyeongMonth = rentData?.avg_pyeong ?? 0;
  const annualRentPerPyeong = rentPerPyeongMonth * 12;
  const marketYield = adjustedPricePerPyeong > 0 ? (annualRentPerPyeong / adjustedPricePerPyeong) * 100 : 0;

  const inputPriceNum = Math.round((parseFloat(inputPrice) || 0) * 10000); // 억→만 변환
  const inputPricePerPyeong = inputPriceNum > 0 ? Math.round(inputPriceNum / selectedPyeong) : 0;
  const inputYield = inputPricePerPyeong > 0 ? (annualRentPerPyeong / inputPricePerPyeong) * 100 : 0;

  const handleVerify = () => {
    if (!inputPriceNum) return;
    setVerifyLoading(true);
    setVerified(null);
    setTimeout(() => {
      const ratio = inputPricePerPyeong / adjustedPricePerPyeong;
      if (ratio <= 0.85) setVerified({ status: "저평가", message: `시세 대비 ${Math.round((1 - ratio) * 100)}% 저렴합니다. 매수 기회입니다.`, color: "#10B981", ratio });
      else if (ratio <= 1.1) setVerified({ status: "적정", message: "시세 범위 내 적정 가격입니다.", color: "#6366F1", ratio });
      else if (ratio <= 1.3) setVerified({ status: "다소 높음", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. 협상 여지가 있습니다.`, color: "#F59E0B", ratio });
      else setVerified({ status: "고평가", message: `시세 대비 ${Math.round((ratio - 1) * 100)}% 높습니다. 재검토 권장합니다.`, color: "#EF4444", ratio });
      setVerifyLoading(false);
    }, 2000);
  };

  return (
    <div className="rounded-xl border-2 border-emerald-200 bg-white p-4">
      <h3 className="mb-3 text-[15px] font-bold text-gray-900">🏢 매매가격 적정성</h3>
      <p className="mb-3 text-[10px] text-muted">{guName} 상업지역 토지 기준 · 공시지가+실거래 추정</p>

      {/* 토지 면적 선택 */}
      <div className="mb-2">
        <label className="mb-1 block text-[10px] font-medium text-muted">토지 면적</label>
        <div className="flex gap-1">
          {LAND_AREA_OPTIONS.map((a) => (
            <button key={a.pyeong} onClick={() => { setSelectedPyeong(a.pyeong); setVerified(null); }}
              className={`flex-1 rounded-lg py-2 text-[11px] font-medium ${selectedPyeong === a.pyeong ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-500"}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* 시세 정보 */}
      <div className="mb-3 rounded-xl bg-gray-50 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted">평당 추정 시세</p>
            <p className="text-[18px] font-black text-gray-900">{adjustedPricePerPyeong.toLocaleString()}<span className="text-[11px] font-medium text-muted">만원</span></p>
          </div>
          <div>
            <p className="text-[10px] text-muted">{selectedPyeong}평 추정 총액</p>
            <p className="text-[18px] font-black text-gray-900">{(estimatedTotal / 10000).toFixed(1)}<span className="text-[11px] font-medium text-muted">억원</span></p>
          </div>
        </div>
      </div>

      {/* 매매가 입력 */}
      <div className="mb-3">
        <label className="mb-1 block text-[10px] font-medium text-muted">확인하고 싶은 매매가 (억원)</label>
        <div className="flex gap-2">
          <input type="number" step="0.1" value={inputPrice}
            onChange={(e) => { setInputPrice(e.target.value); setVerified(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            placeholder={`예: ${(estimatedTotal / 10000).toFixed(1)}`}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          <button onClick={handleVerify} disabled={!inputPrice || verifyLoading}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-40">
            {verifyLoading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "검증"}
          </button>
        </div>
      </div>

      {/* 검증 결과 */}
      {verified && (
        <div className="mb-3 space-y-2">
          <div className="rounded-xl p-4" style={{ background: verified.color + "10" }}>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: verified.color }}>{verified.status}</span>
              <span className="text-[11px] text-gray-500">
                평당 {inputPricePerPyeong.toLocaleString()}만 vs 시세 {adjustedPricePerPyeong.toLocaleString()}만/평
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium text-gray-800">{verified.message}</p>
          </div>
          {/* 수익환원 교차검증 — 임대수입 기반 적정 매매가 */}
          {rentData && rentData.avg_pyeong > 0 && (
            <div className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-gray-500">적정 매매가 검증</span>
                {isAdmin && <span className="text-[9px] text-muted">임대수입 기반 수익환원 (4.5~5.5%)</span>}
              </div>
              {(() => {
                // 적정 매매가 = 연간 임대수입 / 적정 수익률(4.5%)
                const annualRent = rentData.avg_pyeong * 12 * selectedPyeong; // 만원
                const fairPrice4_5 = Math.round(annualRent / 0.045); // 수익률 4.5% 기준
                const fairPrice5_5 = Math.round(annualRent / 0.055); // 수익률 5.5% 기준
                const fairPriceAvg = Math.round((fairPrice4_5 + fairPrice5_5) / 2);
                return (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] text-muted">임대수입 기준 적정 매매가</p>
                        <p className="text-[20px] font-black text-gray-900">
                          {(fairPriceAvg / 10000).toFixed(1)}<span className="text-[12px] font-medium text-muted">억원</span>
                        </p>
                        <p className="text-[9px] text-muted">{(fairPrice5_5 / 10000).toFixed(1)}~{(fairPrice4_5 / 10000).toFixed(1)}억 범위{isAdmin && " · 수익률 4.5~5.5% 기준"}</p>
                      </div>
                      {inputPriceNum > 0 && (
                        <div className="text-right">
                          {(() => {
                            const diff = Math.round(((inputPriceNum - fairPriceAvg) / fairPriceAvg) * 100);
                            const isOk = Math.abs(diff) <= 15;
                            return (
                              <div>
                                <p className={`text-[14px] font-bold ${isOk ? "text-emerald-600" : diff > 0 ? "text-red-500" : "text-blue-600"}`}>
                                  {diff > 0 ? "+" : ""}{diff}%
                                </p>
                                <p className="text-[9px] text-muted">{isOk ? "적정 범위" : diff > 0 ? "수익률 대비 고가" : "수익률 대비 저평가"}</p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── 수익률 분석 ── */}
      {rentData && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-[12px] font-bold text-gray-800">📈 예상 수익률 분석</p>

          <div className="space-y-2">
            {/* 시세 기준 수익률 */}
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-medium text-emerald-600">시세 기준 예상 수익률</p>
                  {isAdmin && <p className="text-[9px] text-muted">1층 평당 월세 {rentPerPyeongMonth}만 × 12개월 ÷ 토지 시세</p>}
                </div>
                <p className={`text-[22px] font-black ${marketYield >= 5 ? "text-emerald-600" : marketYield >= 3 ? "text-amber-600" : "text-red-500"}`}>
                  {marketYield.toFixed(1)}<span className="text-[12px]">%</span>
                </p>
              </div>
            </div>

            {/* 입력가 기준 수익률 */}
            {inputPriceNum > 0 && (
              <div className="rounded-xl bg-blue-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-blue-600">입력가 기준 예상 수익률</p>
                    {isAdmin && <p className="text-[9px] text-muted">연간 임대수입 {(annualRentPerPyeong * selectedPyeong).toLocaleString()}만 ÷ 매매가</p>}
                  </div>
                  <p className={`text-[22px] font-black ${inputYield >= 5 ? "text-emerald-600" : inputYield >= 3 ? "text-amber-600" : "text-red-500"}`}>
                    {inputYield.toFixed(1)}<span className="text-[12px]">%</span>
                  </p>
                </div>
              </div>
            )}

            {/* 적정 수익률 기준선 */}
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="mb-2 text-[10px] font-semibold text-gray-600">수익률 기준</p>
              <div className="space-y-1.5">
                {[
                  { label: "고수익", min: 7, color: "#10B981", desc: "외곽 상업지 수준" },
                  { label: "우수", min: 5, color: "#3B82F6", desc: "우량 상업 부동산" },
                  { label: "적정", min: 3.5, color: "#6366F1", desc: "서울 상업지 평균" },
                  { label: "보통", min: 2.5, color: "#F59E0B", desc: "도심 핵심지 수준" },
                  { label: "미달", min: 0, color: "#EF4444", desc: "재검토 필요" },
                ].map((tier) => {
                  const tiers = [7, 5, 3.5, 2.5, 0];
                  const idx = tiers.indexOf(tier.min);
                  const upper = idx > 0 ? tiers[idx - 1] : Infinity;
                  const current = inputPriceNum > 0 ? inputYield : marketYield;
                  const isActive = current >= tier.min && current < upper;
                  return (
                    <div key={tier.label} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isActive ? "bg-gray-50 ring-1 ring-gray-200" : ""}`}>
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: tier.color }} />
                      <span className={`text-[11px] font-semibold ${isActive ? "text-gray-900" : "text-gray-400"}`}>{tier.label}</span>
                      <span className="text-[10px] text-muted">{tier.min}%{upper < Infinity ? ` ~ ${upper}%` : "+"}</span>
                      <span className="ml-auto text-[9px] text-muted">{tier.desc}</span>
                      {isActive && <span className="text-[9px] font-bold text-primary-600">← 현재</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 수익 시뮬 요약 */}
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="mb-1 text-[10px] font-semibold text-gray-600">예상 월 임대수입 ({selectedPyeong}평)</p>
              <p className="text-[18px] font-black text-gray-900">{(rentPerPyeongMonth * selectedPyeong).toLocaleString()}<span className="text-[11px] font-medium text-muted">만원/월</span></p>
              <p className="text-[10px] text-muted">연 {(annualRentPerPyeong * selectedPyeong).toLocaleString()}만원</p>
            </div>
          </div>
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

/* ── 임대 사례 상세 (공공 실거래·추정 실거래·현재 호가) ── */
type RentCase = {
  date?: string;
  crawl_date?: string;
  dong?: string;
  floor?: string;
  area_m2?: number;
  deposit?: number;
  monthly?: number;
  rent_per_pyeong?: number;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RentCasesSection({ rentNearby }: { rentNearby: any }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"actual" | "deals" | "listings">("deals");

  const actualCases = (rentNearby?.sample_cases ?? []) as Array<{
    floor?: string; rent?: number; deposit?: number; rent_pyeong?: number; distance?: number;
  }>;
  const deals = (rentNearby?.recent_deals ?? []) as RentCase[];
  const listings = (rentNearby?.recent_listings ?? []) as RentCase[];

  const hasAny = actualCases.length > 0 || deals.length > 0 || listings.length > 0;
  if (!hasAny) return null;

  // 기본 탭: 사례가 있는 첫 탭
  const availableTabs = [
    { key: "actual" as const, label: "공공 실거래", count: actualCases.length, caption: "공공 DB · 반경 내" },
    { key: "deals" as const, label: "추정 실거래", count: deals.length, caption: "회수된 매물 기반" },
    { key: "listings" as const, label: "현재 호가", count: listings.length, caption: "현재 매물" },
  ].filter((t) => t.count > 0);

  const activeTab = availableTabs.find((t) => t.key === tab) ? tab : availableTabs[0]?.key;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
      >
        <span className="text-[12px] font-semibold text-gray-700">
          🏢 이 주소 근처 임대 사례 {actualCases.length + deals.length + listings.length}건
        </span>
        <span className="text-[10px] text-muted">{open ? "접기 ▲" : "펼치기 ▼"}</span>
      </button>
      {open && (
        <div className="mt-2">
          <div className="mb-2 flex gap-1">
            {availableTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                  activeTab === t.key
                    ? "bg-primary-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label} <span className="opacity-80">({t.count})</span>
              </button>
            ))}
          </div>

          {activeTab === "actual" && (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted">층</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">거리</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">평당</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">월세</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">보증금</th>
                </tr></thead>
                <tbody>
                  {actualCases.slice(0, 15).map((c, i) => (
                    <tr key={`a-${i}`} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 font-medium text-gray-700">{c.floor}</td>
                      <td className="px-2 py-1.5 text-right text-muted">{c.distance != null ? `${Math.round(c.distance)}m` : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-gray-900">{c.rent_pyeong ?? "—"}만</td>
                      <td className="px-2 py-1.5 text-right text-gray-800">{c.rent?.toLocaleString() ?? "—"}만</td>
                      <td className="px-2 py-1.5 text-right text-gray-600">{c.deposit?.toLocaleString() ?? "—"}만</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "deals" && (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted">거래일</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted">동·층</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">면적</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">평당</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">보/월</th>
                </tr></thead>
                <tbody>
                  {deals.slice(0, 15).map((d, i) => (
                    <tr key={`d-${i}`} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 text-muted">{(d.date ?? "").replaceAll("-", ".")}</td>
                      <td className="px-2 py-1.5 text-gray-700">{d.dong}·{d.floor}</td>
                      <td className="px-2 py-1.5 text-right text-muted">{d.area_m2 ? `${Math.round(d.area_m2)}㎡` : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-gray-900">{d.rent_per_pyeong ?? "—"}만</td>
                      <td className="px-2 py-1.5 text-right text-gray-800">{d.deposit?.toLocaleString() ?? "—"}/{d.monthly?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 py-1.5 text-[9px] text-muted border-t border-gray-50">
                * 회수된 매물을 거래 성사로 추정. 건물명 정보 없음.
              </p>
            </div>
          )}

          {activeTab === "listings" && (
            <div className="overflow-hidden rounded-lg border border-gray-100">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-gray-50">
                  <th className="px-2 py-1.5 text-left font-medium text-muted">수집일</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted">동·층</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">면적</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">평당</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted">보/월</th>
                </tr></thead>
                <tbody>
                  {listings.slice(0, 15).map((l, i) => (
                    <tr key={`l-${i}`} className="border-t border-gray-50">
                      <td className="px-2 py-1.5 text-muted">{(l.crawl_date ?? "").replaceAll("-", ".")}</td>
                      <td className="px-2 py-1.5 text-gray-700">{l.dong}·{l.floor}</td>
                      <td className="px-2 py-1.5 text-right text-muted">{l.area_m2 ? `${Math.round(l.area_m2)}㎡` : "—"}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-gray-900">{l.rent_per_pyeong ?? "—"}만</td>
                      <td className="px-2 py-1.5 text-right text-gray-800">{l.deposit?.toLocaleString() ?? "—"}/{l.monthly?.toLocaleString() ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2 py-1.5 text-[9px] text-muted border-t border-gray-50">
                * 현재 등록된 매물(호가). 실제 거래가와 차이 가능.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
