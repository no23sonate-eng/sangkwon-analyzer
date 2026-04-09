import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const { trdar_cd } = await params;
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radius = parseInt(searchParams.get("radius") ?? "300");

  // analyze-area로 포워딩 (동일 로직 사용)
  const origin = new URL(request.url).origin;
  const url = `${origin}/api/analyze-area?lat=${lat}&lng=${lng}&radius=${radius}`;
  const res = await fetch(url);
  const data = await res.json();
  return NextResponse.json(data);
}
