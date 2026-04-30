-- ═══════════════════════════════════════════════════════════
-- user_events 테이블 — 사용자가 무엇을 검색·조회하는지 트래킹
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행. 재실행 안전.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_events (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT,
  user_name TEXT,
  event_type TEXT NOT NULL,        -- search / area_view / map_click / page_view / consultation_open
  path TEXT,                       -- /search, /map, /reports/...
  query TEXT,                      -- 사용자가 친 검색어
  address TEXT,                    -- 지오코딩된 주소
  area_name TEXT,                  -- 권역명 (예: 한남동, 강남역)
  trdar_cd TEXT,                   -- 상권 코드
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  user_agent TEXT,
  ip TEXT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_events_ts_idx ON user_events (ts DESC);
CREATE INDEX IF NOT EXISTS user_events_email_ts_idx ON user_events (user_email, ts DESC);
CREATE INDEX IF NOT EXISTS user_events_address_idx ON user_events (address);
CREATE INDEX IF NOT EXISTS user_events_event_type_idx ON user_events (event_type, ts DESC);

-- RLS: anon은 INSERT만 가능, SELECT는 service_role 전용
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone insert" ON user_events;
CREATE POLICY "anyone insert" ON user_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- SELECT 정책 없음 = anon은 못 읽음. service_role(/api/admin)만 조회 가능.
