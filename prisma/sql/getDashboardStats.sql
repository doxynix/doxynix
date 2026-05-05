-- @param {DateTime} $1:current_period_start
-- @param {DateTime} $2:previous_period_start
-- @param {DateTime} $3:period_end

WITH periods AS (
    SELECT
        $1::timestamp AS cur_start,
        $3::timestamp AS cur_end,
        $2::timestamp AS prev_start,
        $1::timestamp AS prev_end
),
global_counts AS (
    SELECT
        (SELECT COUNT(*)::int FROM repos WHERE created_at <= p.cur_end) AS repo_count,
        (SELECT COUNT(*)::int FROM documents WHERE created_at <= p.cur_end) AS doc_count
    FROM periods p
    LIMIT 1
),
analysis_status_counts AS (
    SELECT
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int AS failed_count,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN status = 'DONE' THEN 1 END)::int AS success_count,
        COUNT(CASE WHEN status = 'NEW' THEN 1 END)::int AS new_count,
        COUNT(*)::int AS total_count
    FROM analyses
    CROSS JOIN periods p
    WHERE analyses.created_at <= p.cur_end
),
base_data AS (
    SELECT
        a.*,
        r.name as repo_name,
        (a.created_at >= p.cur_start AND a.created_at <= p.cur_end) as is_current,
        (a.created_at >= p.prev_start AND a.created_at < p.cur_start) as is_previous
    FROM analyses a
    JOIN repos r ON a.repo_id = r.id
    CROSS JOIN periods p
    WHERE a.status = 'DONE'
      AND a.created_at >= p.prev_start
      AND a.created_at <= p.cur_end
),
latest_analysis_ids AS (
    SELECT DISTINCT ON (repo_id) id
    FROM base_data
    WHERE is_current = true
    ORDER BY repo_id, created_at DESC
),
rolling_metrics AS (
    SELECT
        COALESCE(AVG(score) FILTER (WHERE is_current), 0)::float AS cur_health,
        COALESCE(AVG(security_score) FILTER (WHERE is_current), 0)::float AS cur_security,
        COALESCE(AVG(complexity_score) FILTER (WHERE is_current), 0)::float AS cur_complexity,
        COALESCE(AVG(onboarding_score) FILTER (WHERE is_current), 0)::float AS cur_onboarding,
        COALESCE(AVG(tech_debt_score) FILTER (WHERE is_current), 0)::float AS cur_tech_debt,
        COALESCE(AVG(score) FILTER (WHERE is_previous), 0)::float AS prev_health,
        COALESCE(AVG(security_score) FILTER (WHERE is_previous), 0)::float AS prev_security,
        COALESCE(AVG(complexity_score) FILTER (WHERE is_previous), 0)::float AS prev_complexity,
        COALESCE(AVG(onboarding_score) FILTER (WHERE is_previous), 0)::float AS prev_onboarding,
        COALESCE(AVG(tech_debt_score) FILTER (WHERE is_previous), 0)::float AS prev_tech_debt,
        COUNT(DISTINCT repo_id) FILTER (WHERE is_current AND score > 0 AND score < 50)::int AS critical_count
    FROM base_data
),
extreme_repos AS (
    SELECT
        (SELECT jsonb_build_object('name', bd.repo_name, 'score', bd.score)
         FROM base_data bd
         WHERE bd.id IN (SELECT id FROM latest_analysis_ids) AND bd.score < 50
         ORDER BY bd.score ASC LIMIT 1) AS worst_repo,
        (SELECT jsonb_build_object('name', bd.repo_name, 'score', bd.score)
         FROM base_data bd
         WHERE bd.id IN (SELECT id FROM latest_analysis_ids)
         ORDER BY bd.score DESC NULLS LAST LIMIT 1) AS best_repo
),
recent_analyses AS (
    SELECT COALESCE(jsonb_agg(ra), '[]'::jsonb) AS recent
    FROM (
        SELECT a.public_id as id, a.progress, a.status, a.created_at as "createdAt", r.name AS "repoName", r.owner AS "repoOwner"
        FROM analyses a
        JOIN repos r ON a.repo_id = r.id
        CROSS JOIN periods p
        WHERE a.created_at <= p.cur_end
        ORDER BY a.created_at DESC
        LIMIT 5
    ) ra
),
latest_metrics_json AS (
    SELECT metrics_json, repo_name
    FROM base_data
    WHERE id IN (SELECT id FROM latest_analysis_ids)
),
language_stats AS (
    SELECT
        lang->>'name' AS name,
        MAX(lang->>'color') AS color,
        SUM((lang->>'lines')::numeric)::int AS lines
    FROM latest_metrics_json,
    jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'languages') = 'array' THEN metrics_json->'languages' ELSE '[]'::jsonb END) AS lang
    GROUP BY lang->>'name'
),
final_languages AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', final_name, 'color', final_color, 'value', sum_lines)), '[]'::jsonb) AS languages
    FROM (
        SELECT
            CASE WHEN rn <= 5 THEN name ELSE 'Other' END AS final_name,
            CASE WHEN rn <= 5 THEN color ELSE '#808080' END AS final_color,
            SUM(lines)::int AS sum_lines
        FROM (SELECT name, color, lines, ROW_NUMBER() OVER (ORDER BY lines DESC) as rn FROM language_stats) ls
        GROUP BY 1, 2 ORDER BY 3 DESC
    ) sub
),
system_risks AS (
    SELECT
        COUNT(*) FILTER (WHERE (metrics_json->>'busFactor')::int = 1)::int AS bus_factor_repos,
        (SELECT jsonb_agg(sub) FROM (
            SELECT repo_name, item->>'path' as path, (item->>'score')::int as score
            FROM latest_metrics_json, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'hotspotSignals') = 'array' THEN metrics_json->'hotspotSignals' ELSE '[]'::jsonb END) AS item
            ORDER BY (item->>'score')::int DESC LIMIT 3
        ) sub) AS top_hotspots,
        (SELECT jsonb_agg(sub) FROM (
            SELECT repo_name, item->>'fromPath' as from_path, item->>'toPath' as to_path, (item->>'commits')::int as commits
            FROM latest_metrics_json, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(metrics_json->'changeCoupling') = 'array' THEN metrics_json->'changeCoupling' ELSE '[]'::jsonb END) AS item
            ORDER BY (item->>'commits')::int DESC LIMIT 3
        ) sub) AS top_coupling
    FROM latest_metrics_json
)
SELECT
    gc.repo_count AS "repoCount",
    gc.doc_count AS "docCount",
    ascnt.failed_count AS "failedCount",
    ascnt.new_count AS "newCount",
    ascnt.pending_count AS "pendingCount",
    ascnt.success_count AS "successCount",
    ascnt.total_count AS "totalCount",
    rm.cur_complexity AS "avgComplexity",
    rm.cur_health AS "avgHealth",
    rm.cur_onboarding AS "avgOnboarding",
    rm.cur_security AS "avgSecurity",
    rm.cur_tech_debt AS "avgTechDebt",
    rm.critical_count AS "criticalRepoCount",
    er.worst_repo AS "worstRepo",
    er.best_repo AS "bestRepo",
    ra.recent AS "recentActivity",
    fl.languages AS "languages",
    COALESCE((SELECT SUM((metrics_json->>'totalLoc')::numeric)::int FROM latest_metrics_json), 0) AS "totalLoc",
    COALESCE(sr.bus_factor_repos, 0) AS "busFactorRepos",
    COALESCE(sr.top_hotspots, '[]'::jsonb) AS "topHotspots",
    COALESCE(sr.top_coupling, '[]'::jsonb) AS "topCoupling",
    NULLIF(ROUND(rm.cur_health - rm.prev_health), ROUND(rm.cur_health))::int AS "healthDelta",
    NULLIF(ROUND(rm.cur_security - rm.prev_security), ROUND(rm.cur_security))::int AS "securityDelta",
    NULLIF(ROUND(rm.cur_complexity - rm.prev_complexity), ROUND(rm.cur_complexity))::int AS "complexityDelta",
    NULLIF(ROUND(rm.cur_onboarding - rm.prev_onboarding), ROUND(rm.cur_onboarding))::int AS "onboardingDelta",
    NULLIF(ROUND(rm.cur_tech_debt - rm.prev_tech_debt), ROUND(rm.cur_tech_debt))::int AS "techDebtDelta"
FROM
    global_counts gc
    CROSS JOIN analysis_status_counts ascnt
    CROSS JOIN rolling_metrics rm
    CROSS JOIN extreme_repos er
    CROSS JOIN recent_analyses ra
    CROSS JOIN final_languages fl
    LEFT JOIN system_risks sr ON TRUE;
