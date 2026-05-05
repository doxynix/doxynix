-- @param {Int} $1:user_id
-- @param {DateTime} $2:current_period_start
-- @param {DateTime} $3:previous_period_start
-- @param {DateTime} $4:period_end

WITH periods AS (
    SELECT
        $2::timestamp AS cur_start,
        $4::timestamp AS cur_end,
        $3::timestamp AS prev_start,
        $2::timestamp AS prev_end
),
user_repos AS (
    SELECT id, name, owner, public_id
    FROM repos
    WHERE user_id = $1
),
base_data AS (
    SELECT
        a.*,
        ur.name as repo_name,
        (a.created_at >= p.cur_start AND a.created_at <= p.cur_end) as is_current,
        (a.created_at >= p.prev_start AND a.created_at < p.cur_start) as is_previous
    FROM analyses a
    JOIN user_repos ur ON a.repo_id = ur.id
    CROSS JOIN periods p
    WHERE a.status = 'DONE'
      AND a.created_at >= p.prev_start
      AND a.created_at <= p.cur_end
),
latest_per_repo AS (
    SELECT DISTINCT ON (repo_id, period_group)
        *,
        CASE WHEN is_current THEN 1 ELSE 2 END as period_group
    FROM base_data
    ORDER BY repo_id, period_group, created_at DESC
)
SELECT
    -- Глобальные счетчики
    (SELECT COUNT(*)::int FROM user_repos) AS "repoCount",
    (SELECT COUNT(*)::int FROM documents d JOIN user_repos ur ON d.repo_id = ur.id CROSS JOIN periods p WHERE d.created_at <= p.cur_end) AS "docCount",

    -- Статусы (считаем по всем анализам, не только DONE)
    (SELECT COUNT(CASE WHEN a.status = 'FAILED' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end) AS "failedCount",
    (SELECT COUNT(CASE WHEN a.status = 'PENDING' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end) AS "pendingCount",
    (SELECT COUNT(CASE WHEN a.status = 'DONE' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end) AS "successCount",
    (SELECT COUNT(CASE WHEN a.status = 'NEW' THEN 1 END)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end) AS "newCount",
    (SELECT COUNT(*)::int FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end) AS "totalCount",

    -- Метрики (ВНИМАНИЕ: Используем двойные кавычки для camelCase колонок Prisma!)
    COALESCE((SELECT AVG(score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgHealth",
    COALESCE((SELECT AVG(security_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgSecurity",
    COALESCE((SELECT AVG(complexity_Score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgComplexity",
    COALESCE((SELECT AVG(onboarding_Score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgOnboarding",
    COALESCE((SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_current), 0)::float AS "avgTechDebt",
    COALESCE((SELECT COUNT(DISTINCT repo_id) FROM latest_per_repo WHERE is_current AND score < 50), 0)::int AS "criticalRepoCount",

    -- Экстремумы
    (SELECT jsonb_build_object('name', repo_name, 'score', score) FROM latest_per_repo WHERE is_current AND score < 50 ORDER BY score ASC LIMIT 1) AS "worstRepo",
    (SELECT jsonb_build_object('name', repo_name, 'score', score) FROM latest_per_repo WHERE is_current ORDER BY score DESC NULLS LAST LIMIT 1) AS "bestRepo",

    -- Последняя активность
    (SELECT COALESCE(jsonb_agg(ra ORDER BY ra."createdAt" DESC), '[]'::jsonb) FROM (
        SELECT a.public_id as id, a.progress, a.status, a.created_at as "createdAt", ur.name AS "repoName", ur.owner AS "repoOwner"
        FROM analyses a JOIN user_repos ur ON a.repo_id = ur.id CROSS JOIN periods p WHERE a.created_at <= p.cur_end ORDER BY a.created_at DESC LIMIT 5
    ) ra) AS "recentActivity",

    (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', final_name, 'color', final_color, 'value', sum_lines) ORDER BY sum_lines DESC), '[]'::jsonb) FROM (
        SELECT
            CASE WHEN rn <= 5 THEN name ELSE 'Other' END AS final_name,
            CASE WHEN rn <= 5 THEN color ELSE '#808080' END AS final_color,
            SUM(lines)::int AS sum_lines
        FROM (
            SELECT lang->>'name' AS name, MAX(lang->>'color') AS color, SUM(COALESCE((lang->>'lines')::numeric, 0))::int AS lines,
            ROW_NUMBER() OVER (ORDER BY SUM(COALESCE((lang->>'lines')::numeric, 0)) DESC) as rn
            FROM latest_per_repo, jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'languages') = 'array' THEN metrics_json->'languages' ELSE '[]'::jsonb END) AS lang
            WHERE is_current = true GROUP BY lang->>'name'
        ) ls GROUP BY 1, 2
    ) sub) AS "languages",

    COALESCE((SELECT SUM(COALESCE((metrics_json->>'totalLoc')::numeric, 0))::int FROM latest_per_repo WHERE is_current = true), 0) AS "totalLoc",
    COALESCE((SELECT COUNT(*)::int FROM latest_per_repo WHERE is_current = true AND COALESCE((metrics_json->>'busFactor')::int, 0) = 1), 0) AS "busFactorRepos",

    (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
        SELECT repo_name, item->>'path' as path, COALESCE((item->>'score')::int, 0) as score
        FROM latest_per_repo, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'hotspotSignals') = 'array' THEN metrics_json->'hotspotSignals' ELSE '[]'::jsonb END) AS item
        WHERE is_current = true ORDER BY score DESC LIMIT 3
    ) sub) AS "topHotspots",

    (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
        SELECT repo_name, item->>'fromPath' as from_path, item->>'toPath' as to_path, COALESCE((item->>'commits')::int, 0) as commits
        FROM latest_per_repo, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'changeCoupling') = 'array' THEN metrics_json->'changeCoupling' ELSE '[]'::jsonb END) AS item
        WHERE is_current = true ORDER BY commits DESC LIMIT 3
    ) sub) AS "topCoupling",

    COALESCE((SELECT AVG(score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(score) FROM latest_per_repo WHERE is_previous), 0)::int AS "healthDelta",
    COALESCE((SELECT AVG(security_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(security_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "securityDelta",
    COALESCE((SELECT AVG(complexity_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(complexity_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "complexityDelta",
    COALESCE((SELECT AVG(onboarding_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(onboarding_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "onboardingDelta",
    COALESCE((SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_current) - (SELECT AVG(tech_debt_score) FROM latest_per_repo WHERE is_previous), 0)::int AS "techDebtDelta"

FROM periods p;
