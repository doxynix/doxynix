-- AlterTable
ALTER TABLE "billing_events" ADD COLUMN     "trigger_batch_id" TEXT;

-- CreateIndex
CREATE INDEX "billing_events_trigger_batch_id_idx" ON "billing_events"("trigger_batch_id");
