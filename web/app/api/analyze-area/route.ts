import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/* ── Haversine distance (meters) ── */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Hardcoded rent data by gu ── */
const RENT_DATA: Record<string, { f1: number; b1: number; f2: number }> = {
  "강남구": { f1: 53.3, b1: 30.9, f2: 32.0 },
  "서초구": { f1: 42.5, b1: 24.7, f2: 25.5 },
  "마포구": { f1: 33.8, b1: 19.6, f2: 20.3 },
  "용산구": { f1: 38.5, b1: 22.3, f2: 23.1 },
  "종로구": { f1: 36.2, b1: 21.0, f2: 21.7 },
  "중구": { f1: 44.8, b1: 26.0, f2: 26.9 },
  "성동구": { f1: 30.5, b1: 17.7, f2: 18.3 },
  "송파구": { f1: 35.1, b1: 20.4, f2: 21.1 },
  "영등포구": { f1: 32.7, b1: 19.0, f2: 19.6 },
  "광진구": { f1: 28.9, b1: 16.8, f2: 17.3 },
  "동작구": { f1: 25.3, b1: 14.7, f2: 15.2 },
  "관악구": { f1: 22.1, b1: 12.8, f2: 13.3 },
  "강동구": { f1: 27.5, b1: 16.0, f2: 16.5 },
  "노원구": { f1: 20.8, b1: 12.1, f2: 12.5 },
  "은평구": { f1: 21.5, b1: 12.5, f2: 12.9 },
  "강서구": { f1: 24.3, b1: 14.1, f2: 14.6 },
  "강북구": { f1: 19.2, b1: 11.1, f2: 11.5 },
  "구로구": { f1: 23.8, b1: 13.8, f2: 14.3 },
  "금천구": { f1: 22.5, b1: 13.1, f2: 13.5 },
  "도봉구": { f1: 19.8, b1: 11.5, f2: 11.9 },
  "동대문구": { f1: 27.3, b1: 15.8, f2: 16.4 },
  "서대문구": { f1: 25.8, b1: 15.0, f2: 15.5 },
  "성북구": { f1: 22.9, b1: 13.3, f2: 13.7 },
  "양천구": { f1: 25.1, b1: 14.6, f2: 15.1 },
  "중랑구": { f1: 21.2, b1: 12.3, f2: 12.7 },
};

/* ── Helpers ── */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function maxKey(obj: Record<string, number>): string {
  let best = "";
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(obj)) {
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

function latestQuarterRows(rows: Row[]): Row[] {
  if (rows.length === 0) return [];
  // 상권별로 최신 분기가 다를 수 있으므로, 각 상권의 최신 분기 데이터를 사용
  const latestByArea = new Map<string, string>();
  for (const r of rows) {
    const cd = r.trdar_cd as string;
    const q = r.quarter_cd as string;
    if (!cd || !q) continue;
    const prev = latestByArea.get(cd);
    if (!prev || q > prev) latestByArea.set(cd, q);
  }
  if (latestByArea.size === 0) return rows;
  return rows.filter((r) => {
    const cd = r.trdar_cd as string;
    const q = r.quarter_cd as string;
    if (!cd || !q) return true;
    return q === latestByArea.get(cd);
  });
}

/* ── Main GET handler ── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  const radius = parseInt(searchParams.get("radius") ?? "300", 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  /* ── Step 1: Find nearby commercial areas ──
     반경 내 상권이 없으면 자동으로 확대하여 최소 1개 이상 찾음 (최대 2km) */
  const searchRadii = [radius, 500, 800, 1000, 1500, 2000];
  // 요청 반경부터 시작, 중복 제거
  const radiiToTry = [...new Set(searchRadii.filter((r) => r >= radius))];

  let nearby: Array<typeof areaRowsTyped[number] & { distance: number }> = [];
  let actualRadius = radius;
  type AreaRow = { trdar_cd: string; trdar_nm: string; gu: string; dong: string; lat: number; lng: number };
  const areaRowsTyped: AreaRow[] = [];

  for (const tryRadius of radiiToTry) {
    const deg = (tryRadius / 111000) * 1.2;
    const { data: areaRows } = await supabase
      .from("areas")
      .select("trdar_cd, trdar_nm, gu, dong, lat, lng")
      .gte("lat", lat - deg)
      .lte("lat", lat + deg)
      .gte("lng", lng - deg)
      .lte("lng", lng + deg);

    if (!areaRows || areaRows.length === 0) continue;

    nearby = areaRows
      .map((r) => ({ ...r, distance: haversineM(lat, lng, r.lat, r.lng) }))
      .filter((r) => r.distance <= tryRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);

    if (nearby.length > 0) {
      actualRadius = tryRadius;
      break;
    }
  }

  if (nearby.length === 0) {
    return NextResponse.json(emptyResponse("", []), { status: 200 });
  }

  const codes = nearby.map((r) => r.trdar_cd);
  const weights = nearby.map((r) => 1.0 - 0.7 * (r.distance / actualRadius));
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  const guName = nearby[0].gu ?? "";

  /* ── Step 2: Fetch data in parallel (limit 확장 — 상권×분기×업종 조합이 많을 수 있음) ── */
  const [salesRes, ftRes, popRes, storesRes] = await Promise.all([
    supabase.from("sales").select("*").in("trdar_cd", codes).limit(50000),
    supabase.from("foot_traffic").select("*").in("trdar_cd", codes).limit(50000),
    supabase.from("population").select("*").in("trdar_cd", codes).limit(50000),
    supabase.from("stores").select("*").in("trdar_cd", codes).limit(50000),
  ]);

  const salesAll = latestQuarterRows(salesRes.data ?? []);
  const ftAll = latestQuarterRows(ftRes.data ?? []);
  const popAll = latestQuarterRows(popRes.data ?? []);
  const storesAll = latestQuarterRows(storesRes.data ?? []);

  /* ── Helper: build weight lookup by trdar_cd ── */
  const weightMap: Record<string, number> = {};
  nearby.forEach((r, i) => {
    weightMap[r.trdar_cd] = weights[i];
  });

  function w(trdarCd: string): number {
    return weightMap[trdarCd] ?? 0;
  }

  /* ── Step 2a: Sales aggregation ── */
  const svcSales: Record<string, { sales: number; count: number }> = {};
  const timeSlotsSales: Record<string, number> = {
    "00~06": 0, "06~11": 0, "11~14": 0, "14~17": 0, "17~21": 0, "21~24": 0,
  };
  const daySales: Record<string, number> = {
    "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0,
  };
  let totalSales = 0;
  let totalCount = 0;

  for (const row of salesAll) {
    const wt = w(row.trdar_cd);
    const svc = row.svc_nm ?? "기타";
    if (!svcSales[svc]) svcSales[svc] = { sales: 0, count: 0 };
    svcSales[svc].sales += num(row.monthly_sales) * wt;
    svcSales[svc].count += num(row.monthly_count) * wt;
    totalSales += num(row.monthly_sales) * wt;
    totalCount += num(row.monthly_count) * wt;

    timeSlotsSales["00~06"] += num(row.time_00_06) * wt;
    timeSlotsSales["06~11"] += num(row.time_06_11) * wt;
    timeSlotsSales["11~14"] += num(row.time_11_14) * wt;
    timeSlotsSales["14~17"] += num(row.time_14_17) * wt;
    timeSlotsSales["17~21"] += num(row.time_17_21) * wt;
    timeSlotsSales["21~24"] += num(row.time_21_24) * wt;

    daySales["월"] += num(row.mon_sales) * wt;
    daySales["화"] += num(row.tue_sales) * wt;
    daySales["수"] += num(row.wed_sales) * wt;
    daySales["목"] += num(row.thu_sales) * wt;
    daySales["금"] += num(row.fri_sales) * wt;
    daySales["토"] += num(row.sat_sales) * wt;
    daySales["일"] += num(row.sun_sales) * wt;
  }

  // Normalize weighted values
  const normW = totalWeight;
  for (const k of Object.keys(timeSlotsSales)) timeSlotsSales[k] = Math.round(timeSlotsSales[k] / normW);
  for (const k of Object.keys(daySales)) daySales[k] = Math.round(daySales[k] / normW);
  totalSales = Math.round(totalSales / normW);
  totalCount = Math.round(totalCount / normW);

  const byService = Object.entries(svcSales).map(([svc, d]) => ({
    "업종": svc,
    "매출액": Math.round(d.sales / normW),
    "건수": Math.round(d.count / normW),
  }));
  byService.sort((a, b) => b["매출액"] - a["매출액"]);

  /* ── Step 2a (cont): per_store sales ── */
  // Build store count per svc from storesAll
  const svcStoreCount: Record<string, number> = {};
  for (const row of storesAll) {
    const svc = row.svc_nm ?? "기타";
    const wt = w(row.trdar_cd);
    svcStoreCount[svc] = (svcStoreCount[svc] ?? 0) + num(row.store_count) * wt;
  }

  const perStore = Object.entries(svcSales).map(([svc, d]) => {
    const storeW = svcStoreCount[svc] ?? 0;
    const stores = Math.round(storeW / normW);
    const sales = Math.round(d.sales / normW);
    const count = Math.round(d.count / normW);
    return {
      "업종": svc,
      "점포수": stores,
      "총매출": sales,
      "점포당_매출": stores > 0 ? Math.round(sales / stores) : 0,
      "점포당_건수": stores > 0 ? Math.round(count / stores) : 0,
    };
  });
  perStore.sort((a, b) => b["총매출"] - a["총매출"]);

  const salesSummary = {
    by_service: byService,
    per_store: perStore,
    time_slots: timeSlotsSales,
    day_of_week: daySales,
    total_sales: totalSales,
    total_count: totalCount,
  };

  /* ── Step 2b: Foot traffic aggregation ── */
  let ftTotal = 0;
  const ftTimeSlots: Record<string, number> = {
    "00~06": 0, "06~11": 0, "11~14": 0, "14~17": 0, "17~21": 0, "21~24": 0,
  };
  const ftGender: Record<string, number> = { "남성": 0, "여성": 0 };
  const ftAge: Record<string, number> = {
    "10대": 0, "20대": 0, "30대": 0, "40대": 0, "50대": 0, "60대이상": 0,
  };
  const ftDay: Record<string, number> = {
    "월": 0, "화": 0, "수": 0, "목": 0, "금": 0, "토": 0, "일": 0,
  };

  for (const row of ftAll) {
    const wt = w(row.trdar_cd);
    ftTotal += num(row.total_ft) * wt;
    ftTimeSlots["00~06"] += num(row.time_00_06) * wt;
    ftTimeSlots["06~11"] += num(row.time_06_11) * wt;
    ftTimeSlots["11~14"] += num(row.time_11_14) * wt;
    ftTimeSlots["14~17"] += num(row.time_14_17) * wt;
    ftTimeSlots["17~21"] += num(row.time_17_21) * wt;
    ftTimeSlots["21~24"] += num(row.time_21_24) * wt;
    ftGender["남성"] += num(row.male_ft) * wt;
    ftGender["여성"] += num(row.female_ft) * wt;
    ftAge["10대"] += num(row.age_10) * wt;
    ftAge["20대"] += num(row.age_20) * wt;
    ftAge["30대"] += num(row.age_30) * wt;
    ftAge["40대"] += num(row.age_40) * wt;
    ftAge["50대"] += num(row.age_50) * wt;
    ftAge["60대이상"] += num(row.age_60) * wt;
    ftDay["월"] += num(row.mon) * wt;
    ftDay["화"] += num(row.tue) * wt;
    ftDay["수"] += num(row.wed) * wt;
    ftDay["목"] += num(row.thu) * wt;
    ftDay["금"] += num(row.fri) * wt;
    ftDay["토"] += num(row.sat) * wt;
    ftDay["일"] += num(row.sun) * wt;
  }

  ftTotal = Math.round(ftTotal / normW);
  for (const k of Object.keys(ftTimeSlots)) ftTimeSlots[k] = Math.round(ftTimeSlots[k] / normW);
  for (const k of Object.keys(ftGender)) ftGender[k] = Math.round(ftGender[k] / normW);
  for (const k of Object.keys(ftAge)) ftAge[k] = Math.round(ftAge[k] / normW);
  for (const k of Object.keys(ftDay)) ftDay[k] = Math.round(ftDay[k] / normW);

  const ftSummary = {
    total: ftTotal,
    time_slots: ftTimeSlots,
    by_gender: ftGender,
    by_age: ftAge,
    by_day: ftDay,
  };

  /* ── Step 2c: Population aggregation ── */
  let popTotal = 0;
  const popGender: Record<string, number> = { "남성": 0, "여성": 0 };
  const popAge: Record<string, number> = {
    "10대": 0, "20대": 0, "30대": 0, "40대": 0, "50대": 0, "60대이상": 0,
  };

  for (const row of popAll) {
    const wt = w(row.trdar_cd);
    popTotal += num(row.total_pop) * wt;
    popGender["남성"] += num(row.male_pop) * wt;
    popGender["여성"] += num(row.female_pop) * wt;
    popAge["10대"] += num(row.age_10) * wt;
    popAge["20대"] += num(row.age_20) * wt;
    popAge["30대"] += num(row.age_30) * wt;
    popAge["40대"] += num(row.age_40) * wt;
    popAge["50대"] += num(row.age_50) * wt;
    popAge["60대이상"] += num(row.age_60) * wt;
  }

  popTotal = Math.round(popTotal / normW);
  for (const k of Object.keys(popGender)) popGender[k] = Math.round(popGender[k] / normW);
  for (const k of Object.keys(popAge)) popAge[k] = Math.round(popAge[k] / normW);
  const households = Math.round(popTotal * 0.4);

  const popSummary = {
    total: popTotal,
    households,
    by_age: popAge,
    by_gender: popGender,
  };

  /* ── Step 2d: Stores aggregation ── */
  const svcStores: Record<string, { count: number; open: number; close: number; franchise: number }> = {};
  let totalStoreCount = 0;

  for (const row of storesAll) {
    const svc = row.svc_nm ?? "기타";
    const wt = w(row.trdar_cd);
    if (!svcStores[svc]) svcStores[svc] = { count: 0, open: 0, close: 0, franchise: 0 };
    svcStores[svc].count += num(row.store_count) * wt;
    svcStores[svc].open += num(row.open_count) * wt;
    svcStores[svc].close += num(row.close_count) * wt;
    svcStores[svc].franchise += num(row.franchise_count) * wt;
    totalStoreCount += num(row.store_count) * wt;
  }

  totalStoreCount = Math.round(totalStoreCount / normW);

  const scByService = Object.entries(svcStores).map(([svc, d]) => ({
    "업종": svc,
    "점포수": Math.round(d.count / normW),
    "개업수": Math.round(d.open / normW),
    "폐업수": Math.round(d.close / normW),
    "프랜차이즈": Math.round(d.franchise / normW),
  }));
  scByService.sort((a, b) => b["점포수"] - a["점포수"]);

  const totalOpen = scByService.reduce((s, r) => s + r["개업수"], 0);
  const totalClose = scByService.reduce((s, r) => s + r["폐업수"], 0);

  const scSummary = {
    by_service: scByService,
    open_close: { open: totalOpen, close: totalClose },
  };

  /* ── Store summary (by_category / by_subcategory) ── */
  // Use svc_nm as subcategory; derive category from first 2 chars or full name
  const bySubcategory: Record<string, { count: number; ratio: number }> = {};
  const byCategory: Record<string, { count: number; ratio: number }> = {};

  // Category grouping: map svc_nm to broader categories
  const CATEGORY_MAP: Record<string, string> = {};
  // We'll group by the first major word
  function deriveCategory(svcNm: string): string {
    if (CATEGORY_MAP[svcNm]) return CATEGORY_MAP[svcNm];
    if (svcNm.includes("음식점") || svcNm.includes("식당")) return "음식점";
    if (svcNm.includes("커피") || svcNm.includes("카페")) return "커피/음료";
    if (svcNm.includes("주점") || svcNm.includes("호프")) return "주점";
    if (svcNm.includes("분식")) return "음식점";
    if (svcNm.includes("치킨")) return "음식점";
    if (svcNm.includes("패스트푸드") || svcNm.includes("피자") || svcNm.includes("햄버거")) return "음식점";
    if (svcNm.includes("의류") || svcNm.includes("패션") || svcNm.includes("신발") || svcNm.includes("잡화")) return "소매/패션";
    if (svcNm.includes("슈퍼") || svcNm.includes("편의점") || svcNm.includes("마트")) return "소매/유통";
    if (svcNm.includes("의원") || svcNm.includes("약국") || svcNm.includes("병원")) return "의료";
    if (svcNm.includes("미용") || svcNm.includes("헤어") || svcNm.includes("네일")) return "서비스/미용";
    if (svcNm.includes("학원") || svcNm.includes("교육")) return "교육";
    if (svcNm.includes("부동산") || svcNm.includes("중개")) return "부동산";
    return "기타";
  }

  for (const [svc, d] of Object.entries(svcStores)) {
    const cnt = Math.round(d.count / normW);
    const ratio = totalStoreCount > 0 ? Math.round((cnt / totalStoreCount) * 1000) / 10 : 0;
    bySubcategory[svc] = { count: cnt, ratio };

    const cat = deriveCategory(svc);
    if (!byCategory[cat]) byCategory[cat] = { count: 0, ratio: 0 };
    byCategory[cat].count += cnt;
  }
  // Recalculate category ratios
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].ratio =
      totalStoreCount > 0 ? Math.round((byCategory[cat].count / totalStoreCount) * 1000) / 10 : 0;
  }

  const storeSummary = {
    total: totalStoreCount,
    by_category: byCategory,
    by_subcategory: bySubcategory,
  };

  /* ── Step 4: Rent info ── */
  const rentData = RENT_DATA[guName];
  const rentInfo = rentData
    ? {
        gu: guName,
        "1층_평": rentData.f1,
        "지하_평": rentData.b1,
        "2층이상_평": rentData.f2,
        source: "한국부동산원 2025 Q3",
      }
    : {};

  /* ── Step 5: Opportunities ── */
  // vitality_score: 0-100 based on foot traffic + sales
  const ftScore = Math.min(50, (ftTotal / 100000) * 50);
  const salesScore = Math.min(50, (totalSales / 1000000000) * 50);
  const vitalityScore = Math.round(ftScore + salesScore);

  const peakTime = maxKey(ftTimeSlots);
  const dominantAge = maxKey(ftAge);
  const dominantGender = maxKey(ftGender);

  // Determine area type
  let areaType = "일반상업지역";
  if (vitalityScore >= 70) areaType = "핵심상권";
  else if (vitalityScore >= 50) areaType = "성장상권";
  else if (vitalityScore >= 30) areaType = "일반상권";
  else areaType = "소규모상권";

  // Diagnosis
  let diagnosis = "안정적인 상권입니다.";
  if (totalOpen > totalClose * 1.5) diagnosis = "활발하게 성장 중인 상권입니다.";
  else if (totalClose > totalOpen * 1.5) diagnosis = "폐업이 많아 주의가 필요한 상권입니다.";
  else if (vitalityScore >= 60) diagnosis = "유동인구와 매출이 양호한 활성 상권입니다.";

  const insights = {
    total_stores: totalStoreCount,
    total_foot_traffic: ftTotal,
    total_population: popTotal,
    peak_time: peakTime,
    dominant_age: dominantAge,
    dominant_gender: dominantGender,
    vitality: vitalityScore >= 60 ? "활발" : vitalityScore >= 40 ? "보통" : "저조",
    vitality_score: vitalityScore,
    open_count: totalOpen,
    close_count: totalClose,
    area_type: areaType,
    diagnosis,
  };

  // Saturated: ratio > 10%
  const saturated = Object.entries(bySubcategory)
    .filter(([, d]) => d.ratio > 10)
    .map(([svc, d]) => ({
      "업종": svc,
      "점포수": d.count,
      "비율": `${d.ratio}%`,
      "판단": "포화",
    }));

  // Underserved: ratio < 2% but has sales
  const svcSalesMap = new Map(byService.map((s) => [s["업종"], s["매출액"]]));
  const underserved = Object.entries(bySubcategory)
    .filter(([svc, d]) => d.ratio < 2 && d.ratio > 0 && (svcSalesMap.get(svc) ?? 0) > 0)
    .map(([svc, d]) => ({
      "업종": svc,
      "점포수": d.count,
      "비율": `${d.ratio}%`,
      "판단": "공급부족",
      "매출액": `${Math.round((svcSalesMap.get(svc) ?? 0) / 10000)}만원`,
    }));

  // Recommendations: top industries from underserved + low saturation with decent sales
  const recommendations = Object.entries(bySubcategory)
    .filter(([svc]) => (svcSalesMap.get(svc) ?? 0) > 0)
    .map(([svc, d]) => {
      const sales = svcSalesMap.get(svc) ?? 0;
      const satRatio = d.ratio;
      // Score: high sales + low saturation = good
      const score = sales / 1000000 * (1 - satRatio / 100);
      return { svc, score, count: d.count, ratio: d.ratio, sales };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((r) => ({
      "업종": r.svc,
      "점포수": r.count,
      "비율": `${r.ratio}%`,
      "매출액": `${Math.round(r.sales / 10000)}만원`,
      "근거": r.ratio < 5 ? "낮은 포화도, 높은 매출" : "양호한 매출 대비 경쟁",
    }));

  const opportunities = {
    insights,
    saturated,
    underserved,
    growing: [] as Array<Record<string, unknown>>,
    recommendations,
  };

  /* ── Step 6: Cross result (placeholder) ── */
  const crossResult: Array<Record<string, unknown>> = [];

  /* ── Build response ── */
  return NextResponse.json({
    store_summary: storeSummary,
    stores: [],
    sales_summary: salesSummary,
    ft_summary: ftSummary,
    pop_summary: popSummary,
    sc_summary: scSummary,
    rent_info: rentInfo,
    cross_result: crossResult,
    opportunities,
    trdar_count: nearby.length,
    trdar_names: nearby.map((r) => r.trdar_nm),
    gu_name: guName,
  });
}

/* ── Empty response for no-data case ── */
function emptyResponse(gu: string, names: string[]) {
  return {
    store_summary: { total: 0, by_category: {}, by_subcategory: {} },
    stores: [],
    sales_summary: {
      by_service: [],
      per_store: [],
      time_slots: {},
      day_of_week: {},
      total_sales: 0,
      total_count: 0,
    },
    ft_summary: { total: 0, time_slots: {}, by_gender: {}, by_age: {}, by_day: {} },
    pop_summary: { total: 0, households: 0, by_age: {}, by_gender: {} },
    sc_summary: { by_service: [], open_close: { open: 0, close: 0 } },
    rent_info: {},
    cross_result: [],
    opportunities: {
      insights: {
        total_stores: 0,
        total_foot_traffic: 0,
        total_population: 0,
        peak_time: "",
        dominant_age: "",
        dominant_gender: "",
        vitality: "저조",
        vitality_score: 0,
        open_count: 0,
        close_count: 0,
        area_type: "",
        diagnosis: "데이터가 없습니다.",
      },
      saturated: [],
      underserved: [],
      growing: [],
      recommendations: [],
    },
    trdar_count: 0,
    trdar_names: names,
    gu_name: gu,
  };
}
