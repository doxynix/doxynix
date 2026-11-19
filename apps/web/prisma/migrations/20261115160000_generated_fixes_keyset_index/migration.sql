-- CreateIndex
CREATE INDEX "generated_fixes_repo_id_created_at_id_idx" ON "generated_fixes"("repo_id", "created_at" DESC, "id" DESC);
