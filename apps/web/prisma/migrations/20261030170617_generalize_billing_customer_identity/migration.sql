-- AlterTable
-- Rename instead of drop+add so existing customer rows keep their Stripe id.
ALTER TABLE "billing_customers" RENAME COLUMN "stripe_customer_id" TO "external_customer_id";

-- AlterTable
ALTER TABLE "billing_customers" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'stripe';

-- DropIndex
DROP INDEX "billing_customers_stripe_customer_id_key";

-- DropIndex
DROP INDEX "billing_customers_workspace_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_workspace_id_provider_key" ON "billing_customers"("workspace_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "billing_customers_provider_external_customer_id_key" ON "billing_customers"("provider", "external_customer_id");
