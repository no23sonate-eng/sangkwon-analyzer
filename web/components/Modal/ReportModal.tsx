"use client";

import { useState } from "react";
import { X, FileText, Download, Check, Lock, Crown } from "lucide-react";
import ModalOverlay from "./ModalOverlay";
import { useAnalysisStore } from "@/store/analysisStore";

/* ── 섹션 목록 ── */
const SECTIONS = [
  { id: "overview", label: "상권 개요 및 업종 분포" },
  { id: "footTraffic", label: "유동인구 분석" },
  { id: "rent", label: "임대 시장 동향" },
  { id: "brand", label: "브랜드 시너지 분석" },
  { id: "growth", label: "성장 예측" },
  { id: "revenue", label: "매출 시뮬레이션 결과" },
];

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  isPro: boolean;
  areaName?: string;
}

export default function ReportModal({ open, onClose, isPro: _isPro, areaName = "강남역 상권" }: ReportModalProps) {
  // PDF 리포트는 현재 모두에게 제공 (베타)
  return (
    <ModalOverlay open={open} onClose={onClose}>
      <ProReportContent onClose={onClose} areaName={areaName} />
    </ModalOverlay>
  );
}

/* ═══════════════════════════════════════════
   Pro 유저: 리포트 설정 모달
   ═══════════════════════════════════════════ */

function ProReportContent({ onClose, areaName }: { onClose: () => void; areaName: string }) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.id)),
  );
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const analysisData = useAnalysisStore((s) => s.analysisData);
  const clickedAddress = useAnalysisStore((s) => s.clickedAddress);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === SECTIONS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SECTIONS.map((s) => s.id)));
    }
  };

  const handleGenerate = async () => {
    if (selected.size === 0 || !analysisData) return;
    setStatus("loading");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ReportPDF } = await import("@/components/Report/ReportPDF");
      const generatedAt = new Date().toLocaleDateString("ko-KR");
      const doc = (
        <ReportPDF
          data={analysisData}
          areaName={areaName}
          address={clickedAddress || ""}
          generatedAt={generatedAt}
        />
      );
      const blob = await pdf(doc).toBlob();
      setPdfBlob(blob);
      setStatus("done");
    } catch (err) {
      console.error("PDF 생성 실패:", err);
      alert("PDF 생성 중 오류가 발생했습니다.");
      setStatus("idle");
    }
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${areaName}_상권분석리포트_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="rounded-2xl bg-white p-0 shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
            <FileText size={20} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-gray-900">리포트 추출</h2>
            <p className="mt-0.5 text-[13px] text-muted">{areaName}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* 본문 */}
      <div className="px-6 py-5">
        {status === "idle" && (
          <>
            {/* 전체 선택 */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-gray-700">
                포함할 섹션을 선택하세요
              </span>
              <button
                onClick={toggleAll}
                className="text-[12px] font-medium text-primary-600 hover:text-primary-700"
              >
                {selected.size === SECTIONS.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>

            {/* 체크박스 목록 */}
            <div className="space-y-1">
              {SECTIONS.map((sec) => {
                const checked = selected.has(sec.id);
                return (
                  <label
                    key={sec.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                      checked ? "bg-primary-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                        checked
                          ? "border-primary-600 bg-primary-600"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked && <Check size={13} className="text-white" strokeWidth={3} />}
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(sec.id)}
                      className="sr-only"
                    />
                    <span
                      className={`text-[14px] font-medium ${
                        checked ? "text-gray-900" : "text-gray-500"
                      }`}
                    >
                      {sec.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-gray-200 border-t-primary-600" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={20} className="text-primary-600" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">
                리포트를 생성하고 있습니다...
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {selected.size}개 섹션 포함 · 잠시만 기다려주세요
              </p>
            </div>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Check size={28} className="text-emerald-500" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-gray-900">
                리포트 준비 완료!
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {areaName} 분석 리포트 · {selected.size}개 섹션
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-[var(--radius-button)] px-4 py-2.5 text-[14px] font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          {status === "done" ? "닫기" : "취소"}
        </button>

        {status === "idle" && (
          <button
            onClick={handleGenerate}
            disabled={selected.size === 0}
            className="flex items-center gap-2 rounded-[var(--radius-button)] bg-primary-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileText size={16} />
            리포트 생성하기
          </button>
        )}

        {status === "done" && (
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-[var(--radius-button)] bg-primary-600 px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-700 active:scale-[0.98]"
          >
            <Download size={16} />
            PDF 다운로드
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   무료 유저: 업그레이드 유도 모달
   ═══════════════════════════════════════════ */

function FreeReportContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
      {/* 닫기 */}
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex flex-col items-center px-8 pb-8">
        {/* 잠금 아이콘 */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Lock size={36} className="text-gray-400" />
        </div>

        <h2 className="text-center text-[20px] font-bold leading-snug text-gray-900">
          상권 분석 리포트는
          <br />
          Pro에서 이용할 수 있어요
        </h2>

        <p className="mt-2 text-center text-[14px] text-muted">
          업종 분석, 유동인구, 성장 예측이 담긴
          <br />
          전문 PDF 리포트를 받아보세요
        </p>

        {/* 블러 미리보기 */}
        <div className="relative mt-6 w-full overflow-hidden rounded-xl">
          <div className="flex h-[200px] items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200">
            {/* 더미 리포트 미리보기 */}
            <div className="w-[280px] rounded-lg bg-white p-4 shadow-sm" style={{ filter: "blur(4px)" }}>
              <div className="mb-3 h-4 w-32 rounded bg-gray-300" />
              <div className="mb-2 h-3 w-full rounded bg-gray-200" />
              <div className="mb-2 h-3 w-4/5 rounded bg-gray-200" />
              <div className="mb-4 h-3 w-3/4 rounded bg-gray-200" />
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-lg bg-indigo-100" />
                <div className="h-16 w-16 rounded-lg bg-blue-100" />
                <div className="h-16 w-16 rounded-lg bg-emerald-100" />
              </div>
              <div className="mt-4 h-20 w-full rounded-lg bg-gray-100" />
            </div>
          </div>
          {/* 그라데이션 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
        </div>

        {/* Pro 혜택 목록 */}
        <div className="mt-5 w-full space-y-2">
          {[
            "PDF 리포트 무제한 추출",
            "브랜드 시너지 & 성장 예측",
            "매출 시뮬레이션",
            "우선 데이터 업데이트",
          ].map((text) => (
            <div key={text} className="flex items-center gap-2.5 text-[13px]">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100">
                <Check size={12} className="text-primary-600" strokeWidth={3} />
              </div>
              <span className="text-gray-700">{text}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary-600 py-3.5 text-[15px] font-bold text-white transition-all hover:bg-primary-700 active:scale-[0.98]">
          <Crown size={18} />
          Pro 시작하기
        </button>
        <p className="mt-2 text-center text-[12px] text-muted">
          월 <span className="font-semibold text-gray-700">29,000원</span> · 언제든 해지 가능
        </p>
      </div>
    </div>
  );
}
