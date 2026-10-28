-- @param {String} $1:userId

-- Raw SQL bypasses ZenStack policies; the WHERE clause is the authorization boundary.
SELECT
    u.activated_at AS "activatedAt",
    u.onboarding_checklist_dismissed_at AS "checklistDismissedAt",
    u.onboarding_completed_at AS "completedAt",
    u.onboarding_intent AS "intent",
    EXISTS (
        SELECT 1
        FROM accounts a
        WHERE a.user_id = u.id AND a.provider_id = 'github'
    ) AS "hasGithubAccount",
    EXISTS (
        SELECT 1
        FROM github_installations gi
        WHERE gi.user_id = u.id AND gi.is_suspended = false
    ) AS "hasGithubInstallation",
    (SELECT COUNT(*)::int FROM repos r WHERE r.created_by_user_id = u.id) AS "repoCount",
    CASE
        WHEN fr.id IS NULL THEN NULL
        ELSE json_build_object('id', fr.id, 'name', fr.name, 'owner', fr.owner)
    END AS "firstRepo",
    EXISTS (
        SELECT 1
        FROM analyses a
        JOIN repos r ON r.id = a.repo_id
        WHERE r.created_by_user_id = u.id AND a.status = 'DONE'
    ) AS "hasCompletedAnalysis",
    CASE
        WHEN la.id IS NULL THEN NULL
        ELSE json_build_object('id', la.id, 'progress', la.progress, 'status', la.status)
    END AS "latestAnalysis"
FROM users u
LEFT JOIN LATERAL (
    SELECT r.id, r.name, r.owner
    FROM repos r
    WHERE r.created_by_user_id = u.id
    ORDER BY r.created_at ASC, r.id ASC
    LIMIT 1
) fr ON true
LEFT JOIN LATERAL (
    SELECT a.id, a.progress, a.status
    FROM analyses a
    WHERE a.repo_id = fr.id
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
) la ON true
WHERE u.id = $1::uuid;
