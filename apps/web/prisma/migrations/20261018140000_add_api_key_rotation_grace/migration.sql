-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "revoked_after" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "api_keys_revoked_after_idx" ON "api_keys"("revoked_after");