"use client";

import { useEffect, useState, useMemo } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { formatCount } from "@/lib/formatters";
import { estimateRent, type RentEstimate } from "@/lib/rent-estimator";
import BrandSynergy from "@/components/Pro/BrandSynergy";
import GrowthPrediction from "@/components/Pro/GrowthPrediction";
import type { OpportunityItem } from "@/lib/types";

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

/* 업종별 적정 임대비율 (매출 대비 월세 %) — BrandSynergy와 동일 기준 */
const RENT_RATIO_BY_CATEGORY: Record<string, number> = {
  "외식": 0.12, "카페/주류": 0.15, "소매/유통": 0.07,
  "뷰티/건강": 0.10, "교육": 0.10, "생활서비스": 0.06, "여가/오락": 0.12,
};

function RentVerification({ guName }: { guName: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentNearby, setRentNearby] = useState<any>(null);
  const [inputRent, setInputRent] = useState("");
  const [selectedPyeong, setSelectedPyeong] = useState(10);
  const [inputFloor, setInputFloor] = useState("1층");
  const [verified, setVerified] = useState<null | { status: string; message: string; color: string; avgPP?: number }>(null);
  const [rentLoading, setRentLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // 교차검증용 추가 데이터
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentApiData, setRentApiData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [saleLiveData, setSaleLiveData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rentLiveData, setRentLiveData] = useState<any>(null);

  const clickedLat = useAnalysisStore((s) => s.clickedLat);
  const clickedLng = useAnalysisStore((s) => s.clickedLng);
  const radius = useAnalysisStore((s) => s.radius);
  const analysisData = useAnalysisStore((s) => s.analysisData);

  // 부동산원 호가 + 임대 실거래 + 매매 실거래 fetch (구 변경 시)
  useEffect(() => {
    if (!guName) return;
    const gu = encodeURIComponent(guName);
    Promise.all([
      fetch(`/api/rent/${gu}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/rent-live/${gu}`).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/sale-live/${gu}`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([a, b, c]) => {
      setRentApiData(a);
      setRentLiveData(b);
      setSaleLiveData(c);
    });
  }, [guName]);

  useEffect(() => {
    if (clickedLat == null || clickedLng == null) return;
    setRentLoading(true);
    setRentNearby(null);
    fetch(`${BASE_URL}/api/rent-nearby?lat=${clickedLat}&lng=${clickedLng}&radius=${radius}&target_pyeong=${selectedPyeong}&gu=${encodeURIComponent(guName)}&_t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { setRentNearby(data); setRentLoading(false); })
      .catch(() => setRentLoading(false));
  }, [clickedLat, clickedLng, radius, selectedPyeong, guName]);

  // 교차검증 결과 계산
  const crossValidation = useMemo<RentEstimate | null>(() => {
    if (!guName) return null;
    const result = estimateRent(
      guName,
      rentApiData,
      rentLiveData,
      saleLiveData,
      selectedPyeong * 3.3, // 평 → m²
      inputFloor,
    );
    return result;
  }, [guName, rentApiData, rentLiveData, saleLiveData, selectedPyeong, inputFloor]);

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
        // 해당 층 데이터 없을 때: 다른 층 데이터로 보정 추정
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
          {/* 시세 비교 결과 */}
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
          <p className="mb-2 text-[11px] font-semibold text-gray-600">
            이 위치 시세 · {selectedPyeong}평 기준
            {rentNearby.fallback
              ? <span className="ml-1 text-amber-600">({rentNearby.fallback_source})</span>
              : ` · ${rentNearby.stats?.["1층"]?.count ?? 0}개 상권`}
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
        </div>
      )}
      {/* ── 교차검증 (3소스 가중평균) ── */}
      {crossValidation && crossValidation.method_details.length > 0 && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-700">📊 교차검증 (신뢰도: {crossValidation.confidence})</p>
            <span className="text-[9px] text-muted">{crossValidation.sources.length}개 소스 종합</span>
          </div>
          <div className="space-y-1.5">
            {crossValidation.method_details.map((m, i) => {
              const maxVal = Math.max(...crossValidation.method_details.map((d) => d.value));
              const barW = maxVal > 0 ? Math.round((m.value / maxVal) * 100) : 0;
              const colors = ["#F59E0B", "#6366F1", "#10B981"];
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-600">{m.method}</span>
                    <span className="font-bold text-gray-800">{m.value}만/평</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: colors[i % 3] }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-indigo-200 pt-2">
            <span className="text-[10px] font-semibold text-gray-700">가중평균 추정 시세</span>
            <span className="text-[13px] font-black text-primary-600">
              {crossValidation.floors.find((f) => f.floor === inputFloor)?.rent_per_pyeong ?? 0}만/평
            </span>
          </div>
          {inputRent && (() => {
            const inputPP = parseInt(inputRent) / selectedPyeong;
            const estPP = crossValidation.floors.find((f) => f.floor === inputFloor)?.rent_per_pyeong ?? 0;
            if (estPP <= 0) return null;
            const diff = Math.round(((inputPP - estPP) / estPP) * 100);
            const isOk = Math.abs(diff) <= 15;
            return (
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold text-white ${isOk ? "bg-emerald-500" : diff > 0 ? "bg-red-400" : "bg-amber-500"}`}>
                  {isOk ? "적정" : diff > 0 ? `+${diff}%` : `${diff}%`}
                </span>
                <span className="text-[9px] text-gray-500">
                  입력 {Math.round(inputPP)}만/평 vs 교차검증 {estPP}만/평
                </span>
              </div>
            );
          })()}
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
                <span className="text-[10px] font-bold text-gray-500">수익환원 교차검증</span>
                <span className="text-[9px] text-muted">임대수입 기반 적정가</span>
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
                        <p className="text-[9px] text-muted">수익률 4.5~5.5% 기준 · {(fairPrice5_5 / 10000).toFixed(1)}~{(fairPrice4_5 / 10000).toFixed(1)}억 범위</p>
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
                  <p className="text-[9px] text-muted">1층 평당 월세 {rentPerPyeongMonth}만 × 12개월 ÷ 토지 시세</p>
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
                    <p className="text-[9px] text-muted">연간 임대수입 {(annualRentPerPyeong * selectedPyeong).toLocaleString()}만 ÷ 매매가</p>
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
