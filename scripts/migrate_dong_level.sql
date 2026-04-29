-- ═══════════════════════════════════════════════════════════
-- 동 단위 4중 검증 시스템 — 스키마 보강
-- 기존 schema 위에 추가. 모두 idempotent (재실행 안전).
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행.
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1) dong_lookup: 행정동 코드(10자리) ↔ 동명·구명 매핑 캐시
--    web/lib/dong-lookup.ts와 동일한 426개 행정동 사전.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dong_lookup (
  dong_code TEXT PRIMARY KEY,        -- 10자리 (예: 1117068500)
  dong_code_short TEXT,              -- 8자리
  dong_name TEXT NOT NULL,           -- "한남동"
  full_name TEXT NOT NULL,           -- "서울특별시 용산구 한남동"
  gu_code TEXT NOT NULL,             -- "11170"
  gu_name TEXT NOT NULL,             -- "용산구"
  centroid_lat DOUBLE PRECISION,
  centroid_lng DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS idx_dong_lookup_gu ON dong_lookup(gu_name);
CREATE INDEX IF NOT EXISTS idx_dong_lookup_name ON dong_lookup(dong_name);

ALTER TABLE dong_lookup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON dong_lookup;
CREATE POLICY "public read" ON dong_lookup FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────
-- 2) 기존 테이블에 dong_code 표준 코드 컬럼 추가
--    기존 `dong` 텍스트는 유지(호환성). dong_code가 표준 키.
--    테이블이 아직 없으면 자동 스킵 (안전 적용).
-- ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'areas') THEN
    ALTER TABLE areas ADD COLUMN IF NOT EXISTS dong_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_areas_dong_code ON areas(dong_code);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'naver_listings') THEN
    ALTER TABLE naver_listings ADD COLUMN IF NOT EXISTS dong_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_naver_listings_dong_code ON naver_listings(dong_code);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'naver_estimated_deals') THEN
    ALTER TABLE naver_estimated_deals ADD COLUMN IF NOT EXISTS dong_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_naver_deals_dong_code ON naver_estimated_deals(dong_code);
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rtms_land_yearly') THEN
    ALTER TABLE rtms_land_yearly ADD COLUMN IF NOT EXISTS dong_code TEXT;
    CREATE INDEX IF NOT EXISTS idx_rtms_land_dong_code ON rtms_land_yearly(dong_code);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────
-- 3) market_reports: CBRE/JLL/쿠시먼 PDF 파싱 결과
--    분기별 권역 평균 임대료 — 4중 검증의 권역 앵커.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_reports (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,              -- 'CBRE', 'JLL', 'CUSHMAN', 'SAVILLS'
  report_quarter TEXT NOT NULL,      -- '2026Q1'
  region_name TEXT NOT NULL,         -- 'Hannam', '강남대로' (보고서 권역명)
  gu_name TEXT,                      -- 매핑 가능한 경우
  rent_per_pyeong NUMERIC(10, 2),    -- 1층 만원/평/월
  rent_grade TEXT,                   -- 'Prime', 'A', 'B' 등
  vacancy_rate NUMERIC(5, 2),
  cap_rate NUMERIC(5, 2),
  pdf_path TEXT,                     -- 원본 파일 경로 (data/reports/)
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  raw_data JSONB,                    -- 원본 표 데이터 (재파싱용)
  UNIQUE(source, report_quarter, region_name)
);
CREATE INDEX IF NOT EXISTS idx_market_reports_quarter ON market_reports(report_quarter);
CREATE INDEX IF NOT EXISTS idx_market_reports_gu ON market_reports(gu_name);

ALTER TABLE market_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON market_reports;
CREATE POLICY "public read" ON market_reports FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────
-- 4) owner_network_rents: 본인 네트워크 실거래 ground truth
--    비공개 데이터. RLS 차단 — service_role만 접근.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owner_network_rents (
  id SERIAL PRIMARY KEY,
  recorded_at DATE NOT NULL,
  dong_code TEXT NOT NULL,
  dong_name TEXT,                    -- 입력 편의
  gu_name TEXT,
  floor TEXT NOT NULL,               -- '1층' / '2층' / '지하'
  area_pyeong NUMERIC(8, 2),
  monthly_rent_per_pyeong NUMERIC(10, 2) NOT NULL,  -- 만원/평/월 (실 계약가)
  deposit_per_pyeong NUMERIC(10, 2),
  building_grade TEXT,               -- 'A', 'B', 'C' (선택)
  source_note TEXT,                  -- 출처 메모 (익명화 권장)
  contributed_by TEXT,               -- 정보 제공자 (익명화 권장)
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_owner_rents_dong ON owner_network_rents(dong_code, floor);
CREATE INDEX IF NOT EXISTS idx_owner_rents_recorded ON owner_network_rents(recorded_at DESC);

ALTER TABLE owner_network_rents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "no public read" ON owner_network_rents;
CREATE POLICY "no public read" ON owner_network_rents FOR SELECT USING (false);
-- INSERT/UPDATE/DELETE은 RLS off된 service_role 키로만 가능.

-- ─────────────────────────────────────────────────────────
-- 5) dong_calibration: 호가→실거래 보정계수 (동·층별)
--    공식: actual_rent = listing_rent * (1 + adjustment_pct/100)
--    예: 한남동 1층 -22% (호가가 실거래보다 22% 부풀림)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dong_calibration (
  id SERIAL PRIMARY KEY,
  dong_code TEXT NOT NULL,
  floor TEXT NOT NULL,
  adjustment_pct NUMERIC(6, 2) NOT NULL,  -- -22.0 = 22% 차감
  sample_n INTEGER NOT NULL,              -- 보정계수 산출에 쓴 표본 수
  confidence NUMERIC(4, 2),               -- 0~1
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  method TEXT DEFAULT 'owner_network_vs_naver',
  UNIQUE(dong_code, floor)
);
CREATE INDEX IF NOT EXISTS idx_calibration_dong ON dong_calibration(dong_code);

ALTER TABLE dong_calibration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON dong_calibration;
CREATE POLICY "public read" ON dong_calibration FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────
-- 6) dong_rent_aggregates: 4중 검증 결과 캐시 (동·분기별)
--    매매역산 / 호가-보정 / R-ONE 권역 / 시장보고서 / 본인 네트워크 → 통합값.
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dong_rent_aggregates (
  id SERIAL PRIMARY KEY,
  dong_code TEXT NOT NULL,
  floor TEXT NOT NULL,
  quarter_cd TEXT NOT NULL,                 -- '20254' = 2025Q4

  -- 4중 검증 소스값 (각각 만원/평/월)
  v_sale_inverse NUMERIC(10, 2),            -- 매매 역산 (캡 5.0% 가정)
  v_listing_calibrated NUMERIC(10, 2),      -- 호가 × 보정계수
  v_rone_region NUMERIC(10, 2),             -- R-ONE 권역 평균
  v_market_report NUMERIC(10, 2),           -- CBRE/JLL/쿠시먼
  v_owner_network NUMERIC(10, 2),           -- 본인 네트워크 중위값

  -- 표본 수
  n_sale INTEGER, n_listing INTEGER, n_owner INTEGER,

  -- 통합값 (중위값 / 가중 평균)
  rent_median NUMERIC(10, 2),
  rent_weighted NUMERIC(10, 2),
  confidence NUMERIC(4, 2),                 -- 0~1, 표본·소스 다양성 기반

  fallback_used TEXT,                       -- 'adjacent_dong' / 'gu_avg' / null
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dong_code, floor, quarter_cd)
);
CREATE INDEX IF NOT EXISTS idx_dong_rent_agg_dong ON dong_rent_aggregates(dong_code);
CREATE INDEX IF NOT EXISTS idx_dong_rent_agg_quarter ON dong_rent_aggregates(quarter_cd);

ALTER TABLE dong_rent_aggregates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read" ON dong_rent_aggregates;
CREATE POLICY "public read" ON dong_rent_aggregates FOR SELECT USING (true);

-- ─────────────────────────────────────────────────────────
-- 7) 인접 동 가중평균 폴백 SQL 함수
--    표본 적은 동 조회 시 인접 동 평균으로 추정.
--    centroid 거리 기준 인접 N개 동을 가중평균.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nearest_dongs(
  target_code TEXT,
  n INTEGER DEFAULT 5
) RETURNS TABLE (
  dong_code TEXT,
  dong_name TEXT,
  distance_km NUMERIC
) AS $$
DECLARE
  t_lat DOUBLE PRECISION;
  t_lng DOUBLE PRECISION;
BEGIN
  SELECT centroid_lat, centroid_lng INTO t_lat, t_lng
  FROM dong_lookup WHERE dong_lookup.dong_code = target_code;

  IF t_lat IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    dl.dong_code,
    dl.dong_name,
    ROUND(CAST(
      111.0 * SQRT(
        POWER((dl.centroid_lng - t_lng) * COS(RADIANS(t_lat)), 2) +
        POWER(dl.centroid_lat - t_lat, 2)
      ) AS NUMERIC), 2) AS distance_km
  FROM dong_lookup dl
  WHERE dl.dong_code != target_code
    AND dl.centroid_lat IS NOT NULL
  ORDER BY distance_km ASC
  LIMIT n;
END;
$$ LANGUAGE plpgsql STABLE;
