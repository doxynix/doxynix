ALTER TABLE "audit_logs" ADD COLUMN "country" varchar(10) DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "request_id" varchar(100);--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");