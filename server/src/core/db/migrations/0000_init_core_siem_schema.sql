CREATE TYPE "public"."notification_channel" AS ENUM('telegram', 'email', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."roles" AS ENUM('analyst', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severity_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor" varchar(100) NOT NULL,
	"action" varchar(150) NOT NULL,
	"target" varchar(150) NOT NULL,
	"ip_address" "inet" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"service_name" "citext" NOT NULL,
	"last_synced_position" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cron_sync_state_service_name_unique" UNIQUE("service_name")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"incident_id" uuid NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"severity" "severity_level" NOT NULL,
	"matched_text" text NOT NULL,
	"line" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"severity" "severity_level" NOT NULL,
	"findings_count" integer DEFAULT 0 NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"incident_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" "citext" NOT NULL,
	"description" text NOT NULL,
	"severity" "severity_level" NOT NULL,
	"pattern" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"role" "roles" DEFAULT 'analyst' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_brin_idx" ON "audit_logs" USING brin ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_ip_gist_idx" ON "audit_logs" USING gist ("ip_address");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor");--> statement-breakpoint
CREATE INDEX "findings_incident_id_idx" ON "findings" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "incidents_created_brin_idx" ON "incidents" USING brin ("created_at");--> statement-breakpoint
CREATE INDEX "incidents_file_name_trgm_idx" ON "incidents" USING gin ("file_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "incidents_severity_idx" ON "incidents" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "notifications_failed_pending_partial_idx" ON "notifications" USING btree ("id") WHERE "notifications"."status" IN ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "notifications_incident_id_idx" ON "notifications" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "rules_active_partial_idx" ON "rules" USING btree ("id") WHERE "rules"."is_active" = true;--> statement-breakpoint
CREATE INDEX "rules_name_trgm_idx" ON "rules" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "rules_desc_trgm_idx" ON "rules" USING gin ("description" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "rules_created_at_idx" ON "rules" USING btree ("created_at");