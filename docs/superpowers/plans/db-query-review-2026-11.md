# Query, cache and fan-out review — round 2 (2026-11-01, revalidated 2026-11-14)

Live checklist for the second static pass over `apps/web`. Companion to
[`db-optimization-progress.md`](../../db/db-optimization-progress.md) (round 1 board, IDs `P*` /
`C*`), [`db-query-inventory.md`](../../db/db-query-inventory.md) (what every call site is for),
[`db-index-audit.md`](../../db/db-index-audit.md) (what the shapes cost) and
[`db-ui-map.md`](../../db/db-ui-map.md) (where latency lands).

**Closed: 13 / 36.** Last pass: R2, R4, R5, R8, R27, R33 — all merged in `311bd6a7` (2026-11-01,
PR #2356). Revalidated 2026-11-14 on `e48fcdec`; R3, R6, R7, R9, R19, R21 and K2 closed 2026-11-15,
and R14 and R30 are **partially** done (see the item text and the progress note below the
scoreboard).

## What this round covers that round 1 did not

Round 1 was about the database itself: index A/B, statement shapes, `pg_stat_statements`,
pagination. This pass follows the call graph through the *layers that multiply* a database
operation into several:

| layer | file | round 1 | this round |
| --- | --- | --- | --- |
| Prisma extension (`audit log` + Ably per write) | `core/db.ts` | not covered | R1 |
| API-key gate (`lastUsed` write per request) | `core/auth/verify-api-key.ts` | not covered | R3 |
| Workspace resolution on every procedure | `core/workspaces/resolve-workspace.ts` | mentioned only as a count | R5 |
| Redis (`core/redis.ts`) | pipeline use | not covered | FP4 — clean |
| Ably publish fan-out | `core/realtime.ts` | not covered | R1, R10, R32 |
| Trigger.dev task lifecycle + enqueues | `modules/**/tasks/*` | not covered | R12, R17 |
| Client-side realtime → refetch fan-out | `app/_components/realtime/` | not covered | R10 |
| Typed SQL | `prisma/sql/*.sql` | measured | R34, K1 |

There is no `sql/` directory under `apps/web/src`. Raw SQL lives in `prisma/sql/*.sql` — **five**
files at the last pass; the four this round reviewed are `getAccountForUpdate`, `getDashboardStats`,
`getOnboardingState` and `getTrends`. `getBillingUsageDays.sql` arrived in `#2386` (2026-11-08),
after this round closed, and is a round-3 candidate; inline `$executeRaw` for advisory locks was
reviewed and is correct.

## How to use this file

1. One checkbox per item. Tick it when the change is in the branch **and** the verification line
   passes; the closing log's `commit` column names the commit that did it.
2. Move the ID into the closing log at the bottom with the date and the commit that did it.
3. If the item was rejected after inspection, tick it and write `dropped — <reason>` instead of a
   commit. Round 1 retracted two items (`P8`, `P10`); that is a normal outcome, not a failure.
4. Keep the numbers in **Closed: n / 36** in sync.
5. A ticked item keeps the description written at review time, so its "What/Why" describes the
   **old** shape on purpose; the closing log is the record of what changed. Where a line range no
   longer points at the described code, the item says so inline.

## What this document is not

- **No benchmarks were run for this round.** Round 1 has the measured baselines; every "cost"
  claim below is derived from the call graph, the number of awaited operations on a path, and the
  shape of what is selected. Where a size is unknown (how large `resultJson` actually is per
  repo) the text says so.
- **Counts are Prisma operations, not TCP round trips.** `relationJoins` is enabled
  (`prisma/models/base.zmodel`, `prisma/schema.prisma`), so a nested `include` is resolved inside
  one statement. `db-ui-map.md` records this as derived-from-flag rather than instrumented; the
  same caveat applies here. Two *separate* `await db…` calls are always two operations.
- **Severity is impact × frequency**, not elegance. R1 is CRITICAL because it applies to every
  write in the product; R4 is HIGH because it is one heavy read per analysis run.

---

## Scoreboard

| severity | items | IDs |
| --- | ---: | --- |
| CRITICAL | 3 | R1–R3 |
| HIGH | 7 | R4–R10 |
| MEDIUM | 13 | R11–R23 |
| LOW | 11 | R24–R34 |
| correctness (adjacent) | 2 | K1–K2 |
| verified clean (do not re-report) | 11 | FP1–FP11 |

### Progress since the last pass (2026-11-15)

R14 and R30 moved without closing: their verification lines still fail, so the checkboxes stay
unticked and the item text below says what is left. R3 (the third partial item from the last pass),
R6, R7, R9, R19, R21 and K2 have since closed (see the closing log).

- **R14** — `getWorkspace` no longer reads every document when `aid` is set (fixed by R33, `311bd6a7`),
  and `getDocumentContent` now reads a narrow ref with a capped document read (2026-11-15). Still
  open: the per-keystroke structure rebuild in `searchWorkspace`.
- **R30** — the PR and push webhook handlers now `select` narrow columns
  (`pr-webhook-handler.ts:167`, `push-webhook-handler.ts:28`). Still open:
  `issue-comment-webhook-handler.ts:17` and `review-comment-webhook-handler.ts:20` read full repo
  rows.

---

## Invariants this round establishes

- A read that gates **access** (`workspace_members`) or **spend** (`workspace_usage`) may be
  deduped *within* a request (`src/server/utils/request-memo.ts`) and must never be cached *across*
  requests. For those two rows staleness is a security or quota bug, not a latency trade-off, so
  Redis is the wrong layer: it would need invalidation on every membership, workspace, user, role
  and Stripe-projection change, and a point lookup by unique index is not the bottleneck.
- A read that is only **display** data (dashboard aggregates, repo lists, onboarding hints) may be
  cached across requests, because it already has an invalidation source in the realtime events.

---

## CRITICAL

- [ ] **R1 · The audit interceptor turns every write into 2–3 operations and a second pooled connection**
  — `src/server/core/db.ts:167-262`
  - Design options, the outbox comparison and the migration plan for this layer:
    [`audit-log-architecture.md`](./audit-log-architecture.md). Nothing there is implemented as of
    2026-11-14.
  - **What:** `$allOperations` runs `baseClient.auditLog.create(...)` (`:202`) after every audited
    `create/update/upsert/delete` (and the `*Many` variants — `core/audit-operations.ts`), after
    `sanitizePayload(args)` serializes the whole `args` object (`:194`). For models in
    `AUDIT_BUSINESS_MODELS` it additionally publishes
    `REALTIME_CONFIG.events.user.auditUpdated` to Ably (`:214-218`) and logs at `info`.
    `baseClient` is the *unextended* client, i.e. a different pool connection than any open
    transaction.
  - **Why it costs:** every audited write = +1 INSERT into `audit_logs` + 1 full JSON walk of the
    payload (+1 Ably REST call, +1 log line). `saveResults`
    (`analysis/services/analysis-lifecycle.service.ts:339-522`, transaction at `:418-491`) performs
    **8** audited writes in one `$transaction` (analysis update, user updateMany, 5 document
    upserts, notification create) → 8 audit INSERTs, 7 of them also publishing to Ably, each INSERT
    on a second connection while the transaction holds its own. `pg.Pool` is created with defaults
    in `createPgPool` (`:83-100`), so 10 connections; concurrent analyses push `waitingCount`. In
    Trigger.dev there is no `next/server` `after()` in the task runtime, so `runAsBackgroundTask`
    (`:46-76`) falls through to `await task()` in production — the audit write is synchronous
    inside the task and, for `$transaction` callers, while the transaction is open.
  - **Fix direction:** exclude bookkeeping-only writes (`lastUsed`, `revoked` flags, `progress`
    milestones) from the audited operation set; batch the Ably publish per request instead of per
    write; make `runAsBackgroundTask` never await in a task context (queue or drop instead), or
    pass the `tx` client so the INSERT joins the caller's transaction.
  - **Effort:** M · **Verify:** `audit_logs` rows per analysis completion == number of *semantic*
    events (not 8); no `poolWaiting > 0` in the `db.slow` payload during a 3-way parallel
    analysis; Ably publish count per analysis run drops accordingly.
  > Progress 2026-11-15: `ApiKey.lastUsed` and `Notification.isRead` writes are no longer audited,
  > and the Ably publish is coalesced to one per request. `Analysis.progress` stays as a guard only —
  > every write carrying it also carries `logs`/`message`/`status`. The "not 8 rows" target still
  > needs `audit-log-architecture.md` step 2.

- [x] **R2 · `repo.getByName` / `getByOwner` read `resultJson`, `metricsJson` and `logs` to render a header**
  — `src/server/modules/repos/repo.service.ts:248-276`
  - **What:** `findFirst({ include: { analyses: { orderBy, take: 1 } } })` with **no `select`**.
    Callers use only `repoMapper.toPublicFields(repo)` and `repoMapper.latestStatus(analyses)`.
    `getByOwner` (`:264`) selects no columns at all.
  - **Why it costs:** `result_json` is the full AI result (`buildResultToStore` —
    `logic/analysis-scoring.ts:49-75`: facts, findings, vulnerabilities, route inventory) and
    `metrics_json` is `RepoMetrics` (languages, hotspots, coupling, mostComplexFiles); both are
    unbounded `Json?`. They are read on **every** repository page: `repoFetchers.getRepoOrNotFound`
    (`repos/repo.fetchers.ts:18-30`) is used by the repo layout plus `map`, `code`, `docs`,
    `pulls`, `settings`, `analyze` pages. `react.cache` collapses layout+page into one call per
    render, but every navigation still pays one fat SELECT.
  - **Fix direction:** reuse `repoWithLatestAnalysisSelect` (`analysis.repository.ts:51-70`, 24
    narrow fields) or add a `latestStatusSelect = { analyses: { take: 1, select: { status: true } } }`.
  - **Effort:** XS · **Verify:** `EXPLAIN (ANALYZE, BUFFERS)` on the repo-page query shows
    `rows`/`width` without the JSON columns; `repo.getByName` response unchanged in the UI.

- [x] **R3 · API-key gate does a full joined read, and its throttled write still audits**
  — `src/server/core/auth/verify-api-key.ts:31-74`
  - **What:** `prisma.apiKey.findUnique({ include: { user: true } })` (`:36-39`) with no `select`
    (both rows in full). The per-request write was addressed in `546a0750` (2026-11-03):
    `lastUsed` is refreshed only when older than `LAST_USED_REFRESH_MS` (1 h, `:7`) and through
    `updateMany` in `runAsBackgroundTask` (`:63-70`).
  - **Why it costs:** one request from the CLI / MCP surface = SELECT (join), and the hourly refresh
    still writes. `ApiKey` is in `AuditModel` and in `AUDIT_BUSINESS_MODELS`, so each refresh also
    produces an audit INSERT **and** an Ably publish (R1). The write is duplicated by design:
    `apiKeyService.touch` (`api-keys/api-key.service.ts:199`) exists for the same purpose.
  - **Fix direction:** `select` only `id, userId, workspaceId, scopes, revoked, revokedAfter,
    expiresAt` plus the user fields actually used (`banned, role, email, emailVerified, name,
    image, createdAt, updatedAt, twoFactorEnabled`); keep the `lastUsed` write out of the audit
    allow-list (or stop auditing `lastUsed`-only updates).
  - **Effort:** S · **Verify:** a burst of 100 API requests against one key produces 0 `audit_logs`
    rows for `ApiKey.update*` and at most one `UPDATE api_keys` per refresh window; `lastUsed` still
    moves. The throttle half already holds — the missing half is the `select`.
  > Done 2026-11-15 (`ad34335b`): the lookup selects only the columns the gate reads, and a
  > `lastUsed`-only update is no longer audited (that half is R1). Burst verification not run.

---

## HIGH

- [x] **R4 · `getAnalysisContext` loads two full analyses to compare one SHA**
  — `src/server/modules/analysis/logic/analysis-context.ts:45-58`
  - **What:** `prisma.analysis.findFirst({ include: { repo: { include: { analyses: { take: 1,
    where: { status: "DONE" } } } } } })`, no `select`. Consumers use `repo.*` (owner, name,
    defaultBranch, visibility) and `lastSuccessfulAnalysis.commitSha` only.
  - **Why it costs:** two full `analyses` rows — `result_json`, `metrics_json`, `logs`, `error` —
    for the current row and the previous successful one, on the start of every analysis run. The
    previous row is then thrown away after `shouldUseCache(...)`.
  - **Fix direction:** `select` on the root (`id, commitSha, repo: { select: … }`) and on the
    nested analyses (`commitSha: true`); the rest of `repo` is available from
    `assertRepoAccess` (`analysis-lifecycle.service.ts:204-218`) which already runs earlier.
  - **Effort:** XS · **Verify:** the task's first query returns only scalar/narrow columns;
    cache-hit path still detects the matching SHA (existing `analyze-repo.task.test.ts`).

- [x] **R5 · Workspace resolution is not memoised, so every `workspaceProcedure` re-queries membership**
  — `src/server/core/workspaces/resolve-workspace.ts:25-78`, `src/server/core/trpc/init.ts:234-270`
  - **What:** before `311bd6a7`, `resolveWorkspace` ran `workspaceMember.findUnique` on the header
    path, plus `workspace.findUnique` when the header was invalid and `strict`, plus
    `workspaceMember.findFirst` on the fallback. `getWorkspaceEntitlement` has a per-request memo
    (`core/entitlements.ts:81-105`, `utils/request-context.ts:13,170`); workspace resolution had
    nothing equivalent.
  - **Why it costs:** 74 `workspaceProcedure`/`entitlementProcedure`/`ownerProcedure` call sites.
    One dashboard render prefetches `workspace.myWorkspaces`, `repo.getSlim`, then the page's own
    procedures — each pays its own membership read. `workspaceService.listForUser`
    (`workspaces/workspace.service.ts:170-189`) pays it *and then* `findMany`s the same memberships.
    In the agent loop every tool call goes through `await api()` (`agent.tools.ts`, 38 call
    sites) → new caller → `isWorkspaceMember` again; `api()`/`ctxForRequest` are wrapped in
    `react.cache` (`core/trpc/server.ts:99,116`) which only dedupes inside a React render, not in
    a route handler.
  - **Fix direction:** add `workspaceMemo: Map<string, Promise<ResolvedWorkspace>>` to
    `RequestStore` and key it on `${userId}:${headerWorkspaceId}`; in `ctxForUser` the workspace is
    already known, so pass the id through instead of re-deriving it.
  - **Effort:** S · **Verify:** a single page render produces one `workspaceMember` read
    (count them with the `db.slow`/`db.write` telemetry or a temporary query counter); agent turn
    with N tool calls produces one.

- [x] **R6 · PR comments and PR findings render markdown with one cache lookup and one HTML build per row**
  — `src/server/modules/analysis/services/pr-comments.service.ts:11-62`,
  `src/server/modules/analysis/analysis.mapper.ts:166-227`
  - **What:** `pullRequestComment.findMany` has **no `take`**, then
    `comments.map(async c => unstable_cache(...markdownToHtml...)())` — one `unstable_cache` entry
    per comment with `revalidate: false`. `buildTopFindings` does the same per finding.
  - **Why it costs:** not a database N+1 — the database side is one query — but N data-cache
    lookups + N markdown/shiki renders + N permanently-retained cache entries per page view, and
    the row count is unbounded (one analysis can hold hundreds of comments; the fixture used in
    round 1 had ~2.8M comment rows overall). It is the dominant cost of `analysis.getComments`
    and `analysis.getByPRNumber`.
  - **Fix direction:** cap the fetch (`take`), render once through a single cached call keyed on
    the page (`unstable_cache` around the whole list, not per item), or return raw markdown and
    render on the client. Same for `buildTopFindings`.
  - **Effort:** S · **Verify:** a PR with 200 comments issues 1 cache lookup; p95 of
    `analysis.getComments` in `bench:http` drops; cache tag cardinality stops growing per comment.
  > Done 2026-11-15 (`d73f3abc`, key corrected in the B2 fix round): one `unstable_cache` entry per
  > page for both — `pr-comments-html-<workspaceId>-<analysisId>-<updatedAt>-<rows>` with tags
  > `["comments", analysisId, workspaceId]`, and `finding-html-<owner>-<name>-<analysisId>-<updatedAt>`
  > with tags `["findings", owner, name, analysisId]` (analysis ids are globally unique and the
  > caller already proves workspace access, so the findings key needs no workspace). An empty
  > comment page skips the cache entirely, so an arbitrary `analysisId` cannot mint an empty entry,
  > and `postCommentToPR` calls `revalidateTag(analysisId)` so a posted comment is visible.
  > Unit tests assert one lookup for a 3-comment page, one for a 3-finding page, distinct keys for two
  > workspaces on the same analysis, a miss when a row is appended or `updatedAt` moves, no lookup for
  > an empty page, and the tag revalidation. The `take` half was deliberately not done (it would
  > truncate the payload); p95 not measured.
  > Cached per workspace+analysis version with a 1 h TTL; explicit writes revalidate immediately.

- [x] **R7 · `agent.getSessionHistory` returns the entire chat with no limit and no `select`**
  — `src/server/modules/agent/agent.service.ts:75-82`
  - **What:** `chatMessage.findMany({ orderBy: { createdAt: "asc" }, where: { sessionId, session: { userId } } })`
    — no `take`, no cursor, no `select`, so `parts` (JSON: text, tool calls, attachments) for every
    message ever written to the session.
  - **Why it costs:** unbounded memory + response size on a hot UI screen; the index
    `chat_messages(session_id, created_at ASC)` exists, so the query is fast but the payload is
    not. `listSessions` (`:84-111`) is likewise unbounded (all sessions of the user) — it gained a
    `currentRepo` filter and a narrow `repo` include, but still no `take`.
  - **Fix direction:** keyset pagination on `(createdAt, id)` or a bounded tail (`take: N` from the
    end then reverse), `select` only `id, role, parts, createdAt`, and a separate endpoint for
    older pages.
  - **Effort:** S · **Verify:** a 5 000-message session returns a bounded page; response size
    stops scaling with history.
  > Done 2026-11-15 (`39d08034`): `getSessionHistory` selects `id, role, parts, createdAt`, orders
  > `createdAt: "desc"`, takes `SESSION_HISTORY_LIMIT = 200` and reverses before mapping;
  > `listSessions` takes `SESSION_LIST_LIMIT = 100` with a `select` covering every field the
  > `SessionListItemSchema` output reads plus `repoId`. The bounded horizon is silent — no "load
  > older" endpoint was added, so history past 200 messages is not reachable from the UI.
  > Follow-up 2026-11-15 (B2b): both procedures now return `{ items, meta }` pages built from the
  > shared `pagination.ts` keyset primitives (`getSessionHistory` on `(createdAt, id)`,
  > `listSessions` on `(updatedAt, id)`), so `nextCursor` reaches older rows; the UI still renders
  > the first page. The array → `{ items, meta }` change is a breaking CLI wire change; the CLI
  > ships from the same monorepo and release-please versions both together, so an older published
  > `dxnx` must upgrade. `listSessions` keysets on `updatedAt`, which moves on rename/append, so a
  > multi-page walk can duplicate or skip a row before a "load older" UI ships.
  > Follow-up 2026-11-15 (B2d): both lists load on scroll and consume `nextCursor`. History cannot
  > use an observer — `react-virtuoso` owns its scroller — so it prepends through `firstItemIndex`
  > decreased by the merged older pages and fetches from `startReached` (`HISTORY_PAGE_SIZE = 100`);
  > `renderMessage` matches the newest message by id because indices are shifted. The session list
  > uses the repo's `useIntersectionObserver` sentinel at the end of its `ScrollArea`
  > (`SESSION_PAGE_SIZE = 50`). No new user-facing copy: the prepend indicator is an `aria-hidden`
  > spinner in Virtuoso's `Header`. The prepend decision is the pure `history-window.ts` state machine
  > (`resetHistoryWindow` / `seedHistoryWindow` / `decidePrepend`) and is unit-tested, as are the
  > `filterNewMessages` and `flattenSessionPages` id-dedupes that keep a refetched page from
  > repeating a row; the sentinel gating is not, because the client tests run in the `node`
  > environment.

- [x] **R8 · The PR-webhook existence check fetches every comment and every fix of the analysis**
  — `src/server/modules/analysis/analysis.repository.ts:179-196`, used at
  `logic/pr-webhook-handler.ts:51`
  - **What:** `getByRepoAndPRNumber` uses `include: { comments: true, generatedFixes: true }`.
    The webhook only needs `id` (and `status` is not even read).
  - **Why it costs:** on every `synchronize` event of every PR — i.e. on every push to every
    monitored repo — the whole comment bodies of the previous analysis are transferred to decide
    "already analysed, skip".
  - **Fix direction:** split into `getRefByRepoAndPRNumber` (`select: { id: true }`) for the
    webhook; keep the fat variant for `pr-impact` only. `@@unique([repoId, prNumber, headSha])`
    already covers the lookup.
  - **Effort:** XS · **Verify:** webhook path logs one narrow query; duplicate-PR check still
    returns early (`analyze-pr.task.test.ts` / webhook tests).

- [x] **R9 · Usage metering writes the same `workspace_usage` row twice per event**
  — `src/server/core/usage/usage.ts:39-75`
  - **What:** `bumpUsage` = `workspaceUsage.upsert({ update: { increment } })` **plus** a second
    raw `UPDATE … GREATEST(0, …)` (`:62-75`) in the same transaction. Each LLM call performs
    `reserveUsage` (`:88`, event INSERT + upsert + UPDATE) and `settleUsage` (`:138`,
    `reservedTokensOf` SELECT + event INSERT + upsert + UPDATE), i.e. ~6–7 statements against one
    row per call.
  - **Why it costs:** every AI call in the analysis pipeline (`utils/call.ts:210-478`) and every
    agent turn serializes on `workspace_usage (workspace_id, period_start)`. Concurrent analyses in
    one workspace queue on that row; the second UPDATE also adds a second WAL record and a second
    dead tuple per event.
  - **Fix direction:** fold the clamp into the upsert with a single raw
    `INSERT … ON CONFLICT (workspace_id, period_start) DO UPDATE SET ai_tokens_used = GREATEST(0,
    workspace_usage.ai_tokens_used + EXCLUDED.ai_tokens_used), …`; or keep an append-only
    `usage_events` table and maintain the rollup once per settle.
  - **Effort:** S · **Verify:** statement count per AI call drops by one; the clamp still holds
    after a `releaseUsage` that would go negative (`usage.test.ts`).

- [ ] **R10 · One realtime event fans out into 1–5 tRPC re-fetches, including the heaviest aggregate**
  — `src/app/_components/realtime/handlers/analysis.tsx:18-48`
  (the provider was split into `src/app/_components/realtime/` in `#2386`; this is the analysis
  handler it dispatches to)
  - **What:** `analysisUpdated` → invalidate `getLatest`, `getHistory` (500 rows + `count`),
    `getStagedFiles`, `getByRepository` (no `take`), `getOnboardingState`. `analysisProgress` →
    invalidate `getOnboardingState` on **every** milestone (≈6 per run) and, on `DONE`/`FAILED`,
    `invalidate()` → `repo.getAll` + `repo.getSlim` + `analytics.getDashboardStats` +
    `getOnboardingState` (`entities/repo/model/use-repo-actions.ts:16-21`). Only
    `getDashboardStats` is patched in place during progress (`analysis.tsx:30-33`).
  - **Why it costs:** `getDashboardStats` (`analytics/analytics.service.ts:38-106`) is the single
    heaviest aggregate in the app (round 1: 5.8 s before `jit=off`, 485 ms after) and it has **no
    cache** — it re-runs on every completion, for every open client. `getOnboardingState` is a raw
    SQL with `EXISTS`/`LATERAL` subqueries, re-executed 6× per run per client. `getHistory` moves
    500 rows for a sidebar badge.
  - **Fix direction:** split the events (progress vs. completion), patch cache with
    `setQueryData` instead of invalidating for progress (already done for `getDashboardStats`
    there — extend it to onboarding), debounce/throttle invalidations per event type, drop
    `getOnboardingState` from the per-milestone path, and give `getDashboardStats` a short
    `staleTime` or a Redis/`unstable_cache` wrapper.
  - **Effort:** M · **Verify:** one analysis completion produces ≤ 2 server queries per open
    client instead of ~8; `bench:http` on `analytics.getDashboardStats` no longer shows a burst at
    completion.

---

## MEDIUM

- [ ] **R11 · No index on `analyses.commit_sha`**
  — `prisma/models/review.zmodel:44-46`
  - **What:** indexes are `[repoId, status]`, `[repoId, createdAt desc]`, `[jobId]`. Two paths
    filter on the SHA: `findCachedSha`
    (`analysis-lifecycle.service.ts:70-74`) and `getRepoBySha`
    (`analysis.repository.ts:282-301`).
  - **Why it costs:** both are served by `[repoId, status]` and then filter `commit_sha` row by
    row. `analyses` is the third-largest table in the round-1 fixture (2.77M rows); a repo with
    hundreds of analyses pays that filter on every analysis start and every PR-impact page.
  - **Fix direction:** `@@index([repoId, commitSha])` (status is cheap to recheck). Confirm with
    `bun --filter @doxynix/web bench:index-ab` before keeping it.
  - **Effort:** XS (schema + migration) · **Verify:** `EXPLAIN` uses the new index for both
    queries; `check:index-parity` stays in sync.

- [ ] **R12 · Stale-event sweep triggers Trigger.dev and updates the row inside a sequential loop**
  — `src/server/modules/billing/billing.events.ts:309-368`
  - **What:** `for (const event of stale)` → `await tasks.trigger(...)` + `await
    prisma.billingEvent.update(...)`, up to `SWEEP_BATCH_SIZE = 50`.
  - **Why it costs:** 50 sequential HTTP round trips to Trigger.dev plus 50 sequential UPDATEs,
    with the sweep holding the whole loop. One slow Trigger call stalls the rest.
  - **Fix direction:** `tasks.batchTrigger([...])` for the enqueues, one `updateMany`-shaped
    bookkeeping write per affected id set (or `Promise.all` over the updates with a bounded
    concurrency).
  - **Effort:** S · **Verify:** sweep with 50 stale events completes in 2 round trips; replay
    count/idempotency semantics unchanged (`billing.events.test.ts`).

- [ ] **R13 · Reconciliation is a per-subscription loop of 5–7 queries and 1–2 Stripe calls**
  — `src/server/modules/billing/billing.reconciliation.ts:206-300, 332-360, 401-430`
  - **What:** for every Stripe subscription: `billingCustomer.findFirst`, `billingSubscription.findUnique`,
    `currentSlotHolder`, `workspaceEntitlement.findUnique`, `workspaceMember.count`, then a
    transaction whose `projectSubscription` reads subscription + entitlement + current holder
    again. `reconcileMissingLocal` re-resolves the customer mapping that it already knows from
    `local.workspaceId`; `reconcileLedger` retrieves one invoice per ledger row.
  - **Why it costs:** linear in customer count. A thousand subscriptions ≈ 6–8k queries and 1–2k
    Stripe requests sequentially. It is a nightly cron, but it is also the job most likely to time
    out silently.
  - **Fix direction:** prefetch `billing_customers`, `billing_subscriptions` and
    `workspace_entitlements` into maps before the loop; pass the known mapping into
    `repair`; keep Stripe calls sequential (rate limits) but batch the DB reads.
  - **Effort:** M · **Verify:** query count per run scales as O(pages) for the reads instead of
    O(subscriptions); `billing.reconciliation.test.ts` still passes.

- [ ] **R14 · Whole repository snapshot loaded where two fields are needed**
  — `analysis/services/docs.service.ts:65-100`, `analysis/services/workspace.service.ts:107-137`,
    `analysis/services/workspace-search.service.ts:13-40`
  > Progress 2026-11-15: `getDocumentContent` uses a narrow repo ref and the no-aid documents read
  > is capped; the per-keystroke structure-map cache is not implemented.
  - **What:** `getDocumentContent` calls `analysisRepo.getRepoSnapshot` (which selects
    `resultJson` + `metricsJson`, `analysis.repository.ts:51-70`) to obtain `repo.name`,
    `repo.owner` and `analysis.id`, then runs a second query for the document.
    `getWorkspace` loads the snapshot **plus every document of the repo**; when `aid` is set the
    documents relation is now filtered in SQL (that half was R33 and is closed, see
    `analysis.repository.ts:376-378`), but with no `aid` there is still no `take`, so a repo with
    100 analyses reads ~500 document rows to render one version. `searchWorkspace` reloads the
    snapshot and rebuilds the full structure map from JSON on every debounced keystroke (300 ms,
    ≥2 chars, `features/repo-analytics/ui/repo-workspace-search.tsx:48-70`).
  - **Why it costs:** the docs viewer is one of the most-visited screens and pays for two
    unbounded JSON columns plus a second query; the search box pays the graph rebuild on every
    keystroke round trip.
  - **Fix direction:** a narrow `getRepoRef` (`select: { name, owner, id }` + `analysisId`), a
    `take` (or `analysisId` filter) on the no-`aid` documents read, and cache the built structure map
    per `(repoId, analysisId)` instead of rebuilding it per request.
  - **Effort:** M · **Verify:** `analysis.getDocumentContent` reads no JSON columns; search p95
    stops tracking keystrokes.

- [ ] **R15 · `revokeOtherSessions` deletes sessions one by one**
  — `src/server/modules/users/user.service.ts:268-283`
  - **What:** `session.findMany` then `Promise.all(others.map(s => deleteSession(token)))` — the
    better-auth internal adapter runs one DELETE per token **and** one secondary-storage delete
    per session (Redis).
  - **Why it costs:** N database deletes + N Redis round trips for one user action, and the same
    pattern exists in the admin path (`admin-user.service.ts:291-309`) for a single session.
  - **Fix direction:** `prisma.session.deleteMany({ where: { userId, id: { not: current } } })`
    plus one Redis `del` pipeline over the tokens that were read.
  - **Effort:** XS · **Verify:** "sign out everywhere" produces 1 SQL DELETE and 1 Redis pipeline;
    the session cookie cache is still invalidated.

- [ ] **R16 · `repos.getMyRepos` reads the GitHub token twice and queries installations twice**
  — `src/server/modules/repos/github-app.service.ts:38-98, 291-360`
  - **What:** `getMyRepos` → `syncInstallations` (`:45`) → `getValidToken` (`:296`) →
    `githubInstallation.findMany` (`:317`) → `github-api.getMyRepos` → `githubInstallation.findMany`
    + `account.findMany` (`core/github/github-api.ts:106-118`) → back in `getMyRepos`,
    `githubInstallation.findMany` (`:47`) and a **second** `getValidToken` (`:52`).
    `syncInstallations` then updates installations in a loop (`:325-360`).
  - **Why it costs:** ~6 database operations and 2 GitHub paginations to open the "add repository"
    dialog. `getValidToken` itself (`core/github/github-access-token.ts:13-26`) is a plain
    `account.findFirst` — now with a narrow `select`, but still no cache — and it is on the path of
    every GitHub call via `getClientContext` (`github-client.ts:112`).
  - **Fix direction:** pass the token/installations down instead of re-resolving; memoise
    `getValidToken` per request (and short-TTL in Redis) since `accessTokenExpiresAt` already
    tells you when it is still valid; collapse the loop into a single
    `updateMany`/`createMany` where possible.
  - **Effort:** S · **Verify:** dialog open = 1 token read, 1 installations read; the installation
    list in the UI is unchanged.

- [ ] **R17 · The task middleware disconnects a *shared* Prisma pool at the end of every run**
  — `src/server/modules/analysis/tasks/init.ts:31-76`
  - **What:** `tasks.middleware("prisma-connection-manager")` calls `prisma.$connect()` at start
    and `prisma.$disconnect()` in `finally`, plus `$disconnect` on `onWait` and `$connect` on
    `onResume`. `prisma` is the process-wide singleton (`core/db.ts:275-278`) and `PrismaPg` wraps
    a `pg.Pool` (`:83-100, 147`).
  - **Why it costs:** a Trigger.dev worker runs several runs concurrently in one process.
    `$disconnect()` from one finished run tears down the pool the others are using; the next query
    re-creates connections (TCP + TLS + auth). It also silently invalidates `pgPoolConnects`, which
    the `db.slow` telemetry uses to distinguish cold start from real cost
    (`core/db.ts:100-112`).
  - **Fix direction:** drop the `finally`/`$connect` pair and rely on `onWait`/`onResume`
    (a task that waits is the only case where releasing connections matters), or give each run its
    own client instead of the global one.
  - **Effort:** S · **Verify:** `pg_stat_activity` during 3 concurrent task runs shows a stable
    connection count; `pgPoolConnects` stops incrementing per run.

- [ ] **R18 · Unbounded list payloads**
  — `analysis/services/analysis-lifecycle.service.ts:21,271-301`,
    `analysis/services/pr-impact.service.ts:136-175`,
    `analysis/analysis.repository.ts:244-254`, `users/user.service.ts:177-187`
  - **What:** `getHistory` returns up to 500 analyses **plus** a `count`; `listByRepository`
    returns 500 PR analyses; `getByRepoId` (fixes) and `getActiveSessions` have no `take` at all.
  - **Why it costs:** 500-row payloads are not paginated, they are "capped by a constant that
    will eventually be hit"; `getHistory` is also invalidated on every `analysisUpdated` (R10), so
    it is re-fetched constantly. The `capped` flag correctly tells the UI it is truncated, but the
    cost is still paid.
  - **Fix direction:** cursor pagination on the existing `(repoId, createdAt desc)` indexes, or
    reduce the cap and add "load more".
  - **Effort:** S–M · **Verify:** response size for a repo with 600 analyses is comparable to one
    with 20.

- [x] **R19 · `getRepoSnapshot` issues a second query for the requested `aid`**
  — `src/server/modules/analysis/analysis.repository.ts:340-364`
  - **What:** `repo.findUnique(...)` (with the *latest* DONE analysis) and then, if `aid` is
    passed, `resolveTargetAnalysis` (`:546-565`) fetches *another* analysis. The latest analysis
    fetched in the first query is discarded when `aid` is present. The same pattern is repeated in
    `getRepoSnapshotWithDocuments` (`:366-402`).
  - **Why it costs:** every `aid`-scoped call (`getWorkspace`, `getStructureMap`,
    `getStructureNode`, `getNodeContext`, `searchWorkspace`, `getDocumentContent`, `getByPRNumber`)
    pays a heavy read twice. `aid` is how the UI pins a historical analysis — the default view
    after clicking a version.
  - **Fix direction:** one `repo.findUnique` with `analyses: { where: aid != null ? { id: aid } :
    { status: "DONE" }, take: 1 }`, so the single query returns the right row.
  - **Effort:** XS · **Verify:** `getStructureMap` with `aid` = 1 operation, same payload;
    `NOT_FOUND` for an unknown `aid` preserved.

- [ ] **R20 · Independent reads and writes are awaited in sequence**
  — `users/user.service.ts:145-175`, `analysis/services/docs.service.ts:193-260`,
    `analysis/services/fixes.service.ts:27-60, 229-290`
  - **What:** `disconnectAccount` runs `account.findUnique` → `account.count` → `user.findUnique`
    inside a **Serializable** transaction (longer lock window than needed);
    `pinAuditToDocs` reads the Redis preview then analysis/repo/CAS in sequence; `applyFix` reads
    the repo, then `getClientContext` (which reads a token/installation), then the fix;
    `openPullRequest` reads repo → installation → Redis hash → creates the fix.
  - **Why it costs:** each extra await is a serialized network round trip on a user-facing request,
    and inside the transaction it extends the serializable window, which increases P2034 retries
    (`runSerializableTransaction`, `:89-106`, retries up to 3×).
  - **Fix direction:** `Promise.all` for independent reads; move the two validation reads out of
    the transaction or merge them into one query with `include`.
  - **Effort:** XS · **Verify:** request latency for disconnect/fix-apply drops by one round trip;
    tests for retries still pass.

- [x] **R21 · The PR task feeds the whole previous `resultJson` into the prompt**
  — `src/server/modules/analysis/tasks/analyze-pr.task.ts:96-108, 222`
  - **What:** `findFirst({ select: { resultJson: true } })` → `JSON.stringify(...)` →
    `projectOverviewJson` in the model context.
  - **Why it costs:** the full AI result (facts, findings, vulnerabilities, route inventory) as
    tokens. This is a direct cost multiplier per PR review and can silently exceed the model
    context, forcing fallbacks. There is no size cap and no truncation.
  - **Fix direction:** project a bounded summary (counts, top-N findings, languages, health
    scores) instead of the raw blob, or reuse the already-computed `metricsJson`.
  - **Effort:** S · **Verify:** prompt token count for PR review drops and stays under the model
    budget; output quality spot-checked on 3 real PRs.
  > Done 2026-11-15 (`39d08034`): `logic/project-result-overview.ts` projects
  > architecture/purpose/stack, four scores, four counts, 5 findings, 3 vulnerabilities, 5 complex
  > files and 5 bottlenecks, then shrinks (drop findings → purpose → string lists) and finally
  > re-checks the serialized form, dropping purpose remainder → vulnerabilities → architecture style
  > before falling back to a minimal object, so the output is always ≤ 4096 chars and always valid
  > JSON. A blob with none of the recognised top-level keys yields `{}`, which is also the null-row
  > fallback in the task. Token count and quality spot-check not measured.

- [ ] **R22 · PR-impact page can read the repository snapshot twice**
  — `src/server/modules/analysis/services/pr-impact.service.ts:43-56`
  - **What:** `getRepoBySha(...)` (repo + the analysis at `headSha`) and, when that returns
    `null`, `getRepoSnapshot(...)` — a second full read of the same repo with a different
    analysis. Both carry `resultJson`/`metricsJson`.
  - **Why it costs:** the miss path (PR analysed but the head SHA has no DONE analysis — the
    normal case after a force-push or a failed run) pays two heavy reads for one page.
  - **Fix direction:** one query per repo plus a targeted analysis lookup, or fetch the repo once
    and choose the analysis in memory; both reads are independent and could at minimum run in
    `Promise.all` (though that does not remove the second fetch).
  - **Effort:** S · **Verify:** query count for the fallback path = 2 (PR analysis + repo), not 3.

- [ ] **R23 · `analysis.analyze` performs 9–10 operations before the client gets an answer**
  — `src/server/modules/analysis/services/analysis-lifecycle.service.ts:92-201`
  > Progress 2026-11-15: `assertRepoAccess` narrowed; the cache-probe merge and the trailing
  > `jobId` update are not implemented (see report).
  - **What:** `assertRepoAccess` (full repo row) → GitHub branch-head call → `analysis.findFirst`
    (cache probe) → transaction (advisory lock, entitlement read (2 queries), usage event,
    upsert + clamp UPDATE) → `analysis.create` → `tasks.trigger` → `analysis.update(jobId)`.
  - **Why it costs:** the user waits for the slowest step of a chain that includes GitHub, Trigger
    and five database writes. `assertRepoAccess` fetches the full repo row while only
    `workspaceId` and owner/name/defaultBranch are used.
  - **Fix direction:** `select` in `assertRepoAccess`; merge the cache probe into the repo read;
    set `jobId` with the `analysis.create` via a client-generated idempotency value so the trailing
    `update` (`:163-167`) disappears.
  - **Effort:** S · **Verify:** operations before enqueue ≤ 6; the `jobId` is still persisted
    before the client polls.

---

## LOW

- [ ] **R24 · Admin audit list and detail read the full row, `payload` included**
  — `src/server/modules/audit-logs/admin-audit.service.ts:78, 91` — `findMany`/`findUnique`
    without `select`, so every page row carries its `payload` JSON (`payloadHtml` re-reads it
    separately anyway, `:99-110`). **Fix:** `select` the summary columns. **Effort:** XS.

- [ ] **R25 · Auth hooks run sequential full-row reads**
  — `src/server/core/auth/index.ts:187-215, 247-292` — `account.create.before` does
    `user.findUnique` (all columns, so the field-encryption extension decrypts what it reads)
    before possibly updating; `session.create.before` does `user.findUnique` →
    `account.findFirst` → conditional `user.update`. The `session.create.after` read was narrowed to
    `createdAt, id, role` (`:219-223`) but still runs. Sign-in only, so frequency is low, but three
    round trips on the login path are avoidable. **Fix:** `select` narrow fields; merge the
    after-hook read into the before-hook result. **Effort:** XS.

- [ ] **R26 · `apikey.list` returns every key of the workspace, unpaginated**
  — `src/server/modules/api-keys/api-key.service.ts:90-124` — `findMany` with no `take`; keys are
    few per workspace today but the endpoint has the same shape as R18 and is invalidated on every
    `apiKeyUpdated` event. **Fix:** `take`/cursor. **Effort:** XS.

- [x] **R27 · `user.me` reads the whole user row**
  — `src/server/modules/users/user.service.ts:214-227` — `findUnique` without `select`, mapped
    through `userMapper.toPublic`. **Fix:** select the public projection
    (`PublicUserSchema`). **Effort:** XS.

- [ ] **R28 · Chat persist path re-reads the session title for every assistant message**
  — `src/app/api/agent/chat/route.ts:270-312` — after `chatMessage.create`, a
    `chatSession.findUnique({ select: { title } })` inside `onEnd`, then possibly a
    title-generation LLM call and an update. The read exists only to detect `title === "New Chat"`.
    **Fix:** carry a flag from the session-creation branch in the same request. **Effort:** XS.

- [ ] **R29 · Admin session list is unbounded**
  — `src/server/modules/users/admin-user.service.ts:265-289` — `session.findMany` for a user with
    no `take` (a narrow `select` landed in `f17088dd`, but there is no pagination). **Fix:** `take` +
    pagination. **Effort:** XS.

- [ ] **R30 · Webhook handlers read full repo rows**
  — `modules/webhooks/issue-comment-webhook-handler.ts:17-19`,
    `modules/webhooks/review-comment-webhook-handler.ts:20-22` — `repo.findMany` without `select`
    (the issue-comment one then passes whole rows around). The PR and push handlers were narrowed
    to `{ id, workspaceId }` / `{ workspaceId }` (`analysis/logic/pr-webhook-handler.ts:167`,
    `webhooks/push-webhook-handler.ts:28`). Repo rows are small, but the handlers run on every
    GitHub delivery. **Fix:** `select` on the two remaining handlers. **Effort:** XS.

- [ ] **R31 · `fixes.createFix` validates the PR analysis with an extra query before the repo read**
  — `analysis/services/fixes.service.ts:129-142` — `pullRequestAnalysis.findFirst` then
    `repo.findUnique`; the first result is only used to null out an invalid FK. **Fix:** read both
    in `Promise.all`, or connect through a nested `findFirst` on the repo. **Effort:** XS.

- [ ] **R32 · Several Ably publishes per single user action**
  — `analysis/services/analysis-lifecycle.service.ts:494-519` (`userUpdated`, `notification`,
    `analysisUpdated`), `users/user.service.ts:263,280,302,313`, plus one publish per audited
    business write (R1). Each is a separate REST call with no batching. **Fix:** batch by channel
    at the end of the request, and collapse the completion burst (notification + analysis update)
    into one event the client already listens to. **Effort:** S.

- [x] **R33 · `getRepoSnapshotWithDocuments` loads every document row of the repo and filters in JS**
  — `analysis/analysis.repository.ts:366-402` — before `311bd6a7` the nested `documents` had no
    `take`, and `repo.documents.filter(d => d.analysis?.id === aid)` ran in JS. Documents grow by
    ~5 per analysis (`saveResults`), so a repo with 100 analyses read 500 metadata rows to serve one
    version. **Fix:** `where: { analysisId: aid }` in the nested select — now at `:376-378`.
    **Effort:** XS.

- [ ] **R34 · `getDashboardStats.sql` builds a per-repo top-5 lateral it never uses**
  — `prisma/sql/getDashboardStats.sql` (`per_repo_top`) — `LIMIT 5` per repo followed by
    `DISTINCT ON (l.repo_id)`, i.e. one row is kept and four are discarded, for every repo of the
    user, on every dashboard load. **Fix:** `LIMIT 1`. **Effort:** XS. (Deliberately not merged
    with R10: this is a shape fix, R10 is a frequency fix.)

---

## Correctness found while reading (not performance)

- [ ] **K1 · Dashboard cards and the repository list on the same screen count different sets**
  — `prisma/sql/getDashboardStats.sql` (`user_repos … WHERE created_by_user_id = $1`),
    `prisma/sql/getTrends.sql` (`r.created_by_user_id = $1`), vs
    `repos/repo.service.ts:202-206` (`where: { workspaceId }`)
  - **What:** in a shared workspace, the stat cards / trends show only repositories the *current
    user* created, while the repository list right below shows the whole workspace.
  - **Why it matters:** numbers and list disagree for any invited member; the trend deltas look
    like data loss. Round 1 (`P2`) fixed the analogous cross-tenant leak in
    `notification.getStats`; this is the same class of bug in the other direction.
  - **Fix direction:** scope both SQL files by workspace membership
    (`repos.workspace_id = $workspaceId`) and pass the workspace id from the procedure, which
    already has it (`protectedProcedure` → needs `workspaceProcedure`).
  - **Effort:** S · **Verify:** an invited member and the owner see identical counts on the same
    workspace; a test with two users in one workspace.

- [x] **K2 · Node context reads documents from the latest analysis, ignoring the selected `aid`**
  — `analysis/services/workspace.service.ts:51-62, 128-140` (`loadRelatedDocSections` →
    `analysisRepo.loadLatestDocumentsWithContent(db, repoId, workspaceId)` without `aid`)
  - **What:** every other call in the same request is pinned to the requested analysis, but the
    related doc sections come from whichever analysis is newest.
  - **Why it matters:** on a historical analysis the "related docs" panel shows sections that do
    not exist in the version being viewed.
  - **Fix direction:** thread `aid` through `loadRelatedDocSections` into
    `loadLatestDocumentsWithContent` (the repository method already accepts it).
  - **Effort:** XS · **Verify:** node context on an old `aid` lists only that analysis's documents.

---

## Verified clean — do not re-report

These were checked and found correct. Listed so a third round does not repeat the work.

| ID | area | why it is fine |
| --- | --- | --- |
| FP1 | `getDashboardStats` | One deliberate aggregate instead of five scans (round 1: `P1`, `P1b`). Shape is fine; its *frequency* is R10 and its *scope* is K1. |
| FP2 | `cappedCount` / `getPaginatedList` | Counting by fetching ≤ `MAX_PAGE × limit` ids and running the three list queries in `Promise.all` is the accepted trade-off from round 1 (`P16`). Not a defect. |
| FP3 | `notification.getStats` | `groupBy(isRead)` with the `(userId, isRead, createdAt, id)` index — index-only scan. |
| FP4 | Redis usage | `core/redis.ts` pipelines every multi-step mutation (`increment`, `staging.addFiles`, `staging.removeFile`); no per-element `get`/`set` loops anywhere in `src/server`. |
| FP5 | `comment-poster.ts` | Posts one `pulls.createReview` with all comments instead of one REST call per finding. |
| FP6 | `analysisLatestSelect` | Narrow `select` — the polling endpoint does not touch the JSON columns. |
| FP7 | `.map(async …)` over the database | Does not exist. The `map(async)` sites are R6 (markdown/cache, `pr-comments.service.ts:38`, `analysis.mapper.ts:198` — both now run inside one page-level cache entry), `webhooks/issue-comment-webhook-handler.ts:78` (markdown), `logic/repo-file-scanner.ts:40` and `logic/differential-analyzer.ts:367` (file reads / analysis), and `domain/ai/ai-tools.ts:198` (tool calls). None of them is a database read per element. |
| FP8 | Advisory locks | `pg_advisory_xact_lock(hashtext(…))` / `pg_try_advisory_xact_lock` are per-workspace or per-user, always inside a transaction, never held across an HTTP call. |
| FP9 | `health.check` | `SELECT 1`. |
| FP10 | Index hygiene | Round 1's `P3`/`P8`/`P17` cleaned up the duplicate and dead indexes; `check:index-parity` keeps app and clone in sync. `546a0750` (2026-11-03) did another pass: dropped `sessions_token_key`, `repos_workspace_id_owner_idx`, `repos_owner_name_workspace_id_key` and `workspace_usage_period_start_idx`, added `repos(workspace_id, owner, name)` unique, `billing_operations(actor_user_id)` and `audit_logs(user_id, created_at DESC, id DESC)`. Do not re-report those as missing. The only gap found in this round is R11. |
| FP11 | Nested `include` counts | Under `relationJoins` a nested `include` is one statement, so "one query with two relations" is not an N+1. Derived from the generator flag, not instrumented — same caveat as `db-ui-map.md`. |

---

## Closing log

| ID | closed | commit | note |
| --- | --- | --- | --- |
| R2 | 2026-11-01 | `311bd6a7` | `repoPublicSelect` / `repoPageSelect` in `repo.mapper.ts`; `getByName` uses the page projection, `getByOwner` the scalar one. `RepoRecord` dropped with the `include`. |
| R3 | 2026-11-15 | `ad34335b` | `select` added; `lastUsed`-only writes are no longer audited (see R1). |
| R4 | 2026-11-01 | `311bd6a7` | Nested `analyses` narrowed to `select: { commitSha: true }`; the repo row itself is still full because `saveResults` needs it. |
| R5 | 2026-11-01 | `311bd6a7` | `workspaceMemo` added to `RequestStore`; `resolveWorkspace` split into `loadWorkspace` + `memoizeOnce` keyed on user, header, `strict` and name. Both this and `entitlementMemo` now go through `src/server/utils/request-memo.ts`, so the key is typed and cannot drift from the inputs. |
| R6 | 2026-11-15 | `d73f3abc` | One `unstable_cache` entry per page in `pr-comments.service.getComments` and `analysisMapper.buildTopFindings` (the latter gained a required `cacheScope`, the PR analysis id); the comments key and tag are workspace-scoped, empty pages are not cached, `postCommentToPR` revalidates the analysis tag. No `take`, so row counts are still unbounded. |
| R7 | 2026-11-15 | `39d08034` | `getSessionHistory` takes the newest 200 rows (desc → reversed) with a four-field `select`; `listSessions` takes 100 with a `select` that keeps every output field. Follow-up: the ad-hoc `take` constants became cursor pagination through the shared `pagination.ts` primitives (`keysetArgs` / `splitKeysetPage` / `orderWithTiebreak`) — newest page plus `nextCursor`; the UI still renders the first page only. The array → `{ items, meta }` output is a breaking wire change for an older published `dxnx` (release-please ships CLI and server together). `listSessions` keysets on `updatedAt`, which moves on rename/append, so a multi-page walk can duplicate or skip before a "load older" UI ships. B2d flipped that last caveat: the web agent now pages history through `firstItemIndex`/`startReached` and the session list through an intersection sentinel, so a multi-page walk is live and the rename/append caveat now applies to it. |
| R8 | 2026-11-01 | `311bd6a7` | `analysisRepo.getByRepoAndPRNumber` selects `id` instead of `include: { comments, generatedFixes }`; its only caller (the PR webhook) reads `id`. |
| R9 | 2026-11-15 | `5420536e` | `bumpUsage` is one `INSERT … ON CONFLICT` statement per event; both paths clamp, and the conflict branch binds the raw delta (`+ $6::int`), so a negative release is not swallowed by `EXCLUDED`. `usage.test.ts` asserts the SQL text and params; `entitlements.test.ts` asserts the 900 → 0 clamp against a real database. |
| R19 | 2026-11-15 | `c004fc44` | `getRepoSnapshot`, `getRepoSnapshotWithDocuments` and `getAnalysisPayloadForRepo` resolve the requested `aid` inside the single `repo.findUnique` (`analyses: { orderBy: createdAt desc, take: 1, where: { id, status: "DONE" } }`), so an `aid`-scoped read is one operation. A missing or foreign `aid` still throws `ANALYSIS_VERSION_NOT_FOUND`; an empty latest still throws `ANALYSIS_NOT_COMPLETED`. `getRepoDocsPayload` keeps its second lookup (out of this batch). |
| R21 | 2026-11-15 | `39d08034` | `logic/project-result-overview.ts` replaces `JSON.stringify(resultJson)` in `analyze-pr.task.ts` with a bounded projection capped at 4096 chars. |
| R27 | 2026-11-01 | `311bd6a7` | `user.me` selects the eight `PublicUser` fields instead of the whole row. |
| R33 | 2026-11-01 | `311bd6a7` | `documents` relation filtered by `analysisId` in SQL when `aid` is set; the JS `.filter()` in `getRepoSnapshotWithDocuments` is gone. |
| K2 | 2026-11-15 | `84ad37d7` | `loadRelatedDocSections` takes the request's `aid` and forwards it to `loadLatestDocumentsWithContent`, so the related-docs panel lists only the pinned analysis's documents. |

The first six shipped in PR #2356 and are on `main`; R3, R6, R7, R9, R19, R21 and K2 landed on
`perf/dxnx-310-db-query-review-round-2` and the "working tree" marker from the original log is
now historical.

## Verification recipes

Run from the repo root. The bench and parity scripts live in `apps/web/package.json`, so they need
the workspace filter — bare `bun run bench:*` does not exist at the root. They read
`DATABASE_URL` from the ambient environment; from a clean shell prefix the command with
`doppler run --config dev --` or run it from `apps/web` with `bun with-doppler`.

```bash
# statement counts for a page/procedure (round 1 tooling)
bun --filter @doxynix/web bench:stats

# what a shape actually does at the database level
bun --filter @doxynix/web bench:queries

# index A/B before keeping a new index (R11)
bun --filter @doxynix/web bench:index-ab --index analyses_repo_id_commit_sha_idx 'label=<sql>'

# index drift after a schema change
bun --filter @doxynix/web check:index-parity

# unit suites for the touched slices
bun --filter @doxynix/web test src/server/modules/analysis
bun --filter @doxynix/web test src/server/modules/billing
bun --filter @doxynix/web test src/server/core
```
