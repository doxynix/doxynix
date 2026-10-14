-- @param {String} $1:user_id
-- @param {DateTime} $2:current_period_start
-- @param {DateTime} $3:previous_period_start
-- @param {DateTime} $4:period_end

-- `@prisma/adapter-pg` sends Date params as a zone-less UTC string, so the `::date`/`::timestamp`
-- casts below are session-TimeZone independent; casting one to `::timestamptz` would re-add it.
WITH periods AS (
    SELECT
        $2::timestamp AS cur_start,
        ($4::date + interval '1 day')::timestamp AS cur_end,
        $3::timestamp AS prev_start,
        $2::timestamp AS prev_end
),
user_repos AS (
    SELECT id, name, owner, created_at
    FROM repos
    WHERE user_id = $1::uuid
),
base_data AS (
    SELECT
        a.repo_id, a.id, a.status, a.progress, a.created_at,
        a.score, a.security_score, a.complexity_score, a.onboarding_score, a.tech_debt_score,
        a.metrics_json,
        ur.name as repo_name,
        (a.created_at >= p.cur_start AND a.created_at < p.cur_end) as is_current
    FROM analyses a
    JOIN user_repos ur ON a.repo_id = ur.id
    CROSS JOIN periods p
    WHERE a.status = 'DONE'
      AND a.created_at >= p.prev_start
      AND a.created_at < p.cur_end
),
latest_per_repo AS (
    SELECT DISTINCT ON (b.repo_id, b.period_group)
        b.repo_id, b.id, b.status, b.progress, b.created_at,
        b.score, b.security_score, b.complexity_score, b.onboarding_score, b.tech_debt_score,
        b.metrics_json, b.repo_name, b.is_current, b.period_group
    FROM (
        SELECT bd.*, CASE WHEN bd.is_current THEN 1 ELSE 2 END AS period_group
        FROM base_data bd
    ) b
    ORDER BY b.repo_id, b.period_group, b.created_at DESC, b.id DESC
),
status_agg AS (
    SELECT
        COUNT(*) FILTER (WHERE a.status = 'FAILED')::int AS "failedCount",
        COUNT(*) FILTER (WHERE a.status = 'PENDING')::int AS "pendingCount",
        COUNT(*) FILTER (WHERE a.status = 'DONE')::int AS "successCount",
        COUNT(*) FILTER (WHERE a.status = 'NEW')::int AS "newCount",
        COUNT(*)::int AS "totalCount"
    FROM analyses a
    JOIN user_repos ur ON a.repo_id = ur.id
    CROSS JOIN periods p
    WHERE a.created_at >= p.cur_start
      AND a.created_at < p.cur_end
),
doc_agg AS (
    SELECT COUNT(*)::int AS "docCount"
    FROM documents d
    JOIN user_repos ur ON d.repo_id = ur.id
    CROSS JOIN periods p
    WHERE d.created_at < p.cur_end
),
score_stats AS (
    SELECT
        AVG(score) FILTER (WHERE is_current) AS cur_health,
        AVG(score) FILTER (WHERE NOT is_current) AS prev_health,
        AVG(security_score) FILTER (WHERE is_current) AS cur_security,
        AVG(security_score) FILTER (WHERE NOT is_current) AS prev_security,
        AVG(complexity_score) FILTER (WHERE is_current) AS cur_complexity,
        AVG(complexity_score) FILTER (WHERE NOT is_current) AS prev_complexity,
        AVG(onboarding_score) FILTER (WHERE is_current) AS cur_onboarding,
        AVG(onboarding_score) FILTER (WHERE NOT is_current) AS prev_onboarding,
        AVG(tech_debt_score) FILTER (WHERE is_current) AS cur_tech_debt,
        AVG(tech_debt_score) FILTER (WHERE NOT is_current) AS prev_tech_debt,
        -- `is_current` keeps only `period_group = 1`, and `DISTINCT ON` already allowed one row
        -- per repo there, so this equals `COUNT(DISTINCT repo_id)`.
        COUNT(*) FILTER (WHERE is_current AND score < 50)::int AS critical_repo_count,
        SUM(COALESCE((metrics_json->>'totalLoc')::numeric, 0)) FILTER (WHERE is_current)::int AS total_loc,
        COUNT(*) FILTER (WHERE is_current AND COALESCE((metrics_json->>'busFactor')::int, 0) = 1)::int AS bus_factor_repos
    FROM latest_per_repo
),
-- Top-5 newest per repo via `analyses(repo_id, created_at DESC)`, so the outer LIMIT 5 never
-- sorts the whole history. Five rows of one repo can never crowd out the global top 5.
per_repo_top AS (
    SELECT DISTINCT ON (l.repo_id) l.repo_id, l.id, l.progress, l.status, l.created_at
    FROM user_repos ur
    CROSS JOIN LATERAL (
        SELECT a.id, a.repo_id, a.progress, a.status, a.created_at
        FROM analyses a
        WHERE a.repo_id = ur.id
          AND a.created_at < (SELECT cur_end FROM periods)
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 5
    ) l
    ORDER BY l.repo_id
)
SELECT
    -- Counters
    (SELECT COUNT(*)::int FROM user_repos ur CROSS JOIN periods p WHERE ur.created_at < p.cur_end) AS "repoCount",
    (SELECT "docCount" FROM doc_agg) AS "docCount",

    -- Statuses (one pass over user_repos x analyses instead of five identical scans)
    (SELECT "failedCount" FROM status_agg) AS "failedCount",
    (SELECT "pendingCount" FROM status_agg) AS "pendingCount",
    (SELECT "successCount" FROM status_agg) AS "successCount",
    (SELECT "newCount" FROM status_agg) AS "newCount",
    (SELECT "totalCount" FROM status_agg) AS "totalCount",

    -- Metrics
    COALESCE((SELECT cur_health FROM score_stats), 0)::float AS "avgHealth",
    COALESCE((SELECT cur_security FROM score_stats), 0)::float AS "avgSecurity",
    COALESCE((SELECT cur_complexity FROM score_stats), 0)::float AS "avgComplexity",
    COALESCE((SELECT cur_onboarding FROM score_stats), 0)::float AS "avgOnboarding",
    COALESCE((SELECT cur_tech_debt FROM score_stats), 0)::float AS "avgTechDebt",
    COALESCE((SELECT critical_repo_count FROM score_stats), 0)::int AS "criticalRepoCount",

    -- Extremes
    (SELECT jsonb_build_object('name', repo_name, 'score', score) FROM latest_per_repo WHERE is_current AND score < 50 ORDER BY score ASC, repo_name ASC LIMIT 1) AS "worstRepo",
    (SELECT jsonb_build_object('name', repo_name, 'score', score) FROM latest_per_repo WHERE is_current ORDER BY score DESC NULLS LAST, repo_name ASC LIMIT 1) AS "bestRepo",

    -- Activity
    (SELECT COALESCE(jsonb_agg(ra ORDER BY ra."createdAt" DESC, ra.id DESC), '[]'::jsonb) FROM (
        SELECT prt.id, prt.progress, prt.status, prt.created_at AS "createdAt",
               ur.name AS "repoName", ur.owner AS "repoOwner"
        FROM per_repo_top prt
        JOIN user_repos ur ON ur.id = prt.repo_id
        ORDER BY prt.created_at DESC, prt.id DESC
        LIMIT 5
    ) ra) AS "recentActivity",

    -- Languages
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

    -- Risks and LOC
    COALESCE((SELECT total_loc FROM score_stats), 0)::int AS "totalLoc",
    COALESCE((SELECT bus_factor_repos FROM score_stats), 0)::int AS "busFactorRepos",

    (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
        SELECT repo_name, item->>'path' as path, COALESCE((item->>'score')::int, 0) as score
        FROM latest_per_repo, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'hotspotSignals') = 'array' THEN metrics_json->'hotspotSignals' ELSE '[]'::jsonb END) AS item
        WHERE is_current = true ORDER BY score DESC, repo_name ASC, path ASC LIMIT 3
    ) sub) AS "topHotspots",

    (SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) FROM (
        SELECT repo_name, item->>'fromPath' as from_path, item->>'toPath' as to_path, COALESCE((item->>'commits')::int, 0) as commits
        FROM latest_per_repo, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'changeCoupling') = 'array' THEN metrics_json->'changeCoupling' ELSE '[]'::jsonb END) AS item
        WHERE is_current = true ORDER BY commits DESC, repo_name ASC, from_path ASC LIMIT 3
    ) sub) AS "topCoupling",

    -- Deltas
    COALESCE((SELECT cur_health - prev_health FROM score_stats), 0)::int AS "healthDelta",
    COALESCE((SELECT cur_security - prev_security FROM score_stats), 0)::int AS "securityDelta",
    COALESCE((SELECT cur_complexity - prev_complexity FROM score_stats), 0)::int AS "complexityDelta",
    COALESCE((SELECT cur_onboarding - prev_onboarding FROM score_stats), 0)::int AS "onboardingDelta",
    COALESCE((SELECT cur_tech_debt - prev_tech_debt FROM score_stats), 0)::int AS "techDebtDelta"

FROM periods p;
