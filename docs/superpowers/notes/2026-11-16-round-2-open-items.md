# Round 2 — decisions and closure record (2026-11-16, closed 2026-11-18)

Companion to [`db-query-review-2026-11.md`](../plans/db-query-review-2026-11.md). The per-batch
reports that this file summarises are git-ignored under `.superpowers/sdd/`, so everything a
reviewer needs is recorded here.

Scope: the round-2 branch `perf/dxnx-310-db-query-review-round-2` (draft PR #2412).

---

## 1. Plan items — final state

**35 / 36 closed.** Only R1 stays open, and its remainder is a separate architecture step, not a
missing fix in this branch.

| ID | State | Record |
| --- | --- | --- |
| R1 | open | Bookkeeping writes are no longer audited and the Ably publish coalesces per request, but every write left in `saveResults` is a semantic row (analysis, user, five documents, notification). "Not 8 rows" needs `audit_events` (`audit-log-architecture.md` step 2). |
| R10 | closed | `82dec26b` — completion invalidates `getLatest` + `getHistory`; staging/fixes publish `stagingUpdated` → `getStagedFiles`; onboarding follows `userUpdated`; `getVersionRef` refreshes on the FAILED path only (it labels a pinned old version). The DONE/FAILED progress path still refreshes the mounted widget (dashboard stats or the repo cards) — that is the completion contract, not a fan-out. |
| R12 | closed | `8c1ae61c`, `0c9045a0` — one `tasks.batchTrigger` for the sweep and one typed-SQL update, with `billing_events.trigger_batch_id` replacing the per-run id the batch API does not return. |
| R23 | closed | `989fd1af`, `d302fb0a` — the worker attaches `jobId` with one guarded `updateMany` (`status = PENDING`) instead of the request path writing it after `tasks.trigger`; a row cancelled before the worker starts is left untouched and the run returns early. The cache probe stays separate because its key is the branch-head SHA. |
| R25 | closed | `35eb6a90` — the sign-in log moved into `session.create.before`, which already holds the profile (`createdAt`, `role` joined the select); `session.create.after` is gone. |

R1's verification line still fails by design, so the item stays unticked in the plan.

## 2. Decisions taken during the round (do not “fix” them back)

- **No backward compatibility.** The legacy PR-comment reconstruction and the pre-v7
  `cachedInputTokens` shape were deleted. There are no clients for either.
- **Pagination contracts:** keyset for feeds and admin tables; offset (page numbers) only for the
  small tables (repo list, banned emails, notifications page) with date/search for reachability; a
  cap + visible total only for child lists where a bulk action needs the whole set. The UI never
  offers a page past `MAX_PAGE`.
- **`total` is a contract field only where it is rendered.** `getHistory` keeps it for the version
  selector and the CLI; `listByRepository` lost both the field and its `COUNT(*)` (`36ad9162`).
- **Comments/fixes are cursor-paginated; `fixAll` is server-side** (`analysis.fixAllComments`), so
  it no longer depends on the loaded page.
- **Cents are rounded, not ceil** in `costCentsFor`; sub-cent calls record `0`. The rollup is a
  quota/cost estimate, not an invoice.
- **Reservations cap output at 8 192 tokens** (`maxOutputTokens` remains the model limit).
- **`analysis-context-memo.ts` is a bounded process-local memo** (32 entries) for the search path.
  It is not Redis-backed because the builder is a live object with per-node maps; caching the
  serializable structure in Redis would be a separate design.
- **`onWait` still disconnects the shared pool**, `onResume` reconnects. Removing that would let
  parked runs hold pool connections; it stays until per-run clients exist.
- **Root `export *` is allowed; nested barrels are not.**
- **Server mappers are `*.mapper.ts`**; pure helpers are kebab-case without `-utils`.
- **Transaction mechanics live in `core/db.ts`**: `withTransaction` (root client or an open
  transaction) and `withAdvisoryLock` (transaction-scoped lock via typed SQL). The serializable
  retry policy stays in `users/user.service.ts` because it carries `TRPCError`/retry semantics.
  Array-form `prisma.$transaction([...])`, the auth adapter and the `plan-changes` try-lock are
  deliberately left alone.
- **Files stay cohesive instead of hitting a line count.** `billing.reconciliation.ts` (a state
  machine whose functions share invariants), `analysis.repository.ts` (one data-access surface for
  the slice), `billing.events.ts` and `api-key.service.test.ts` are long because their parts share
  context; splitting them by line count would spread invariants across files. A split is only
  justified when a real seam appears (as with `usage.mapper.ts` and `analysis.mapper.ts`).
- **Legacy comments on old rows render empty** instead of being reconstructed from
  `pull_request_comments` — accepted owner trade-off.

## 3. Follow-ups from this doc that are now done

- **`listByRepository` total** — the field was unused by the UI and the CLI; the query, the schema
  field and the first-page `COUNT(*)` are gone (`36ad9162`).
- **`capped_hint` copy** — “Narrow the results to see the rest.” in all 12 locales, so the message is
  true on the PR comment and fix cards, which have no date filter (`e8302e17`).
- **Dead exports** — `RepoRefRecord` / `RepoRef` removed; `fixesMapper.toPublic` and
  `GeneratedFixDTO` turned out to have a live caller (`fixes.service.listFixes`) and stay.
- **Unreachable branch** — `docs.getDocumentContent` no longer re-checks a missing analysis:
  `analysisRepo.getRepoRef` returns `analysisId` or throws first (`bf7aab05`).
- **`billing.events` chunking** — moot after R12: the sweep now makes one `batchTrigger` call and
  the test asserts the item list.
- **Comment and line-length minors** — the three-line comments are two lines and the 114-column
  cache key is built from a list (`3e69ffeb`).
- **`check:index-parity`** — run against a fresh database built from all 106 migrations:
  154 indexes on both sides, sets and definitions identical.

## 4. Accepted as they are (deliberate, not deferred)

- **CLI cursor walks stop after 10 pages** (`MAX_CURSOR_PAGES`), and the agent's `listApiKeys`
  shares that bound (1 000 rows per list). The bound is a parameter; it is deliberate protection
  against an unbounded walk on a pathological data set.
- **`clampPage` / `clampIntegerParam` keep their names** while delegating to `es-toolkit` `clamp`:
  they carry the domain rule (`MAX_PAGE`, NaN/float rejection) that the call sites would otherwise
  repeat.
- **The three `usageEvent.create` payloads stay explicit.** They differ in tokens, kind and cost,
  and this is the money path; a parameterised builder was tried and made the differences harder to
  see (jscpd records two small clones).
- **`customerFor`'s query fallback stays** in the reconciliation page context. Every current caller
  is seeded by the prefetch, so it does not run today, but returning “unowned” on a cache miss would
  be a wrong repair rather than a slow one.
- **Sub-cent calls record `0` cents.** Correct for quota and estimation; if the rollup ever becomes
  invoice-grade, the precision decision (round vs ceil vs micro-cents) is a billing change, not a
  database one.

## 5. Not verifiable in this environment

- **R17's live effect** — no Trigger.dev worker here, so `pg_stat_activity` / `poolConnects` were not
  measured during parallel runs. Unit tests prove `$connect`/`$disconnect` are gone from the run
  wrapper.
- **Browser behaviour** — the Playwright harness has a single unauthenticated smoke spec and no
  test-auth fixture, so sentinels (including the one inside Radix `SelectContent`), `ErrorState`
  retry, the version dropdown's paging and toolbar reset are covered by unit-tested helpers and the
  type-checker only. A real spec needs an authenticated fixture, which is its own change.
- **Benchmarks** — this round still has no `bench:*` numbers; every claim is derived from the call
  graph and statement count, as the plan states.

## 6. Next round (candidates, not started)

1. `audit_events` + outbox drain (`audit-log-architecture.md` steps 2–3) — the only way to close R1.
2. Fold the analysis quota check into the usage SQL, so `analysis.analyze` drops from seven
   statements to six and the advisory-lock transaction loses a read.
3. A Playwright auth fixture, so the pagination UI can be tested where it actually renders.
4. Invoice-grade precision for `costCents`, if the rollup stops being an estimate.
5. `getBillingUsageDays.sql` (landed after this round) under the same treatment as the other typed
   SQL files.
