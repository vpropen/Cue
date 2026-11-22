-- Імітація Supabase для локальної перевірки RLS на чистому PostgreSQL.
-- У Supabase схема auth, функція auth.uid() і роль authenticated вже існують.
-- Запускати ДО міграцій, бо 0004 посилається на auth.uid().
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
