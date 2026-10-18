-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "api_keys_expires_at_idx" ON "api_keys"("expires_at");
