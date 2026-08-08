-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "event" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_deliveries_created_at_idx" ON "webhook_deliveries"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_provider_delivery_id_key" ON "webhook_deliveries"("provider", "delivery_id");
