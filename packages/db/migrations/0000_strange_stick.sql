CREATE TYPE "public"."booking_channel" AS ENUM('cabinet', 'phone', 'telegram', 'instagram');--> statement-breakpoint
CREATE TYPE "public"."booking_creator_type" AS ENUM('client', 'master', 'admin');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending_confirmation', 'confirmed', 'done', 'no_show', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('barber', 'cosmetology');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('pending_confirmation', 'confirmed_no_visits', 'has_history');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('telegram', 'instagram', 'sms', 'email', 'internal');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."prepayment_status" AS ENUM('paid', 'refunded', 'retained');--> statement-breakpoint
CREATE TYPE "public"."price_change_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."schedule_type" AS ENUM('working', 'salon_day_off', 'holiday');--> statement-breakpoint
CREATE TYPE "public"."service_approval" AS ENUM('approved', 'pending_owner_approval');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'admin', 'master');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trial', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."time_off_type" AS ENUM('vacation', 'master_day_off');--> statement-breakpoint
CREATE TABLE "account_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"external_id" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"email" text,
	"full_name" text,
	"photo_path" text,
	"auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
	"booking_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"price_snapshot" numeric(10, 2) NOT NULL,
	"duration_snapshot" integer NOT NULL,
	CONSTRAINT "booking_services_booking_id_service_id_pk" PRIMARY KEY("booking_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"master_staff_id" uuid NOT NULL,
	"status" "booking_status" DEFAULT 'pending_confirmation' NOT NULL,
	"created_by_type" "booking_creator_type" NOT NULL,
	"created_by_staff_id" uuid,
	"channel" "booking_channel" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"confirmed_by_staff_id" uuid,
	"confirmed_at" timestamp with time zone,
	"rescheduled_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_time_order" CHECK ("bookings"."ends_at" > "bookings"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid,
	"phone" text NOT NULL,
	"full_name" text,
	"status" "client_status" DEFAULT 'pending_confirmation' NOT NULL,
	"last_visit_at" timestamp with time zone,
	"notes" text,
	"rescheduled_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"recipient_client_id" uuid,
	"recipient_staff_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "prepayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "prepayment_status" DEFAULT 'paid' NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"provider_payment_id" text
);
--> statement-breakpoint
CREATE TABLE "price_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"new_price" numeric(10, 2) NOT NULL,
	"requested_by_staff_id" uuid NOT NULL,
	"status" "price_change_status" DEFAULT 'pending' NOT NULL,
	"decided_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "salons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"phone" text NOT NULL,
	"business_type" "business_type" NOT NULL,
	"subdomain" text NOT NULL,
	"custom_domain" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legal_name" text,
	"legal_tax_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_id" uuid,
	"day_of_week" integer,
	"specific_date" date,
	"start_time" time,
	"end_time" time,
	"type" "schedule_type" DEFAULT 'working' NOT NULL,
	CONSTRAINT "schedules_day_or_date" CHECK (("schedules"."day_of_week" IS NULL) <> ("schedules"."specific_date" IS NULL)),
	CONSTRAINT "schedules_day_range" CHECK ("schedules"."day_of_week" IS NULL OR ("schedules"."day_of_week" >= 0 AND "schedules"."day_of_week" <= 6))
);
--> statement-breakpoint
CREATE TABLE "service_masters" (
	"service_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	CONSTRAINT "service_masters_service_id_staff_id_pk" PRIMARY KEY("service_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"status" "service_status" DEFAULT 'active' NOT NULL,
	"approval" "service_approval" DEFAULT 'approved' NOT NULL,
	"created_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_15min" CHECK ("services"."duration_minutes" > 0 AND "services"."duration_minutes" % 15 = 0),
	CONSTRAINT "services_price_nonneg" CHECK ("services"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"account_id" uuid,
	"role" "staff_role" NOT NULL,
	"display_name" text NOT NULL,
	"photo_path" text,
	"bio" text,
	"status" "staff_status" DEFAULT 'active' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"max_staff" integer DEFAULT 10 NOT NULL,
	"status" "subscription_status" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"type" time_off_type NOT NULL,
	"created_by_staff_id" uuid,
	CONSTRAINT "time_off_range" CHECK ("time_off"."ends_on" >= "time_off"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "account_channels" ADD CONSTRAINT "account_channels_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_master_staff_id_staff_id_fk" FOREIGN KEY ("master_staff_id") REFERENCES "public"."staff"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_staff_id_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_confirmed_by_staff_id_staff_id_fk" FOREIGN KEY ("confirmed_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_client_id_clients_id_fk" FOREIGN KEY ("recipient_client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_staff_id_staff_id_fk" FOREIGN KEY ("recipient_staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepayments" ADD CONSTRAINT "prepayments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_requests" ADD CONSTRAINT "price_change_requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_requests" ADD CONSTRAINT "price_change_requests_requested_by_staff_id_staff_id_fk" FOREIGN KEY ("requested_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_change_requests" ADD CONSTRAINT "price_change_requests_decided_by_staff_id_staff_id_fk" FOREIGN KEY ("decided_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_masters" ADD CONSTRAINT "service_masters_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_masters" ADD CONSTRAINT "service_masters_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_created_by_staff_id_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_created_by_staff_id_staff_id_fk" FOREIGN KEY ("created_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_channels_uq" ON "account_channels" USING btree ("channel","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_phone_uq" ON "accounts" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_uq" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_auth_user_uq" ON "accounts" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX "bookings_salon_start_idx" ON "bookings" USING btree ("salon_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_master_start_idx" ON "bookings" USING btree ("master_staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_salon_phone_uq" ON "clients" USING btree ("salon_id","phone");--> statement-breakpoint
CREATE INDEX "clients_account_idx" ON "clients" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "notifications_status_scheduled_idx" ON "notifications" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_salon_idx" ON "notifications" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "prepayments_booking_idx" ON "prepayments" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salons_subdomain_uq" ON "salons" USING btree ("subdomain");--> statement-breakpoint
CREATE UNIQUE INDEX "salons_custom_domain_uq" ON "salons" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "schedules_salon_idx" ON "schedules" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "schedules_staff_idx" ON "schedules" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "services_salon_idx" ON "services" USING btree ("salon_id");--> statement-breakpoint
CREATE INDEX "staff_salon_idx" ON "staff" USING btree ("salon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_salon_account_uq" ON "staff" USING btree ("salon_id","account_id");--> statement-breakpoint
CREATE INDEX "time_off_staff_idx" ON "time_off" USING btree ("staff_id");