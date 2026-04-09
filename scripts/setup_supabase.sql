-- Supabase 테이블 생성 SQL
-- Supabase Dashboard > SQL Editor에서 실행

-- 1. 상권 영역 좌표
CREATE TABLE IF NOT EXISTS areas (
  trdar_cd TEXT PRIMARY KEY,
  trdar_nm TEXT NOT NULL,
  gu TEXT,
  dong TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);
CREATE INDEX idx_areas_latlon ON areas(lat, lng);

-- 2. 추정매출
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  quarter_cd TEXT,
  trdar_cd TEXT,
  trdar_nm TEXT,
  svc_cd TEXT,
  svc_nm TEXT,
  monthly_sales BIGINT,
  monthly_count BIGINT,
  weekday_sales BIGINT,
  weekend_sales BIGINT,
  mon_sales BIGINT,
  tue_sales BIGINT,
  wed_sales BIGINT,
  thu_sales BIGINT,
  fri_sales BIGINT,
  sat_sales BIGINT,
  sun_sales BIGINT,
  time_00_06 BIGINT,
  time_06_11 BIGINT,
  time_11_14 BIGINT,
  time_14_17 BIGINT,
  time_17_21 BIGINT,
  time_21_24 BIGINT,
  male_sales BIGINT,
  female_sales BIGINT,
  age_10 BIGINT,
  age_20 BIGINT,
  age_30 BIGINT,
  age_40 BIGINT,
  age_50 BIGINT,
  age_60 BIGINT,
  monthly_count_all BIGINT
);
CREATE INDEX idx_sales_trdar ON sales(trdar_cd);
CREATE INDEX idx_sales_quarter ON sales(quarter_cd);

-- 3. 유동인구
CREATE TABLE IF NOT EXISTS foot_traffic (
  id SERIAL PRIMARY KEY,
  quarter_cd TEXT,
  trdar_cd TEXT,
  trdar_nm TEXT,
  total_ft BIGINT,
  male_ft BIGINT,
  female_ft BIGINT,
  age_10 BIGINT,
  age_20 BIGINT,
  age_30 BIGINT,
  age_40 BIGINT,
  age_50 BIGINT,
  age_60 BIGINT,
  time_00_06 BIGINT,
  time_06_11 BIGINT,
  time_11_14 BIGINT,
  time_14_17 BIGINT,
  time_17_21 BIGINT,
  time_21_24 BIGINT,
  mon BIGINT,
  tue BIGINT,
  wed BIGINT,
  thu BIGINT,
  fri BIGINT,
  sat BIGINT,
  sun BIGINT
);
CREATE INDEX idx_ft_trdar ON foot_traffic(trdar_cd);
CREATE INDEX idx_ft_quarter ON foot_traffic(quarter_cd);

-- 4. 직장인구
CREATE TABLE IF NOT EXISTS population (
  id SERIAL PRIMARY KEY,
  quarter_cd TEXT,
  trdar_cd TEXT,
  trdar_nm TEXT,
  total_pop BIGINT,
  male_pop BIGINT,
  female_pop BIGINT,
  age_10 BIGINT,
  age_20 BIGINT,
  age_30 BIGINT,
  age_40 BIGINT,
  age_50 BIGINT,
  age_60 BIGINT
);
CREATE INDEX idx_pop_trdar ON population(trdar_cd);

-- 5. 점포
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  quarter_cd TEXT,
  trdar_cd TEXT,
  trdar_nm TEXT,
  svc_cd TEXT,
  svc_nm TEXT,
  store_count INT,
  similar_count INT,
  open_rate DOUBLE PRECISION,
  open_count INT,
  close_rate DOUBLE PRECISION,
  close_count INT,
  franchise_count INT
);
CREATE INDEX idx_stores_trdar ON stores(trdar_cd);
CREATE INDEX idx_stores_quarter ON stores(quarter_cd);

-- 6. 임대료 추정
CREATE TABLE IF NOT EXISTS rents (
  id SERIAL PRIMARY KEY,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  target_pyeong INT,
  floor TEXT,
  rent_pyeong DOUBLE PRECISION,
  rent DOUBLE PRECISION,
  deposit DOUBLE PRECISION
);
CREATE INDEX idx_rents_pyeong ON rents(target_pyeong);
CREATE INDEX idx_rents_latlon ON rents(lat, lng);
