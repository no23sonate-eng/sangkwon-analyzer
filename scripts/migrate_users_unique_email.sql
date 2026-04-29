-- ═══════════════════════════════════════════════════════════
-- users.email UNIQUE 제약 추가 + 기존 중복 row 정리
-- 다중 기기 가입으로 같은 이메일이 여러 row 생긴 케이스 정리.
-- 실행: Supabase SQL Editor에서 전체 복사 후 실행. 재실행 안전.
-- ═══════════════════════════════════════════════════════════

-- 1) 같은 이메일이 여러 row에 있을 경우, approved=true가 있으면 그것을 남기고
--    그렇지 않으면 가장 오래된 row 1개만 남기고 나머지 삭제.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    -- 중복 정리: 각 이메일당 가장 우선되는 row의 id만 살림
    DELETE FROM users
    WHERE id NOT IN (
      SELECT DISTINCT ON (email) id
      FROM users
      ORDER BY email,
               (approved IS TRUE) DESC,   -- 승인된 row 우선
               created_at ASC NULLS LAST  -- 그다음 가장 오래된 row
    );
  END IF;
END $$;

-- 2) UNIQUE 제약 추가 (이미 있으면 스킵)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
  AND NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
    AND contype = 'u'
    AND conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;
