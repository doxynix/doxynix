CREATE UNIQUE INDEX "unique_active_api_key_name"
ON "api_keys"("userId", "name")
WHERE ("revoked" = false);
