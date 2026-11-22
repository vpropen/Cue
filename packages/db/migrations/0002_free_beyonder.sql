CREATE TABLE "salon_sms_settings" (
	"salon_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"provider" text,
	"sender_name" text,
	"credentials_secret_ref" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_sms_settings" ADD CONSTRAINT "salon_sms_settings_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;