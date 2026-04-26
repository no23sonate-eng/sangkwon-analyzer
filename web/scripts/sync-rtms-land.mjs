// ── RTMS 상업업무용 매매 실거래 → 토지 평당가 시계열 ──
// 25개 구 × 최근 10년 (120개월) RTMS API 호출 → 연 평균 평당가 → JSON 저장
// 키: DATA_GO_KR_API_KEY (data.go.kr 일반인증키)
//
// 산출물: web/lib/data/rtms-land-yearly.json
// 사용처: /api/price-history 라우트가 폴백 우선순위로 활용

import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const KEY = map.DATA_GO_KR_API_KEY;
if (!KEY) { console.error("DATA_GO_KR_API_KEY 미설정"); process.exit(1); }

// 25개 구 LAWD_CD (5자리 법정동 코드)
const SEOUL_GU_LAWD = {
  "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
  "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
  "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
  "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
  "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const NOW = new Date();
const CUR_YEAR = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth() + 1;

// 한 달치 RTMS 호출 (모든 페이지 합산)
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
    if (page > 20) break; // 안전장치
  }
  return out;
}

// 거래 → 평당가 (만원/평)
function toPyeongPrice(deal) {
  // dealAmount: 만원 단위 string (콤마 포함), e.g. "2,540,000"
  const amount = parseFloat(String(deal.dealAmount ?? "").replaceAll(",", ""));
  // plottageAr: 대지면적 m²
  const land = parseFloat(deal.plottageAr ?? 0);
  if (!amount || !land || land <= 0) return null;
  // 만원 / m² × 3.3 = 만원/평
  return (amount / land) * 3.3;
}

(async () => {
  const result = {}; // { gu: { year: { sum, n, avg } } }

  for (const [gu, lawdCd] of Object.entries(SEOUL_GU_LAWD)) {
    console.log(`\n[${gu}] LAWD=${lawdCd}`);
    result[gu] = {};
    for (const year of YEARS) {
      const sum = { total: 0, n: 0 };
      const monthEnd = (year === CUR_YEAR) ? CUR_MONTH : 12;
      for (let m = 1; m <= monthEnd; m++) {
        const ym = `${year}${String(m).padStart(2, "0")}`;
        const deals = await fetchMonth(lawdCd, ym);
        for (const d of deals) {
          const p = toPyeongPrice(d);
          if (p && p > 100 && p < 100000) { // 평당 100만 ~ 10억 사이만 (이상치 제거)
            sum.total += p;
            sum.n += 1;
          }
        }
      }
      const avg = sum.n > 0 ? Math.round(sum.total / sum.n) : null;
      result[gu][year] = { avg, n: sum.n };
      console.log(`  ${year}: ${sum.n}건, 평균 ${avg ? avg.toLocaleString() + "만/평" : "—"}`);
    }
  }

  // JSON 저장
  fs.writeFileSync("./lib/data/rtms-land-yearly.json", JSON.stringify({
    _meta: {
      source: "국토교통부 RTMS 상업업무용 부동산매매 실거래자료",
      api: "RTMSDataSvcNrgTrade",
      filter: "buildingUse=업무 (사실상 상업업무용 빌딩)",
      computed: "매매가(만원) ÷ 대지면적(㎡) × 3.3 = 평당가(만원)",
      outliers_removed: "평당 100만~10억 외 제외",
      synced_at: new Date().toISOString(),
    },
    data: result,
  }, null, 2), "utf8");

  console.log("\n✓ ./lib/data/rtms-land-yearly.json 저장 완료");
})();
