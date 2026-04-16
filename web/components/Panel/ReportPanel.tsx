"use client";

import { useState } from "react";
import { useAnalysisStore } from "@/store/analysisStore";
import { palette } from "@/lib/colors";
import { Send, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getUserInfo } from "@/components/Modal/SignupModal";

export default function ReportPanel() {
  const analysisData = useAnalysisStore((s) => s.analysisData);
  const clickedAddress = useAnalysisStore((s) => s.clickedAddress);
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!analysisData) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: palette.textSecondary }}>
        먼저 상권을 선택해주세요.
      </p>
    );
  }

  const handleSubmit = async () => {
    if (!question.trim()) return;
    const user = getUserInfo();
    // Supabase에 저장
    try {
      await supabase.from("inquiries").insert({
        user_email: user?.email ?? null,
        user_name: user?.name ?? null,
        address: clickedAddress,
        area_name: analysisData.trdar_names?.[0] ?? "",
        question: question.trim(),
      });
    } catch {
      // DB insert 실패해도 UI 플로우 진행
    }
    setSubmitted(true);
    setTimeout(() => {
      setQuestion("");
      setSubmitted(false);
    }, 3000);
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="rounded-xl bg-primary-50 px-4 py-3">
        <p className="text-[12px] font-semibold text-primary-700">맞춤형 분석 요청</p>
        <p className="mt-1 text-[11px] text-gray-600">
          이 상권에 대해 궁금한 점이나 추가 분석이 필요한 내용을 작성해주세요. 전문가가 직접 답변드립니다.
        </p>
      </div>

      {/* 선택된 상권 정보 */}
      <div className="rounded-xl border border-gray-100 bg-white p-3">
        <p className="text-[10px] text-muted">분석 대상</p>
        <p className="mt-0.5 text-[13px] font-bold text-gray-900">
          {clickedAddress || analysisData.trdar_names?.[0] || "선택된 상권"}
        </p>
      </div>

      {/* 질문 입력 */}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-gray-700">
          궁금한 내용
        </label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="예: 이 위치에 카페를 열려고 하는데 적정 매출이 얼마나 나올까요?&#10;예: 인근에 비슷한 업종이 얼마나 있는지 자세히 알고 싶어요&#10;예: 임대료 협상 시 참고할 만한 데이터가 있나요?"
          rows={8}
          className="w-full rounded-xl border border-gray-200 px-3 py-3 text-[12px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none placeholder:text-gray-400"
        />
      </div>

      {/* 제출 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!question.trim() || submitted}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all ${
          submitted
            ? "bg-emerald-500 text-white"
            : "bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed"
        }`}
      >
        {submitted ? (
          <>
            <Check size={16} /> 제출 완료 — 빠른 시일 내에 연락드립니다
          </>
        ) : (
          <>
            <Send size={14} /> 제출하기
          </>
        )}
      </button>

      <p className="text-center text-[10px] text-muted">
        제출하신 질문은 저장되며, 이메일이나 카카오톡으로 답변드립니다
      </p>
    </div>
  );
}
