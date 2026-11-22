CREATE TYPE "public"."phone_verification_method" AS ENUM('sms_code', 'admin_call');--> statement-breakpoint
CREATE TABLE "phone_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phone_verification_method" "phone_verification_method";--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phone_verified_by_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "phone_otps" ADD CONSTRAINT "phone_otps_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_otps_lookup_idx" ON "phone_otps" USING btree ("salon_id","phone","created_at");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_phone_verified_by_staff_id_staff_id_fk" FOREIGN KEY ("phone_verified_by_staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;