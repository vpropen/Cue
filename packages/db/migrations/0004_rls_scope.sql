-- Row Level Security: доступ до даних за салоном і роллю.
--
-- Чому це потрібно: Supabase відкриває таблиці public через API. Без RLS будь-хто з
-- anon-ключем міг би читати дані інших салонів. Перевірки в коді — лише перший рівень.
--
-- Модель:
-- - current_memberships(): активні співробітники поточного користувача (auth.uid()).
-- - Власник і адміністратор бачать весь салон; майстер — свої записи і своїх клієнтів.
-- - Клієнт бачить лише власний обліковий запис, своїх клієнтів і свої записи.
-- - phone_otps закрита для всіх клієнтів API: доступ лише через service role на сервері.
--
-- Помітка: політики для сценарію «майстер бачить клієнта з іншого салону» (D-рішення,
-- відкрите питання) тут не реалізовано: доступ між салонами заборонено за замовчуванням.

-- ---------- Допоміжні функції ----------

CREATE OR REPLACE FUNCTION public.current_memberships()
RETURNS TABLE (salon_id uuid, staff_id uuid, role staff_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.salon_id, s.id, s.role
  FROM public.staff s
  JOIN public.accounts a ON a.id = s.account_id
  WHERE a.auth_user_id = auth.uid()
    AND s.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.current_salon_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT salon_id FROM public.current_memberships();
$$;

CREATE OR REPLACE FUNCTION public.current_account_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.accounts WHERE auth_user_id = auth.uid();
$$;

-- Картки клієнтів, прив'язані до особи поточного користувача.
-- SECURITY DEFINER: читає без RLS, щоб політики clients і bookings не викликали одна одну
-- по колу (PostgreSQL інакше повертає "infinite recursion detected in policy").
CREATE OR REPLACE FUNCTION public.current_client_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.clients c
  JOIN public.accounts a ON a.id = c.account_id
  WHERE a.auth_user_id = auth.uid();
$$;

-- Клієнти, з якими має записи поточний майстер (SECURITY DEFINER з тієї самої причини).
CREATE OR REPLACE FUNCTION public.master_client_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT b.client_id
  FROM public.bookings b
  JOIN public.current_memberships() m ON m.staff_id = b.master_staff_id
  WHERE m.role = 'master';
$$;

-- ---------- Увімкнення RLS ----------

ALTER TABLE "salons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_channels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_masters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "price_change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "time_off" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prepayments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salon_sms_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "phone_otps" ENABLE ROW LEVEL SECURITY;

-- ---------- Салон ----------

CREATE POLICY "salons_member_select" ON "salons"
  FOR SELECT USING (id IN (SELECT public.current_salon_ids()));

-- Оновлювати салон може лише власник. Перевіряється роллю в memberships.
CREATE POLICY "salons_owner_update" ON "salons"
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = salons.id AND m.role = 'owner'
  ));

-- ---------- Особи ----------

CREATE POLICY "accounts_self_select" ON "accounts"
  FOR SELECT USING (
    auth_user_id = auth.uid()
    -- Персонал бачить особу, якщо вона має картку клієнта в його салоні
    OR id IN (SELECT account_id FROM public.clients WHERE salon_id IN (SELECT public.current_salon_ids()))
  );

CREATE POLICY "accounts_self_insert" ON "accounts"
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "accounts_self_update" ON "accounts"
  FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "account_channels_self" ON "account_channels"
  FOR ALL
  USING (account_id IN (SELECT public.current_account_ids()))
  WITH CHECK (account_id IN (SELECT public.current_account_ids()));

-- ---------- Підписка і співробітники ----------

CREATE POLICY "subscriptions_member_select" ON "subscriptions"
  FOR SELECT USING (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "staff_member_select" ON "staff"
  FOR SELECT USING (salon_id IN (SELECT public.current_salon_ids()));

-- Додавати й змінювати співробітників: власник і адміністратор (власник — адміністраторів)
CREATE POLICY "staff_manage_owner_admin" ON "staff"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = staff.salon_id AND m.role IN ('owner', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = staff.salon_id AND m.role IN ('owner', 'admin')
  ));

-- ---------- Клієнти ----------

-- Перегляд: власник і адміністратор — усі клієнти салону; майстер — лише тих,
-- з ким має записи; клієнт — власна картка.
CREATE POLICY "clients_select" ON "clients"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.current_memberships() m
      WHERE m.salon_id = clients.salon_id AND m.role IN ('owner', 'admin')
    )
    OR clients.id IN (SELECT public.master_client_ids())
    OR clients.id IN (SELECT public.current_client_ids())
  );

-- Запис окремо від читання: FOR ALL давало б право читання всім співробітникам салону.
-- Створити картку може будь-який співробітник свого салону.
CREATE POLICY "clients_insert" ON "clients"
  FOR INSERT
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

-- Змінювати — власник, адміністратор і майстер лише своїх клієнтів
CREATE POLICY "clients_update" ON "clients"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.current_memberships() m
      WHERE m.salon_id = clients.salon_id AND m.role IN ('owner', 'admin')
    )
    OR clients.id IN (SELECT public.master_client_ids())
  )
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "clients_delete" ON "clients"
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = clients.salon_id AND m.role IN ('owner', 'admin')
  ));

-- ---------- Послуги і майстри ----------

CREATE POLICY "services_member_select" ON "services"
  FOR SELECT USING (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "services_member_write" ON "services"
  FOR ALL
  USING (salon_id IN (SELECT public.current_salon_ids()))
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "service_masters_member" ON "service_masters"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_masters.service_id AND s.salon_id IN (SELECT public.current_salon_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_masters.service_id AND s.salon_id IN (SELECT public.current_salon_ids())
  ));

CREATE POLICY "price_change_requests_member" ON "price_change_requests"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = price_change_requests.service_id AND s.salon_id IN (SELECT public.current_salon_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = price_change_requests.service_id AND s.salon_id IN (SELECT public.current_salon_ids())
  ));

-- ---------- Графіки і відпустки ----------

CREATE POLICY "schedules_member" ON "schedules"
  FOR ALL
  USING (salon_id IN (SELECT public.current_salon_ids()))
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "time_off_member" ON "time_off"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.staff st
    WHERE st.id = time_off.staff_id AND st.salon_id IN (SELECT public.current_salon_ids())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.staff st
    WHERE st.id = time_off.staff_id AND st.salon_id IN (SELECT public.current_salon_ids())
  ));

-- ---------- Записи ----------

-- Власник і адміністратор — усі записи салону; майстер — лише свої; клієнт — свої записи.
CREATE POLICY "bookings_select" ON "bookings"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.current_memberships() m
      WHERE m.salon_id = bookings.salon_id
        AND (m.role IN ('owner', 'admin') OR m.staff_id = bookings.master_staff_id)
    )
    OR bookings.client_id IN (SELECT public.current_client_ids())
  );

-- Створювати запис може будь-який співробітник свого салону (майстер — за тією самою логікою, що й адмін)
CREATE POLICY "bookings_insert" ON "bookings"
  FOR INSERT
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

-- Змінювати: власник і адміністратор — будь-який запис салону; майстер — лише свій
CREATE POLICY "bookings_update" ON "bookings"
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = bookings.salon_id
      AND (m.role IN ('owner', 'admin') OR m.staff_id = bookings.master_staff_id)
  ))
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

CREATE POLICY "bookings_delete" ON "bookings"
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = bookings.salon_id AND m.role IN ('owner', 'admin')
  ));

-- Склад послуг у записі: читання успадковує видимість запису, запис — лише в межах салону
CREATE POLICY "booking_services_via_booking" ON "booking_services"
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_services.booking_id));

CREATE POLICY "booking_services_insert" ON "booking_services"
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id AND b.salon_id IN (SELECT public.current_salon_ids())
  ));

CREATE POLICY "booking_services_delete" ON "booking_services"
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_services.booking_id AND b.salon_id IN (SELECT public.current_salon_ids())
  ));

-- Передоплати: читають лише власник і адміністратор та клієнт за своїм записом (майстер — ні)
CREATE POLICY "prepayments_select" ON "prepayments"
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = prepayments.booking_id
      AND (
        b.client_id IN (SELECT public.current_client_ids())
        OR EXISTS (
          SELECT 1 FROM public.current_memberships() m
          WHERE m.salon_id = b.salon_id AND m.role IN ('owner', 'admin')
        )
      )
  ));

CREATE POLICY "prepayments_owner_admin_write" ON "prepayments"
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.current_memberships() m ON m.salon_id = b.salon_id
    WHERE b.id = prepayments.booking_id AND m.role IN ('owner', 'admin')
  ));

CREATE POLICY "prepayments_owner_admin_update" ON "prepayments"
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.current_memberships() m ON m.salon_id = b.salon_id
    WHERE b.id = prepayments.booking_id AND m.role IN ('owner', 'admin')
  ));

-- ---------- Повідомлення і SMS ----------

-- Читання: власник і адміністратор — усі повідомлення салону; співробітник — свої.
CREATE POLICY "notifications_select" ON "notifications"
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = notifications.salon_id
      AND (m.role IN ('owner', 'admin') OR m.staff_id = notifications.recipient_staff_id)
  ));

CREATE POLICY "notifications_insert" ON "notifications"
  FOR INSERT
  WITH CHECK (salon_id IN (SELECT public.current_salon_ids()));

-- Налаштування SMS містять посилання на секрети: лише власник
CREATE POLICY "salon_sms_settings_owner" ON "salon_sms_settings"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = salon_sms_settings.salon_id AND m.role = 'owner'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.current_memberships() m
    WHERE m.salon_id = salon_sms_settings.salon_id AND m.role = 'owner'
  ));

-- phone_otps: без політик для клієнтів API. Доступ — лише з сервера через service role.
