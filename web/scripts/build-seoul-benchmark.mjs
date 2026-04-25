// 서울 7개 카테고리 × 5개 지표 벤치마크 산출 (Phase 1)
// 출력: 카테고리별 평균 객단가/점포당매출/밀도/개폐업률/프랜차이즈비율
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const map = Object.fromEntries(
  env.split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)),
);
const sb = createClient(map.NEXT_PUBLIC_SUPABASE_URL, map.SUPABASE_SERVICE_ROLE_KEY);

const CATEGORIES = {
  "외식": ["한식음식점", "중식음식점", "일식음식점", "양식음식점", "분식전문점", "패스트푸드점", "치킨전문점", "제과점", "반찬가게"],
  "카페/주류": ["커피-음료", "호프-간이주점", "주류도매"],
  "소매/유통": ["편의점", "슈퍼마켓", "일반의류", "한복점", "유아의류", "화장품", "신발", "가방", "시계및귀금속", "안경", "서적", "문구", "가전제품", "핸드폰", "운동/경기용품", "예술품", "의약품", "육류판매", "중고가구", "가구", "철물점", "청과상", "수산물판매", "미곡판매", "조명용품", "섬유제품", "완구", "악기", "화초", "애완동물", "미용재료", "컴퓨터및주변장치판매", "의류임대", "가정용품임대", "재생용품 판매점", "비디오/서적임대", "중고차판매", "자전거 및 기타운송장비", "모터사이클및부품"],
  "뷰티/건강": ["미용실", "피부관리실", "네일숍", "일반의원", "치과의원", "한의원", "동물병원", "의료기기"],
  "교육": ["외국어학원", "일반교습학원", "예술학원", "컴퓨터학원", "스포츠 강습", "독서실"],
  "생활서비스": ["세탁소", "부동산중개업", "변호사사무소", "회계사사무소", "세무사사무소", "인테리어", "전자상거래업", "자동차수리", "사진관", "여행사", "통번역서비스", "법무사사무소", "변리사사무소", "기타법무서비스", "건축물청소", "자동차미용", "자동차부품", "모터사이클수리", "가전제품수리", "통신기기수리", "주유소", "녹음실"],
  "여가/오락": ["스포츠클럽", "골프연습장", "PC방", "노래방", "당구장", "볼링장", "게스트하우스", "여관", "고시원", "DVD방", "전자게임장", "기타오락장", "복권방"],
};

// svc_nm → 카테고리 역매핑
const SVC_TO_CAT = {};
for (const [cat, subs] of Object.entries(CATEGORIES)) {
  for (const s of subs) SVC_TO_CAT[s] = cat;
}

// ── 1. 데이터 상태 확인 ──
async function checkDataState() {
  console.log("\n=== 데이터 상태 ===");
  for (const tbl of ["sales", "stores", "foot_traffic", "population"]) {
    const { count } = await sb.from(tbl).select("*", { count: "exact", head: true });
    const { data: maxQ } = await sb.from(tbl).select("quarter_cd").order("quarter_cd", { ascending: false }).limit(1);
    console.log(`  ${tbl}: ${count?.toLocaleString() ?? "?"}행, 최신분기 ${maxQ?.[0]?.quarter_cd ?? "없음"}`);
  }
}

// ── 2. 페이지네이션 헬퍼 (Supabase 1만 행 제한 회피) ──
async function fetchAll(tbl, select, filter, pageSize = 1000) {
  const out = [];
  let from = 0;
  while (true) {
    let q = sb.from(tbl).select(select).range(from, from + pageSize - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) {
      console.error(`fetchAll(${tbl}) error:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ── 3. 카테고리별 벤치마크 산출 ──
async function buildBenchmark() {
  // 최신 분기 — sales 기준
  const { data: maxQ } = await sb.from("sales").select("quarter_cd").order("quarter_cd", { ascending: false }).limit(1);
  const Q = maxQ?.[0]?.quarter_cd;
  if (!Q) { console.log("최신 분기 없음"); return; }
  console.log(`\n사용 분기: ${Q}`);

  // 4개 테이블 latest quarter 데이터 한 번에 가져오기
  console.log("→ sales 가져오는 중…");
  const sales = await fetchAll("sales", "trdar_cd, svc_nm, monthly_sales, monthly_count", (q) => q.eq("quarter_cd", Q));
  console.log(`  ${sales.length.toLocaleString()}행`);

  console.log("→ stores 가져오는 중…");
  const stores = await fetchAll("stores", "trdar_cd, svc_nm, store_count, open_count, close_count, franchise_count", (q) => q.eq("quarter_cd", Q));
  console.log(`  ${stores.length.toLocaleString()}행`);

  console.log("→ foot_traffic 가져오는 중…");
  const ft = await fetchAll("foot_traffic", "trdar_cd, total_ft", (q) => q.eq("quarter_cd", Q));
  console.log(`  ${ft.length.toLocaleString()}행`);

  console.log("→ population 가져오는 중…");
  const pop = await fetchAll("population", "trdar_cd, total_pop", (q) => q.eq("quarter_cd", Q));
  console.log(`  ${pop.length.toLocaleString()}행`);

  // trdar별 잠재소비자 합산
  const consumersByTrdar = {};
  for (const r of ft) consumersByTrdar[r.trdar_cd] = (consumersByTrdar[r.trdar_cd] ?? 0) + (Number(r.total_ft) || 0);
  for (const r of pop) consumersByTrdar[r.trdar_cd] = (consumersByTrdar[r.trdar_cd] ?? 0) + (Number(r.total_pop) || 0);

  // trdar × category 기준 집계
  // sales: { trdar: { cat: { sales, count } } }
  const salesAgg = {};
  for (const r of sales) {
    const cat = SVC_TO_CAT[r.svc_nm];
    if (!cat) continue;
    if (!salesAgg[r.trdar_cd]) salesAgg[r.trdar_cd] = {};
    if (!salesAgg[r.trdar_cd][cat]) salesAgg[r.trdar_cd][cat] = { sales: 0, count: 0 };
    salesAgg[r.trdar_cd][cat].sales += Number(r.monthly_sales) || 0;
    salesAgg[r.trdar_cd][cat].count += Number(r.monthly_count) || 0;
  }

  const storesAgg = {};
  for (const r of stores) {
    const cat = SVC_TO_CAT[r.svc_nm];
    if (!cat) continue;
    if (!storesAgg[r.trdar_cd]) storesAgg[r.trdar_cd] = {};
    if (!storesAgg[r.trdar_cd][cat]) storesAgg[r.trdar_cd][cat] = { count: 0, open: 0, close: 0, franchise: 0 };
    storesAgg[r.trdar_cd][cat].count += Number(r.store_count) || 0;
    storesAgg[r.trdar_cd][cat].open += Number(r.open_count) || 0;
    storesAgg[r.trdar_cd][cat].close += Number(r.close_count) || 0;
    storesAgg[r.trdar_cd][cat].franchise += Number(r.franchise_count) || 0;
  }

  // 카테고리별 trdar 단위 지표 모음 → 평균
  const benchmark = {};
  for (const cat of Object.keys(CATEGORIES)) {
    const perStoreSales = []; // 점포당 월매출 (원)
    const tickets = [];        // 객단가 (원/건)
    const perCapitaSales = []; // 1인당 카테고리 소비액 (원/월) — 수요축
    const densities = [];      // 잠재소비자 만명당 점포수
    const openRates = [];      // 개업/(개+폐)
    const franchiseRatios = [];

    let totalStores = 0, totalOpen = 0, totalClose = 0, totalFranchise = 0;

    for (const trdar of Object.keys(consumersByTrdar)) {
      const consumers = consumersByTrdar[trdar];
      if (!consumers || consumers <= 0) continue;
      const s = salesAgg[trdar]?.[cat];
      const t = storesAgg[trdar]?.[cat];

      if (s && s.sales > 0) {
        perCapitaSales.push(s.sales / consumers);
      }
      if (s && s.count > 0 && t && t.count > 0) {
        perStoreSales.push(s.sales / t.count);
        tickets.push(s.sales / s.count);
      }
      if (t && t.count > 0) {
        densities.push((t.count / consumers) * 10000);
        const oc = t.open + t.close;
        if (oc > 0) openRates.push(t.open / oc);
        franchiseRatios.push(t.franchise / t.count);

        totalStores += t.count;
        totalOpen += t.open;
        totalClose += t.close;
        totalFranchise += t.franchise;
      }
    }

    const median = (arr) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    benchmark[cat] = {
      // 핵심: trdar 단위 평균 (외부 분포 노이즈 안정)
      avg_per_store_sales: Math.round(mean(perStoreSales)),
      median_per_store_sales: Math.round(median(perStoreSales)),
      avg_ticket: Math.round(mean(tickets)),
      median_ticket: Math.round(median(tickets)),
      avg_per_capita_sales: Math.round(mean(perCapitaSales)),
      median_per_capita_sales: Math.round(median(perCapitaSales)),
      avg_density: Math.round(mean(densities) * 100) / 100,
      median_density: Math.round(median(densities) * 100) / 100,
      avg_open_rate: Math.round(mean(openRates) * 1000) / 10, // %
      avg_franchise_ratio: Math.round(mean(franchiseRatios) * 1000) / 10, // %
      // 진단용 메타
      _trdar_n: perStoreSales.length,
      _seoul_total_stores: totalStores,
      _seoul_total_open: totalOpen,
      _seoul_total_close: totalClose,
    };
  }

  return { quarter: Q, categories: benchmark };
}

(async () => {
  await checkDataState();
  const result = await buildBenchmark();
  if (!result) return;
  console.log(`\n=== 서울 7개 카테고리 벤치마크 (분기 ${result.quarter}) ===\n`);

  const rows = [];
  for (const [cat, m] of Object.entries(result.categories)) {
    rows.push({
      카테고리: cat,
      "trdar n": m._trdar_n,
      "점포당월매출(만원)": Math.round(m.avg_per_store_sales / 10000),
      "(median)": Math.round(m.median_per_store_sales / 10000),
      "객단가(원)": m.avg_ticket.toLocaleString(),
      "(median)": m.median_ticket.toLocaleString(),
      "밀도(만명/점포)": m.avg_density,
      "개업률(%)": m.avg_open_rate,
      "프랜차이즈(%)": m.avg_franchise_ratio,
    });
  }
  console.table(rows);

  // 결과 JSON 저장
  fs.writeFileSync("./_seoul_benchmark.json", JSON.stringify(result, null, 2), "utf8");
  console.log("\n저장: ./_seoul_benchmark.json");
})();
