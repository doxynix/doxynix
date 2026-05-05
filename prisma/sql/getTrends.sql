-- @param {Int} $1:user_id
-- @param {DateTime} $2:start_date
-- @param {DateTime} $3:end_date

WITH daily_latest AS (
    SELECT DISTINCT ON (a.repo_id, DATE(a.created_at))
        a.score,
        a.security_score,
        a.complexity_score,
        a.onboarding_score,
        a.tech_debt_score,
        a.created_at
    FROM analyses a
    JOIN repos r ON a.repo_id = r.id
    WHERE r.user_id = $1
      AND a.status = 'DONE'
      AND a.created_at >= $2
      AND a.created_at <= $3
    ORDER BY a.repo_id, DATE(a.created_at), a.created_at DESC
)
SELECT
    DATE(created_at) AS "dateKey",
    TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS "fullDate",
    COALESCE(AVG(score), 0)::int AS "health",
    COALESCE(AVG(security_score), 0)::int AS "security",
    COALESCE(AVG(complexity_score), 0)::int AS "complexity",
    COALESCE(AVG(onboarding_score), 0)::int AS "onboarding",
    COALESCE(AVG(tech_debt_score), 0)::int AS "techDebt"
FROM daily_latest
GROUP BY DATE(created_at)
ORDER BY "dateKey" ASC;
