-- @param {Json} $1:items

-- One statement for the whole sweep; typed SQL has no array parameters, so the rows arrive as a
-- JSON array under `items`. `updated_at` is matched and rewritten because raw SQL skips @updatedAt.
UPDATE "billing_events" AS b
SET "status" = 'ENQUEUED',
    "replay_count" = b."replay_count" + 1,
    "trigger_run_id" = v."run_id",
    "updated_at" = now()
FROM jsonb_to_recordset(($1::jsonb) -> 'items') AS v(
    "id" uuid,
    "run_id" text,
    "expected_updated_at" timestamptz
)
WHERE b."id" = v."id"
  AND b."status" IN ('RECEIVED', 'PROCESSING', 'ENQUEUED')
  AND b."updated_at" = v."expected_updated_at"
RETURNING b."id";
