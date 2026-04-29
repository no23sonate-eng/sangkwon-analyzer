"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "user_signup";
const ADMIN_BYPASS = process.env.NEXT_PUBLIC_ADMIN_BYPASS ?? "";

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
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return false;
  try {
    const info = JSON.parse(data);
    return info.approved === true;
  } catch { return false; }
}

export function isUserPending(): boolean {
  if (typeof window === "undefined") return false;
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return false;
  try {
    const info = JSON.parse(data);
    return info.approved === false;
  } catch { return false; }
}

export function getUserInfo(): UserInfo | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch { return null; }
}


export default function SignupModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    job: "",
    age: "",
    gender: "",
    ageGroup: "",
  });

  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/admin") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === ADMIN_BYPASS && ADMIN_BYPASS) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          email: "admin@local", name: "관리자", job: "admin",
          age: "", gender: "", ageGroup: "",
          registeredAt: new Date().toISOString(), approved: true,
        }));
        return;
      }
    }

    if (isUserPending()) {
      // 승인 대기 중 → DB에서 승인 여부 확인.
      // 중복 row가 있어도 안전하도록 limit(1) + approved 우선 정렬 사용.
      const stored = getUserInfo();
      if (stored?.email) {
        supabase
          .from("users")
          .select("approved")
          .eq("email", stored.email)
          .order("approved", { ascending: false })
          .limit(1)
          .then(({ data }) => {
            const row = data?.[0];
            if (row?.approved) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, approved: true }));
              setOpen(false);
              setPending(false);
            } else {
              setPending(true);
              setOpen(true);
            }
          });
      }
      return;
    }

    if (!isUserRegistered()) {
      setOpen(true);
    }
  }, []);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name || !form.job || !form.gender || !form.ageGroup) return;
    setSubmitting(true);

    const userInfo: UserInfo = {
      ...form,
      registeredAt: new Date().toISOString(),
    };

    // 1) 이메일로 기존 가입 여부 확인 — 다른 기기에서 접속한 케이스 자동 복구.
    //    localStorage는 기기·브라우저마다 별개라, 같은 이메일이 이미 DB에 있으면
    //    INSERT 시도 대신 DB 상태로 localStorage를 동기화한다.
    //    중복 row가 있을 가능성에 대비해 limit(1) + approved 우선 정렬 사용.
    let existing: { approved?: boolean } | null = null;
    try {
      const { data } = await supabase
        .from("users")
        .select("approved")
        .eq("email", form.email)
        .order("approved", { ascending: false })
        .limit(1);
      existing = data?.[0] ?? null;
    } catch {
      // DB 조회 실패 — 신규로 간주하고 INSERT 시도
    }

    if (existing) {
      // 이미 가입된 이메일 — INSERT 없이 상태만 동기화
      const approved = existing.approved === true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...userInfo, approved }));
      setSubmitting(false);
      if (approved) {
        setOpen(false);
        setPending(false);
      } else {
        setPending(true);
      }
      return;
    }

    // 2) 신규 가입 — DB INSERT
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
    } catch {
      // DB insert 실패해도 로컬 등록은 진행 (오프라인 등)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...userInfo, approved: false }));
    setSubmitting(false);
    setPending(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in">
        {pending ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <span className="text-2xl">⏳</span>
            </div>
            <h2 className="text-[18px] font-bold text-gray-900">승인 대기 중</h2>
            <p className="mt-2 text-[13px] text-gray-500 leading-relaxed">
              가입 신청이 완료되었습니다.<br />
              관리자 승인 후 서비스를 이용할 수 있습니다.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-gray-100 px-6 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-200"
            >
              승인 확인하기
            </button>
          </div>
        ) : (
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
