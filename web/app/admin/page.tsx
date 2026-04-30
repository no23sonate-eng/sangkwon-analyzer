"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Users, MessageSquare, Download, CheckCircle, XCircle, UserCheck, ChevronDown, ChevronUp, Activity, MapPin, Search as SearchIcon } from "lucide-react";

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

interface EventRow {
  id: number;
  user_email: string | null;
  user_name: string | null;
  event_type: string;
  path: string | null;
  query: string | null;
  address: string | null;
  area_name: string | null;
  trdar_cd: string | null;
  lat: number | null;
  lng: number | null;
  ts: string;
}

function AdminContent() {
  const params = useSearchParams();
  const authKey = params.get("key") ?? "";
  const [isAuth, setIsAuth] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "inquiries" | "events">("users");
  const [expandedInquiry, setExpandedInquiry] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          setEvents(data.events ?? []);
          setErrorMsg(null);
        } else if (res.status === 401) {
          setErrorMsg("잘못된 비밀번호입니다. URL의 ?key= 값을 확인하세요.");
        } else if (res.status === 429) {
          setErrorMsg("요청이 너무 많습니다. 1분 뒤 다시 시도하세요.");
        } else {
          setErrorMsg(`서버 오류 (${res.status}). 잠시 후 다시 시도하세요.`);
        }
      } catch {
        setErrorMsg("네트워크 오류. 연결을 확인하세요.");
      }
      setLoading(false);
    })();
  }, [authKey]);

  const toggleApproval = async (userId: number, approved: boolean) => {
    const prevUsers = users;
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, approved } : u))
    );
    try {
      const res = await fetch(`/api/admin?key=${encodeURIComponent(authKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", userId, approved }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setUsers(prevUsers);
      alert(`변경 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const approveAll = async () => {
    const pending = users.filter((u) => !u.approved);
    if (pending.length === 0) return;
    const ids = pending.map((u) => u.id);
    const prevUsers = users;
    setUsers((prev) => prev.map((u) => ({ ...u, approved: true })));
    try {
      const res = await fetch(`/api/admin?key=${encodeURIComponent(authKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", userIds: ids, approved: true }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setUsers(prevUsers);
      alert(`전체 승인 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    if (loading) {
      return (
        <div className="flex h-full items-center justify-center text-muted">로딩 중...</div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-[14px] text-gray-500">{errorMsg ?? "접근 권한이 없습니다."}</p>
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
            onClick={() => {
              const data =
                tab === "users" ? users as unknown as Record<string, unknown>[]
                : tab === "inquiries" ? inquiries as unknown as Record<string, unknown>[]
                : events as unknown as Record<string, unknown>[];
              exportCSV(data, `${tab}_${new Date().toISOString().slice(0, 10)}.csv`);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-700"
          >
            <Download size={14} /> CSV 다운로드
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4">
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
          <div className="rounded-[20px] bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                <Activity size={18} className="text-sky-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted">총 이벤트</p>
                <p className="text-[24px] font-bold text-gray-900">{events.length}</p>
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
          <button
            onClick={() => setTab("events")}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 ${tab === "events" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500"}`}
          >
            사용 현황 ({events.length})
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
        ) : tab === "inquiries" ? (
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
        ) : (
          <EventsView
            events={events}
            expandedUser={expandedUser}
            setExpandedUser={setExpandedUser}
          />
        )}
      </div>
    </div>
  );
}

/* ── 사용 현황 탭: 검색 TOP / 주소 TOP / 사용자별 활동 ── */
function EventsView({
  events,
  expandedUser,
  setExpandedUser,
}: {
  events: EventRow[];
  expandedUser: string | null;
  setExpandedUser: (v: string | null) => void;
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-12 text-center shadow-card">
        <p className="text-muted">아직 사용 데이터가 없습니다</p>
      </div>
    );
  }

  // DAU (오늘)
  const today = new Date().toISOString().slice(0, 10);
  const dau = new Set(
    events.filter((e) => e.ts.slice(0, 10) === today).map((e) => e.user_email ?? `anon:${e.id}`)
  ).size;

  // 검색어 TOP
  const queryCount: Record<string, number> = {};
  for (const e of events) {
    if (e.event_type === "search" && e.query) {
      queryCount[e.query] = (queryCount[e.query] ?? 0) + 1;
    }
  }
  const topQueries = Object.entries(queryCount).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // 주소·권역 TOP — area_view + map_click 합산
  const placeCount: Record<string, number> = {};
  for (const e of events) {
    const key = e.area_name || e.address;
    if (!key) continue;
    if (e.event_type === "area_view" || e.event_type === "map_click") {
      placeCount[key] = (placeCount[key] ?? 0) + 1;
    }
  }
  const topPlaces = Object.entries(placeCount).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // 사용자별 활동
  const byUser: Record<string, { name: string; events: EventRow[] }> = {};
  for (const e of events) {
    const k = e.user_email ?? "anon";
    if (!byUser[k]) byUser[k] = { name: e.user_name ?? "익명", events: [] };
    byUser[k].events.push(e);
  }
  const users = Object.entries(byUser).sort((a, b) => b[1].events.length - a[1].events.length);

  const fmt = (ts: string) =>
    new Date(ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const eventLabel = (t: string) =>
    t === "search" ? "검색" : t === "area_view" ? "권역조회" : t === "map_click" ? "지도클릭" : t === "consultation_open" ? "상담" : t;

  return (
    <div className="space-y-5">
      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-[20px] bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
              <Activity size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted">오늘 활성 사용자</p>
              <p className="text-[24px] font-bold text-gray-900">{dau}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[20px] bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <SearchIcon size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted">총 검색</p>
              <p className="text-[24px] font-bold text-gray-900">
                {events.filter((e) => e.event_type === "search").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-[20px] bg-white p-5 shadow-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <MapPin size={18} className="text-rose-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted">총 권역·지도 조회</p>
              <p className="text-[24px] font-bold text-gray-900">
                {events.filter((e) => e.event_type === "area_view" || e.event_type === "map_click").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP 검색어 + TOP 주소 */}
      <div className="grid grid-cols-2 gap-5">
        <div className="rounded-[20px] bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-gray-900">
            <SearchIcon size={14} className="text-blue-600" /> 인기 검색어 TOP 20
          </h3>
          {topQueries.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">검색 기록 없음</p>
          ) : (
            <ol className="space-y-1.5">
              {topQueries.map(([q, n], i) => (
                <li key={q} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-5 text-right text-[11px] text-muted">{i + 1}</span>
                    <span className="truncate text-gray-800">{q}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">{n}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-[20px] bg-white p-5 shadow-card">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold text-gray-900">
            <MapPin size={14} className="text-rose-600" /> 가장 많이 본 위치 TOP 20
          </h3>
          {topPlaces.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-muted">조회 기록 없음</p>
          ) : (
            <ol className="space-y-1.5">
              {topPlaces.map(([p, n], i) => (
                <li key={p} className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-2 truncate">
                    <span className="w-5 text-right text-[11px] text-muted">{i + 1}</span>
                    <span className="truncate text-gray-800">{p}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">{n}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* 사용자별 활동 */}
      <div className="rounded-[20px] bg-white shadow-card overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-3 text-[13px] font-bold text-gray-900">
          사용자별 활동 ({users.length}명)
        </div>
        <div className="divide-y divide-gray-50">
          {users.map(([email, u]) => (
            <div key={email} className="px-5 py-3">
              <button
                onClick={() => setExpandedUser(expandedUser === email ? null : email)}
                className="flex w-full items-center justify-between text-left hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">
                    {u.name} <span className="text-muted font-normal">· {email}</span>
                  </p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {u.events.length}개 이벤트 · 최근 {fmt(u.events[0].ts)}
                  </p>
                </div>
                {expandedUser === email ? (
                  <ChevronUp size={14} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400 shrink-0" />
                )}
              </button>
              {expandedUser === email && (
                <div className="mt-3 max-h-80 overflow-y-auto rounded-xl bg-gray-50 p-3">
                  <ul className="space-y-1">
                    {u.events.slice(0, 100).map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2 text-[11px]">
                        <span className="shrink-0 text-muted w-20">{fmt(e.ts)}</span>
                        <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                          {eventLabel(e.event_type)}
                        </span>
                        <span className="text-gray-700 truncate">
                          {e.query || e.area_name || e.address || e.path || "-"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
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
