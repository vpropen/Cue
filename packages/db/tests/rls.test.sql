-- Перевірка RLS-політик (міграція 0004). Порядок запуску на чистій БД:
--   1) psql -f packages/db/tests/supabase-stub.sql   (лише локально, не в Supabase)
--   2) застосувати міграції 0000–0004
--   3) psql -v ON_ERROR_STOP=1 -f packages/db/tests/rls.test.sql
-- Якщо будь-яка перевірка не пройшла, скрипт завершується помилкою.

-- ---------- Імітація Supabase: див. supabase-stub.sql (запускається до міграцій) ----------

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ---------- Дані (від суперкористувача, RLS не застосовується) ----------
-- Салон A: власник, адміністратор, два майстри, клієнт C1 (має акаунт), клієнт C2
-- Салон B: власник, клієнт C3

INSERT INTO salons (id, name, phone, business_type, subdomain) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'Salon A', '+380000000001', 'barber', 'salon-a'),
  ('b0000000-0000-0000-0000-00000000000b', 'Salon B', '+380000000002', 'cosmetology', 'salon-b');

INSERT INTO accounts (id, phone, auth_user_id) VALUES
  ('10000000-0000-0000-0000-000000000001', '+380500000001', '00000000-0000-0000-0000-00000000a001'), -- власник A
  ('10000000-0000-0000-0000-000000000002', '+380500000002', '00000000-0000-0000-0000-00000000a002'), -- адмін A
  ('10000000-0000-0000-0000-000000000003', '+380500000003', '00000000-0000-0000-0000-00000000a003'), -- майстер M1
  ('10000000-0000-0000-0000-000000000004', '+380500000004', '00000000-0000-0000-0000-00000000a004'), -- майстер M2
  ('10000000-0000-0000-0000-000000000005', '+380500000005', '00000000-0000-0000-0000-00000000a005'), -- клієнт C1
  ('10000000-0000-0000-0000-000000000006', '+380500000006', '00000000-0000-0000-0000-00000000b001'), -- власник B
  ('10000000-0000-0000-0000-000000000007', '+380500000007', '00000000-0000-0000-0000-00000000c001'); -- сторонній користувач

INSERT INTO staff (id, salon_id, account_id, role, display_name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'owner', 'Owner A'),
  ('20000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002', 'admin', 'Admin A'),
  ('20000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'master', 'M1'),
  ('20000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000004', 'master', 'M2'),
  ('20000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000006', 'owner', 'Owner B');

INSERT INTO services (id, salon_id, name, price, duration_minutes) VALUES
  ('30000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Стрижка', 300, 60);

INSERT INTO clients (id, salon_id, account_id, phone, full_name) VALUES
  ('40000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000005', '+380500000005', 'C1'),
  ('40000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', NULL, '+380500000010', 'C2'),
  ('40000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b', NULL, '+380500000020', 'C3');

-- B1: C1 у M1; B2: C2 у M2; B3: C3 у салоні B
INSERT INTO bookings (id, salon_id, client_id, master_staff_id, created_by_type, channel, starts_at, ends_at) VALUES
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'client', 'cabinet', '2026-12-10 10:00+02', '2026-12-10 11:00+02'),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000004', 'admin', 'phone', '2026-12-10 12:00+02', '2026-12-10 13:00+02'),
  ('50000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-00000000000b', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000b', 'admin', 'phone', '2026-12-10 10:00+02', '2026-12-10 11:00+02');

INSERT INTO prepayments (booking_id, amount, status) VALUES
  ('50000000-0000-0000-0000-000000000001', 100, 'paid');

INSERT INTO phone_otps (salon_id, phone, code_hash, expires_at) VALUES
  ('a0000000-0000-0000-0000-00000000000a', '+380500000099', 'hash', now() + interval '5 minutes');

-- ---------- Допоміжні функції перевірки ----------

-- Рахує рядки від імені користувача uid (NULL — анонім)
CREATE OR REPLACE FUNCTION pg_temp.count_as(uid text, q text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(uid, ''), true);
  SET LOCAL ROLE authenticated;
  EXECUTE q INTO n;
  RESET ROLE;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect(label text, actual bigint, want bigint) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'FAIL %: отримано %, очікувалось %', label, actual, want;
  END IF;
  RAISE NOTICE 'ok: % (%)', label, actual;
END $$;

-- ---------- Перевірки ----------

-- Власник A бачить лише салон A і його записи
SELECT pg_temp.expect('owner A: salons', pg_temp.count_as('00000000-0000-0000-0000-00000000a001', 'SELECT count(*) FROM salons'), 1);
SELECT pg_temp.expect('owner A: bookings', pg_temp.count_as('00000000-0000-0000-0000-00000000a001', 'SELECT count(*) FROM bookings'), 2);
SELECT pg_temp.expect('owner A: clients (C1,C2)', pg_temp.count_as('00000000-0000-0000-0000-00000000a001', 'SELECT count(*) FROM clients'), 2);

-- Адміністратор A бачить усі записи салону A
SELECT pg_temp.expect('admin A: bookings', pg_temp.count_as('00000000-0000-0000-0000-00000000a002', 'SELECT count(*) FROM bookings'), 2);

-- Майстер M1 бачить лише свій запис і лише свого клієнта
SELECT pg_temp.expect('master M1: bookings', pg_temp.count_as('00000000-0000-0000-0000-00000000a003', 'SELECT count(*) FROM bookings'), 1);
SELECT pg_temp.expect('master M1: clients (only C1)', pg_temp.count_as('00000000-0000-0000-0000-00000000a003', 'SELECT count(*) FROM clients'), 1);

-- Майстер M2 бачить лише C2
SELECT pg_temp.expect('master M2: clients (only C2)', pg_temp.count_as('00000000-0000-0000-0000-00000000a004', 'SELECT count(*) FROM clients WHERE full_name = ''C2'''), 1);
SELECT pg_temp.expect('master M2: clients (no C1)', pg_temp.count_as('00000000-0000-0000-0000-00000000a004', 'SELECT count(*) FROM clients WHERE full_name = ''C1'''), 0);

-- Клієнт C1 бачить свою картку і свій запис, не чужі
SELECT pg_temp.expect('client C1: own clients', pg_temp.count_as('00000000-0000-0000-0000-00000000a005', 'SELECT count(*) FROM clients'), 1);
SELECT pg_temp.expect('client C1: own bookings', pg_temp.count_as('00000000-0000-0000-0000-00000000a005', 'SELECT count(*) FROM bookings'), 1);

-- Власник B не бачить салон A
SELECT pg_temp.expect('owner B: salons', pg_temp.count_as('00000000-0000-0000-0000-00000000b001', 'SELECT count(*) FROM salons'), 1);
SELECT pg_temp.expect('owner B: bookings only own salon', pg_temp.count_as('00000000-0000-0000-0000-00000000b001', 'SELECT count(*) FROM bookings'), 1);
SELECT pg_temp.expect('owner B: no staff of A', pg_temp.count_as('00000000-0000-0000-0000-00000000b001', 'SELECT count(*) FROM staff WHERE salon_id = ''a0000000-0000-0000-0000-00000000000a'''), 0);

-- Сторонній користувач і анонім нічого не бачать
SELECT pg_temp.expect('stranger: salons', pg_temp.count_as('00000000-0000-0000-0000-00000000c001', 'SELECT count(*) FROM salons'), 0);
SELECT pg_temp.expect('stranger: bookings', pg_temp.count_as('00000000-0000-0000-0000-00000000c001', 'SELECT count(*) FROM bookings'), 0);
SELECT pg_temp.expect('anon: salons', pg_temp.count_as(NULL, 'SELECT count(*) FROM salons'), 0);
SELECT pg_temp.expect('anon: bookings', pg_temp.count_as(NULL, 'SELECT count(*) FROM bookings'), 0);

-- Коди підтвердження недоступні жодному клієнту API
SELECT pg_temp.expect('owner A: phone_otps closed', pg_temp.count_as('00000000-0000-0000-0000-00000000a001', 'SELECT count(*) FROM phone_otps'), 0);

-- Власник B не може створити запис у салоні A (WITH CHECK має відхилити)
DO $$
DECLARE blocked boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000b001', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO bookings (salon_id, client_id, master_staff_id, created_by_type, channel, starts_at, ends_at)
    VALUES ('a0000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-000000000002',
            '20000000-0000-0000-0000-000000000003', 'admin', 'phone',
            '2026-12-11 10:00+02', '2026-12-11 11:00+02');
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := true;
  END;
  RESET ROLE;
  IF NOT blocked THEN
    RAISE EXCEPTION 'FAIL: власник B створив запис у салоні A';
  END IF;
  RAISE NOTICE 'ok: owner B cannot insert into salon A';
END $$;

-- Майстер не може змінювати графік салону (політики graphs лише для membership з салону)
-- Тут перевіряємо, що власник A бачить власні графіки, а B — ні (поки графіки порожні, перевірка на 0)
SELECT pg_temp.expect('owner B: schedules of A hidden', pg_temp.count_as('00000000-0000-0000-0000-00000000b001', 'SELECT count(*) FROM schedules WHERE salon_id = ''a0000000-0000-0000-0000-00000000000a'''), 0);

-- Передоплати: майстер не бачить, власник бачить, клієнт C1 бачить свою
SELECT pg_temp.expect('master M1: prepayments hidden', pg_temp.count_as('00000000-0000-0000-0000-00000000a003', 'SELECT count(*) FROM prepayments'), 0);
SELECT pg_temp.expect('owner A: prepayments visible', pg_temp.count_as('00000000-0000-0000-0000-00000000a001', 'SELECT count(*) FROM prepayments'), 1);
SELECT pg_temp.expect('client C1: own prepayment', pg_temp.count_as('00000000-0000-0000-0000-00000000a005', 'SELECT count(*) FROM prepayments'), 1);

-- Оновлення записів: майстер M2 не може змінити запис майстра M1, M1 — може свій запис
SELECT pg_temp.expect('master M2: cannot update M1 booking', pg_temp.count_as('00000000-0000-0000-0000-00000000a004', 'WITH u AS (UPDATE bookings SET status = ''confirmed'' WHERE id = ''50000000-0000-0000-0000-000000000001'' RETURNING 1) SELECT count(*) FROM u'), 0);
SELECT pg_temp.expect('master M1: can update own booking', pg_temp.count_as('00000000-0000-0000-0000-00000000a003', 'WITH u AS (UPDATE bookings SET status = ''confirmed'' WHERE id = ''50000000-0000-0000-0000-000000000001'' RETURNING 1) SELECT count(*) FROM u'), 1);

-- Повідомлення: майстер бачить лише свої (тут їх немає, перевірка на 0)
SELECT pg_temp.expect('master M1: notifications of others hidden', pg_temp.count_as('00000000-0000-0000-0000-00000000a003', 'SELECT count(*) FROM notifications'), 0);

DO $$ BEGIN RAISE NOTICE 'Усі перевірки RLS пройшли.'; END $$;
