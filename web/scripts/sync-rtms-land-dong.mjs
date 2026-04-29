// ── RTMS 상업업무용 매매 실거래 → 동 단위 토지 평당가 시계열 (JSON) ──
// 기존 sync-rtms-land.mjs의 동 단위 버전.
// 거래마다 umdNm(법정동명) 추출 → (gu, 법정동, year) 집계 → JSON 저장.
// rent-estimator.ts는 좌표→행정동→이름매칭으로 조회 (prefix 매칭 지원).
//
// 키: DATA_GO_KR_API_KEY
// 사용:
//   node web/scripts/sync-rtms-land-dong.mjs            # 25개 구 전체
//   node web/scripts/sync-rtms-land-dong.mjs 용산구       # 1개 구만
//
// 산출: web/lib/data/rtms-land-yearly-dong.json
//   { _meta, data: { "용산구": { "한남동": { 2024: {avg, n}, 2025: {...} } } } }

import fs from "node:fs";
import path from "node:path";

// env 로드
const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(
  env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))
);
const KEY = map.DATA_GO_KR_API_KEY;
if (!KEY) { console.error("DATA_GO_KR_API_KEY 미설정"); process.exit(1); }

const SEOUL_GU_LAWD = {
  "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
  "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
  "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
  "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
  "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

// 최근 3년 (인프라 검증용. 풀 시계열은 YEARS 늘려 재실행)
const YEARS = [2024, 2025, 2026];
const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth() + 1;

const OUT_PATH = "./lib/data/rtms-land-yearly-dong.json";

async function fetchMonth(lawdCd, ym) {
  const out = [];
  let page = 1;
  while (true) {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade?serviceKey=${encodeURIComponent(KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=1000&_type=json`;
    let res, json;
    try {
      res = await fetch(url);
      json = await res.json();
    } catch (e) {
      console.error(`  ${lawdCd}/${ym} fetch err:`, e.message);
      break;
    }
    const items = json?.response?.body?.items?.item;
    if (!items) break;
    const arr = Array.isArray(items) ? items : [items];
    out.push(...arr);
    const total = json?.response?.body?.totalCount ?? 0;
    if (out.length >= total || arr.length < 1000) break;
    page++;
    if (page > 20) break;
  }
  return out;
}

function toPyeongPrice(deal) {
  const amount = parseFloat(String(deal.dealAmount ?? "").replaceAll(",", ""));
  const land = parseFloat(deal.plottageAr ?? 0);
  if (!amount || !land || land <= 0) return null;
  return (amount / land) * 3.3;
}

function extractDong(deal) {
  return String(deal.umdNm ?? "").trim() || null;
}

async function syncGu(gu, lawdCd, result) {
  console.log(`\n[${gu}] LAWD=${lawdCd}`);
  if (!result[gu]) result[gu] = {};

  // (dong, year) → { sum, n }
  const agg = {};

  for (const year of YEARS) {
    const monthEnd = (year === CUR_YEAR) ? CUR_MONTH : 12;
    for (let m = 1; m <= monthEnd; m++) {
      const ym = `${year}${String(m).padStart(2, "0")}`;
      const deals = await fetchMonth(lawdCd, ym);
      for (const d of deals) {
        const p = toPyeongPrice(d);
        if (!p || p < 100 || p >= 100000) continue;
        const dong = extractDong(d);
        if (!dong) continue;
        const key = `${dong}|${year}`;
        if (!agg[key]) agg[key] = { dong, year, sum: 0, n: 0 };
        agg[key].sum += p;
        agg[key].n += 1;
      }
    }
  }

  const dongCount = new Set(Object.values(agg).map((v) => v.dong)).size;
  if (dongCount === 0) {
    console.log(`  거래 없음`);
    return;
  }

  for (const v of Object.values(agg)) {
    if (v.n < 1) continue;
    if (!result[gu][v.dong]) result[gu][v.dong] = {};
    result[gu][v.dong][v.year] = {
      avg: Math.round(v.sum / v.n),
      n: v.n,
    };
  }

  console.log(`  ${dongCount}개 동 × 최대 ${YEARS.length}년 집계 완료`);
  // 한남동 같은 핵심 동은 샘플 출력
  const samples = ["한남동", "신사동", "청담동", "압구정동", "성수동1가", "성수동2가", "논현동", "이태원동"]
    .filter((d) => result[gu][d]);
  for (const d of samples) {
    const yrs = Object.entries(result[gu][d])
      .map(([y, v]) => `${y}: ${v.avg}만/평 (n=${v.n})`)
      .join(", ");
    console.log(`    ${d} → ${yrs}`);
  }
}

async function main() {
  // 기존 JSON 있으면 머지 (특정 구만 갱신할 때 다른 구 데이터 보존)
  let result = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
      result = prev.data ?? {};
      console.log(`기존 데이터 로드 (${Object.keys(result).length}개 구)`);
    } catch {}
  }

  const targetGu = process.argv[2];
  const targets = targetGu
    ? [[targetGu, SEOUL_GU_LAWD[targetGu]]].filter(([_, c]) => c)
    : Object.entries(SEOUL_GU_LAWD);

  if (targets.length === 0) {
    console.error(`알 수 없는 구: ${targetGu}. 사용 가능: ${Object.keys(SEOUL_GU_LAWD).join(", ")}`);
    process.exit(1);
  }

  for (const [gu, lawd] of targets) {
    await syncGu(gu, lawd, result);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({
    _meta: {
      source: "국토교통부 RTMS 상업업무용 부동산매매 실거래자료 (동 단위)",
      api: "RTMSDataSvcNrgTrade",
      computed: "매매가(만원) ÷ 대지면적(㎡) × 3.3 = 평당가(만원). 동 = umdNm(법정동)",
      outliers_removed: "평당 100만~10억 외 제외",
      years_covered: YEARS,
      synced_at: new Date().toISOString(),
    },
    data: result,
  }, null, 2), "utf8");

  console.log(`\n✓ ${OUT_PATH} 저장 완료`);
}

main().catch((e) => { console.error(e); process.exit(1); });
