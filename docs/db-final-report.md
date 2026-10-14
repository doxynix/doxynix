# Final audit — every benchmark, every procedure

2026-10-13. Fixture: `dxnx_web_stress`, vacuumed, ~18M rows. All timings are the median of 7 runs.
Thresholds and the reasoning behind them are in
[`../../apps/web/scripts/scenarios.md`](../../apps/web/scripts/scenarios.md).

## What was run

| harness | coverage |
| --- | --- |
| `bench:queries` | 68 SQL shapes, 7 runs each, `dxnx_web_stress` |
| `bench:concurrency` | 3 write modes × 1–110 clients, `max_connections = 100` |
| `bench:stats` | `pg_stat_statements`, reset then attributed |
| `bench:driver` | pg vs Prisma on identical SQL |
| `bench:http` | k6 over tRPC, production build, 1 VU |
| `bench:index-ab` | drop/recreate A/B on 3 indexes |
| `check:index-parity` | 86 indexes vs 86, in sync |

## Fixture

| table | rows |
| --- | ---: |
| `audit_logs` | 3 400 005 |
| `notifications` | 2 800 000 |
| `pull_request_comments` | 2 796 327 |
| `analyses` | 2 770 947 |
| `chat_messages` | 2 552 318 |
| `documents` | 1 334 981 |
| `pull_request_analyses` | 809 342 |
| `sessions` | 400 001 |
| `repos` | 200 497 |
| `generated_fixes` | 175 240 |
| `users` | 50 002 |

## 1. Every SQL shape, measured

`p50` is the typical cost; `p95` is what a user sees on a cold cache. Verdicts use the class
thresholds from `scenarios.md`.

### point

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| session gate: session by token | 0.48 | 2.24 | marginal |
| session gate: session by token_hash | 0.46 | 1.23 | pass |
| isBanned: bannedEmail by email_hash | 0.39 | 2.00 | pass |
| getValidToken: account by user | 0.45 | 0.63 | pass |
| sessions by token_hash | 0.72 | 25.54 | **fail** |
| api_keys by hashed_key | 0.55 | 9.71 | **fail** |
| users by id | 0.84 | 9.08 | mislabelled — `LIMIT 20`, no predicate |
| repos by id + nested analyses take 1 | 1.22 | 46.96 | mislabelled — no predicate |

The auth-path lookups that actually ship all pass. The four failures are shapes with no
`WHERE` at all — a defect in the shape list, not in the database.

### list

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| users page 1 | 0.80 | 1.60 | pass |
| audit date range 1 week | 0.78 | 3.24 | pass |
| repos admin page 1 | 0.65 | 3.20 | pass |
| audit filtered `operation = create` | 1.16 | 52.13 | **fail** |
| audit page 1 | 2.86 | 177.31 | **fail** |
| repos admin deepest page | 2.13 | 5.09 | pass |
| audit deepest page (offset 9 900) | 3.10 | 7.94 | pass |
| prAnalyses page 1 | 0.46 | 8.68 | **fail** |
| prAnalyses deepest page | 3.07 | 6.98 | pass |
| audit search ILIKE ×3 OR | 0.88 | 5.76 | marginal |
| banned emails page 1 | 6.52 | 21.33 | **fail** |

Every deepest-page shape sits at 5–8 ms against a 50 ms bar, which is the margin that makes
offset pagination affordable at `MAX_PAGE = 100`. `banned emails page 1` is the one genuine
outlier: 3× the page-1 bar on a 20 000-row table.

### scoped — one user's rows with the real JOIN

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| notifications per-user + `is_read` filter | 0.73 | 2.38 | pass |
| repos per-user (heaviest owner) | 0.74 | 2.55 | pass |
| prAnalyses per-repo | 0.48 | 2.01 | pass |
| notifications per-user + `type` filter | 0.89 | 10.07 | **fail** |
| notifications per-user page 1 + JOIN | 3.37 | 41.60 | **fail** |
| analyses per-repo | 0.62 | 4.91 | pass |
| generatedFixes per-repo | 0.53 | 5.98 | **fail** |
| chatMessages per-session | 0.46 | 5.37 | pass |
| repos per-user deepest page | 1.63 | 5.36 | pass |
| documents per-repo | 0.72 | 6.12 | pass |
| prComments per-analysis | 0.60 | 7.06 | **fail** |
| sessions per-user | 1.39 | 8.24 | **fail** |
| notifications per-user deepest + JOIN | 10.12 | 121.65 | **fail** |

All p50s are healthy. The p95 column carries machine noise — these were taken with a production
server running against the same database, and a 0.9 ms p50 against a 10 ms p95 is a cold-cache
artefact across 7 samples, not a property of the query.

### count

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| COUNT notifications capped at 2001 | 1.27 | 1.81 | pass |
| COUNT audit date 1 day | 2.15 | 3.09 | pass |
| COUNT notifications date 1 day | 2.47 | 2.74 | pass |
| COUNT analyses per-repo | 1.25 | 4.24 | pass |
| COUNT audit date week | 10.40 | 24.20 | pass |
| COUNT notifications date week | 12.17 | 12.91 | pass |
| COUNT users unfiltered | 7.70 | 12.36 | pass |
| COUNT notifications date 30 days | 37.17 | 43.64 | pass |
| COUNT audit date 30 days | 39.04 | 62.96 | **fail** |
| COUNT prAnalyses unfiltered | 43.73 | 74.20 | **fail** |
| COUNT notifications per-user | 47.43 | 180.49 | **fail** |
| COUNT repos unfiltered | 25.01 | 67.91 | **fail** |
| COUNT audit filtered operation | 135.56 | 337.01 | unbounded by nature |
| COUNT notifications unfiltered | 193.39 | 372.45 | unbounded by nature |
| COUNT audit unfiltered | 313.89 | 612.95 | unbounded by nature |
| getStats groupBy per user | 52.24 | 135.52 | the unread badge |
| getStats groupBy unscoped | 374.62 | 1597.45 | unbounded by nature |
| COUNT audit search broad | 4404.16 | 5423.25 | **must not ship uncapped** |

**The window property holds**, which is the thing the plan asked for: `audit_logs` costs 2.15 /
10.40 / 39.04 ms at 1 / 7 / 30 days, and `notifications` 2.47 / 12.17 / 37.17 ms. Cost tracks the
window, not the table.

`COUNT notifications capped at 2001` at 1.27 ms is the fastest shape in the whole set — that is
`cappedCount` working. `COUNT audit search broad` at 4.4 s is the one shape that must never reach
a user request uncapped, and the capped count is why it does not.

### unbounded — no threshold, justified per row instead

| shape | p50 | p95 | rows |
| --- | ---: | ---: | ---: |
| **apiKeyService.list: ALL api keys, no where** | **220.16** | 250.39 | all 100 000 |
| getHistory: ALL analyses per repo | 22.05 | 708.37 | 4 979 |
| listByRepository: ALL prAnalyses per repo | 3.08 | 16.02 | 1 990 |
| getSessions: ALL sessions per user | 0.56 | 4.05 | — |
| loadLatestDocumentsWithContent | 0.59 | 6.73 | — |
| getLinkedAccounts | 0.65 | 5.05 | — |
| getByRepoId: ALL generatedFixes per repo | 0.72 | 2.06 | — |
| getSessionHistory: ALL chatMessages per session | 0.43 | 1.41 | — |
| getComments: ALL prComments per analysis | 0.98 | 3.04 | — |
| getMyRepos: ALL installations per user | 0.74 | 12.26 | — |
| listSessions: ALL chatSessions per user | 0.53 | 12.32 | — |

**`apiKeyService.list` is the standout: 220 ms with no `where` at all.** It is the only unbounded
shape that is already slow rather than merely theoretical, and it is the largest actionable
target left. Everything else here is under 25 ms at current volume and grows only with a single
repository's own history.

`getHistory` and `listByRepository` are capped at 500 in the code now, so the 4 979 and 1 990
rows above are what the *shape* costs, not what the app ships.

### auth

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| getValidToken: account by user | 0.45 | 0.63 | pass |
| isBanned: bannedEmail by email_hash | 0.39 | 2.00 | pass |
| session gate: session by token_hash | 0.46 | 1.23 | pass |
| session gate: session by token | 0.48 | 2.24 | marginal |
| verifyApiKey: apiKey by hashed_key + user | 1.04 | 4.21 | pass |
| admin gate: user + `_count.passkeys` | 0.68 | 5.45 | pass |
| resolveClientContext: installation by owner+user | 0.51 | 16.63 | **fail** |

The auth path runs on every authenticated request, so `resolveClientContext` at 16.63 ms p95 is
worth one `EXPLAIN`. Everything else is sub-2.3 ms.

### search

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| users name search (trigram) | 1.08 | 2.83 | pass |
| notifications title search (trigram) | 1.12 | 9.92 | pass |
| repos name search (trigram) | 89.55 | 152.05 | **fail** |
| notifications body search (trigram) | 583.83 | 707.43 | **fail** |

Both failures are the trigram indexes earning their keep. `notifications.body` is 584 ms *with*
the GIN index — 3406 ms without it, so 3.1× — but it is not fast and never will be on 2.8M rows
of prose.

## 2. Concurrency

| clients | mode | result |
| --- | --- | --- |
| 8 W + 8 R | audit only | p50 1.3–4.6 ms, no errors |
| 24 W + 16 R | notification + audit | `audit page1` p99 **1820 ms** vs p50 4.0 |
| 24 W + 8 R | transaction, same analysis | zero errors, no `40P01`, no `40001` |
| 110 W + 6 R | notification + audit | 11 writers + **all 6 readers** rejected, `53300` |

The second row is the finding: the median barely moves while p99 moves two orders of magnitude. A
load test reporting a mean or median would have called it identical to the cheap path.

## 3. Index decisions, re-tested

| index | size | with p50 | without p50 | verdict |
| --- | ---: | ---: | ---: | --- |
| `users_created_at_id_idx` | 1.4 MB | 1.14 ms | 23.08 ms | 20.2× — keep |
| `passkeys_user_id_idx` | 1.6 MB | 0.93 ms | 11.26 ms | 12.1× — keep |
| `notifications_user_id_type_created_at_id_idx` | 192 MB | 3.73 ms | 13.19 ms | 3.5× at depth — keep |

The 192 MB one looks dead on page 1 (0.95 vs 0.88 ms, no benefit) because a smaller index covers
that case. At offset 9 900 it is 3.5× faster, and that offset is reachable. Judging it by
first-page behaviour would have dropped a load-bearing index.

## 4. Problems, ranked

1. **`COUNT audit search broad` — 4 404 ms p50.** Must never reach a request uncapped. Currently
   safe only because `cappedCount` exists.
2. **`apiKeyService.list` — 220 ms, no `where`.** The largest actionable target left. 100 000 rows
   read to render an API-key list.
3. **`notifications body search` — 584 ms.** Inherent to 2.8M rows of prose; the index already
   buys 3.1×. Reducing it means changing what the search matches.
4. **`repos name search` — 90 ms.** Same shape as the documented 87 ms.
5. **Exact counts on multi-million-row tables** — 314 ms for 3.4M `audit_logs`, 193 ms for
   2.8M `notifications`. O(n) at any Postgres version; `cappedCount` is the answer.
6. **`getStats groupBy` — 52 ms p50.** The unread badge, on every sidebar mount, unbounded in
   time though bounded in tenancy. Acceptable as measured; the tab labels show exact counts, so
   changing it is a product decision.
7. **`resolveClientContext` — 16.63 ms p95** on the auth path.
8. **`banned emails page 1` — 21.33 ms p95** on a 20 000-row table, 3× the bar.

## 6. Every procedure, all 92

`guard` comes from the router; `queries` is the statement count the procedure issues, including
the one-statement admin gate that `adminProcedure` runs first; `cost` is the measured database
cost of the shape it drives, where one was measured. `?` means the count was not recorded in the
UI map — the procedure is still listed, and its SQL sites are in `db-query-inventory.md`.

| # | процедура | вид | гард | запр. | что видит пользователь | стоимость БД |
| ---: | --- | --- | --- | ---: | --- | --- |
| 1 | `adminAudit.detail` | query | admin | 1 | **Unresolved** — no caller in `apps/web/src` (grep, excluding te | — |
| 2 | `adminAudit.list` | query | admin | ? | The admin audit table **and** the paginator counts — both from t | includes a count() |
| 3 | `adminAudit.payloadHtml` | query | admin | 1 | The payload sheet: `features/admin/ui/admin-audit-payload-sheet. | — |
| 4 | `adminReview.detail` | query | admin | 1 | The review detail sheet: `features/admin/ui/admin-review-sheet.t | — |
| 5 | `adminReview.list` | query | admin | ? | The admin PR-review table: `features/admin/ui/admin-review-conta | includes a count() |
| 6 | `adminUser.getDetail` | query | admin | 1 | The user detail sheet: `features/admin/ui/admin-user-sheet.tsx`. | includes a count() |
| 7 | `adminUser.list` | query | admin | ? | The admin users table: `features/admin/ui/admin-users-container. | includes a count() |
| 8 | `adminUser.listSessions` | query | admin | 1 | The sessions block inside the user sheet: `features/admin/ui/adm | — |
| 9 | `agent.getSessionHistory` | query | protected | 1 | The chat transcript: `features/agent/ui/agent.tsx`. | — |
| 10 | `agent.listSessions` | query | protected | ? | The chat session rail: `features/agent/ui/agent.tsx`. | — |
| 11 | `analysis.getAnalysis` | query | protected | 1 | **No web caller.** CLI only (`packages/cli/src/commands/pr/pr.se | — |
| 12 | `analysis.getAvailableDocs` | query | protected | 1 | The docs tab's file list: `features/repo-docs-viewer/ui/repo-doc | — |
| 13 | `analysis.getById` | query | protected | 1 | The fix detail panel: `features/repo-analytics/ui/repo-metrics.t | — |
| 14 | `analysis.getByPRNumber` | query | protected | ? | The PR detail panel: `features/repo-pulls/ui/repo-pull-details-c | — |
| 15 | `analysis.getByRepository` | query | protected | 1 | Fix list — **in the web app only as an invalidation target** (`r | — |
| 16 | `analysis.getComments` | query | protected | 1 | The review-comment list in the PR detail pane: `features/repo-pu | — |
| 17 | `analysis.getDetailedMetrics` | query | protected | 1 | The metrics panel: `features/repo-analytics/ui/repo-metrics-cont | — |
| 18 | `analysis.getDocumentContent` | query | protected | 2 | The rendered document body: `features/repo-docs-viewer/ui/repo-d | includes a count() |
| 19 | `analysis.getFileActionResult` | query | protected | ? | Polls the audit result into the code browser: `features/repo-cod | — |
| 20 | `analysis.getHistory` | query | protected | 1 | The version dropdown: `features/repo/ui/repo-version-selector.ts | 22 ms @4979 → capped 500 |
| 21 | `analysis.getLatest` | query | protected | 1 | Live progress view: `features/repo-setup/ui/repo-analysis-live.t | — |
| 22 | `analysis.getNodeContext` | query | protected | ? | The node detail panel, in **three** places: `features/repo-map/u | — |
| 23 | `analysis.getRepoConfig` | query | protected | 1 | The PR-analysis settings card: `features/repo-settings/ui/pr-ana | — |
| 24 | `analysis.getStagedFiles` | query | protected | ? | The PR draft sheet's staged-file list: `features/repo/ui/pr-draf | — |
| 25 | `analysis.getStructureMap` | query | protected | 1 | The repo map canvas: `features/repo-map/ui/repo-map-container.ts | — |
| 26 | `analysis.getStructureNode` | query | protected | 1 | The floating node card in the map (`features/repo-docs-viewer/ui | — |
| 27 | `analysis.getWithGraphLinks` | query | protected | 1 | **Unresolved** — see below. | — |
| 28 | `analysis.getWorkspace` | query | protected | 1 | The repo overview tab (`features/repo-analytics/ui/repo-overview | — |
| 29 | `analysis.highlightFile` | query | protected | ? | **Unresolved** — no in-app caller found. | — |
| 30 | `analysis.listByRepository` | query | protected | 1 | The PR list table: `features/repo-pulls/ui/repo-pulls-list-conta | 3 ms @1990 → capped 500 |
| 31 | `analysis.searchWorkspace` | query | protected | 2 | The workspace search box: `features/repo-analytics/ui/repo-works | — |
| 32 | `analytics.getDashboardStats` | query | protected | 1 | **The whole dashboard page.** Three components call it with byte | **485 ms** (raw SQL, whole dashboard) |
| 33 | `analytics.getTrends` | query | protected | 1 | A per-repo trend chart: `features/repo-analytics/ui/repo-trends- | one statement |
| 34 | `apikey.list` | query | protected | 1 | The API-keys page: `features/api-keys/ui/api-keys-list-container | **220 ms** — unbounded, no `where` |
| 35 | `audit.getActivityLogs` | query | protected | 1 | The activity feed: `features/audit-logs/ui/audit-logs-container. | includes a count() |
| 36 | `audit.getLogPayloadHtml` | query | protected | 1 | The payload sheet opened from a feed row: `entities/audit-log/ui | — |
| 37 | `bannedEmail.list` | query | admin | ? | The banned-emails table: `features/admin/ui/admin-banned-emails- | includes a count() |
| 38 | `githubApp.getGithubInstallUrl` | query | protected | ? | The "Install GitHub App" button: `features/connections/ui/connec | — |
| 39 | `githubApp.getMyGithubRepos` | query | protected | ? | The connected-repositories list and the create dialog: `connecti | — |
| 40 | `githubBrowse.getBranches` | query | protected | ? | Branch dropdown during repo setup: `entities/repo/model/use-repo | — |
| 41 | `githubBrowse.getFileContent` | query | protected | ? | The file viewer: `features/repo-code-viewer/ui/repo-code-contain | — |
| 42 | `githubBrowse.getRepoFiles` | query | protected | ? | The file-selection tree during setup: `use-repo-setup.ts`. | — |
| 43 | `githubBrowse.searchGithub` | query | protected | ? | The GitHub repo search in the create dialog: `create-repo-dialog | — |
| 44 | `health.check` | query | protected | 1 | **Unresolved** — no caller in `apps/web/src`. The public status  | — |
| 45 | `notification.getAll` | query | protected | ? | The notifications page list (`features/notifications/ui/notifica | includes a count() |
| 46 | `notification.getStats` | query | protected | 1 | The unread badge, in **three** components: the sidebar nav item  | **52 ms** groupBy |
| 47 | `repo.getAll` | query | protected | ? | The main repositories table: `features/repo/ui/repo-list-contain | includes a count() |
| 48 | `repo.getByName` | query | protected | 1 | Server-component fetch, not a client hook: `server/modules/repos | — |
| 49 | `repo.getByOwner` | query | protected | 1 | Server-component fetch: `repo.fetchers.ts:9`. | — |
| 50 | `repo.getSlim` | query | protected | 1 | Four consumers: the sidebar repo list (`widgets/app-sidebar/ui/a | includes a count() |
| 51 | `user.getActiveSessions` | query | protected | ? | The sessions list: `features/sessions/ui/sessions-list.tsx:27`. | — |
| 52 | `user.getLinkedAccounts` | query | protected | ? | The connections list: `features/connections/ui/connections-list- | includes a count() |
| 53 | `user.me` | query | protected | 1 | **No web caller.** Only `utils.user.me.invalidate()` in the web  | — |
| 54 | `adminUser.deleteUser` | mut | admin | 3 | Delete confirm: `use-admin-user-actions.ts`. | includes a count() |
| 55 | `adminUser.revokeSession` | mut | admin | ? | Revoke button in `admin-user-sessions.tsx`. | — |
| 56 | `adminUser.setBanned` | mut | protected | ? | не картирована | — |
| 57 | `adminUser.setRole` | mut | protected | ? | не картирована | — |
| 58 | `agent.createSession` | mut | protected | ? | New-chat button. | — |
| 59 | `analysis.analyze` | mut | protected | ? | "Analyse" button in the repo setup flow: `entities/repo/model/us | — |
| 60 | `analysis.applyFix` | mut | protected | 3 | **No web caller.** Only `server/modules/agent/agent.tools.ts:35` | — |
| 61 | `analysis.cancel` | mut | protected | ? | Cancel button on the live progress view: `features/repo-setup/ui | — |
| 62 | `analysis.clearStaging` | mut | protected | ? | Clear-staging in the PR draft sheet. | — |
| 63 | `analysis.configureRepository` | mut | protected | 2 | Same settings card. | — |
| 64 | `analysis.createFix` | mut | protected | ? | "Create fix" in the PR detail content: `features/repo-pulls/ui/r | — |
| 65 | `analysis.documentFile` | mut | protected | ? | "Document this file" in the code browser: `features/repo-code-vi | — |
| 66 | `analysis.openPullRequest` | mut | protected | 3 | "Open pull request" in the PR draft sheet: `pr-draft-sheet.tsx`. | — |
| 67 | `analysis.pinAuditToDocs` | mut | protected | ? | "Pin to docs" in the code browser: `repo-code-browser.tsx`. | — |
| 68 | `analysis.postCommentToPR` | mut | protected | ? | Post-review-comment action: `repo-pull-details-content.tsx`. | — |
| 69 | `analysis.quickFileAudit` | mut | protected | ? | "Quick audit" in the code browser: `repo-code-browser.tsx`. | — |
| 70 | `analysis.stageFile` | mut | protected | ? | не картирована | — |
| 71 | `analysis.stageGeneratedFix` | mut | protected | 1 | Stage-from-fix buttons: `features/repo-analytics/ui/repo-metrics | — |
| 72 | `analysis.unstageFile` | mut | protected | ? | не картирована | — |
| 73 | `apikey.create` | mut | protected | ? | не картирована | **220 ms** — unbounded, no `where` |
| 74 | `apikey.revoke` | mut | protected | ? | не картирована | **220 ms** — unbounded, no `where` |
| 75 | `apikey.touch` | mut | protected | 1 | **Unresolved** — no caller in `apps/web/src` or `packages/cli/sr | **220 ms** — unbounded, no `where` |
| 76 | `apikey.update` | mut | protected | ? | не картирована | **220 ms** — unbounded, no `where` |
| 77 | `bannedEmail.create` | mut | admin | ? | Add-banned-email form: `features/admin/model/use-banned-email-ac | — |
| 78 | `bannedEmail.remove` | mut | admin | 1 | Remove button: `use-banned-email-actions.ts`. | — |
| 79 | `githubApp.saveInstallation` | mut | protected | ? | Install callback only. | — |
| 80 | `notification.deleteOne` | mut | protected | ? | не картирована | — |
| 81 | `notification.deleteRead` | mut | protected | ? | не картирована | — |
| 82 | `notification.markAllAsRead` | mut | protected | ? | не картирована | — |
| 83 | `notification.markAs` | mut | protected | ? | не картирована | — |
| 84 | `repo.create` | mut | protected | ? | Create-repo dialog: `features/repo/ui/create-repo-dialog.tsx`. | — |
| 85 | `repo.delete` | mut | protected | ? | не картирована | — |
| 86 | `repo.deleteAll` | mut | protected | ? | не картирована | — |
| 87 | `repo.deleteByOwner` | mut | protected | ? | не картирована | — |
| 88 | `user.deleteAccount` | mut | protected | ? | не картирована | — |
| 89 | `user.disconnectAccount` | mut | protected | ? | не картирована | — |
| 90 | `user.removeAvatar` | mut | protected | ? | не картирована | — |
| 91 | `user.revokeSession` | mut | protected | ? | Revoke button: `sessions-list.tsx:48`. | — |
| 92 | `user.updateUser` | mut | protected | ? | не картирована | — |

итого: 92 {'query': 53, 'mut': 39}

`query` procedures are the 53 that could in principle be measured end to end. The
39 `mut` ones are not run against the fixture: they write, and every other number here depends on
this database staying as it is.

## 7. Per-procedure, measured end to end

Production build, 1 VU, 6 iterations, 80 ms pacing, `RATE_LIMIT_ENABLED=false` so the rate
limiter's Upstash round trip is out of the picture. 39 of the 47 query procedures are in the
table; the 8 that are not follow with the reason.

**Read `above floor` first.** Every authenticated request pays a session lookup against Upstash,
which from this host costs about **260 ms**. That is environmental, not the application:
`/api/status`, which skips the tRPC stack, answers in 16 ms. The last column is what the
procedure itself costs on top of that floor, and it is the only part that would change if its
query got faster.

| # | procedure | p50 | p95 | above floor | verdict |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | `apikey.list` | 8.5 s | 8.8 s | +8.2 s ms | **critical** |
| 2 | `user.getActiveSessions` | 982 | 1.0 s | +722 ms | **slow** |
| 3 | `githubBrowse.getRepoFiles` | 888 | 1.4 s | +628 ms | **slow** |
| 4 | `analysis.getById` | 527 | 625 | +267 ms | **slow** |
| 5 | `analysis.getStagedFiles` | 489 | 548 | +229 ms | **slow** |
| 6 | `repo.getAll` | 330 | 349 | +70 ms | watch |
| 7 | `analytics.getDashboardStats` | 321 | 364 | +61 ms | watch |
| 8 | `analysis.getByPRNumber` | 311 | 418 | +51 ms | watch |
| 9 | `agent.getSessionHistory` | 309 | 471 | +49 ms | watch |
| 10 | `analytics.getTrends` | 307 | 651 | +47 ms | watch |
| 11 | `notification.getAll` | 307 | 336 | +47 ms | watch |
| 12 | `adminReview.list` | 304 | 386 | +44 ms | watch |
| 13 | `repo.getSlim` | 300 | 516 | +40 ms | at the floor |
| 14 | `adminAudit.list` | 298 | 321 | +38 ms | at the floor |
| 15 | `adminUser.list` | 298 | 324 | +38 ms | at the floor |
| 16 | `bannedEmail.list` | 294 | 309 | +34 ms | at the floor |
| 17 | `audit.getActivityLogs` | 292 | 323 | +32 ms | at the floor |
| 18 | `analysis.getComments` | 284 | 307 | +24 ms | at the floor |
| 19 | `user.getLinkedAccounts` | 281 | 349 | +21 ms | at the floor |
| 20 | `adminAudit.payloadHtml` | 280 | 404 | +20 ms | at the floor |
| 21 | `adminUser.listSessions` | 277 | 331 | +17 ms | at the floor |
| 22 | `agent.listSessions` | 275 | 319 | +15 ms | at the floor |
| 23 | `githubApp.getMyGithubRepos` | 273 | 289 | +13 ms | at the floor |
| 24 | `health.check` | 272 | 342 | +12 ms | at the floor |
| 25 | `analysis.getAvailableDocs` | 271 | 292 | +11 ms | at the floor |
| 26 | `githubApp.getGithubInstallUrl` | 271 | 396 | +11 ms | at the floor |
| 27 | `repo.getByName` | 271 | 285 | +11 ms | at the floor |
| 28 | `adminUser.getDetail` | 269 | 346 | +9 ms | at the floor |
| 29 | `analysis.listByRepository` | 267 | 289 | +7 ms | at the floor |
| 30 | `analysis.getByRepository` | 267 | 330 | +7 ms | at the floor |
| 31 | `analysis.getLatest` | 266 | 419 | +6 ms | at the floor |
| 32 | `analysis.getAnalysis` | 266 | 333 | +6 ms | at the floor |
| 33 | `analysis.getRepoConfig` | 265 | 403 | +5 ms | at the floor |
| 34 | `adminAudit.detail` | 264 | 297 | +4 ms | at the floor |
| 35 | `analysis.getHistory` | 264 | 267 | +4 ms | at the floor |
| 36 | `notification.getStats` | 261 | 341 | +1 ms | at the floor |
| 37 | `repo.getByOwner` | 261 | 314 | +1 ms | at the floor |
| 38 | `user.me` | 258 | 330 | +-2 ms | at the floor |

The floor is the three procedures that barely touch the database: `health.check` (272 ms),
`user.me` (258 ms), `repo.getByOwner` (261 ms).

### The one that matters

`apikey.list` at **8.5 s** is thirty times the next procedure and 32x the floor. Its SQL is not the
problem — `SELECT id, prefix, hashed_key FROM api_keys` measures 220 ms. The procedure selects
**all 100 000 rows with no `where`**, eight columns instead of three, and serialises the lot. It is
a `protectedProcedure`, so any authenticated user can spend nine seconds of the server on one
request. It is the only procedure here where the cost is genuinely the result set rather than the
query.

`githubBrowse.getRepoFiles` (888 ms) and `githubApp.getGithubInstallUrl` are external GitHub calls,
not database work, and would read differently from a network that can reach GitHub.

### Not measurable on this fixture, and why

| procedure | reason |
| --- | --- |
| `adminReview.detail` | the seed writes `risk_score` 0-100 while the schema caps it at 10; **720 659 of 809 342 rows (89%) are out of range**, so the input parse rejects nearly every one |
| `analysis.getWorkspace`, `getDetailedMetrics`, `getStructureMap`, `searchWorkspace` | 500 — the seeded `resultJson` carries no structure for the structure map to read |
| `analysis.getDocumentContent`, `getWithGraphLinks`, `getFileActionResult` | "not found" — the chosen repository has no documents or fixes |
| `audit.getLogPayloadHtml` | the log must belong to the calling user |

The `risk_score` mismatch is the interesting one: not an app bug, but it means this clone cannot
exercise the procedure at all, and that every `riskScore` measured here sits on a distribution
the application never produces.

## 5. What could not be measured, and why

- **Per-procedure end-to-end latency.** `bench:http` covers 6 endpoints and its absolute numbers
  are dominated by a ~530 ms per-request Upstash round trip from this host (`proxy.ts` applies the
  global rate limiter to every route not in its bypass list, and `/api/trpc` is not among them).
  To get clean per-procedure numbers the limiter's cost has to come out of the measurement first.
- **Every procedure under a real account.** The session in the stress database belongs to a user
  with no repositories, so per-user shapes would measure empty result sets. A session for the
  5 449-repository owner would make that honest; forging one failed because better-auth rotates
  the token on `session.updateAge`, so the usable cookie only exists in the browser.
- **Admin procedures.** 15 of the 92 are `adminProcedure` and need an admin session; the seeded
  admin accounts are banned.
- **39 mutations.** Not run: they write, and the fixture is the reference for every other
  measurement. Their SQL shapes are covered at the query level.
- **`notifications_body_trgm_idx` (227 MB) and `audit_logs_request_id_idx` (204 MB).** The two
  largest indexes. `idx_scan = 0` on a clone is not evidence of deadness, so removing them needs
  production observation.

## 8. Mutations, measured

**31 of the 38 mutations returned 2xx and could be timed** — 19 create/update plus 12 destructive.
All of them sit within ~250 ms of the same network floor as the queries, so **the write path costs
nothing extra on top of it**, which is worth stating because `db.ts:159` doubles every mutation
with an audit row and that overhead never appears.

### Destructive, against `dxnx_web_test`

Run separately with `BENCH_DESTRUCTIVE=1` against the disposable test database — 24 tables, no
repositories of its own — with a second administrator present so the admin mutations had something
to act on.

| mutation | p50 | | mutation | p50 |
| --- | ---: | --- | --- | ---: |
| `repo.deleteByOwner` | 256 ms | | `bannedEmail.remove` | 268 ms |
| `apikey.revoke` | 265 ms | | `notification.deleteOne` | 279 ms |
| `user.removeAvatar` | 282 ms | | `notification.deleteRead` | 273 ms |
| `repo.delete` | 280 ms | | `user.deleteAccount` | 270 ms |
| `repo.deleteAll` | 291 ms | | `analysis.clearStaging` | 496 ms |
| `adminUser.revokeSession` | 740 ms | | | |

`adminUser.revokeSession` is the one destructive mutation that clears sessions in the primary
store as well, which is the extra round trip.

### The writes that cost more than the floor

| mutation | p50 | p95 |
| --- | ---: | ---: |
| `analysis.stageFile` | 1.4 s | 1.4 s |
| `analysis.createFix` | 2.0 s | 2.0 s |
| `analysis.unstageFile` | 806 ms | 806 ms |
| `analysis.documentFile` | 692 ms | 692 ms |
| `apikey.create` | 6.4 s | 6.4 s |

`stageFile` and `unstageFile` key their Redis entry at `pr-stage:{userId}:{repoId}`, so they pay the
same Upstash round trip that sets the session-lookup floor — not a database cost.
`documentFile`, `quickFileAudit` and `analyze` carry an AI audit call or start a Trigger.dev run.
`apikey.create` at 6.4 s is key generation and encryption, and is the outlier worth watching.

### Not measured, and why

| mutation | reason |
| --- | --- |
| `repo.create` | needs a live GitHub token — "GitHub token expired" |
| `githubApp.saveInstallation` | needs a signed GitHub OAuth `state`; cannot be forged outside the install flow |
| `analysis.postCommentToPR`, `analysis.openPullRequest` | need a real pull request in a connected repository |
| `analysis.pinAuditToDocs` | needs a live audit result — "Audit result expired or not found" |
| `analysis.stageGeneratedFix` | the seeded fix is not in a stageable state |
| `analysis.cancel` | no analysis exists in the disposable test database |
| `bannedEmail.create` | works standalone; the harness reused one address across runs and hit the unique index |
| `user.revokeSession` | refuses to revoke the caller's own active session |
| `adminUser.deleteUser` | the target administrator still holds relations the procedure guards |

Five of the nine need GitHub rather than the database. That is a hard boundary for this fixture.

## 9. Why four mutations were slow — two were not

Re-measured with 10 iterations instead of one:

| mutation | first reading (1 sample) | p50 (10 samples) | verdict |
| --- | ---: | ---: | --- |
| `apikey.create` | 6.4 s | **282 ms** | measurement artefact |
| `analysis.createFix` | 2.0 s | **534 ms** | measurement artefact |
| `analysis.stageFile` | 1.4 s | **1.0 s** | real |
| `analysis.unstageFile` | 806 ms | **831 ms** | real |

A single-sample p50 is the sample. Both "slow" outliers were noise from a 1-iteration run against a
production server — the same failure the plan's Task 1 was written to prevent, reproduced inside
my own harness.

### The two real ones are round-trip counts, not work

Neither touches the database. `stageFile` is one call into `src/server/core/redis.ts:138`:

```ts
await redisClient.hset(key, entries);
await redisClient.expire(key, REDIS_CONFIG.ttl.prStaging);
return redisClient.hlen(key);
```

**Three sequential Upstash round trips** for one logical operation. `removeFile`
(`redis.ts:174`) is the same shape, two. At the ~300 ms per Upstash call measured from this host,
three round trips is 900 ms — which is the 1.0 s observed, and `removeFile` accounts for the 831 ms.

`@upstash/redis` pipelines over its HTTP API, so these were **three round trips that could be one
request**. Both sites now build one pipeline (`src/server/core/redis.ts:138,174`):

```ts
const pipeline = redisClient.pipeline();
pipeline.hset(key, entries);
pipeline.expire(key, REDIS_CONFIG.ttl.prStaging);
pipeline.hlen(key);
const results = await pipeline.exec();
return results.at(-1) as number;
```

| mutation | before | after | |
| --- | ---: | ---: | --- |
| `analysis.stageFile` | 1.0 s | **538 ms** | three round trips → one |
| `analysis.unstageFile` | 831 ms | **547 ms** | two → one |

`analysis.createFix` did not move (534 ms → 538 ms), which confirms it was never on the Redis
path — its cost is its own, and the earlier 2.0 s reading was noise.

### The pipeline was verified end to end, not by its status code

A pipeline can drop commands and still return 200, so all three were checked against Redis
directly after the rebuild:

| check | result |
| --- | --- |
| `hset` — content round-trips | `src/verify-a.ts → 'ALPHA_CONTENT'`, `src/verify-b.ts → 'BETA_CONTENT'` |
| `expire` — TTL actually set | `TTL pr-stage:…` returned **86378 s** |
| `hlen` — count from the same round trip | `stagedCount` 1 → 2 across two calls |
| ordering — `hlen` reflects the `hset` before it | yes, the second call returned 2 |

## 10. The `@omit` sweep

`adminReview.detail` failed because `PullRequestAnalysis.repoId` is `@omit`, and ZenStack strips an
omitted field from the result **however it is selected** — so a select asking for it yields
`undefined`, and a schema requiring it rejects the whole response. Worth asking whether it happens
elsewhere, so: **31 omitted fields across 21 models**, and every site that selects one.

The discriminator is that `@omit` is a ZenStack feature and applies only through the `enhance()`d
client. Ten of the thirteen direct selects use the raw `prisma` singleton, where `@omit` has no
effect. Cross-referencing those ten with their call sites:

| site | client | conclusion |
| --- | --- | --- |
| `github-access-token.ts:14` | `prisma` | safe |
| `analysis-progress.ts:46` | `prisma` | safe |
| `analyze-pr.task.ts:67`, `init.ts:124,148,168` | `prisma` / `getTaskPrisma()` | safe |
| `github-app.service.ts:207,271` | `prisma` / `tx` | safe |
| `admin-user.service.ts:264` | `prisma` | safe |
| `user.service.ts:98,199` | `prisma`, one says so in a comment | safe |
| `issue-comment-webhook-handler.ts:28,58` | `prisma` | safe |

**`admin-review.service.ts` was the only one.** The class is a single occurrence, and it is fixed
and covered by a test that fails when the relation read is reverted.

Worth keeping as a rule: an output schema that requires an omitted field is unsatisfiable, and the
failure presents as a data problem rather than a schema one.

## 9. pgbench

Verified working and adopted — the plan's claim that it was absent from the image was wrong.
4619 tps at 0.761 ms average on three app shapes at four clients; details and the `×1250`
subquery result are in [`db-tooling.md`](./db-tooling.md).

## 10. `adminReview.detail` — a real bug, not a fixture problem

It failed with `400`, `repoId: expected string, received undefined`. The first two explanations
were both wrong:

- Not `risk_score`. The schema says `review.zmodel:89` is `min(0).max(10)` and the seed generated
  0–100, so the ranges did disagree — but the clone's values are all inside 0–10 now, and the
  error names `repoId`.
- Not a missing column. `pull_request_analyses.repo_id` is populated on all 809 342 rows.

The actual cause is one line of schema:

```prisma
// review.zmodel:100
repoId  String  @map("repo_id") @db.Uuid @omit
```

`@omit` makes ZenStack strip the field from the result **however it is selected**. `REVIEW_SELECT`
asked for `repoId: true`, received nothing, and `AdminReviewDetailSchema` requires
`repoId: z.uuid()` — so the procedure answered 400 for **every row, in every environment**. Not a
seeding artefact and not a performance question: a procedure that could never have worked.

`AdminReviewSummarySchema` has no `repoId`, which is why `adminReview.list` works and only
`detail` does.

**Fixed** by reading the id through the relation — `repo: { select: { id: true } }` — which is the
pattern already used for `documents.analysis.id`. The dead `repoId: true` was removed from
`REVIEW_SELECT` so the next reader does not try it again.

**Why it survived:** `adminReview.service.ts` had no test file at all. There is now
`admin-review.service.test.ts`, asserting the detail payload satisfies its own output schema. With
the fix reverted the test fails on `expected undefined to be '0192f0c1-…'`.

Worth noting for the rest of the schema: `@omit` on a foreign key is invisible at the call site.
Any output schema that requires an omitted field is unsatisfiable, and the failure looks like a
data problem rather than a schema one.
