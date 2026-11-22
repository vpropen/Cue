/**
 * Схема бази даних Cue.
 *
 * Принципи:
 * - Мультитенантність: майже кожна таблиця має salon_id. Row Level Security
 *   у Supabase додається окремою міграцією (див. docs/decisions.md).
 * - Глобальна особа (accounts) відокремлена від картки клієнта в салоні (clients),
 *   бо клієнт може ходити до кількох салонів.
 * - Заборону подвійного запису (EXCLUDE на перетин часу майстра) додає
 *   ручна міграція, бо Drizzle її не описує (див. migrations/*_bookings_no_overlap).
 * - Гроші зберігаємо як numeric(10,2) у гривнях.
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------- Enums ----------

export const businessType = pgEnum("business_type", ["barber", "cosmetology"]);

export const staffRole = pgEnum("staff_role", ["owner", "admin", "master"]);

export const staffStatus = pgEnum("staff_status", ["active", "blocked"]);

export const clientStatus = pgEnum("client_status", [
  "pending_confirmation", // новий клієнт, очікує дзвінка адміністратора
  "confirmed_no_visits", // підтверджений, без візитів і оплат
  "has_history", // має історію візитів або оплат
]);

export const serviceStatus = pgEnum("service_status", ["active", "disabled"]);

export const serviceApproval = pgEnum("service_approval", [
  "approved",
  "pending_owner_approval", // створено адміністратором, чекає підтвердження власника
]);

export const scheduleType = pgEnum("schedule_type", [
  "working",
  "salon_day_off",
  "holiday",
]);

export const timeOffType = pgEnum("time_off_type", ["vacation", "master_day_off"]);

export const bookingStatus = pgEnum("booking_status", [
  "pending_confirmation",
  "confirmed",
  "done",
  "no_show",
  "cancelled",
  "expired",
]);

export const bookingCreatorType = pgEnum("booking_creator_type", [
  "client",
  "master",
  "admin",
]);

export const bookingChannel = pgEnum("booking_channel", [
  "cabinet",
  "phone",
  "telegram",
  "instagram",
]);

export const prepaymentStatus = pgEnum("prepayment_status", [
  "paid",
  "refunded",
  "retained",
]);

export const notificationChannel = pgEnum("notification_channel", [
  "telegram",
  "instagram",
  "sms",
  "email",
  "internal",
]);

export const notificationStatus = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);

export const priceChangeStatus = pgEnum("price_change_status", [
  "pending",
  "approved",
  "rejected",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "cancelled",
]);

// ---------- Салони і підписка ----------

export const salons = pgTable(
  "salons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone").notNull(),
    businessType: businessType("business_type").notNull(),
    /** Піддомен на домені сервісу, наприклад "beauty-lab" → beauty-lab.cue.app */
    subdomain: text("subdomain").notNull(),
    /** Власний домен салону — платна опція, необов'язково */
    customDomain: text("custom_domain"),
    /** Усі налаштування салону (горизонт, таймаути, правило 6 годин тощо) */
    settings: jsonb("settings").$type<SalonSettings>().notNull().default(sql`'{}'::jsonb`),
    /** Юридичні дані (ФОП, ТОВ тощо), заповнюються при реєстрації */
    legalName: text("legal_name"),
    legalTaxId: text("legal_tax_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("salons_subdomain_uq").on(t.subdomain),
    uniqueIndex("salons_custom_domain_uq").on(t.customDomain),
  ],
);

/** Типізація jsonb-налаштувань салону. Значення за замовчуванням — у коді застосунку. */
export type SalonSettings = {
  bookingHorizonDays?: number; // за замовчуванням 14
  newClientMinLeadMinutes?: number; // за замовчуванням 60
  confirmationTimeoutMinutes?: number; // за замовчуванням 120
  cancellationWindowHours?: number; // правило 6 годин, за замовчуванням 6
  prepayment?: {
    enabled: boolean;
    mode: "percent" | "fixed";
    value: number;
    appliesTo: "new_clients" | "all_clients";
  };
  sms?: { enabled: boolean };
  reminderTimes?: string[]; // наприклад ["18:00"], у межах 08:00–21:00
  clientDataSharingBetweenSalons?: boolean; // доступ майстрів до даних клієнта з іншого салону
};

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  salonId: uuid("salon_id")
    .notNull()
    .references(() => salons.id, { onDelete: "cascade" }),
  /** Тариф обирає салон з переліку, встановленого сервісом */
  plan: text("plan").notNull(),
  maxStaff: integer("max_staff").notNull().default(10),
  status: subscriptionStatus("status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
});

// ---------- Особи ----------

/**
 * Глобальна особа. Клієнт може входити через телефон, Google або Meta,
 * і одна особа може мати картки клієнта у кількох салонах.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone"),
    email: text("email"),
    fullName: text("full_name"),
    photoPath: text("photo_path"), // шлях у приватному сховищі, не публічний URL
    /** Ідентифікатор користувача Supabase Auth, якщо вхід виконано */
    authUserId: uuid("auth_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accounts_phone_uq").on(t.phone),
    uniqueIndex("accounts_email_uq").on(t.email),
    uniqueIndex("accounts_auth_user_uq").on(t.authUserId),
  ],
);

/** Прив'язки каналів повідомлень до особи (Telegram, Instagram). */
export const accountChannels = pgTable(
  "account_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    channel: notificationChannel("channel").notNull(),
    externalId: text("external_id").notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("account_channels_uq").on(t.channel, t.externalId)],
);

/** Картка клієнта у конкретному салоні. Телефон — основний ключ пошуку в салоні. */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    /** Порожньо, доки клієнт не увійшов сам; зв'язується за телефоном */
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    phone: text("phone").notNull(),
    fullName: text("full_name"),
    status: clientStatus("status").notNull().default("pending_confirmation"),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    /** Нотатки майстрів і адміністратора про клієнта */
    notes: text("notes"),
    /** Лічильники для картки клієнта (перенесення, скасування, неявки) */
    rescheduledCount: integer("rescheduled_count").notNull().default(0),
    cancelledCount: integer("cancelled_count").notNull().default(0),
    noShowCount: integer("no_show_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("clients_salon_phone_uq").on(t.salonId, t.phone),
    index("clients_account_idx").on(t.accountId),
  ],
);

/**
 * Співробітник салону: власник, адміністратор або майстер.
 * Одна особа може працювати в кількох салонах — тому окремий рядок на салон.
 */
export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    role: staffRole("role").notNull(),
    displayName: text("display_name").notNull(),
    photoPath: text("photo_path"),
    bio: text("bio"),
    status: staffStatus("status").notNull().default("active"),
    /** Лічильник невдалих входів; блокування лише для співробітників */
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    /** Вхід і скидання пароля через Telegram-код */
    telegramChatId: text("telegram_chat_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("staff_salon_idx").on(t.salonId),
    uniqueIndex("staff_salon_account_uq").on(t.salonId, t.accountId),
  ],
);

// ---------- Послуги ----------

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    /** Тривалість кратна 15 хвилинам (мінімальний таймслот) */
    durationMinutes: integer("duration_minutes").notNull(),
    status: serviceStatus("status").notNull().default("active"),
    approval: serviceApproval("approval").notNull().default("approved"),
    createdByStaffId: uuid("created_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("services_duration_15min", sql`${t.durationMinutes} > 0 AND ${t.durationMinutes} % 15 = 0`),
    check("services_price_nonneg", sql`${t.price} >= 0`),
    index("services_salon_idx").on(t.salonId),
  ],
);

/** Які послуги може виконувати майстер. */
export const serviceMasters = pgTable(
  "service_masters",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.serviceId, t.staffId] })],
);

/** Запити на зміну ціни від адміністратора; ціну змінює лише власник. */
export const priceChangeRequests = pgTable("price_change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  newPrice: numeric("new_price", { precision: 10, scale: 2 }).notNull(),
  requestedByStaffId: uuid("requested_by_staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  status: priceChangeStatus("status").notNull().default("pending"),
  decidedByStaffId: uuid("decided_by_staff_id").references(() => staff.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

// ---------- Графік ----------

/**
 * Графік салону (staff_id = null) або майстра (staff_id заданий).
 * Вихідний салону має пріоритет над графіком майстра.
 * Або day_of_week (0–6, неділя = 0), або конкретна дата — перевіряється CHECK.
 */
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => staff.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week"),
    specificDate: date("specific_date"),
    startTime: time("start_time"),
    endTime: time("end_time"),
    type: scheduleType("type").notNull().default("working"),
  },
  (t) => [
    check(
      "schedules_day_or_date",
      sql`(${t.dayOfWeek} IS NULL) <> (${t.specificDate} IS NULL)`,
    ),
    check(
      "schedules_day_range",
      sql`${t.dayOfWeek} IS NULL OR (${t.dayOfWeek} >= 0 AND ${t.dayOfWeek} <= 6)`,
    ),
    index("schedules_salon_idx").on(t.salonId),
    index("schedules_staff_idx").on(t.staffId),
  ],
);

/** Відпустки і вихідні майстрів. Блокують записи на період. */
export const timeOff = pgTable(
  "time_off",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    type: timeOffType("type").notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    check("time_off_range", sql`${t.endsOn} >= ${t.startsOn}`),
    index("time_off_staff_idx").on(t.staffId),
  ],
);

// ---------- Записи ----------

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    masterStaffId: uuid("master_staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    status: bookingStatus("status").notNull().default("pending_confirmation"),
    /** Хто створив запис і з якого каналу */
    createdByType: bookingCreatorType("created_by_type").notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    channel: bookingChannel("channel").notNull(),
    /** Початок і кінець у UTC; відображення — у Europe/Kyiv */
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Тимчасове блокування слота для нового клієнта до підтвердження */
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    confirmedByStaffId: uuid("confirmed_by_staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    /** Перенесення: посилання на попередній запис, якщо це наслідок переносу */
    rescheduledFromId: uuid("rescheduled_from_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("bookings_time_order", sql`${t.endsAt} > ${t.startsAt}`),
    index("bookings_salon_start_idx").on(t.salonId, t.startsAt),
    index("bookings_master_start_idx").on(t.masterStaffId, t.startsAt),
    index("bookings_client_idx").on(t.clientId),
  ],
);

/** Послуги в межах одного запису (клієнт може обрати кілька). Знімки ціни і тривалості. */
export const bookingServices = pgTable(
  "booking_services",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    priceSnapshot: numeric("price_snapshot", { precision: 10, scale: 2 }).notNull(),
    durationSnapshot: integer("duration_snapshot").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookingId, t.serviceId] })],
);

/** Передоплата за бронювання. */
export const prepayments = pgTable(
  "prepayments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    status: prepaymentStatus("status").notNull().default("paid"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    /** Ідентифікатор платежу у платіжному провайдері (LiqPay / WayForPay) */
    providerPaymentId: text("provider_payment_id"),
  },
  (t) => [index("prepayments_booking_idx").on(t.bookingId)],
);

// ---------- Повідомлення ----------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    salonId: uuid("salon_id")
      .notNull()
      .references(() => salons.id, { onDelete: "cascade" }),
    recipientClientId: uuid("recipient_client_id").references(() => clients.id, {
      onDelete: "cascade",
    }),
    recipientStaffId: uuid("recipient_staff_id").references(() => staff.id, {
      onDelete: "cascade",
    }),
    channel: notificationChannel("channel").notNull(),
    type: text("type").notNull(), // наприклад: booking_created, reminder, digest_tomorrow
    body: text("body").notNull(),
    status: notificationStatus("status").notNull().default("queued"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    index("notifications_status_scheduled_idx").on(t.status, t.scheduledFor),
    index("notifications_salon_idx").on(t.salonId),
  ],
);

// ---------- Типи для коду застосунку ----------

export type Salon = typeof salons.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type TimeOff = typeof timeOff.$inferSelect;
