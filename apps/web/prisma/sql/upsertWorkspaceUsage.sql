-- @param {String} $1:workspace_id
-- @param {String} $2:period_start
-- @param {Int} $3:tokens
-- @param {Int} $4:analyses
-- @param {BigInt} $5:cost_cents

-- The insert clamps a fresh row at zero; the conflict branch adds the raw delta, because a release
-- is negative and would be lost if EXCLUDED were already clamped.
INSERT INTO "workspace_usage" (
    "workspace_id", "period_start", "ai_tokens_used", "analyses_count", "cost_cents", "updated_at"
)
VALUES (
    $1::uuid,
    $2::date,
    GREATEST(0, $3::int),
    $4::int,
    GREATEST(0, $5::bigint),
    now()
)
ON CONFLICT ("workspace_id", "period_start") DO UPDATE SET
    "ai_tokens_used" = GREATEST(0, "workspace_usage"."ai_tokens_used" + $3::int),
    "analyses_count" = "workspace_usage"."analyses_count" + $4::int,
    "cost_cents" = GREATEST(0, "workspace_usage"."cost_cents" + $5::bigint),
    "updated_at" = now();
