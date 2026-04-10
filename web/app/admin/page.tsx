"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { Users, MessageSquare, Download } from "lucide-react";

interface UserRow {
  id: number;
  email: string;
  name: string;
  job: string;
  gender: string;
  age_group: string;
  registered_at: string;
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

const ADMIN_PASSWORD = "cgwoo2026";

function AdminContent() {
  const params = useSearchParams();
  const isAuth = params.get("key") === ADMIN_PASSWORD;

  const [users, setUsers] = useState<UserRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "inquiries">("users");

  useEffect(() => {
    if (!isAuth) return;
    (async () => {
      const [u, i] = await Promise.all([
        supabase.from("users").select("*").order("registered_at", { ascending: false }),
        supabase.from("inquiries").select("*").order("submitted_at", { ascending: false }),
      ]);
      setUsers(u.data ?? []);
      setInquiries(i.data ?? []);
      setLoading(false);
    })();
  }, [isAuth]);

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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="flex gap-2 border-b border-gray-200">
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
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-muted">로딩 중...</p>
        ) : tab === "users" ? (
          <div className="overflow-hidden rounded-[20px] bg-white shadow-card">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">이메일</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">이름</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">직업</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">성별</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">연령</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">가입일시</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">아직 가입자가 없습니다</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{u.email}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.job}</td>
                      <td className="px-4 py-3 text-gray-600">{u.gender}</td>
                      <td className="px-4 py-3 text-gray-600">{u.age_group}</td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(u.registered_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
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
                <div key={q.id} className="rounded-[20px] bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-[13px] font-bold text-gray-900">
                        {q.user_name ?? "익명"} <span className="text-muted font-normal">· {q.user_email ?? "이메일 없음"}</span>
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {q.area_name ?? q.address ?? "위치 정보 없음"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted">
                      {new Date(q.submitted_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[12px] text-gray-700 whitespace-pre-wrap">{q.question}</p>
                  </div>
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
