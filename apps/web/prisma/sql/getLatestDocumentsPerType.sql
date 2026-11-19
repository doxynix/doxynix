-- @param {String} $1:repo_id
-- @param {String} $2:workspace_id
-- @param {String} $3:analysis_id?
-- @param {Int} $4:per_type_limit

-- One window per (type, path) instead of one global `take`, so a type with many versions cannot
-- evict the others and pinned code docs stay one-per-path (NULL paths are peers in the partition).
SELECT
    t.id,
    t.type,
    t.analysis_id AS "analysisId",
    t.created_at AS "createdAt",
    t.path,
    t.updated_at AS "updatedAt",
    t.version
FROM (
    SELECT
        d.id,
        d.type,
        d.analysis_id,
        d.created_at,
        d.path,
        d.updated_at,
        d.version,
        ROW_NUMBER() OVER (
            PARTITION BY d.type, d.path
            ORDER BY d.updated_at DESC, d.id DESC
        ) AS row_number
    FROM documents d
    JOIN repos r ON r.id = d.repo_id
    WHERE d.repo_id = $1::uuid
      AND r.workspace_id = $2::uuid
      AND ($3::uuid IS NULL OR d.analysis_id = $3::uuid)
) t
WHERE t.row_number <= $4
ORDER BY t.type ASC, t.updated_at DESC;
