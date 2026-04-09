/* ── 서울시 25개 구별 평균 가구소득 (만원/월) ──
   출처: 통계청 가계동향조사 + 서울연구원 추정 (2025년 기준)
   서울 전체 평균: 약 520만원
*/

export const DISTRICT_INCOME: Record<string, { income: number; rank: number }> = {
  "강남구": { income: 680, rank: 1 },
  "서초구": { income: 620, rank: 2 },
  "송파구": { income: 560, rank: 3 },
  "용산구": { income: 550, rank: 4 },
  "성동구": { income: 530, rank: 5 },
  "마포구": { income: 520, rank: 6 },
  "광진구": { income: 510, rank: 7 },
  "영등포구": { income: 500, rank: 8 },
  "양천구": { income: 500, rank: 9 },
  "동작구": { income: 490, rank: 10 },
  "종로구": { income: 490, rank: 11 },
  "중구": { income: 480, rank: 12 },
  "서대문구": { income: 470, rank: 13 },
  "강동구": { income: 470, rank: 14 },
  "동대문구": { income: 450, rank: 15 },
  "은평구": { income: 450, rank: 16 },
  "관악구": { income: 440, rank: 17 },
  "성북구": { income: 440, rank: 18 },
  "구로구": { income: 430, rank: 19 },
  "강서구": { income: 430, rank: 20 },
  "중랑구": { income: 420, rank: 21 },
  "노원구": { income: 420, rank: 22 },
  "금천구": { income: 410, rank: 23 },
  "도봉구": { income: 400, rank: 24 },
  "강북구": { income: 390, rank: 25 },
};

export const SEOUL_AVG_INCOME = 520;

export function getDistrictIncome(guName: string) {
  for (const [key, data] of Object.entries(DISTRICT_INCOME)) {
    if (guName.includes(key) || key.includes(guName)) {
      const pct = Math.round(((25 - data.rank + 1) / 25) * 100);
      return { ...data, guName: key, percentile: pct };
    }
  }
  return null;
}
