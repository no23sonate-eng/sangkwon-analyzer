-- =====================================================================
-- Supabase Row Level Security 정책 (공개 전 필수 적용)
-- =====================================================================
-- anon 키로 브라우저에서 직접 접근하는 퍼블릭 테이블은 "읽기 전용"만 허용.
-- 쓰기(update/insert/delete)는 service_role(API 서버) 또는 cron만 가능.
--
-- 실행 방법: Supabase Dashboard > SQL Editor 에 붙여넣기
-- =====================================================================

-- 1) RLS 활성화 (모든 공개 조회 테이블)
ALTER TABLE areas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE foot_traffic           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rents                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gu_rent_stats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gu_sale_stats          ENABLE ROW LEVEL SECURITY;
ALTER TABLE naver_estimated_deals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE naver_listings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_stats        ENABLE ROW LEVEL SECURITY;

-- 2) 익명 읽기 허용 정책 (공개 OK 테이블만)
DROP POLICY IF EXISTS "public read" ON areas;
CREATE POLICY "public read" ON areas FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON stores;
CREATE POLICY "public read" ON stores FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON sales;
CREATE POLICY "public read" ON sales FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON foot_traffic;
CREATE POLICY "public read" ON foot_traffic FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON rents;
CREATE POLICY "public read" ON rents FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON gu_rent_stats;
CREATE POLICY "public read" ON gu_rent_stats FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON gu_sale_stats;
CREATE POLICY "public read" ON gu_sale_stats FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public read" ON dashboard_stats;
CREATE POLICY "public read" ON dashboard_stats FOR SELECT TO anon, authenticated USING (true);

-- 3) Naver 관련은 서버 전용 (이용약관 리스크 — anon 공개 금지)
--    API 라우트는 service_role 로 접근해야 함. SUPABASE_SERVICE_ROLE_KEY 필수.
DROP POLICY IF EXISTS "server only" ON naver_estimated_deals;
DROP POLICY IF EXISTS "server only" ON naver_listings;
-- (정책 없음 = anon 접근 불가)

-- 4) 쓰기는 service_role 만 허용됨 (RLS 기본 동작). 명시적 정책 불필요.

-- 5) 검증 쿼리 — 적용 후 실행해 anon 접근 가능 여부 확인
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- SELECT * FROM pg_policies WHERE schemaname='public';
