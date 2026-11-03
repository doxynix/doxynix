-- @param {String} $1:user_id
-- @param {DateTime} $2:start_date
-- @param {DateTime} $3:end_date
-- @param {String} $4:repo_id?

-- `created_at` is `timestamptz`, so the day bucket and the range bounds are pinned to UTC:
-- relying on the implicit cast would let the session TimeZone move rows between days.
WITH daily_latest AS (
    SELECT DISTINCT ON (a.repo_id, (a.created_at AT TIME ZONE 'UTC')::date)
        a.score,
        a.security_score,
        a.complexity_score,
        a.onboarding_score,
        a.tech_debt_score,
        a.created_at
    FROM analyses a
    JOIN repos r ON a.repo_id = r.id
    WHERE r.created_by_user_id = $1::uuid
      AND ($4::uuid IS NULL OR r.id = $4::uuid)
      AND a.status = 'DONE'
      AND a.created_at >= (($2::timestamp) AT TIME ZONE 'UTC')
      AND a.created_at < ((($3::date + interval '1 day')::timestamp) AT TIME ZONE 'UTC')
    ORDER BY a.repo_id, (a.created_at AT TIME ZONE 'UTC')::date, a.created_at DESC, a.id DESC
)
SELECT
    (created_at AT TIME ZONE 'UTC')::date AS "dateKey",
    TO_CHAR((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS "fullDate",
    COALESCE(AVG(score), 0)::int AS "health",
    COALESCE(AVG(security_score), 0)::int AS "security",
    COALESCE(AVG(complexity_score), 0)::int AS "complexity",
    COALESCE(AVG(onboarding_score), 0)::int AS "onboarding",
    COALESCE(AVG(tech_debt_score), 0)::int AS "techDebt"
FROM daily_latest
GROUP BY (created_at AT TIME ZONE 'UTC')::date
ORDER BY "dateKey" ASC;
