-- CreateIndex
CREATE INDEX "repos_user_id_owner_idx" ON "repos"("user_id", "owner");
