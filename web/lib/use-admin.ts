"use client";

import { useSearchParams } from "next/navigation";

const ADMIN_KEY = "cgwoo2026";

/** URL에 ?admin=cgwoo2026 이 있으면 true — 산정 로직/내부 지표 노출 여부 판단 */
export function useIsAdmin(): boolean {
  const params = useSearchParams();
  return params?.get("admin") === ADMIN_KEY;
}
