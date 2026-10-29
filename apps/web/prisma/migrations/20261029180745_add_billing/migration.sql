-- CreateTable
CREATE TABLE "billing_customers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "billing_customer_id" UUID NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "stripe_subscription_item_id" TEXT NOT NULL,
    "stripe_price_id" TEXT NOT NULL,
    "stripe_status" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancel_at" TIMESTAMPTZ(3),
    "latest_invoice_id" TEXT,
    "latest_invoice_status" TEXT,
    "activated_at" TIMESTAMPTZ(3),
    "past_due_started_at" TIMESTAMPTZ(3),
    "grace_ends_at" TIMESTAMPTZ(3),
    "is_current" BOOLEAN,
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "review_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_checkout_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "stripe_checkout_session_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_status" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_operations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "operation" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stripe_object_id" TEXT,
    "result_json" JSONB,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "stripe_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "livemode" BOOLEAN NOT NULL,
    "api_version" TEXT,
    "stripe_created_at" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB,
    "payload_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "replay_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "trigger_run_id" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_ledger_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "billing_event_id" UUID,
    "entry_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stripe_object_id" TEXT NOT NULL,
    "related_invoice_id" TEXT,
    "related_subscription_id" TEXT,
    "corrects_entry_id" UUID,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_issues" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "workspace_id" UUID,
    "stripe_object_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "details" JSONB,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_reconciliation_runs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "scheduled_for_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3),
    "checked_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "checked_money_objects" INTEGER NOT NULL DEFAULT 0,
    "mismatch_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_workspace_id_key" ON "billing_customers"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_stripe_customer_id_key" ON "billing_customers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_stripe_subscription_id_key" ON "billing_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_stripe_subscription_item_id_key" ON "billing_subscriptions"("stripe_subscription_item_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_billing_customer_id_created_at_idx" ON "billing_subscriptions"("billing_customer_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_subscriptions_stripe_status_current_period_end_idx" ON "billing_subscriptions"("stripe_status", "current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_workspace_id_is_current_key" ON "billing_subscriptions"("workspace_id", "is_current");

-- CreateIndex
CREATE UNIQUE INDEX "billing_checkout_sessions_stripe_checkout_session_id_key" ON "billing_checkout_sessions"("stripe_checkout_session_id");

-- CreateIndex
CREATE INDEX "billing_checkout_sessions_workspace_id_created_at_idx" ON "billing_checkout_sessions"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_operations_status_updated_at_idx" ON "billing_operations"("status", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_operations_workspace_id_request_id_key" ON "billing_operations"("workspace_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_stripe_event_id_key" ON "billing_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "billing_events_status_received_at_idx" ON "billing_events"("status", "received_at");

-- CreateIndex
CREATE INDEX "billing_events_type_stripe_created_at_idx" ON "billing_events"("type", "stripe_created_at");

-- CreateIndex
CREATE INDEX "billing_events_stripe_created_at_id_idx" ON "billing_events"("stripe_created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_ledger_entries_entry_key_key" ON "billing_ledger_entries"("entry_key");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_workspace_id_occurred_at_id_idx" ON "billing_ledger_entries"("workspace_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_related_invoice_id_kind_idx" ON "billing_ledger_entries"("related_invoice_id", "kind");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_stripe_object_id_kind_idx" ON "billing_ledger_entries"("stripe_object_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "billing_issues_dedupe_key_key" ON "billing_issues"("dedupe_key");

-- CreateIndex
CREATE INDEX "billing_issues_status_severity_last_seen_at_idx" ON "billing_issues"("status", "severity", "last_seen_at");

-- CreateIndex
CREATE INDEX "billing_issues_workspace_id_status_idx" ON "billing_issues"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_reconciliation_runs_scheduled_for_date_key" ON "billing_reconciliation_runs"("scheduled_for_date");

-- AddForeignKey
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_billing_customer_id_fkey" FOREIGN KEY ("billing_customer_id") REFERENCES "billing_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_operations" ADD CONSTRAINT "billing_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_operations" ADD CONSTRAINT "billing_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_billing_event_id_fkey" FOREIGN KEY ("billing_event_id") REFERENCES "billing_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_corrects_entry_id_fkey" FOREIGN KEY ("corrects_entry_id") REFERENCES "billing_ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_issues" ADD CONSTRAINT "billing_issues_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
