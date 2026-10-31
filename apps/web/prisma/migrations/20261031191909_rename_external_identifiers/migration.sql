-- Provider-agnostic identifiers: Stripe is the first provider, not the only one.
-- Renames (not drop/add) so existing rows and history survive the migration.

ALTER TABLE "billing_subscriptions" RENAME COLUMN "stripe_subscription_id" TO "external_subscription_id";
ALTER TABLE "billing_subscriptions" RENAME COLUMN "stripe_subscription_item_id" TO "external_subscription_item_id";
ALTER TABLE "billing_subscriptions" RENAME COLUMN "stripe_price_id" TO "external_price_id";
ALTER TABLE "billing_subscriptions" RENAME COLUMN "stripe_status" TO "external_status";
ALTER TABLE "billing_subscriptions" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

ALTER INDEX "billing_subscriptions_stripe_subscription_id_key" RENAME TO "billing_subscriptions_external_subscription_id_key";
ALTER INDEX "billing_subscriptions_stripe_subscription_item_id_key" RENAME TO "billing_subscriptions_external_subscription_item_id_key";
ALTER INDEX "billing_subscriptions_stripe_status_current_period_end_idx" RENAME TO "billing_subscriptions_external_status_current_period_end_idx";

ALTER TABLE "billing_checkout_sessions" RENAME COLUMN "stripe_checkout_session_id" TO "external_checkout_session_id";
ALTER TABLE "billing_checkout_sessions" RENAME COLUMN "stripe_customer_id" TO "external_customer_id";
ALTER TABLE "billing_checkout_sessions" RENAME COLUMN "stripe_status" TO "external_status";
ALTER TABLE "billing_checkout_sessions" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

ALTER INDEX "billing_checkout_sessions_stripe_checkout_session_id_key" RENAME TO "billing_checkout_sessions_external_checkout_session_id_key";

ALTER TABLE "billing_operations" RENAME COLUMN "stripe_object_id" TO "external_object_id";

ALTER TABLE "billing_events" RENAME COLUMN "stripe_event_id" TO "external_event_id";
ALTER TABLE "billing_events" RENAME COLUMN "stripe_created_at" TO "external_created_at";
ALTER TABLE "billing_events" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

ALTER INDEX "billing_events_stripe_event_id_key" RENAME TO "billing_events_external_event_id_key";
ALTER INDEX "billing_events_type_stripe_created_at_idx" RENAME TO "billing_events_type_external_created_at_idx";
ALTER INDEX "billing_events_stripe_created_at_id_idx" RENAME TO "billing_events_external_created_at_id_idx";

ALTER TABLE "billing_ledger_entries" RENAME COLUMN "stripe_object_id" TO "external_object_id";
ALTER TABLE "billing_ledger_entries" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

ALTER INDEX "billing_ledger_entries_stripe_object_id_kind_idx" RENAME TO "billing_ledger_entries_external_object_id_kind_idx";

ALTER TABLE "billing_issues" RENAME COLUMN "stripe_object_id" TO "external_object_id";
ALTER TABLE "billing_issues" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';
