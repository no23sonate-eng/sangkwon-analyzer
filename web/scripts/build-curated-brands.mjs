#!/usr/bin/env node
/* ── curated-brands.csv → JSON 변환 (build-time) ──
   본인이 직접 검수한 명품·플래그십·갤러리·편집숍 매장 DB.
   trdar 일반 분류로 안 잡히는 ground truth.

   분기마다 본인 검수 후 재실행. CSV 없으면 빈 JSON 유지. */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const CSV = path.join(ROOT, "data", "curated-brands.csv");
const OUT = path.resolve(process.cwd(), "lib/data/curated-brands.json");

const ALLOWED_CATEGORIES = new Set([
  "luxury", "flagship", "gallery", "fine_dining",
  "select_shop", "lifestyle", "contemporary", "streetwear_premium",
]);

function parseCsv(text) {
  const rows = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("recorded_at,")) continue; // header
    const cols = line.split(",").map((c) => c.trim());
    if (cols.length < 9) continue;
    const [
      recorded_at, gu, dong, road_name, brand_name,
      category, store_type, lat_s, lng_s, area_pyeong = "0",
      opened_at = "", note = "", contributed_by = "",
    ] = cols;
    const lat = parseFloat(lat_s);
    const lng = parseFloat(lng_s);
    if (!brand_name || !isFinite(lat) || !isFinite(lng)) continue;
    if (!ALLOWED_CATEGORIES.has(category)) {
      console.warn(`[curated-brands] skip 알 수 없는 category: ${category} (${brand_name})`);
      continue;
    }
    rows.push({
      recorded_at, gu, dong, road_name, brand_name,
      category, store_type, lat, lng,
      area_pyeong: parseFloat(area_pyeong) || 0,
      opened_at, note, contributed_by,
    });
  }
  return rows;
}

function main() {
  if (!fs.existsSync(CSV)) {
    if (!fs.existsSync(OUT)) {
      console.log(`[curated-brands] CSV·JSON 모두 없음 — 빈 JSON 생성`);
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({
        _meta: { synced_at: new Date().toISOString(), brand_count: 0 },
        brands: [],
        by_dong: {},
        by_category: {},
      }, null, 2));
    } else {
      console.log(`[curated-brands] CSV 없음 — 기존 JSON 유지`);
    }
    return;
  }
  const text = fs.readFileSync(CSV, "utf8");
  const brands = parseCsv(text);

  // 인덱스: by_dong / by_category
  const byDong = {};
  const byCategory = {};
  for (const b of brands) {
    const dk = `${b.gu}|${b.dong}`;
    if (!byDong[dk]) byDong[dk] = [];
    byDong[dk].push(b);
    if (!byCategory[b.category]) byCategory[b.category] = [];
    byCategory[b.category].push(b);
  }

  const json = {
    _meta: {
      source: "본인 큐레이션 브랜드 (data/curated-brands.csv)",
      synced_at: new Date().toISOString(),
      brand_count: brands.length,
      dong_count: Object.keys(byDong).length,
      category_count: Object.keys(byCategory).length,
    },
    brands,
    by_dong: byDong,
    by_category: byCategory,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(json, null, 2));
  console.log(`[curated-brands] ✓ ${brands.length}건 / ${Object.keys(byDong).length}개 동 / ${Object.keys(byCategory).length}개 카테고리 → ${OUT}`);
  for (const [cat, arr] of Object.entries(byCategory)) {
    console.log(`  ${cat}: ${arr.length}개`);
  }
}

main();
