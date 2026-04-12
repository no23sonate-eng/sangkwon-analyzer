"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "user_signup";
const APPROVAL_KEY = "user_approved";
// 본인용 우회 키 — URL에 ?admin=cgwoo2026 붙이면 회원가입 스킵
const ADMIN_BYPASS = "cgwoo2026";

export interface UserInfo {
  email: string;
  name: string;
  job: string;
  age: string;
  gender: string;
  ageGroup: string;
  registeredAt: string;
}

export function isUserRegistered(): boolean {
  if (typeof window === "undefined") return true;
  return !!localStorage.getItem(STORAGE_KEY);
}

export function isUserApproved(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(APPROVAL_KEY) === "true";
}

export function getUserInfo(): UserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch { return null; }
}

export default function SignupModal() {
  const [open, setOpen] = useState(false);
  // "form" = 가입 폼, "pending" = 승인 대기
  const [view, setView] = useState<"form" | "pending">("form");
  const [form, setForm] = useState({
    email: "",
    name: "",
    job: "",
    age: "",
    gender: "",
    ageGroup: "",
  });

  // 승인 여부를 Supabase에서 확인
  const checkApproval = useCallback(async (email: string) => {
    const { data } = await supabase
      .from("users")
      .select("approved")
      .eq("email", email)
      .single();
    if (data?.approved) {
      localStorage.setItem(APPROVAL_KEY, "true");
      setOpen(false);
      return true;
    }
    // 승인 취소된 경우: localStorage 초기화
    localStorage.removeItem(APPROVAL_KEY);
    setOpen(true);
    setView("pending");
    return false;
  }, []);

  useEffect(() => {
    // URL에 admin 파라미터 있으면 우회 (본인 접속용)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === ADMIN_BYPASS) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          email: "admin@local",
          name: "관리자",
          job: "admin",
          age: "",
          gender: "",
          ageGroup: "",
          registeredAt: new Date().toISOString(),
        }));
        localStorage.setItem(APPROVAL_KEY, "true");
        return;
      }
    }

    // 가입 안 했으면 폼 표시
    if (!isUserRegistered()) {
      setOpen(true);
      setView("form");
      return;
    }

    // 가입한 사용자는 항상 Supabase에서 승인 상태 재확인
    const userInfo = getUserInfo();
    if (userInfo?.email) {
      checkApproval(userInfo.email);
    }
  }, [checkApproval]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name || !form.job || !form.gender || !form.ageGroup) return;
    setSubmitting(true);

    const userInfo: UserInfo = {
      ...form,
      registeredAt: new Date().toISOString(),
    };

    // Supabase에 저장 (approved 기본값 false)
    try {
      await supabase.from("users").insert({
        email: form.email,
        name: form.name,
        job: form.job,
        gender: form.gender,
        age_group: form.ageGroup,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        approved: false,
      });
    } catch (err) {
      console.error("user insert failed", err);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(userInfo));
    setSubmitting(false);
    // 가입 후 승인 대기 화면으로 전환
    setView("pending");
  };

  const handleRefreshApproval = async () => {
    const userInfo = getUserInfo();
    if (!userInfo?.email) return;
    setSubmitting(true);
    const approved = await checkApproval(userInfo.email);
    setSubmitting(false);
    if (!approved) {
      alert("아직 승인되지 않았습니다. 관리자 승인을 기다려주세요.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        {view === "pending" ? (
          /* ── 승인 대기 화면 ── */
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-[18px] font-bold text-gray-900">승인 대기 중</h2>
            <p className="mt-2 text-[13px] text-gray-500 leading-relaxed">
              가입 신청이 완료되었습니다.<br/>
              관리자 승인 후 서비스를 이용하실 수 있습니다.
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              승인이 완료되면 아래 버튼을 눌러 확인해주세요.
            </p>
            <button
              onClick={handleRefreshApproval}
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-primary-600 py-3 text-[14px] font-semibold text-white hover:bg-primary-700 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting ? "확인 중..." : "승인 여부 확인"}
            </button>
          </div>
        ) : (
          /* ── 가입 폼 ── */
          <>
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-[20px] font-extrabold text-white">B</div>
              <h2 className="text-[18px] font-bold text-gray-900">상권분석기 시작하기</h2>
              <p className="mt-1 text-[12px] text-gray-500">
                서비스 이용을 위해 간단한 정보를 입력해주세요
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">이메일 *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="example@email.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">이름 *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="홍길동"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-700">직업 *</label>
                <select
                  required
                  value={form.job}
                  onChange={(e) => setForm({ ...form, job: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
                >
                  <option value="">선택하세요</option>
                  <option value="창업예정자">창업 예정자</option>
                  <option value="자영업자">자영업자</option>
                  <option value="부동산투자자">부동산 투자자</option>
                  <option value="건물주">건물주</option>
                  <option value="공인중개사">공인중개사</option>
                  <option value="디벨로퍼">디벨로퍼/시행사</option>
                  <option value="기획자">MD/공간기획자</option>
                  <option value="컨설턴트">컨설턴트</option>
                  <option value="학생">학생</option>
                  <option value="직장인">직장인</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-gray-700">성별 *</label>
                  <select
                    required
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
                  >
                    <option value="">선택</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-gray-700">연령대 *</label>
                  <select
                    required
                    value={form.ageGroup}
                    onChange={(e) => setForm({ ...form, ageGroup: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 bg-white"
                  >
                    <option value="">선택</option>
                    <option value="20대">20대</option>
                    <option value="30대">30대</option>
                    <option value="40대">40대</option>
                    <option value="50대">50대</option>
                    <option value="60대 이상">60대 이상</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={!form.email || !form.name || !form.job || !form.gender || !form.ageGroup || submitting}
                className="mt-2 w-full rounded-xl bg-primary-600 py-3 text-[14px] font-semibold text-white hover:bg-primary-700 active:scale-[0.98] disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? "저장 중..." : "시작하기"}
              </button>
            </form>

            <p className="mt-3 text-center text-[10px] text-gray-400">
              입력하신 정보는 서비스 개선 목적으로만 사용됩니다
            </p>
          </>
        )}
      </div>
    </div>
  );
}
