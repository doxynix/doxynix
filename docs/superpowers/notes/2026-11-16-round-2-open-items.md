# Round 2 — open items, decisions and deferred work (2026-11-16)

Companion to [`db-query-review-2026-11.md`](../plans/db-query-review-2026-11.md). Written so the
branch can be reviewed and merged without reading the per-batch reports (they are git-ignored under
`.superpowers/sdd/`).

Scope: everything left open after the round-2 branch
`perf/dxnx-310-db-query-review-round-2` (draft PR #2412).

---

## 1. Plan items left partial (5 of 36)

| ID | What remains | Why it is not closed |
| --- | --- | --- |
| R1 | “not 8 audit rows per analysis” | Needs `audit_events` (`audit-log-architecture.md` step 2). The interceptor already skips bookkeeping writes and coalesces the Ably publish. |
| R10 | four invalidations on completion | Staging, onboarding, latest and history each have a consumer; the per-milestone burst is gone. A lower number needs an event-contract change. |
| R12 | one HTTP trigger call per event | SDK 4.8.5 `batchTrigger` exposes no per-run ids; `trigger_run_id` is used for diagnostics/cancel. The DB side is one statement, triggers are chunked 10 at a time. |
| R23 | merge the cache probe; drop the trailing `jobId` update | The SHA only exists after the GitHub call, and the update needs a create/trigger ordering change (API decision). `assertRepoAccess` is already narrowed. |
| R25 | `session.create.after` user read | Better Auth has no before→after channel; merging needs a module-level side map. The two before-hooks are narrowed. |

## 2. Decisions taken during the round (do not “fix” them back)

- **No backward compatibility.** The legacy PR-comment reconstruction and the pre-v7
  `cachedInputTokens` shape were deleted. There are no clients for either.
- **Pagination contracts:** keyset for feeds and admin tables; offset (page numbers) only for the
  small tables (repo list, banned emails, notifications page) with date/search for reachability; a
  cap + visible total only for child lists where a bulk action needs the whole set. The UI never
  offers a page past `MAX_PAGE`.
- **Comments/fixes are cursor-paginated; `fixAll` is server-side** (`analysis.fixAllComments`), so it
  no longer depends on the loaded page.
- **Cents are rounded, not ceil** in `costCentsFor`; sub-cent calls record `0`. The rollup is a
  quota/cost estimate, not an invoice.
- **Reservations cap output at 8 192 tokens** (`maxOutputTokens` remains the model limit).
- **`analysis-context-memo.ts` is a bounded process-local memo** (32 entries) for the search path.
  It is not Redis-backed because the builder is a live object with per-node maps; caching the
  serializable structure in Redis would be a separate design.
- **`onWait` still disconnects the shared pool**, `onResume` reconnects. Removing that would let
  parked runs hold pool connections; it stays until per-run clients exist.
- **Root `export *` is allowed; nested barrels are not.** `packages/shared/src/utils/index.ts` no
  longer re-exports siblings.
- **Server mappers are `*.mapper.ts`** (`usage.mapper.ts`, `analysis.mapper.ts`); pure helpers are
  kebab-case without `-utils`.
- **Transaction mechanics live in `core/db.ts`**: `withTransaction` (root client or an
  already-open transaction) and `withAdvisoryLock` (transaction-scoped lock via typed SQL). The
  serializable retry policy stays in `users/user.service.ts` because it carries `TRPCError`/retry
  semantics, not database ones. Plain `prisma.$transaction([...])` array calls and the
  `plan-changes` try-lock stay as they are.
- **Legacy comments on old rows render empty** instead of being reconstructed from
  `pull_request_comments` — accepted owner trade-off.

## 3. Deferred refactors

- **File size** (all pre-existing breaches, worsened by the round): `billing.reconciliation.ts`
  ~760 lines, `analysis.repository.ts` ~715, `billing.events.ts` ~419,
  `api-key.service.test.ts` > 500. Split in a separate refactor PR, not mixed with behaviour changes.
- **`fixesMapper.toPublic` / `GeneratedFixDTO`** have no production caller after the cursor move
  (the router maps rows itself). Remove with the next dead-code pass (`knip` is non-gating).
- **`RepoRefRecord`/`RepoRef`** may still be exported without an importer.
- **`docs.service.ts` `ANALYSIS_NOT_FOUND`** branch is unreachable after `getRepoRef` (it throws
  earlier). Remove or keep the response contract deliberately.
- **`billing.reconciliation` customer miss-fallback is dead** after negative caching; the map always
  seeds every page customer. Kept as a guard for future callers.
- **`billing.events` chunking is not asserted** (only the total call count); a mutation that removes
  the chunk loop would still pass.
- **`usage.ts` still has three similar event-create payloads** (`ANALYSIS`, `ANALYSIS_RELEASE`,
  `CACHE_HIT`). Parameterising them would make the money path less explicit; jscpd records 2 small
  clones.

## 4. Parked minor findings (accepted, not fixed)

- CLI cursor walks stop after **10 pages** (`collectCursorPages`): 1 000 rows per list. Raising it is
  a one-argument change; the bound is documented in the plans.
- `agent.tools.listApiKeys` pages active + archived up to the same 10-page bound; a workspace with
  > 1 000 keys is not fully visible to the agent tool.
- `capped_hint` copy says “narrow filters or pick a date range” on the PR comment/fix cards, which
  have no date filter (no new i18n copy was allowed).
- `RepoPullsList` does not render `total`; the field stays in the wire contract for the CLI.
- `clampPage` / `clampIntegerParam` keep their names while delegating to `es-toolkit` `clamp`;
  inlining would touch ~10 services and 3 test suites.
- `session-pages.test.ts` was removed with the helper; dedupe is now `uniqBy` from `es-toolkit`.
- `analysis.mapper.ts` has one ~114-column line (no max-len rule).
- `usage.test.ts` and `audit-filters.test.ts` have a 3-line comment each (AGENTS caps at 2).

## 5. Not verified locally

- **`check:index-parity`** — no `dxnx_web_stress` clone in this environment; the script exits 0 when
  the clone DB is absent, and CI does the same. The new indexes were applied to `dxnx_web` and
  confirmed in `pg_indexes`.
- **R17 live effect** — no Trigger.dev worker here; `pg_stat_activity`/`pgPoolConnects` were not
  measured. Unit tests prove `$connect`/`$disconnect` are gone from the run wrapper.
- **UI behaviour in a browser** — no component/e2e harness runs in this worktree: sentinels
  (especially the one inside Radix `SelectContent`), `ErrorState` retry, the version dropdown’s
  automatic paging, and toolbar reset are type-checked and unit-tested only.
- **`billing.reconciliation` two-page run** and the sweep’s optimistic guard were run against a
  private clone (`dxnx_b6_test`) because parallel batches reset `dxnx_web_test` mid-run; the
  integration files are committed and pass.

## 6. Next round (candidates, not started)

1. `audit_events` + outbox drain (R1 / audit-log-architecture step 2–3).
2. Event-contract change for completion invalidation (R10).
3. `billing_events.batch_id` only if per-run id can be dropped from the sweep (R12).
4. Create/trigger/jobId ordering (R23) and a Better Auth before→after channel (R25).
5. File splits listed in §3.
6. Playwright coverage for the pagination UI (sentinels, error state, dropdown paging).
7. Index parity in CI with a disposable clone.
8. Dead-code pass: `fixesMapper.toPublic`, `GeneratedFixDTO`, unused `RepoRef*`, unreachable
   `ANALYSIS_NOT_FOUND`.
9. Precision decision for `costCents` (round vs ceil vs micro-cents) if the rollup ever becomes
   invoice-grade.
