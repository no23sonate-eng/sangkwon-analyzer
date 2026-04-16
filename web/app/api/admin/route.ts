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
  const limited = rateLimit(req, "admin", 10, 60_000);
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
