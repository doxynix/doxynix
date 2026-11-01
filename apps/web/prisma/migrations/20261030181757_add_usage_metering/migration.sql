-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "analysis_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'AI_CALL',
    "idempotency_key" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" BIGINT NOT NULL DEFAULT 0,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_usage" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "workspace_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "analyses_count" INTEGER NOT NULL DEFAULT 0,
    "ai_tokens_used" INTEGER NOT NULL DEFAULT 0,
    "cost_cents" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_events_idempotency_key_key" ON "usage_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "usage_events_workspace_id_occurred_at_id_idx" ON "usage_events"("workspace_id", "occurred_at", "id");

-- CreateIndex
CREATE INDEX "usage_events_analysis_id_idx" ON "usage_events"("analysis_id");

-- CreateIndex
CREATE INDEX "workspace_usage_period_start_idx" ON "workspace_usage"("period_start");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_usage_workspace_id_period_start_key" ON "workspace_usage"("workspace_id", "period_start");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_usage" ADD CONSTRAINT "workspace_usage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

