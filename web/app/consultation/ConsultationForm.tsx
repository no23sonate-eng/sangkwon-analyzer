"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/track";

interface FormData {
  name: string;
  phone: string;
  area: string;
  industry: string;
  budget: string;
  message: string;
}

async function submitConsultation(data: FormData) {
  await supabase.from("inquiries").insert({
    user_name: data.name,
    user_email: data.phone,
    area_name: data.area,
    address: data.area,
    question: `[상담신청] 업종: ${data.industry} / 예산: ${data.budget} / 연락처: ${data.phone}\n${data.message}`,
  });
  return { success: true };
}

export default function ConsultationForm() {
  const searchParams = useSearchParams();
  const prefillArea = searchParams.get("area") ?? "";

  const [form, setForm] = useState<FormData>({
    name: "",
    phone: "",
    area: prefillArea,
    industry: "",
    budget: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    track({
      event_type: "consultation_open",
      area_name: prefillArea || undefined,
      path: "/consultation",
    });
  }, [prefillArea]);

  const update = (key: keyof FormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setLoading(true);
    await submitConsultation(form);
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-4 text-center animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <h1 className="text-[22px] font-bold text-gray-900">상담 신청이 완료되었습니다</h1>
          <p className="text-[14px] text-muted">
            입력하신 연락처로 빠른 시일 내 연락드리겠습니다.
          </p>
          <a
            href="/"
            className="mt-4 rounded-[var(--radius-button)] bg-primary-600 px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-primary-700"
          >
            대시보드로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-start justify-center overflow-y-auto p-8">
      <div className="w-full max-w-lg animate-fade-in">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <MessageSquare size={26} className="text-primary-600" />
          </div>
          <h1 className="text-[24px] font-bold text-gray-900">전문가 상담 신청</h1>
          <p className="mt-2 text-[14px] text-muted">
            상권 분석 전문가가 맞춤 컨설팅을 제공합니다
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[20px] bg-white p-6 shadow-card">
          {/* 이름 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              이름 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="홍길동"
              className="w-full rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 연락처 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              연락처 <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 관심 지역 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">관심 지역</label>
            <input
              type="text"
              value={form.area}
              onChange={(e) => update("area", e.target.value)}
              placeholder="예: 강남역, 성수동, 홍대입구"
              className="w-full rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 관심 업종 + 예산 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">관심 업종</label>
              <select
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                className="w-full rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">선택</option>
                <option value="카페">카페</option>
                <option value="음식점">음식점</option>
                <option value="소매">소매</option>
                <option value="서비스업">서비스업</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">예산 규모</label>
              <select
                value={form.budget}
                onChange={(e) => update("budget", e.target.value)}
                className="w-full rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">선택</option>
                <option value="5천만원 이하">5천만원 이하</option>
                <option value="5천~1억">5천~1억</option>
                <option value="1~3억">1~3억</option>
                <option value="3억 이상">3억 이상</option>
              </select>
            </div>
          </div>

          {/* 문의 내용 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">문의 내용</label>
            <textarea
              value={form.message}
              onChange={(e) => update("message", e.target.value)}
              rows={4}
              placeholder="궁금한 사항이나 상담 받고 싶은 내용을 자유롭게 작성해주세요"
              className="w-full resize-none rounded-[var(--radius-button)] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-gray-800 outline-none transition-all focus:border-primary-300 focus:ring-2 focus:ring-primary-100"
            />
          </div>

          {/* 제출 */}
          <button
            type="submit"
            disabled={loading || !form.name.trim() || !form.phone.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-button)] bg-primary-600 py-3 text-[15px] font-semibold text-white transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Send size={16} />
                상담 신청하기
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-muted">
            영업일 기준 24시간 이내 연락드립니다
          </p>
        </form>
      </div>
    </div>
  );
}
