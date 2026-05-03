/* ── Admin · places 검수 API ──

   place_crawler.py 가 자동 수집한 매장 데이터를 본인이 검수.
   - GET: 매장 리스트 (필터: gu/dong/category/검수상태)
   - POST: { id, action: 'curate' | 'disable' | 'restore' } 토글

   service_role 키로만 호출.
*/
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function authed(req: NextRequest): boolean {
  if (!ADMIN_PASSWORD) return false;
  const key = req.nextUrl.searchParams.get("key");
  return key === ADMIN_PASSWORD;
}

function client() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("supabase env missing");
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

export async function GET(req: NextRequest) {
  if (!ADMIN_PASSWORD) return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 503 });
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const gu = sp.get("gu") ?? "";
  const dong = sp.get("dong") ?? "";
  const category = sp.get("category") ?? "";
  const status = sp.get("status") ?? "all"; // all | curated | uncurated | disabled
  const limit = Math.min(500, parseInt(sp.get("limit") ?? "200", 10));

  const sb = client();
  let q = sb.from("places")
    .select("id, kakao_place_id, brand_name, category, kakao_category_name, road_name, road_address, address, lat, lng, gu, dong, collected_at, is_curated, is_disabled, source_query")
    .order("collected_at", { ascending: false })
    .limit(limit);
  if (gu) q = q.eq("gu", gu);
  if (dong) q = q.eq("dong", dong);
  if (category) q = q.eq("category", category);
  if (status === "curated") q = q.eq("is_curated", true);
  if (status === "uncurated") q = q.eq("is_curated", false).eq("is_disabled", false);
  if (status === "disabled") q = q.eq("is_disabled", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 카운트 통계 — 운영 가시성용
  const stats: Record<string, Record<string, number>> = { by_category: {}, by_status: {} };
  for (const p of data ?? []) {
    stats.by_category[p.category] = (stats.by_category[p.category] ?? 0) + 1;
    const st = p.is_disabled ? "disabled" : p.is_curated ? "curated" : "uncurated";
    stats.by_status[st] = (stats.by_status[st] ?? 0) + 1;
  }

  return NextResponse.json({ places: data ?? [], stats, total: data?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  if (!ADMIN_PASSWORD) return NextResponse.json({ error: "ADMIN_PASSWORD not set" }, { status: 503 });
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.id || !body.action) {
    return NextResponse.json({ error: "id + action 필수" }, { status: 400 });
  }
  const id = parseInt(body.id, 10);
  const action = String(body.action);

  const updates: Record<string, boolean> = {};
  if (action === "curate") { updates.is_curated = true; updates.is_disabled = false; }
  else if (action === "uncurate") { updates.is_curated = false; }
  else if (action === "disable") { updates.is_disabled = true; updates.is_curated = false; }
  else if (action === "restore") { updates.is_disabled = false; }
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });

  // category 매핑 보정 (오분류 케이스)
  if (typeof body.category === "string") updates["category"] = body.category as unknown as boolean;

  const sb = client();
  const { error } = await sb.from("places").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id, applied: updates });
}
