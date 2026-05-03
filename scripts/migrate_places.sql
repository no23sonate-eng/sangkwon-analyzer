/* ── places 테이블 마이그레이션 ──
   place_crawler.py 가 카카오 Local API 로 자동 수집한 매장 단위 카테고리 DB.

   trdar(서울시 상권 통계) 분류로 안 잡히는 명품·플래그십·갤러리·파인다이닝·편집숍·라이프스타일을
   좌표 단위로 보유. 모든 상권에 동일 동작 (좌표만 있으면 됨).
*/

CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  kakao_place_id TEXT NOT NULL UNIQUE,
  brand_name TEXT NOT NULL,
  category TEXT NOT NULL,                  -- luxury / flagship / gallery / fine_dining / select_shop / lifestyle
  kakao_category_name TEXT,                -- 카카오 원본 카테고리명 (분류 보정용)
  phone TEXT,
  address TEXT,
  road_address TEXT,
  road_name TEXT,                          -- 도로명만 (이태원로 / 압구정로 / 가로수길 ...)
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  gu TEXT,
  dong TEXT,
  source_query TEXT,                       -- whitelist 브랜드명 또는 'kakao:CT1'
  place_url TEXT,
  radius_m INTEGER,                        -- 수집 시 반경 (debug)
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_curated BOOLEAN NOT NULL DEFAULT FALSE,  -- 본인 큐레이션 검증 통과 (admin 패널에서 토글)
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE  -- 폐점·오매핑 — admin 에서 끄기
);

CREATE INDEX IF NOT EXISTS places_geo_idx ON places (lat, lng);
CREATE INDEX IF NOT EXISTS places_gu_dong_idx ON places (gu, dong);
CREATE INDEX IF NOT EXISTS places_category_idx ON places (category);
CREATE INDEX IF NOT EXISTS places_road_name_idx ON places (road_name);
CREATE INDEX IF NOT EXISTS places_collected_idx ON places (collected_at DESC);

-- RLS: anon 은 SELECT 만 (분석 화면 표시용), 쓰기는 service_role 만
ALTER TABLE places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone read places" ON places;
CREATE POLICY "anyone read places" ON places
  FOR SELECT TO anon, authenticated
  USING (is_disabled = FALSE);

-- INSERT/UPDATE 정책 없음 = service_role(/api/admin) 만 쓸 수 있음
