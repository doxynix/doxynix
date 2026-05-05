-- @param {DateTime} $1:start_date
-- @param {DateTime} $2:end_date
SELECT
    DATE(created_at) AS "dateKey",
    COALESCE(AVG(score), 0)::int AS "health",
    COALESCE(AVG(security_score), 0)::int AS "security",
    COALESCE(AVG(complexity_score), 0)::int AS "complexity",
    COALESCE(AVG(onboarding_score), 0)::int AS "onboarding",
    COALESCE(AVG(tech_debt_score), 0)::int AS "techDebt"
FROM analyses
WHERE status = 'DONE'
  AND created_at >= $1
  AND created_at <= $2
GROUP BY DATE(created_at)
ORDER BY "dateKey" ASC;
