/* ── 서울시 25개 구별 평균 가구소득 (만원/월) ──
   DB(district_income 테이블)에서 가져오며, 로드 전까지 폴백 사용.
*/

// 폴백 데이터 (DB 미연결 시 사용)
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

// DB 캐시 (클라이언트 사이드에서 한 번만 로드)
let _dbCache: Record<string, { income: number; rank: number }> | null = null;
let _dbLoading = false;

export function loadDistrictIncomeFromDB() {
  if (_dbCache || _dbLoading || typeof window === "undefined") return;
  _dbLoading = true;
  fetch("/api/district-income/강남구") // 테스트 호출로 DB 연결 확인
    .then((r) => r.ok ? r.json() : null)
    .then((test) => {
      if (!test || !test.income) return;
      // 전체 구 데이터를 한번에 로드
      return fetch("/api/district-income/all").then((r) => r.ok ? r.json() : null);
    })
    .then((data) => {
      if (data && typeof data === "object") {
        _dbCache = data;
      }
    })
    .catch(() => {})
    .finally(() => { _dbLoading = false; });
}

export function getDistrictIncome(guName: string) {
  const source = _dbCache ?? DISTRICT_INCOME;
  for (const [key, data] of Object.entries(source)) {
    if (guName.includes(key) || key.includes(guName)) {
      const pct = Math.round(((25 - data.rank + 1) / 25) * 100);
      return { ...data, guName: key, percentile: pct };
    }
  }
  return null;
}
