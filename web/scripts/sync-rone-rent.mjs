// ── R-ONE 임대 시세 추이 ──
// 한국부동산원 R-ONE OpenAPI:
//   STATBL_ID: TT248473134635539 (중대형 상가 임대가격지수 시계열, 2013Q1 ~)
//   STATBL_ID: A_2024_00278 (중대형 상가 임대료 2022~) ← 최근 절대값 보정용
// 결과: rone-rent-yearly.json (서울 권역별 연평균 평당 월세)
//
// 단위 변환: R-ONE 임대료 단위 = 천원/㎡/월
//   천원/㎡ × 3.3 ÷ 10 = 만원/평/월

import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const KEY = map.RONE_API_KEY;
if (!KEY) { console.error("RONE_API_KEY 미설정"); process.exit(1); }

const STAT_INDEX = "TT248473134635539";   // 임대가격지수 시계열
const STAT_RENT  = "A_2024_00278";         // 절대 임대료 2022~

async function fetchAll(statblId, dtacycle) {
  const all = [];
  let page = 1;
  while (true) {
    const url = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${KEY}&Type=json&pIndex=${page}&pSize=1000&STATBL_ID=${statblId}&DTACYCLE_CD=${dtacycle}`;
    const r = await fetch(url);
    const j = await r.json();
    const rows = j?.SttsApiTblData?.[1]?.row;
    if (!rows || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 1000) break;
    page++;
    if (page > 30) break;
  }
  return all;
}

(async () => {
  console.log("→ 임대가격지수 시계열 fetch…");
  const indexRows = await fetchAll(STAT_INDEX, "QY");
  console.log(`  ${indexRows.length.toLocaleString()}행`);

  console.log("→ 절대 임대료 (2022~) fetch…");
  const rentRows = await fetchAll(STAT_RENT, "QY");
  console.log(`  ${rentRows.length.toLocaleString()}행`);

  // 서울만 필터
  const seoulIndex = indexRows.filter((r) => (r.CLS_FULLNM ?? "").startsWith("서울>"));
  const seoulRent = rentRows.filter((r) => (r.CLS_FULLNM ?? "").startsWith("서울>"));
  console.log(`\n서울 인덱스 ${seoulIndex.length}, 임대료 ${seoulRent.length}`);

  // 권역(CLS_NM)별 시계열 구성
  // 임대가격지수: 권역 × WRTTIME_IDTFR_ID(YYYYNQ) → 지수
  // 절대 임대료: 권역 × YYYYNQ → 원/㎡/월

  // 1. 절대 임대료 — 가장 최근 값으로 권역별 baseline 만들기
  const baselineRent = {}; // { region: { wrttime, value } }
  for (const r of seoulRent) {
    const region = r.CLS_NM;
    const ym = r.WRTTIME_IDTFR_ID; // e.g. "20243"
    const val = parseFloat(r.DTA_VAL);
    if (!val) continue;
    const cur = baselineRent[region];
    if (!cur || ym > cur.wrttime) {
      baselineRent[region] = { wrttime: ym, value: val, fullName: r.CLS_FULLNM };
    }
  }

  // 2. 임대가격지수 — 권역 × 분기
  const indexByRegion = {}; // { region: { wrttime: indexValue } }
  for (const r of seoulIndex) {
    const region = r.CLS_NM;
    const ym = r.WRTTIME_IDTFR_ID;
    const val = parseFloat(r.DTA_VAL);
    if (!val) continue;
    if (!indexByRegion[region]) indexByRegion[region] = {};
    indexByRegion[region][ym] = val;
  }

  // 3. 권역별로 절대 임대료 시계열 산출
  // 절대값(baseline) ÷ 그 시점 지수 × 각 시점 지수 = 각 시점 절대값
  const result = {}; // { region: { year: 평당만월세 } }
  for (const region of Object.keys(indexByRegion)) {
    const base = baselineRent[region];
    if (!base) continue; // 절대 임대료 없는 권역 스킵
    const baseIndex = indexByRegion[region][base.wrttime];
    if (!baseIndex) continue;
    const rentPerSqm = base.value; // 원/㎡/월

    // 분기 → 연 평균
    const yearMap = {}; // { year: [indexes...] }
    for (const [ym, idx] of Object.entries(indexByRegion[region])) {
      const year = parseInt(ym.substring(0, 4));
      if (!yearMap[year]) yearMap[year] = [];
      yearMap[year].push(idx);
    }

    const yearly = {};
    for (const [year, indexes] of Object.entries(yearMap)) {
      const avgIdx = indexes.reduce((s, v) => s + v, 0) / indexes.length;
      // 절대 임대료(천원/㎡/월) × (해당년 지수 / baseline 지수) × 3.3 / 10 = 만원/평/월
      const rentMan = (rentPerSqm * (avgIdx / baseIndex) * 3.3) / 10;
      yearly[year] = Math.round(rentMan * 10) / 10;
    }
    result[region] = {
      fullName: base.fullName,
      baseline: { wrttime: base.wrttime, rent_per_sqm: base.value },
      yearly,
    };
  }

  // 4. 검증: 강남 핵심 권역 출력
  console.log("\n=== 강남 핵심 권역 검증 ===");
  for (const region of Object.keys(result)) {
    if (/강남|압구|신사|청담|논현|역삼|테헤란|가로|선릉/.test(region) || /강남/.test(result[region].fullName ?? "")) {
      const yrs = Object.entries(result[region].yearly).sort();
      console.log(`\n[${result[region].fullName}]`);
      console.log("  baseline:", result[region].baseline);
      console.log("  연평균:", yrs.slice(-6).map(([y, v]) => y + "=" + v + "만").join(" / "));
    }
  }

  // 5. JSON 저장
  fs.writeFileSync("./lib/data/rone-rent-yearly.json", JSON.stringify({
    _meta: {
      source: "한국부동산원 R-ONE 상업용부동산 임대동향조사",
      stats_index: STAT_INDEX + " (중대형 상가 임대가격지수 시계열)",
      stats_rent: STAT_RENT + " (중대형 상가 임대료 2022~)",
      computed: "최근 절대임대료(천원/㎡/월) × (해당년지수/기준년지수) × 3.3 / 10 = 만원/평/월",
      synced_at: new Date().toISOString(),
    },
    data: result,
  }, null, 2), "utf8");
  console.log("\n✓ ./lib/data/rone-rent-yearly.json 저장 완료. 권역 수:", Object.keys(result).length);
})();
