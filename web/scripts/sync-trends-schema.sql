-- ── 임대·토지 시세 추이 캐시 테이블 ──
-- R-ONE 임대동향조사 + RTMS 매매 실거래 데이터 캐시.
-- 분기/연 단위 갱신.

-- 1. R-ONE 권역별 임대 시계열 (1층 평당 월세 만원 기준)
CREATE TABLE IF NOT EXISTS rone_rent_yearly (
  region_code TEXT NOT NULL,           -- e.g. "11_APGUJEONG"
  region_name TEXT NOT NULL,           -- e.g. "압구정"
  gu TEXT NOT NULL,                    -- e.g. "강남구"
  year INTEGER NOT NULL,
  rent_per_pyeong NUMERIC(10, 2),      -- 1층 평당 월세 (만원)
  source TEXT DEFAULT 'rone',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (region_code, year)
);

CREATE INDEX IF NOT EXISTS idx_rone_rent_gu ON rone_rent_yearly(gu);

-- 2. RTMS 매매 실거래 기반 토지 시계열 (구·동·연 단위)
CREATE TABLE IF NOT EXISTS rtms_land_yearly (
  gu TEXT NOT NULL,
  dong TEXT,                           -- 동 단위 (선택)
  year INTEGER NOT NULL,
  avg_land_per_pyeong NUMERIC(12, 2),  -- 토지 평당가 (만원)
  sample_n INTEGER,                    -- 표본 거래 수
  source TEXT DEFAULT 'rtms',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (gu, dong, year)
);

CREATE INDEX IF NOT EXISTS idx_rtms_land_gu ON rtms_land_yearly(gu);

-- RLS: 익명 조회 허용 (가공된 통계만 노출, 개별 거래 X)
ALTER TABLE rone_rent_yearly ENABLE ROW LEVEL SECURITY;
ALTER TABLE rtms_land_yearly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rone_public_read" ON rone_rent_yearly FOR SELECT USING (true);
CREATE POLICY "rtms_public_read" ON rtms_land_yearly FOR SELECT USING (true);
