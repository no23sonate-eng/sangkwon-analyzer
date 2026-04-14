"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Users, MessageSquare, Download, CheckCircle, XCircle, UserCheck, ChevronDown, ChevronUp } from "lucide-react";

interface UserRow {
  id: number;
  email: string;
  name: string;
  job: string;
  gender: string;
  age_group: string;
  registered_at: string;
  approved: boolean;
}

interface InquiryRow {
  id: number;
  user_email: string | null;
  user_name: string | null;
  address: string | null;
  area_name: string | null;
  question: string;
  submitted_at: string;
}

function AdminContent() {
  const params = useSearchParams();
  const authKey = params.get("key") ?? "";
  const [isAuth, setIsAuth] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "inquiries">("users");
  const [expandedInquiry, setExpandedInquiry] = useState<number | null>(null);

  useEffect(() => {
    if (!authKey) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin?key=${encodeURIComponent(authKey)}`);
        if (res.ok) {
          setIsAuth(true);
          const data = await res.json();
          setUsers(data.users ?? []);
          setInquiries(data.inquiries ?? []);
        } else {
          // API rejected the key — don't show admin content
          setLoading(false);
          return;
        }
      } catch {
        // Network error — don't show admin content
        setLoading(false);
        return;
      }
      setLoading(false);
    })();
  }, [authKey]);

  const toggleApproval = async (userId: number, approved: boolean) => {
    await supabase.from("users").update({ approved }).eq("id", userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, approved } : u))
    );
  };

  const approveAll = async () => {
    const pending = users.filter((u) => !u.approved);
    if (pending.length === 0) return;
    const ids = pending.map((u) => u.id);
    await supabase.from("users").update({ approved: true }).in("id", ids);
    setUsers((prev) => prev.map((u) => ({ ...u, approved: true })));
  };

  const exportCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((h) => {
          const v = row[h];
          if (v == null) return "";
          const s = String(v).replace(/"/g, '""');
          return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
        }).join(",")
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuth) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[14px] text-gray-500">접근 권한이 없습니다.</p>
          <p className="mt-2 text-[11px] text-gray-400">URL 끝에 ?key=비밀번호를 추가하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">관리자 대시보드</h1>
            <p className="mt-1 text-sm text-muted">사용자 가입 및 문의 내역</p>
          </div>
          <button
            onClick={() => exportCSV(
              tab === "users" ? users as unknown as Record<string, unknown>[] : inquiries as unknown as Record<string, unknown>[],
              `${tab}_${new Date().toISOString().slice(0, 10)}.csv`
            )}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          >
            <Download size={14} /> CSV 다운로드
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-[20px] bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <Users size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted">총 가입자</p>
                <p className="text-[24px] font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <UserCheck size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted">승인 대기</p>
                <p className="text-[24px] font-bold text-amber-600">{users.filter(u => !u.approved).length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-[20px] bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <MessageSquare size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted">총 문의</p>
                <p className="text-[24px] font-bold text-gray-900">{inquiries.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 ${tab === "users" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500"}`}
          >
            가입자 ({users.length})
          </button>
          <button
            onClick={() => setTab("inquiries")}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 ${tab === "inquiries" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500"}`}
          >
            문의 ({inquiries.length})
          </button>
          {tab === "users" && users.some((u) => !u.approved) && (
            <button
              onClick={approveAll}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCircle size={13} /> 전체 승인
            </button>
          )}
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted">로딩 중...</p>
        ) : tab === "users" ? (
          <div className="overflow-hidden rounded-[20px] bg-white shadow-card">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">직업</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">성별</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">연령</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">가입일시</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">아직 가입자가 없습니다</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className={`border-t border-gray-50 hover:bg-gray-50 ${!u.approved ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        {u.approved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircle size={11} /> 승인
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            대기
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{u.email}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.job}</td>
                      <td className="px-4 py-3 text-gray-600">{u.gender}</td>
                      <td className="px-4 py-3 text-gray-600">{u.age_group}</td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(u.registered_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.approved ? (
                          <button
                            onClick={() => toggleApproval(u.id, false)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                          >
                            <XCircle size={12} /> 취소
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleApproval(u.id, true)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                          >
                            <CheckCircle size={12} /> 승인
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.length === 0 ? (
              <div className="rounded-[20px] bg-white p-12 text-center shadow-card">
                <p className="text-muted">아직 문의가 없습니다</p>
              </div>
            ) : (
              inquiries.map((q) => (
                <div
                  key={q.id}
                  className="rounded-[20px] bg-white shadow-card cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setExpandedInquiry(expandedInquiry === q.id ? null : q.id)}
                >
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                        <MessageSquare size={15} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 truncate">
                          {q.user_name ?? "익명"} <span className="text-muted font-normal">· {q.user_email ?? "이메일 없음"}</span>
                        </p>
                        <p className="text-[11px] text-muted mt-0.5 truncate">
                          {q.area_name ?? q.address ?? "위치 정보 없음"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[10px] text-muted">
                        {new Date(q.submitted_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      {expandedInquiry === q.id ? (
                        <ChevronUp size={14} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </div>
                  </div>
                  {expandedInquiry === q.id && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-3">
                      <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-[12px] text-gray-700 whitespace-pre-wrap leading-relaxed">{q.question}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted">로딩 중...</div>}>
      <AdminContent />
    </Suspense>
  );
}
