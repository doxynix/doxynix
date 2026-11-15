-- CreateIndex
CREATE INDEX "analyses_repo_id_created_at_id_idx" ON "analyses"("repo_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "analyses_repo_id_commit_sha_idx" ON "analyses"("repo_id", "commit_sha");

-- CreateIndex
CREATE INDEX "api_keys_workspace_id_created_at_id_idx" ON "api_keys"("workspace_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "chat_messages_session_id_created_at_id_idx" ON "chat_messages"("session_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_repo_id_updated_at_id_idx" ON "chat_sessions"("user_id", "repo_id", "updated_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "pull_request_analyses_repo_id_created_at_id_idx" ON "pull_request_analyses"("repo_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "sessions_user_id_created_at_id_idx" ON "sessions"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "workspace_members_workspace_id_created_at_id_idx" ON "workspace_members"("workspace_id", "created_at", "id");

