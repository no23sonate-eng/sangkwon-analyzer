import "server-only";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// 서버 라우트 전용. service_role 없으면 anon으로 폴백하되 그 사실을 로깅 (RLS로 보호).
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !key) {
  console.warn("[supabase-server] Missing SUPABASE URL or key");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[supabase-server] SERVICE_ROLE_KEY not set — falling back to anon. RLS must protect data.");
}

export const supabaseServer = createClient(SUPABASE_URL, key, {
  auth: { persistSession: false },
});
