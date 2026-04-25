// ── 임대·토지 시세 추이 동기화 ──
// 한국부동산원 R-ONE OpenAPI + 국토부 RTMS 실거래가 OpenAPI 호출 → Supabase 캐시
// 분기/연 단위 갱신용. 환경변수 PUBLIC_DATA_PORTAL_KEY 필요.
//
// 실행: node scripts/sync-trends.mjs
// Vercel Cron: 분기 1회 (예: 1월·4월·7월·10월 5일 03:00)

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const sb = createClient(map.NEXT_PUBLIC_SUPABASE_URL, map.SUPABASE_SERVICE_ROLE_KEY);
const KEY = map.PUBLIC_DATA_PORTAL_KEY;

if (!KEY) {
  console.error("PUBLIC_DATA_PORTAL_KEY 미설정. .env.local에 키 추가 후 재실행하세요.");
  process.exit(1);
}

const regions = JSON.parse(fs.readFileSync(path.resolve("./lib/data/rone-regions.json"), "utf8")).regions;

// ────────────────────────────────────────────────────────
// 1. R-ONE 임대동향조사 동기화
// ────────────────────────────────────────────────────────
async function syncRoneRent() {
  console.log("\n=== R-ONE 임대동향조사 동기화 ===");
  // R-ONE API 엔드포인트 (실제 통계표 ID는 R-ONE 통계 코드 검색에서 확인)
  // 예시: 상업용부동산 임대동향조사 - 임대료 (1층) STATBL_ID (확인 필요)
  // const URL = `https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${KEY}&Type=json&pIndex=1&pSize=100&STATBL_ID=A_2024_00404&DTACYCLE_CD=QY`;
  console.log("→ R-ONE API 엔드포인트 + 통계표 ID 매핑 작업 필요");
  console.log("→ 권역", regions.length, "개에 대해 분기별 임대료 fetch → 연 평균 → upsert");
  // TODO: 실제 API 호출 + rone_rent_yearly upsert
}

// ────────────────────────────────────────────────────────
// 2. RTMS 상업업무용 매매 실거래 동기화
// ────────────────────────────────────────────────────────
async function syncRtmsLand() {
  console.log("\n=== RTMS 상업업무용 매매 실거래 동기화 ===");
  // 국토부 RTMS API: 시·군·구 코드(법정동) + 계약년월 단위 호출
  // const URL = `https://apis.data.go.kr/1613000/RTMSDataSvcOfficeRent/getRTMSDataSvcOfficeRent?serviceKey=${KEY}&LAWD_CD=11680&DEAL_YMD=202612&pageNo=1&numOfRows=1000`;
  console.log("→ RTMS API 엔드포인트 + 시·군·구 코드 매핑 작업 필요");
  console.log("→ 25개 구 × 최근 10년 월별 fetch → 연 평균 평당가 → upsert");
  // TODO: 실제 API 호출 + rtms_land_yearly upsert
}

(async () => {
  await syncRoneRent();
  await syncRtmsLand();
  console.log("\n동기화 완료");
})();
