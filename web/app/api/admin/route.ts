import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "admin-get", 120, 60_000);
  if (limited) return limited;

  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (key !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const [u, i] = await Promise.all([
    sb.from("users").select("*").order("registered_at", { ascending: false }),
    sb.from("inquiries").select("*").order("submitted_at", { ascending: false }),
  ]);

  return NextResponse.json({
    users: u.data ?? [],
    inquiries: i.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, "admin-post", 120, 60_000);
  if (limited) return limited;

  if (!ADMIN_PASSWORD) {
    return NextResponse.json({ error: "ADMIN_PASSWORD not configured" }, { status: 503 });
  }
  const key = req.nextUrl.searchParams.get("key");
  if (key !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { action, userId, userIds, approved } = (body ?? {}) as {
    action?: string;
    userId?: number;
    userIds?: number[];
    approved?: boolean;
  };

  if (action !== "approve" || typeof approved !== "boolean") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const sb = getServiceClient();
  let q = sb.from("users").update({ approved });
  if (Array.isArray(userIds) && userIds.length > 0) {
    q = q.in("id", userIds);
  } else if (typeof userId === "number") {
    q = q.eq("id", userId);
  } else {
    return NextResponse.json({ error: "missing userId(s)" }, { status: 400 });
  }
  const { error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
