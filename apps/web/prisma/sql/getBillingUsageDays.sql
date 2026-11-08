-- @param {String} $1:workspaceId
-- @param {DateTime} $2:periodStart
-- @param {DateTime} $3:periodEnd

-- Raw SQL bypasses ZenStack policies; the workspace filter is the authorization boundary.
-- The daily series is derived from the append-only meter, not from the monthly rollup: the rollup
-- only knows "how much so far" and cannot be replayed onto a chart. Reservations are estimates, so
-- only settled calls count as tokens; analyses are counted on the ANALYSIS event.
SELECT
    TO_CHAR((occurred_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "date",
    COALESCE(
        SUM(CASE WHEN kind = 'ANALYSIS' THEN 1 WHEN kind = 'ANALYSIS_RELEASE' THEN -1 ELSE 0 END),
        0
    )::int AS "analyses",
    COALESCE(
        SUM(CASE WHEN kind = 'SETTLE' THEN input_tokens + output_tokens ELSE 0 END),
        0
    )::int AS "tokens"
FROM usage_events
WHERE workspace_id = $1::uuid
  AND occurred_at >= (($2::timestamp) AT TIME ZONE 'UTC')
  AND occurred_at < (($3::timestamp) AT TIME ZONE 'UTC')
GROUP BY (occurred_at AT TIME ZONE 'UTC')::date
ORDER BY (occurred_at AT TIME ZONE 'UTC')::date ASC;
