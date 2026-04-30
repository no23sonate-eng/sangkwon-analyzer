-- 점포 좌표·도로명 데이터 (소상공인진흥공단 상가정보)
-- 출처: data.go.kr "소상공인시장진흥공단_상가(상권)정보" (분기 갱신, 무료)
-- 한남동 trdar 단위 평균이 패션 라인을 묻어버리는 한계 해소용.
-- 좌표·도로명·표준업종으로 "건물 라인" 단위 점포 분포 분석 가능.

CREATE TABLE IF NOT EXISTS stores_geo (
  store_id TEXT PRIMARY KEY,        -- 상가업소번호
  store_name TEXT,
  branch_name TEXT,
  category_l TEXT,                  -- 상권업종 대분류 (음식, 소매, 학문/교육, 의료 등)
  category_m TEXT,                  -- 중분류 (한식, 양식, 카페/디저트 등)
  category_s TEXT,                  -- 소분류 (한식 - 백반, 카페 - 커피전문점)
  std_industry_cd TEXT,             -- 표준산업분류 코드
  std_industry_nm TEXT,
  sido TEXT,
  sigungu TEXT,
  adm_dong TEXT,                    -- 행정동
  legal_dong TEXT,                  -- 법정동
  road_name TEXT,                   -- 도로명 (한남대로, 이태원로)
  road_address TEXT,                -- 전체 도로명주소
  jibun_address TEXT,               -- 지번주소
  building_name TEXT,
  floor_info TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  gu_name TEXT,                     -- 표준화 (용산구 등)
  dong_name TEXT,                   -- 한남동 등
  dong_code TEXT,                   -- dong_lookup 매핑값
  quarter_cd TEXT,                  -- 분기 (예: 20262)
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 좌표 기반 반경 검색 (kNN/거리 가중) 위해 lat/lng 인덱스
CREATE INDEX IF NOT EXISTS idx_stores_geo_lat_lng ON stores_geo(lat, lng);
CREATE INDEX IF NOT EXISTS idx_stores_geo_dong ON stores_geo(dong_code);
CREATE INDEX IF NOT EXISTS idx_stores_geo_road ON stores_geo(road_name);
CREATE INDEX IF NOT EXISTS idx_stores_geo_category ON stores_geo(category_m, category_s);

-- 각 분기 갱신 시 이전 분기 데이터를 누적 (폐업 점포 추적)
-- store_id 동일 시 업서트.
