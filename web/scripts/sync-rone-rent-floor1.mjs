// ── R-ONE 중대형 상가 1층 임대료 시계열 ──
// STATBL_ID:
//   A_2024_00317: 층별임대료 (2022~2024 Q2)
//   T241873134863890: 층별임대료 (2024 Q3~)
// 데이터 구조: GRP_NM=권역, CLS_NM=층(1층/2층/지하1층 등), DTA_VAL=천원/㎡

import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const KEY = map.RONE_API_KEY;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url);
      return await r.json();
    } catch (e) {
      console.log(`  retry ${i + 1}/${retries} (${e.message})`);
      await sleep(1500);
    }
  }
  return null;
}

async function fetchAll(statblId, dtacycle) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${KEY}&Type=json&pIndex=${page}&pSize=1000&STATBL_ID=${statblId}&DTACYCLE_CD=${dtacycle}`;
    const j = await fetchWithRetry(url);
    if (!j) break;
    const rows = j?.SttsApiTblData?.[1]?.row;
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    page++;
    if (page > 50) break;
    await sleep(200); // 서버 부하 완화
  }
  return all;
}

(async () => {
  console.log("→ 2022~2024Q2 데이터 (A_2024_00317)…");
  const old = await fetchAll("A_2024_00317", "QY");
  console.log(`  ${old.length.toLocaleString()}행`);

  console.log("→ 2024Q3~ 데이터 (T241873134863890)…");
  const recent = await fetchAll("T241873134863890", "QY");
  console.log(`  ${recent.length.toLocaleString()}행`);

  // 1층 + 서울 + GRP가 권역명 (전국·서울·강남 같은 상위 그룹은 제외하고 세부 권역만)
  const isFloor1 = (cls) => cls === "1층";
  const isSeoulRegion = (r) => (r.GRP_FULLNM ?? "").startsWith("서울>") && r.GRP_FULLNM.split(">").length >= 3;

  const merged = [...old, ...recent].filter((r) => isFloor1(r.CLS_NM) && isSeoulRegion(r));
  console.log(`\n1층 + 서울 권역 필터 후: ${merged.length}행`);

  // 권역×분기 → 권역×연 평균
  const byRegion = {}; // { region: { year: [values...] } }
  for (const r of merged) {
    const region = r.GRP_NM;
    const year = parseInt(String(r.WRTTIME_IDTFR_ID).substring(0, 4));
    const val = parseFloat(r.DTA_VAL);
    if (!val) continue;
    if (!byRegion[region]) byRegion[region] = { fullName: r.GRP_FULLNM, years: {} };
    if (!byRegion[region].years[year]) byRegion[region].years[year] = [];
    byRegion[region].years[year].push(val);
  }

  // 연 평균 계산 + 천원/㎡ → 만원/평 변환
  const result = {};
  for (const [region, info] of Object.entries(byRegion)) {
    const yearly = {};
    for (const [year, arr] of Object.entries(info.years)) {
      const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
      // 천원/㎡ × 3.3 / 10 = 만원/평
      yearly[year] = Math.round((avg * 3.3 / 10) * 10) / 10;
    }
    result[region] = { fullName: info.fullName, yearly };
  }

  // 검증 출력
  console.log("\n=== 강남·중구 1층 임대료 (R-ONE 공식) ===");
  for (const region of ["강남대로", "테헤란로", "신사역", "압구정", "청담", "도산대로", "이태원", "남대문", "명동", "광화문"]) {
    const e = result[region];
    if (!e) { console.log(region, "없음"); continue; }
    const yrs = Object.entries(e.yearly).sort();
    console.log(`${region} (1층): ${yrs.map(([y, v]) => y + "=" + v + "만").join(" / ")}`);
  }

  fs.writeFileSync("./lib/data/rone-rent-floor1-yearly.json", JSON.stringify({
    _meta: {
      source: "한국부동산원 R-ONE 상업용부동산 임대동향조사 - 중대형 상가 층별임대료",
      stats: ["A_2024_00317 (2022~2024 Q2)", "T241873134863890 (2024 Q3~)"],
      filter: "CLS_NM=1층, GRP_FULLNM 서울>",
      computed: "분기 임대료(천원/㎡) × 3.3 / 10 = 만원/평/월, 연 평균",
      synced_at: new Date().toISOString(),
    },
    data: result,
  }, null, 2), "utf8");
  console.log("\n✓ ./lib/data/rone-rent-floor1-yearly.json 저장. 권역", Object.keys(result).length, "개");
})();
