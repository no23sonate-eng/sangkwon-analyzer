#!/usr/bin/env node
/* ── owner-network-rents.csv → JSON 변환 (build-time) ──
   본인 네트워크 실거래 CSV (../data/owner-network-rents.csv) 파싱.
   (gu, dong, floor) 단위로 평당 월세 중위값·n 집계 후 web/lib/data/owner-network-rents.json 생성.
   CSV 없으면 빈 JSON. 분기마다 신규 케이스 추가 후 재실행. */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const CSV = path.join(ROOT, "data", "owner-network-rents.csv");
const OUT = path.resolve(process.cwd(), "lib/data/owner-network-rents.json");

function parseCsv(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("recorded_at,")) continue; // header
    const cols = line.split(",").map((c) => c.trim());
    if (cols.length < 6) continue;
    const [recorded_at, dong_name, gu_name, floor, area_pyeong, rent_pp, deposit_pp = "", grade = "", source_note = "", contributed_by = "", notes = ""] = cols;
    const rent = parseFloat(rent_pp);
    if (!isFinite(rent) || rent <= 0) continue;
    // 가정/추정/시뮬 행은 GT 아님 — source_note·notes에 키워드 있으면 skip
    const noteBlob = `${source_note} ${notes}`.toLowerCase();
    if (/가정|추정|시뮬|예상|hypothetical|assumed|estimate/.test(noteBlob)) {
      console.warn(`[owner-network] skip 가정행: ${gu_name} ${dong_name} ${floor} ${rent}만 (${source_note})`);
      continue;
    }
    rows.push({
      recorded_at,
      gu: gu_name,
      dong: dong_name,
      floor: floor || "1층",
      area_pyeong: parseFloat(area_pyeong) || 0,
      rent_pp: rent,
      deposit_pp: parseFloat(deposit_pp) || 0,
      grade, source_note, contributed_by, notes,
    });
  }
  return rows;
}

function classifyFloor(f) {
  const s = String(f ?? "").trim();
  if (s === "지하" || s === "B1" || s === "반지하") return "지하";
  if (s === "1층" || s === "1") return "1층";
  return "2층이상";
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function main() {
  if (!fs.existsSync(CSV)) {
    // CSV 없으면 기존 JSON 보존 (Vercel 빌드 시 로컬 컨버트본 덮어쓰지 않도록).
    // 기존 JSON도 없을 때만 빈 JSON 생성.
    if (!fs.existsSync(OUT)) {
      console.log(`[owner-network] CSV·JSON 모두 없음 — 빈 JSON 생성`);
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({ _meta: { synced_at: new Date().toISOString(), case_count: 0 }, by_dong: {} }, null, 2));
    } else {
      console.log(`[owner-network] CSV 없음 — 기존 JSON 유지`);
    }
    return;
  }
  const text = fs.readFileSync(CSV, "utf8");
  const rows = parseCsv(text);
  // (gu, dong, floor) 단위 집계
  const agg = {};
  for (const r of rows) {
    const f = classifyFloor(r.floor);
    const key = `${r.gu}|${r.dong}`;
    if (!agg[key]) agg[key] = { gu: r.gu, dong: r.dong, floors: { "1층": [], "2층이상": [], "지하": [] } };
    agg[key].floors[f].push(r.rent_pp);
  }

  const byDong = {};
  for (const v of Object.values(agg)) {
    const out = { gu: v.gu, dong: v.dong };
    for (const [f, arr] of Object.entries(v.floors)) {
      if (!arr.length) continue;
      out[f] = { rent: Math.round(median(arr) * 10) / 10, n: arr.length };
    }
    byDong[`${v.gu}|${v.dong}`] = out;
  }

  const json = {
    _meta: {
      source: "본인 네트워크 실거래 (data/owner-network-rents.csv)",
      synced_at: new Date().toISOString(),
      case_count: rows.length,
      dong_count: Object.keys(byDong).length,
    },
    by_dong: byDong,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(json, null, 2));
  console.log(`[owner-network] ✓ ${rows.length}건 / ${Object.keys(byDong).length}개 동 → ${OUT}`);
  for (const v of Object.values(byDong)) {
    const fs1 = v["1층"];
    if (fs1) console.log(`  ${v.gu} ${v.dong} 1층: ${fs1.rent}만/평 (n=${fs1.n})`);
  }
}

main();
