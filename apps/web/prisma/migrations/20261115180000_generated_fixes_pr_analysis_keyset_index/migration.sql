-- CreateIndex
CREATE INDEX "generated_fixes_pr_analysis_id_created_at_id_idx" ON "generated_fixes"("pr_analysis_id", "created_at" DESC, "id" DESC);
