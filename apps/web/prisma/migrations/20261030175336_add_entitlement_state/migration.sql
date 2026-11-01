-- AlterTable
ALTER TABLE "workspace_entitlements" ADD COLUMN     "access_state" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "grace_ends_at" TIMESTAMP(3),
ADD COLUMN     "revision" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "source_subscription_id" UUID;

-- CreateIndex
CREATE INDEX "workspace_entitlements_access_state_grace_ends_at_idx" ON "workspace_entitlements"("access_state", "grace_ends_at");
