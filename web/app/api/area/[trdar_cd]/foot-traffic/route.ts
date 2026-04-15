import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 3600;

export async function GET(req: Request, { params }: { params: Promise<{ trdar_cd: string }> }) {
  const limited = rateLimit(req, "area-foot-traffic", 120, 60_000);
  if (limited) return limited;
  const { trdar_cd } = await params;

  const { data } = await supabase
    .from("foot_traffic")
    .select("*")
    .eq("trdar_cd", trdar_cd);

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "no data" }, { status: 404 });
  }

  // 최신 분기
  const quarters = Array.from(new Set(data.map((d) => d.quarter_cd))).sort();
  const latestQ = quarters[quarters.length - 1];
  const row = data.find((d) => d.quarter_cd === latestQ);
  if (!row) return NextResponse.json({ error: "no data" }, { status: 404 });

  // 일평균 = 총 유동 / 90일 (분기)
  const dailyAvg = Math.round((row.total_ft ?? 0) / 90);

  // 시간대별 (분기 전체값을 일평균 근사)
  const timeBuckets: Array<[string, number]> = [
    ["06", row.time_06_11 ?? 0],
    ["10", row.time_06_11 ?? 0],
    ["12", row.time_11_14 ?? 0],
    ["14", row.time_14_17 ?? 0],
    ["16", row.time_14_17 ?? 0],
    ["18", row.time_17_21 ?? 0],
    ["20", row.time_17_21 ?? 0],
    ["22", row.time_21_24 ?? 0],
  ];
  // 각 구간 시간 수로 나눠 시간당 평균, 다시 90일로 나눠 일평균 시간당
  const bucketHours: Record<string, number> = {
    "06": 5, "10": 5, "12": 3, "14": 3, "16": 3, "18": 4, "20": 4, "22": 3,
  };
  const hourly = timeBuckets.map(([hour, val]) => ({
    hour,
    value: Math.round(val / bucketHours[hour] / 90),
  }));

  // 요일별 (일평균)
  const dayValues = [
    row.mon ?? 0, row.tue ?? 0, row.wed ?? 0,
    row.thu ?? 0, row.fri ?? 0, row.sat ?? 0, row.sun ?? 0,
  ];
  const weeklyAvgPerDay = dayValues.map((v) => Math.round(v / (90 / 7)));

  // 히트맵 (7 x 9): 요일 비율 × 시간대 분포로 근사
  const totalDay = dayValues.reduce((s, v) => s + v, 0) || 1;
  const totalTime = timeBuckets.reduce((s, [, v]) => s + v, 0) || 1;
  const timeRatios = timeBuckets.map(([, v]) => v / totalTime);
  const heatmap = dayValues.map((dv) => {
    const dayRatio = dv / totalDay;
    return timeRatios.map((tr) => Math.round(dayRatio * tr * 700)); // 0~100 스케일 근사
  });
  // 9번째 컬럼 없음 → 8컬럼. UI는 9컬럼 기대 → 마지막 하나 복제
  const heatmap9 = heatmap.map((row) => [...row, row[row.length - 1]]);

  // 성별
  const totalGender = (row.male_ft ?? 0) + (row.female_ft ?? 0) || 1;
  const gender = {
    male: Math.round(((row.male_ft ?? 0) / totalGender) * 100),
    female: Math.round(((row.female_ft ?? 0) / totalGender) * 100),
  };

  // 연령
  const ages = [
    ["10대", row.age_10 ?? 0],
    ["20대", row.age_20 ?? 0],
    ["30대", row.age_30 ?? 0],
    ["40대", row.age_40 ?? 0],
    ["50대", row.age_50 ?? 0],
    ["60+", row.age_60 ?? 0],
  ] as const;
  const ageTotal = ages.reduce((s, [, v]) => s + v, 0) || 1;
  const age = ages.map(([label, v]) => ({
    label,
    value: Math.round((v / ageTotal) * 100),
  }));

  return NextResponse.json({
    dailyAvg,
    hourly,
    heatmap: heatmap9,
    gender,
    age,
    _weekly: weeklyAvgPerDay,
  });
}
