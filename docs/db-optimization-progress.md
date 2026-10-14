# Database optimization — progress board

Live tracker for the work driven by [`db-index-audit.md`](./db-index-audit.md).
Measurements come from the `dxnx_web_stress` clone (11 GB / ~18M rows); per-shape timings
are in the `_bm` table there.

**Baseline at board creation:** 9 of 64 query shapes over 100 ms, worst 8824 ms.

## Status

| ID | Change | Type | Effort | Before | After | Status |
| --- | --- | --- | --- | ---: | ---: | --- |
| P1 | `getDashboardStats.sql` — 5× `COUNT(CASE)` → 1 pass | code | S | 6012 ms | 5775 ms (−45 % buffers) | **done, tested** |
| P1b | `jit = off` for the app databases | config | XS | 5775 ms | 485 ms | **done, 11.9×** |
| P2 | `notification.getStats` — pass `userId` + `where` | code | XS | 483 ms | 1.9 ms | **done** — fixes the cross-tenant leak. Re-verified 2026-10-13 at 53 ms for the heaviest user (400 045 notifications). A first reading of 993 ms was **my measurement error**, not the app: the clone had never been vacuumed, so no index-only scan was available. See `apps/web/scripts/scenarios.md` |
| P3 | Drop 3 provably-redundant indexes | schema | XS | 11 919 ms / 200k | 8 646 ms | **done, −242 MB** |
| P4 | `adminAudit.getAll` — conditional unfiltered `count()` | code | XS | 1193 ms | 636 ms | **done (unfiltered only)** |
| P4b | `bannedEmail.getAll` — same pattern | code | XS | 6.7 ms | 4.9 ms | **done** |
| P5 | `pr-config.getConfig` → `findUnique({ repoId })` | code | XS | 0.228 ms | 0.068 ms | **done** |
| P6 | `audit_logs(operation, created_at DESC)` | schema | S | 1598 ms | 646 ms | **done** |
| P7 | Drop the unreachable `email ILIKE` from admin search | code | XS | 218 ms | 8.0 ms | **done, 27×** |
| P8 | Remove remaining 6 unused trigram indexes (−460 MB) | schema | M | — | — | **retracted** — re-measured, the indexes are worth 1.6×–126× |
| P9 | Cap `MAX_PAGE` | code | XS | 161 ms @ p100k | — | **done, currently 100** — see the pagination section for why it moved and came back |
| P10 | Add `(user_id, created_at DESC, id DESC)` ×4 tables | schema | S | — | — | **dropped** — measurements did not justify it |
| C1 | `issue_comment` webhook picked an arbitrary tenant | code | S | 201 queries | 3 queries | **done, 67× fewer queries** |
| C1b | Webhook redelivery hit no unique constraint | code + schema | XS | — | — | **done** — composite unique + P2002 as no-op |
| C9 | `readMultipleFiles` N+1 — repo + client context per file | code | S | ~30 queries | 2 + 10 API calls | **done** |
| C10 | `revokeAccessForEmail` looped over a `@unique` lookup | code | XS | 3 queries | 2 | **done** |
| C6 | `getRepoBySha` dropped `orderBy` | code | XS | — | — | **done** |
| C7 | `analyze-pr` failsafe checked the wrong payload field | code | XS | — | — | **done** |
| C8 | `passkeys` missing `@@index([userId])` | schema | XS | — | — | **done** |
| P11 | Admin sort paths had no index at all | schema | S | 989 ms / 150 ms | 11.1 / 12.4 ms | **done, 89× and 12×** |
| P14 | `notifications` list materialised every matching row before `LIMIT` | schema | S | 803 ms | 0.66 ms | **done, 1220×** |
| P15 | Unified every offset-paginated list on one helper | code | M | — | — | **done** — 6 services share `getPaginatedList` |
| P12 | Audit counts were exact over 3.4M rows | code | S | 2774 / 378 ms | 38 / 9 ms | **done, 73× and 40×** — later replaced by P16 |
| P13 | `admin-review` ran an unfiltered `count()` | code | XS | 71 ms | — | **done** |
| C11 | 3 more webhooks still picked an arbitrary tenant | code | M | — | — | **done** |
| P16 | Capped count on pure Prisma, hand-written SQL deleted | code | S | — | — | **done** — 6 services, `countAuditLogs.sql` removed |
| P17 | `id` tiebreaker on `audit_logs` and `repos` per-user | schema | S | 311 ms | 36 ms | **done** |
| P18 | Date range on all six lists + calendar UI | code + schema | L | 1562 ms | 35 ms | **done** |
| P19 | `totalPages` advertised a page `clampPage` refused | code | XS | 101 vs 100 | 100 vs 100 | **done**, guarded by a test |
| P20 | Benchmark harness over every query shape | tooling | M | — | — | **done** — `bun run bench:queries`, 68 shapes |

## Correctness — tracked separately, not perf

| ID | Issue | Severity | Status |
| --- | --- | --- | --- |
| C1 | `findFirst({ githubId })` picked an arbitrary user of a shared repo; comment row + realtime event went to the wrong tenant | cross-tenant | **fixed** — iterate all connected repos |
| C1b | Webhook redelivery duplicated synced comments | data | **fixed** — composite unique `(analysisId, githubCommentId)` + P2002 treated as no-op |
| C2 | Keyset cursor `id` against `createdAt DESC` | correctness | **not a bug** — see below |
| C3 | `repo.deleteMany()` with no `where`; the ZenStack policy is the only guard | data loss | **not a bug** — retracted, see below |
| C4 | Audit rows outlive rolled-back transactions | correctness | open |
| C5 | `getStats` leaked all users' notifications to admins | data leak | **fixed by P2** |
| C6 | `getRepoBySha` chose non-deterministically among `take: 1` | correctness | **fixed** |
| C7 | Failsafe never fired for `analyze-pr` | correctness | **fixed** |
| C8 | `passkeys` aggregate did a seq scan per admin request | perf, latent | **fixed** |
| C11 | `push`, `review_comment` and `pull_request` handlers used `findFirst({ githubId })` | cross-tenant | **fixed** — all four now fan out over every connected account |
| C12 | `repos.getSlim` ordered by `updatedAt DESC` with no `id` tiebreaker | correctness | **fixed** — unstable pagination |
| C13 | ZenStack policies bypassed via the un-enhanced `ctx.prisma` | security | **investigated — not currently a leak**, but the structural risk is real, and the investigation found a worse adjacent bug. See below. |
| C14 | Eight `findMany` calls with no `take`, reachable from user-facing procedures | unbounded | **open** |

### Claims that turned out to be wrong

Recorded so nobody re-derives them:

- **C2 is not a bug.** Prisma's `cursor` on a unique field with a composite `orderBy`
  generates the correct tuple comparison. `audit-pagination.test.ts` exists precisely to
  guard this — it was added in the same commit that moved `id` to uuidv7 (27f16ea3). An
  earlier change here was reverted.
- **`repo.deleteMany({ githubId })` / `updateMany({ githubId })` are not data loss.** One
  GitHub repo may legitimately be connected by several Doxynix users; deleting every copy
  when GitHub reports the repo deleted is correct, and metadata sync is per-GitHub-repo.
  The live problem was only the non-deterministic `findFirst` (C1).
- **Trigram indexes on `audit_logs` do nothing.** Measured −0.6 % on a selective term. At
  15–36 % selectivity a sequential scan is correct. The three indexes were dropped again.
- **P8 — "drop the 6 unused trigram indexes" — was wrong, and was retracted.** The −0.6 %
  figure came from a term matching 461k of 2.97M rows, which is 16 % selectivity: that proves
  a broad search does not benefit, not that the indexes are useless. Re-measured with terms
  matching exactly one row: `notifications.title` **9.7 ms vs 1222 ms (126× for)**,
  `notifications.body` **1089 ms vs 3406 ms (3.1× for)**, `repos.name` **87 ms vs 137 ms
  (1.6× for)**. A migration dropping them was written, then reverted before shipping.
- **`random_page_cost` 4.0 → 1.1 changes nothing here.** Cost estimates drop ~35 % but no
  plan changes and no execution time moves. Not applied.
- **`repo.deleteMany()` and `deleteByOwner` are not data loss either.** `Repo` carries
  `@@allow('read,delete', auth() == user || auth().role == 'ADMIN')`, so the policy already
  scopes both to the caller's own rows. The earlier "one user deletes another's repo" claim
  did not account for the policy. Adding an explicit `where` is defence in depth, not a fix.
- **`db.$session.userId` does not exist.** While fixing the above I reached for a session
  accessor that appears nowhere in the codebase; it was wrong and the change was reverted.
- **`agent-github-reply.task.ts:30` picks an arbitrary installation.** `githubInstallation.findFirst({ accountLogin, isSuspended })` with no `userId`, although `payload.userId` is present. Same class as C1/C11 — **fixed**, `userId` added to the `where`.
- **`repos_user_id_updated_at_id_idx` was dropped as "junk" and had to come back.** While aligning the
  stress database to the migration state I removed it as experimental residue. It was not residue:
  without the `id` tiebreaker a per-user repo list sorted all of that user's rows, and the deepest
  page cost 107 ms. Restored as a migration — 11.5 ms. Lesson: an index's value is measured per
  query shape, and "no usage on the clone" is not evidence.
- **`MAX_PAGE` went 100 → 5000 → 100.** Raising it needed `audit_logs (created_at DESC, id DESC)`,
  which took the deepest page from 311 ms to 36 ms. It came back to 100 because the count cap is
  what bounds `totalPages`, and the user chose the smaller number. The indexes stayed.
- **`countAuditLogs.sql` was my own bad idea.** It hand-mirrored `buildWhereClause`, so adding a
  filter to the clause and forgetting the SQL produced a silently wrong count. Replaced by
  `cappedCount` on plain Prisma, measured at the same speed (8.7 ms vs 9.8 ms).
- **Four measurements in this board were my own tooling errors**, not app behaviour. Recorded so nobody re-derives them:
  - `analyses` 461 ms, `documents` 369 ms, `chatMessages` 647 ms — my benchmark put `SELECT repo_id … GROUP BY` in the `WHERE` clause, so the subquery re-scanned the whole table. Real: 0.21 / 0.19 / 0.17 ms.
  - "The paginator cannot render 170 000 pages" — `getPaginationItems` emits at most 7 items; the loop is O(totalPages) but trivial. ~1 ms, not a blocker.
  - A trigram A/B where both rows were labelled "with index" while the index was present for both.
  - Single-shot timings on a cold cache varied up to 8×. Every number above is now a median of 5.
  - **The seed contradicts the app's own schemas, in three places, and nothing caught it.**
  - `metrics_json` carries five keys where `RepoMetricsSchema` requires thirty-one. The failure
    is silent by design: `coerceAnalysisPayload` logs a warning and substitutes
    `EMPTY_REPO_METRICS`, so the database looks populated while `getStructureMap`, `searchWorkspace`,
    `getNodeContext` and `getDocumentContent` return nothing. This is why eight procedures could
    not be measured on the clone — not slow, *unreadable*.
  - `pull_request_analyses.risk_score` is generated 0-100 while `AdminReviewDetailSchema` caps it
    at 10. **720 659 of 809 342 rows (89%)** fall outside the schema, so `adminReview.detail`'s
    input parse rejects nearly every one.
  - `documents` is never populated, so the documentation procedures have nothing to return.

  The seed now validates its own generator through `parseRepoMetrics` at startup and throws rather
  than write data the app will discard. `scripts/benchmarks/repair-seed-drift.ts` repairs an
  existing clone and **requires** `BENCH_REPAIR_REPOS` — it refuses to run unscoped.

- **I rewrote a 2.77M-row table to fix 53 rows, and it cost 6.5 GB.** `UPDATE analyses SET
  metrics_json = ...` with no scope tripled the table from 3.2 GB to 9.7 GB (49% dead tuples) and
  ran for the better part of an hour. Three mistakes compounded: no check of free disk or bloat
  before starting, one unbounded statement instead of batched, and then a second repair launched
  on top of the still-running first one, which deadlocked. `pg_cancel_backend` did not stop it;
  only `pg_terminate_backend` did. The lesson generalises past this task: **any bulk rewrite of a
  table this size must be scoped and batched first, and measured against free disk before it
  starts** — the same rule as vacuuming the fixture, arrived at the expensive way.
- **The clone had never been vacuumed.** It was bulk-loaded, so the visibility map covered ~2% of
    every large table and the planner could not consider an index-only scan at all. Every
    measurement taken before 2026-10-13 is pessimistic by up to 30× on those tables:
    `notification.getStats` read 993 ms and became 53 ms after one `VACUUM (ANALYZE)`, and a
    30-day `COUNT notifications` read 1031 ms and became 34 ms. **Every number in this board and
    in `db-index-audit.md` that predates the VACUUM has to be re-derived before it is used to
    justify a decision** — including decisions to add an index. I read the slow number, concluded
    the fix had not held, and rewrote the P2 row above before checking whether the fixture was
    the problem. It was.

## Measurement log

| Date | ID | Shape | Before | After | Delta |
| --- | --- | --- | ---: | ---: | ---: |
| 2026-10-11 | — | baseline audit, 64 shapes / 5355 execs | — | — | — |
| 2026-10-11 | P1 | dashboard, heavy user (5476 repos), `jit=on` | 6012 ms | 5775 ms | −4 % |
| 2026-10-11 | P1 | dashboard, buffers | 274 964 | 150 065 | −45 % |
| 2026-10-11 | P1 | dashboard, `jit=off` | 670 ms | 485 ms | −28 % |
| 2026-10-11 | P1 | equivalence: 60 users × 4 windows vs pre-rewrite SQL | — | 240/240 identical | ok |
| 2026-10-11 | P2 | `getStats` groupBy, 40 users | 483.4 ms | 1.9 ms | −99.6 % |
| 2026-10-13 | P2 | `getStats` groupBy, heaviest user (400 045 rows), **before** VACUUM | 993 ms | — | **artefact, not the app** |
| 2026-10-13 | — | `VACUUM (ANALYZE)` the whole clone; the fixture was bulk-loaded and never maintained | — | — | visibility map was 2% covered, no index-only scan available |
| 2026-10-13 | P2 | `getStats` groupBy, heaviest user, after VACUUM | 993 ms | **53 ms** | −94.7 % — the 1.9 ms did generalise after all |
| 2026-10-11 | P3 | 200k `audit_logs` inserts | 11 919 ms | 8 646 ms | −27 % |
| 2026-10-11 | P4 | `adminAudit.list` unfiltered | 1193.4 ms | 636.0 ms | −46.7 % |
| 2026-10-11 | P4 | `adminAudit.list` filtered | 577.0 ms | 577.0 ms | unchanged |
| 2026-10-11 | P4b | `bannedEmail.list` unfiltered | 6.7 ms | 4.9 ms | −27 % |
| 2026-10-11 | P5 | `pr-config.getConfig` ×200 | 0.228 ms | 0.068 ms | −70 % |
| 2026-10-11 | P6 | `adminAudit.list` filtered, +`(operation, created_at DESC)` | 1597.7 ms | 646.4 ms | −60 % |
| 2026-10-11 | P7 | admin user search | 218.2 ms | 8.0 ms | −96 % |
| 2026-10-12 | P1b | dashboard after `ALTER DATABASE … SET jit = off` | 5774.6 ms | 484.9 ms | −91.6 % |
| 2026-10-12 | — | `random_page_cost` 4.0 → 1.1, 10 probes | — | — | no plan or timing change |
| 2026-10-12 | C1 | `issue_comment.created`, 100 connected accounts on one repo | 201 queries | 3 queries | −98.5 % |
| 2026-10-12 | C9 | `readMultipleFiles`, 10 paths | ~30 queries | 2 queries | −93 % (GitHub API calls unchanged) |
| 2026-10-12 | C10 | `revokeAccessForEmail` | 3 queries | 2 queries | −1 query, loop removed |
| 2026-10-12 | P11 | `pull_request_analyses` admin page, offset 9900 | 989.3 ms | 11.1 ms | −98.9 % (31 MB index) |
| 2026-10-12 | P11 | `repos` admin page, offset 9900 | 159.3 ms | 12.4 ms | −92 % (7.9 MB index) |
| 2026-10-12 | P11 | `audit_logs` offset 9900, already indexed | 10.9 ms | — | no change needed |
| 2026-10-12 | P12 | `countAuditLogs` broad search, cap 10001 | 2774.8 ms | 37.8 ms | −98.6 % |
| 2026-10-12 | P12 | `countAuditLogs` unfiltered | 378.3 ms | 9.4 ms | −97.5 % |
| 2026-10-12 | P12 | capped vs exact count, 7 filter combinations | — | 7/7 identical | ok |
| 2026-10-12 | P13 | `pullRequestAnalysis.count()` unfiltered | 71.2 ms | skipped when unfiltered | −71 ms |
| 2026-10-12 | P8 | `notifications.title` selective, 1 row of 2.8M | 1222 ms | 9.7 ms | **126× — keep index** |
| 2026-10-12 | P8 | `notifications.body` selective, 1 row of 2.8M | 3405.7 ms | 1089.0 ms | **3.1× — keep index** |
| 2026-10-12 | P8 | `repos.name` selective, 1 row of 200k | 137.4 ms | 87.5 ms | **1.6× — keep index** |
| 2026-10-12 | P8 | `notifications` broad, 2M rows | 4162.8 ms | 7566.3 ms | 1.8× against |
| 2026-10-12 | — | `pg_class.reltuples` vs real rows, quiesced table | 3 400 000 | 3 399 891 | 0.003 % error |
| 2026-10-12 | — | `pg_class.reltuples` allowed drift on `audit_logs` | — | ±340 050 | 10 % (`autovacuum_analyze_scale_factor` 0.1) |
| 2026-10-12 | — | `MAX_PAGE=100` ceiling, `audit_logs` | skip 100 000: 466 ms | skip 9900: 54 ms | −88 % |
| 2026-10-12 | P14 | notifications, one user with 400 045 rows, page 1 + JOIN | 803.2 ms | 1.9 ms | −99.8 % |
| 2026-10-12 | P14 | same, repeated 5× (median) | — | 0.66 ms | −99.9 % |
| 2026-10-12 | P14 | same, deep page offset 9900 | — | 3.84 ms | — |
| 2026-10-12 | P14 | notifications + `type` filter | 207.4 ms | 0.26 ms | −99.9 % |
| 2026-10-12 | P14 | buffers read, page 1 | 20 912 | 6 | −99.97 % |
| 2026-10-12 | — | write: `audit_logs` 20k inserts | — | 691 ms (28 930 row/s) | baseline |
| 2026-10-12 | — | write: `notifications` 20k, with trigram | 5 532 ms | 3 615 row/s | — |
| 2026-10-12 | — | write: `notifications` 20k, without trigram | 3 618 ms | 5 527 row/s | **−53 % throughput** |

## Deliberately not doing

| Item | Why |
| --- | --- |
| Trigram indexes on `audit_logs` | Measured 0.6 % gain. The result set is the problem, not access. |
| **Trigram indexes on `notifications` and `repos`** | **Kept.** The original 0.6 % case was 16 %-selective and therefore not representative; selective searches are 1.6×–126× faster with them. Costs write throughput on `notifications` — a read-latency versus write-volume call, resolved in favour of reads. |
| `random_page_cost = 1.1` | Good default generally, but changes no plan here. |
| P10 composite indexes | Every affected query is under 10 ms; an index is pure write cost. The admin paths that *were* slow needed un-scoped indexes instead — those shipped as P11. |
| Optimising the 41 sub-millisecond shapes | Already fine. Don't touch. |
| Approximate count from `pg_class.reltuples` | 0.003 % accurate on a quiesced table, but ±10 % drift is allowed by the autovacuum threshold, it can read `-1` before the first analyze, and it cannot estimate a *filtered* count — which is the one that cost 2774 ms. The capped count removed the problem honestly instead. |
| Deferred join (select ids, then the page) | After P11 a page costs 11–13 ms. A second round trip to avoid fetching 10 rows buys nothing. |
| Cursor pagination everywhere | See "Pagination architecture" below. Offset is kept deliberately. |

## How the JIT change was applied

Per-database, not cluster-wide, and no secrets were involved:

```sql
ALTER DATABASE dxnx_web       SET jit = off;
ALTER DATABASE dxnx_web_stress SET jit = off;
```

Applies at login time, so existing pooled connections keep the old value until recycled.
Verify with `SHOW jit;` from a fresh connection, or
`SELECT datname, setconfig FROM pg_db_role_setting JOIN pg_database USING (oid);`

Per-session override still works for analysis: `SET jit = on;`

## Applying the same change on Neon

Everything below is from Neon's own docs (`/reference/compatibility`, `/manage/roles`,
`/connect/connection-pooling`), checked against the full `llms-full.txt` corpus.

### The trap first

Neon's PostgreSQL 19 tutorial page tells you to run:

```sql
ALTER SYSTEM SET jit = on;
SELECT pg_reload_conf();
```

**That fails on Neon.** There is no `superuser` — Neon substitutes `neon_superuser`, whose
privilege list (`CREATEDB`, `CREATEROLE`, `BYPASSRLS`, …) does not include `SUPERUSER`. That
page is a mirror of generic PG docs, not a platform instruction.

### Step 1 — check JIT is even compiled in

```sql
SELECT pg_jit_available();
```

If `false`, stop: none of this matters. Neon never documents `jit` or a `jit_provider`, so
their builds may omit `--with-llvm`. Run this **first** — it decides whether step 2 is worth
anything.

### Step 2 — database-level, as the branch's default role

```sql
ALTER DATABASE neondb SET jit = off;
```

- Neon's rule is that only `user`-context GUCs are configurable, and only per
  session / database / role. `jit` is `user`-context, so it qualifies.
- Use the **branch's default role** (`neondb_owner`). `ALTER DATABASE` needs the database
  owner. `neondb_owner` owns the database and is a member of `neon_superuser`.
- `neondb_readwrite` is **not** a Neon convention — zero hits in Neon docs, it is a Supabase
  name. If you created it yourself with `CREATE ROLE`, it is not the owner and the command
  fails.

Confirm before running:

```sql
SELECT current_user, session_user;
SELECT datname, datdba::regrole AS owner FROM pg_database WHERE datname = current_database();
```

### Step 3 — verify on a fresh connection

`SHOW jit;` does not say where the value came from. Use:

```sql
SELECT name, setting, source, context FROM pg_settings WHERE name = 'jit';
```

| column | expected |
| --- | --- |
| `setting` | `off` |
| `source` | `database` ← proof it took, not `default`/`override` |
| `context` | `user` |

`source` maps `default` → `session` → `role` → `database` → `database user`. Anything other
than `database` means it did not apply.

### Step 4 — repeat on every branch, in code

- Databases belong to a branch. A child branch inherits the parent's databases, so a branch
  created **after** the change inherits it; branches created before do not.
- **`reset from parent` and `instant restore` silently drop it** — a per-database GUC is
  catalog data in `pg_database.datconfig`, and both operations overwrite the branch's
  databases wholesale. Run the `ALTER DATABASE` **idempotently in bootstrap or a migration on
  every branch**, never once by hand.
- Scale-to-zero is fine: per-database settings are durable catalog data, not session state.
  Only a session-level `SET` is lost on wake.

### What to avoid

| Approach | Verdict |
| --- | --- |
| `ALTER SYSTEM` | No superuser. Fails. |
| `options=-c jit=off` in the URL | Works unpooled, **errors on the `-pooler` host** — PgBouncer accepts only `client_encoding`, `datestyle`, `timezone`, `standard_conforming_strings`, `application_name`. |
| Compute-level `pg_settings` via the Neon API | Schema is untyped; whether `jit` is allowlisted is undocumented. Also needs a compute restart and is per-endpoint, so read replicas each need it. |
| `neon_superuser` escalation | Scale plan only, and the docs say instance-level settings may not be supported at all. |

`ALTER DATABASE` is immune to the pooler precisely because it is catalog data rather than
session state — that is the argument for it over everything in the table above.

### Horizon

Neon runs **Postgres 14–18**, where `jit` still defaults to `on`. Upstream PG19 flips the
default to `off` — the release notes state JIT "added latency to short OLTP queries without
meaningful benefit for most workloads", which matches what P1b measured here. Neon has no PG19
yet and no changelog entry touching `jit`. When Neon ships PG19 this whole section becomes a
no-op — but the major-version upgrade is not in-place, it is a new project plus a data
migration.

## Regressions this work introduced, and how they were caught

None of these reached a branch — the unit suite caught all of them. Recorded because each one
was a **stale test asserting the old behaviour**, which is the dangerous kind: it passes
until the behaviour it guards is changed.

| Cause | Symptom | Fix |
| --- | --- | --- |
| P9 lowered `MAX_PAGE` | `repo.service.test.ts` held a **local copy** `const MAX_PAGE = 1_000_000`, so the clamp assertions went stale in 5 tests | Exported `MAX_PAGE` from `pagination.ts`; both test files now import it |
| **P9 lowered `MAX_PAGE`** | **`PaginationSchema` carried `.max(MAX_PAGE)`, so `?page=101` returned `400 Too big` instead of clamping.** All six frontend containers still clamp to `1_000_000`, so any bookmark past the cap threw. Introduced by P9, found while auditing the frontend | Removed `.max()` — `clampPage` is the single authority and already clamps. Any page now resolves to 1…100 |
| P7 dropped the `email ILIKE` clause | 2 tests in `admin-user.service.test.ts` still expected `email` in the search `OR` | Updated the expectations and renamed the test to state why email is excluded |
| C10 `findMany` → `findUnique` | 5 tests in `banned-email.service.test.ts` mocked `user.findMany` | Mock switched to `findUnique` |
| P2 added `where: { userId }` to `getStats` | 4 tests asserted `groupBy` was called with no `where` | Updated; the assertion now **guards** the fix instead of just passing |

The `MAX_PAGE` one is the interesting case: the constant existed in two places, so lowering it
in one silently invalidated the other. Same shape would have happened for any shared constant.

## Pagination architecture

Offset pagination is kept for the five admin/user lists. `audit.getActivityLogs` already uses
keyset, and `repo.getSlim` is consumed through `useInfiniteQuery` by the sidebar and command
menu.

**The `id` tiebreak is the thing that matters, not the pagination style.** `created_at` is not
unique — `audit_logs` has 245 000 groups of rows sharing a timestamp — so an index of
`(scope, created_at DESC)` cannot serve `ORDER BY created_at DESC, id DESC`. Postgres then
fetches every matching row and sorts before applying `LIMIT`. Measured on one user holding
400 045 notifications, page 1 with its `repos` join:

| | median | buffers |
| --- | ---: | ---: |
| `(user_id, created_at DESC)` | 803 ms | 20 912 |
| `(user_id, created_at DESC, id DESC)` | **0.66 ms** | **6** |

The same fix applies to the `is_read` and `type` variants (207 ms → 0.26 ms). Migration
`20261012081803_notifications_ordering_tiebreaker` drops the three old prefixes and creates the
three closed indexes.

Two rules now hold everywhere:

- every list orders by `ORDER_CREATED_AT_DESC`, or `orderWithTiebreak(sortBy, sortOrder)` when
  the caller picks the column;
- no index on a sort column is declared without the `id` that closes the order.

`repos.getSlim` had no tiebreaker (C12, fixed). `repos.getAll` sorted by a bare dynamic
`{ [sortBy]: sortOrder }`, so ties were unordered and a row could land on two pages or none —
now closed by `orderWithTiebreak`.

### One scheme for every list

Five services had near-identical `getAll` bodies: clamp the page, compute `skip`, fire
`findMany` plus a filtered and an unfiltered `count`, assemble `meta`. They now share
`getPaginatedList` in `server/utils/pagination.ts`, which owns page clamping, the count pair and
the `meta` shape. `countUnfiltered` is `null` when the request is unfiltered, which also
removed `repo.getAll`'s habit of counting the same row set twice whenever `owner == null`.

## C13 investigated — no live leak, but the guard is the wrong shape

Seven sites read through the un-enhanced `ctx.prisma`. Each was traced to the policy it skips
and to the `where` it actually runs:

| Site | Policy skipped | Actually filtered by | Verdict |
| --- | --- | --- | --- |
| `core/trpc/init.ts:165` | `User`: `auth() == this` | `where: { id: session.user.id }` | **identical result** — the raw client buys nothing |
| `repos/github-browse.router.ts` ×4 | `GithubInstallation`: `userId == auth().id` | services pass an explicit `userId` from the session into every `findFirst`/`findFirst` inside `resolveClientContext` | no leak, scoping is **manual** |
| `repos/github-app.router.ts` ×3 | same | `getMyRepos` reads via `db` (policy-enforced); only the write path is raw | no leak |
| `users/user.service.ts:97,198` | `User` | own `userId`; only caller passes `session.user.id` | safe today, **fragile by signature** |
| `users/admin-user.service.ts:256` | `Session`: `auth() == user` | behind `adminProcedure`, where the policy allows any row | no leak |

So nothing leaks today. **The real problem is that the protection is a convention, not a rule.**
Every one of these is scoped by remembering to pass the right `userId` from the right place. Add a
query to a service that receives `prisma` and forget the filter, and nothing stops you — no test,
no type, no runtime error.

### What the investigation turned up instead

`syncInstallations` upserted with `update: { userId }` keyed on `where: { id }`. A GitHub App
installation is **one row per organisation**, so whichever account synced last overwrote the
owner and the first workspace silently lost its integration, along with every repo, analysis and
PR tied to it.

`saveInstallation` already guarded against exactly this — it updates only
`where: { id, OR: [{ userId: null }, { userId }] }` and throws *"This installation is already
linked to another workspace"* otherwise. **So the schema and the intent were both correct; the
automatic sync path simply did not honour the rule the explicit path enforced.**

Fixed by giving `syncInstallations` the same guard: it updates only an unclaimed row or one it
already owns, never carries `userId` in the update, skips-and-logs when the row belongs to
another workspace, and creates only when no row exists at all. Pinned by
`github-app.service.test.ts`.

## Still open

| ID | Item | Severity | Why it is not closed |
| --- | --- | --- | --- |
| C13 | ZenStack policies bypassed through the un-enhanced `ctx.prisma` | **security** | Investigated: no live leak at any of the 7 sites, all self-scoped or admin-gated. The hazard is that the guard is a convention rather than a rule. **The investigation found a worse adjacent bug — see "C13 investigated".** |
| **C15** | **`github-app.service.ts` sync overwrote `userId`** | **cross-tenant data loss** | **fixed** — the sync path now obeys the same ownership rule `saveInstallation` already enforced. |
| C14 | Eight `findMany` calls with no `take`, reachable from user-facing procedures | unbounded | `analysis-lifecycle`, `analysis.repository` (`documents[]` nested, reachable from 9 procedures), `pr-impact` (plus `_count.comments` per row), `pr-comments`, `agent`, `api-key`. All fast at current volume, all grow without limit. |
| C4 | Audit rows outlive a rolled-back transaction | correctness | `db.ts` writes through the raw client captured before `$extends` and defers via `runAsBackgroundTask`, so the trail records attempts rather than outcomes. Needs a transactional writer or an outbox — a design change. |
| — | Neon `jit = off` | config | Not applied. Needs a Neon session, and a decision on `pg_jit_available()` first. |
| — | `analyses_repo_id_status` / `documents_repo_id` | unaccounted | **resolved** — never had a migration and were never measured; removed from the clone, dev and stress now match at 85 indexes. |
| — | The URL lies past the cap | UX | `?page=100000` is accepted and silently shows page 100. GitHub returns 404. Fix is either a canonical redirect or a 404. |
| — | Offset not keyset | perf | Deep pages cost 36 ms against 6.8 ms for a cursor at the same depth. Only matters if the cap is raised again. |
| — | Concurrency | **closed** | Driven with 8→64 parallel writers against 8→24 readers. Zero deadlocks, zero serialization failures, zero pool exhaustion at 88 of 100 connections. See below. |

## Concurrency

The audit was single-session, so write contention, lock waits and pool behaviour were never
exercised. `bench:concurrency` drives real parallel writers and readers and reports percentiles
rather than a single number.

| Writers | Readers | Rows written | Throughput | p50 | p95 | p99 | Worst max |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 8 | 8 | 98 600 / 15 s | 6 516 rows/s | 1.4–4.4 ms | 2.8–6.8 ms | 4.0–8.8 ms | 64.9 ms |
| 24 | 16 | 154 200 / 20 s | 7 626 rows/s | 3.3–7.4 ms | 6.6–12.7 ms | 8.9–16.8 ms | 62.2 ms |
| 64 | 24 | 184 200 / 20 s | 8 982 rows/s | 7.1–12.5 ms | 13.3–23.6 ms | 18.4–37.3 ms | 111.1 ms |

No errors in any run: no `40P01` deadlock, no `40001` serialization failure, no pool
exhaustion at 88 of 100 connections. Throughput *rose* with writer count while latency grew
roughly linearly — graceful degradation, not a cliff.

### The baseline above only measured half the write

Every run above inserted into `audit_logs` alone. That is the cheap half: `db.ts:159` writes a
notification *and* an audit row, so a real mutation is two statements and touches the GIN trigram
indexes that `notifications` maintains. `CONC_WRITE=notification` reproduces the real write.
The difference is in the tail, not the median:

| | 8 writers, audit only | 24 writers, notification + audit |
| --- | ---: | ---: |
| `audit page1` p50 / p95 / p99 | 1.4 / 2.9 / 4.4 ms | 4.0 / 374 / 1820 ms |
| `audit page1` worst max | 23.5 ms | 4 400 ms |
| `notifications deep page` p50 / p99 | 3.4 / 8.1 ms | 28.0 / 126 ms |
| reader errors | none | none |

The median barely moves; p99 moves by two orders of magnitude. A load test that reported only a
mean or a median would have called this identical to the cheap path.

### Transactional contention on one row

`CONC_WRITE=transaction` mirrors `analysis-lifecycle.service.ts:295-351`: one `UPDATE analyses`
that takes a row lock, then five `document.upsert` calls contending on
`(repo_id, version, type, analysis_id)`, then a notification insert — **all writers targeting the
same analysis**.

24 writers, 8 readers, 15 s: **zero errors.** No `40P01`, no `40001`, no leaked `P2002`. The
upserts serialise on the unique index and absorb each other through `ON CONFLICT`, and readers
stayed flat (`audit page1` p50 4.0 ms, p99 10.5 ms). The row lock is taken and released per
transaction, so nothing accumulates.

### The failure point

`max_connections = 100` locally. At 110 writers + 6 readers:

```
ошибки писателей:
   11×  connect 53300: sorry, too many clients already
ошибки читателей:
    6×  connect 53300: sorry, too many clients already
```

Two things worth recording:

- **The readers all failed, not just some.** When the connection budget is exhausted the app does
  not degrade — reads are refused outright. The latency table came back empty for that reason.
- **The harness had to survive to report this.** `client.connect()` sat outside the error handler,
  so the first refusal killed the process with an unhandled rejection, at exactly the moment the
  run existed to observe. Connect is now caught for both writers and readers.

### Two cleanup bugs this task found in the harness

Both were caught by the post-run count check, which is the reason it exists:

- Deleting by `model = 'Conc'` missed the audit rows written in notification mode, because those
  carry `model = 'Notification'` — **33 400 rows leaked into the fixture.** Cleaning up by model
  is not safe: the stress fixture legitimately contains 230 770 `Notification` rows of its own.
  Audit rows now carry `{"bench":"conc"}` in their payload and cleanup matches on that.
- The total-count check compared against a baseline taken at start, which a *running application
  server* legitimately moves, because `db.ts` writes an audit row for every mutation. It fired on
  ordinary traffic. The invariant is now "zero harness-tagged rows remain"; the total is reported
  as a delta.

The transaction mode additionally overwrites `analyses.message` and `analyses.progress` on a real
row, so it snapshots both before the run and restores them after. Verified: analysis restored, 5
harness documents deleted, both table deltas `+0`.

**What this does not cover:** it exercises PostgreSQL, not the application. Prisma's pool size,
`poolConnects` and `poolWaiting` on a real deployment are separate — read
[`runbooks/db-telemetry.md`](./runbooks/db-telemetry.md) for those. On serverless or Neon the
ceiling is the platform's connection budget, not this number.

Closed by measurement or retraction rather than by a code change: C2, C3, C5, P10, the
`audit_logs` trigram indexes, P8, `random_page_cost`, `reltuples`, the deferred join, and the
41 sub-millisecond query shapes.

