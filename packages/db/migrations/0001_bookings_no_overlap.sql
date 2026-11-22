-- Заборона подвійного запису майстра на перетин часу.
-- Drizzle не описує EXCLUDE-обмеження, тому воно винесено в ручну міграцію.
-- Активні записи: очікують підтвердження (слот заблоковано), підтверджено, виконано, не з'явився.
-- Скасовані і прострочені записи не займають слот.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_no_master_overlap"
  EXCLUDE USING gist (
    "master_staff_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  )
  WHERE ("status" NOT IN ('cancelled', 'expired'));
