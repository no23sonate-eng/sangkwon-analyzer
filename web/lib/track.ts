/**
 * 사용자 행동 트래킹 — 클라이언트에서 호출하면 /api/track으로 POST.
 * SignupModal localStorage에 저장된 user_email/name을 자동 첨부.
 * 실패해도 절대 throw 하지 않음 (사용자 경험 영향 없음).
 */

const STORAGE_KEY = "user_signup";

export type TrackPayload = {
  event_type: "search" | "area_view" | "map_click" | "page_view" | "consultation_open";
  path?: string;
  query?: string;
  address?: string;
  area_name?: string;
  trdar_cd?: string;
  lat?: number;
  lng?: number;
};

function getUser(): { email: string | null; name: string | null } {
  if (typeof window === "undefined") return { email: null, name: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { email: null, name: null };
    const info = JSON.parse(raw);
    return {
      email: typeof info?.email === "string" ? info.email : null,
      name: typeof info?.name === "string" ? info.name : null,
    };
  } catch {
    return { email: null, name: null };
  }
}

export function track(payload: TrackPayload): void {
  if (typeof window === "undefined") return;
  const { email, name } = getUser();
  // 비로그인 사용자도 anonymous로 기록 (가입 직전 행동도 보고 싶을 수 있음)
  const body = {
    ...payload,
    user_email: email,
    user_name: name,
    path: payload.path ?? window.location.pathname,
  };
  // sendBeacon으로 페이지 이탈에도 안전하게 전송
  try {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/track", blob)) return;
  } catch {}
  // 폴백: fetch
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}
