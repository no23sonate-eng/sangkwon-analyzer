import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
);

const AREA_KEYWORDS: Record<string, string[]> = {
  "강남역": ["강남역", "강남"],
  "도산공원": ["도산공원", "압구정", "신사동 가로수길", "가로수길"],
  "한남동": ["한남", "이태원"],
  "성수동": ["성수"],
  "홍대역": ["홍대", "서교", "동교"],
  "명동": ["명동"],
};

function formatQuarter(q: string): string {
  if (q.length !== 5) return q;
  return `${q.slice(0, 4)} Q${q.slice(4)}`;
}

function prevQuarter(q: string): string | null {
  if (q.length !== 5) return null;
  const y = parseInt(q.slice(0, 4), 10);
  const qq = parseInt(q.slice(4), 10);
  if (qq === 1) return `${y - 1}4`;
  return `${y}${qq - 1}`;
}

async function getTrdarCds(area: string): Promise<string[] | null> {
  if (!area || area === "서울 전체") return null;
  const keywords = AREA_KEYWORDS[area] ?? [area];
  const all = new Set<string>();
  for (const kw of keywords) {
    const { data } = await supabase.from("areas").select("trdar_cd").ilike("trdar_nm", `%${kw}%`);
    if (data) for (const r of data) all.add(r.trdar_cd);
  }
  return all.size > 0 ? Array.from(all) : null;
}

function pct(curr: number, prev: number): number {
  if (prev <= 0) return 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

async function computeAreaKpi(trdarCds: string[]) {
  // 전체 분기 목록 조회 → 최신/전분기
  const { data: qRows } = await supabase
    .from("stores")
    .select("quarter_cd")
    .in("trdar_cd", trdarCds)
    .order("quarter_cd", { ascending: false })
    .limit(1);
  const latestQ = qRows?.[0]?.quarter_cd as string | undefined;
  if (!latestQ) return null;
  const prevQ = prevQuarter(latestQ);

  const fetchAgg = async (quarter: string) => {
    const { data } = await supabase
      .from("stores")
      .select("store_count, open_count, close_count")
      .eq("quarter_cd", quarter)
      .in("trdar_cd", trdarCds);
    let s = 0, o = 0, c = 0;
    for (const r of data ?? []) {
      s += r.store_count ?? 0;
      o += r.open_count ?? 0;
      c += r.close_count ?? 0;
    }
    return { s, o, c };
  };

  const curr = await fetchAgg(latestQ);
  const prev = prevQ ? await fetchAgg(prevQ) : { s: 0, o: 0, c: 0 };

  const qLabel = formatQuarter(latestQ);
  return {
    total_stores: { value: curr.s, label: `총 상가 (${qLabel})`, change_pct: pct(curr.s, prev.s) },
    monthly_open: { value: curr.o, label: `${qLabel} 신규 개업`, change_pct: pct(curr.o, prev.o) },
    monthly_close: { value: curr.c, label: `${qLabel} 폐업`, change_pct: pct(curr.c, prev.c) },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "서울 전체";
  const trdarCds = await getTrdarCds(area);

  if (trdarCds && trdarCds.length > 0) {
    const areaKpi = await computeAreaKpi(trdarCds);
    if (areaKpi) return NextResponse.json(areaKpi);
  }

  const { data } = await supabase
    .from("dashboard_stats")
    .select("metric_key, value, label, change_pct, updated_at");

  if (data && data.length > 0) {
    const map: Record<string, { value: number; label: string; change_pct: number; updated_at: string }> = {};
    for (const row of data) {
      map[row.metric_key] = {
        value: row.value,
        label: row.label,
        change_pct: row.change_pct ?? 0,
        updated_at: row.updated_at,
      };
    }
    return NextResponse.json(map);
  }

  return NextResponse.json({
    total_stores: { value: 12840000, label: "총 상가 데이터", change_pct: 0 },
    monthly_open: { value: 3241, label: "이번 달 신규 개업", change_pct: 8.2 },
    monthly_close: { value: 2103, label: "이번 달 폐업", change_pct: -3.1 },
  });
}
