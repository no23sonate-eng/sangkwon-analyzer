import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const ALLOWED_EVENTS = new Set([
  "search",
  "area_view",
  "map_click",
  "page_view",
  "consultation_open",
]);

function clip(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  // 분당 200건/IP — 페이지뷰까지 잡으면 트래픽 좀 됨
  const limited = rateLimit(req, "track", 200, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = clip(body.event_type, 32);
  if (!eventType || !ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "invalid event_type" }, { status: 400 });
  }

  const row = {
    event_type: eventType,
    user_email: clip(body.user_email, 255),
    user_name: clip(body.user_name, 80),
    path: clip(body.path, 200),
    query: clip(body.query, 200),
    address: clip(body.address, 200),
    area_name: clip(body.area_name, 100),
    trdar_cd: clip(body.trdar_cd, 32),
    lat: num(body.lat),
    lng: num(body.lng),
    user_agent: clip(req.headers.get("user-agent"), 300),
    ip: clip(getClientIp(req), 64),
  };

  const { error } = await supabaseServer.from("user_events").insert(row);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
