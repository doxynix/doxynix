-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "webhook_deliveries" ADD COLUMN     "error" TEXT,
ADD COLUMN     "status" "WebhookStatus" NOT NULL DEFAULT 'PROCESSING';
