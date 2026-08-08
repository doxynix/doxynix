# Repo Workspace Implementation Plan

Date: 2026-04-25

Goal:
- Establish `Repo Workspace` as the main repository experience.
- Introduce stable backend contracts for `RepoWorkspace`, `RepoNodeContext`, and `RepoSearchResult`.
- Keep `Metrics` and PR automation available as secondary surfaces.

Implementation focus:
- Reuse current `repoDetails` aggregation instead of introducing a separate analysis engine path.
- Keep changes centered in `src/server/entities/analyze/api`, `src/server/api/routers/repo-details.router.ts`,
  and repo workspace UI containers.
- Preserve repository tab continuity by carrying relevant query state across repo detail pages.

Planned deliverables:
- New read endpoints for workspace aggregate, node context, and structural search.
- Shared selection/navigation model for `node`, `path`, and related repo detail query params.
- Overview updated to consume workspace data instead of acting as an isolated score report.
- Map, code, and docs aligned around the same selected repository context.
