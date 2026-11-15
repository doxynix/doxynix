-- @param {String} $1:invite_id

UPDATE "workspace_invites"
SET "accepted_at" = now()
WHERE "id" = $1::uuid AND "accepted_at" IS NULL
RETURNING "id";
