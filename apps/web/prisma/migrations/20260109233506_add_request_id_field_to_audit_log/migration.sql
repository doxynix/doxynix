-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "request_id" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");
