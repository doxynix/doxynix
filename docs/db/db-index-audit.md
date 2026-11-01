# Database index audit — `dxnx_web` under load

## Index verdicts re-tested 2026-10-13

`idx_scan` cannot answer whether an index earns its write cost: on a clone it means "not
exercised", and in production it needs weeks. The only honest local answer is to time the query
with the index and without it, on this data. `bun run bench:index-ab --index <name> 'label=sql'`
drops the index, re-times, recreates it, re-times again, and reports the ratio. The post-restore
timing is the one used, because a recreated index is in arbitrary physical order until vacuumed.

| index | size | query | with p50 | without p50 | verdict |
| --- | ---: | --- | ---: | ---: | --- |
| `users_created_at_id_idx` | 1.4 MB | admin list page 1 | 1.14 ms | 23.08 ms | **20.2× faster — keep** |
| `users_created_at_id_idx` | 1.4 MB | admin list, offset 9 900 | 2.82 ms | 38.75 ms | **13.7× faster — keep** |
| `users_created_at_id_idx` | 1.4 MB | `COUNT users` | 7.87 ms | 7.85 ms | no benefit, as expected |
| `passkeys_user_id_idx` | 1.6 MB | per-user lookup | 0.93 ms | 11.26 ms | **12.1× faster — keep** |
| `passkeys_user_id_idx` | 1.6 MB | per-user count | 1.33 ms | 11.32 ms | **8.5× faster — keep** |
| `notifications_user_id_type_created_at_id_idx` | 192 MB | per-user + type, page 1 | 0.95 ms | 0.88 ms | no benefit — another index covers page 1 |
| `notifications_user_id_type_created_at_id_idx` | 192 MB | per-user + type, offset 9 900 | 3.73 ms | 13.19 ms | **3.5× faster — keep** |

Three conclusions the earlier audit reached for the wrong reason:

1. **`users_created_at_id_idx` is justified.** It was flagged for re-verification because P10's
   decision to drop composite indexes had been justified by "every affected query is under 10 ms",
   measured on a different query set. On the actual query it is 20× slower without the index.
2. **`passkeys_user_id_idx` was dismissed for the wrong reason.** The audit recorded it as "cheap
   here only because the table is tiny". True in absolute terms — 0.93 ms with the index — but the
   sequential scan it replaces costs 11.3 ms. Absolute speed was never the question; the ratio is.
3. **The 192 MB `notifications_user_id_type_created_at_id_idx` looks redundant on page 1 and is
   not.** `notifications_user_id_created_at_id_idx` already serves page 1, so the type index
   measures as dead there — but at offset 9 900 it is 3.5× faster than the alternatives, and that
   offset is reachable (`MAX_PAGE = 100` caps `skip` at 9 900). Judging an index by its first-page
   behaviour alone would have dropped a 192 MB index that is load-bearing at depth.

This is the same failure mode as the trigram indexes below: a leftmost-prefix or first-page
argument that is structurally true and practically wrong.

### The four largest migration-added indexes, re-tested on the vacuumed clone

| index | size | query | with p50 | without p50 | verdict |
| --- | ---: | --- | ---: | ---: | --- |
| `audit_logs_created_at_id_idx` | 171 MB | audit page 1 | 0.24 ms | 388.15 ms | **1617× — keep** |
| `audit_logs_created_at_id_idx` | 171 MB | audit page 1, offset 9 900 | 1.46 ms | 384.86 ms | **264× — keep** |
| `audit_logs_request_id_idx` | 204 MB | `request_id` exact match | 0.31 ms | 2489.94 ms | **8032× — keep** |
| `audit_logs_request_id_idx` | 204 MB | `request_id` `ILIKE` prefix | 1109 ms | 1092 ms | no benefit — btree cannot serve `ILIKE` |
| `notifications_user_id_is_read_created_at_id_idx` | 192 MB | `getStats` `GROUP BY is_read` | 28.00 ms | 173.43 ms | **6.2× — keep** |
| `notifications_user_id_is_read_created_at_id_idx` | 192 MB | page filtered by `is_read` | 0.63 ms | 0.57 ms | no benefit — another index covers page 1 |
| `notifications_user_id_created_at_id_idx` | 167 MB | notifications page 1 | 0.61 ms | 0.45 ms | no benefit |
| `notifications_user_id_created_at_id_idx` | 167 MB | notifications, offset 9 900 | 1.31 ms | 2.59 ms | **2.0× — keep** |
| `notifications_user_id_type_created_at_id_idx` | 181 MB | per-user + `type`, offset 9 900 | 3.73 ms | 13.19 ms | **3.5× — keep** |

**No index came back unjustified.** The three `notifications_user_id_*` indexes total 540 MB and
each is the cheapest route for one specific access pattern, while a neighbouring index serves the
first page. Judged by first-page behaviour alone — which is how the earlier audit nearly dropped
the 181 MB one — all three would have looked dead.

The pattern is consistent: each is redundant at page 1 and load-bearing at depth, or redundant for
the list and load-bearing for the aggregate. `getStats` is the clearest case: the 192 MB index buys
6.2× on the query the dashboard runs on every sidebar mount, and nothing else on the table serves
it.

**Not re-tested.** `idx_scan = 0` on the clone is still not evidence of deadness, so nothing has
been dropped on local data alone. `notifications_body_trgm_idx` (227 MB) and
`audit_logs_request_id_idx` (204 MB) are the largest and are the obvious next candidates, but both
need production observation, not a synthetic A/B.

> **Stale as of 2026-10-13.** Every number below was taken before the clone was vacuumed. The
> clone was bulk-loaded and never maintained, so its visibility map covered ~2% of each large
> table and the planner could not consider an index-only scan. Re-measured on the same shapes
> after one `VACUUM (ANALYZE)`, `notification.getStats` went 993 ms → 53 ms and a 30-day
> `COUNT notifications` went 1031 ms → 34 ms — up to 30× faster with **no code or index change**.
>
> That means the slow figures in this document are pessimistic by an unknown amount per shape, and
> some of the indexes added below may have been justified by a number that was really the
> planner's blindness. Treat the *reasoning* here as sound and the *timings* as unverified until
> they are re-derived. Method and thresholds live in
> [`../apps/web/scripts/scenarios.md`](../apps/web/scripts/scenarios.md).

Generated against a purpose-built clone of `dxnx_web` at 11 GB / ~18M rows.
Every number below was measured, not estimated. Companion to
[`runbooks/db-telemetry.md`](./runbooks/db-telemetry.md) — that doc tells you how to read
production telemetry, this one records what the data looks like when you push on it.

## Scope and method

| | |
| --- | --- |
| Target | `apps/web` — Prisma 6 + ZenStack 2 + tRPC |
| Engine | PostgreSQL 18.6 |
| Clone | `dxnx_web_stress`, created with `CREATE DATABASE ... TEMPLATE dxnx_web` |
| Schema | identical to production (22 tables, 83 indexes) |
| Coverage | 64 query shapes, 5355 executions |

Each shape was read out of the source, rewritten as SQL with the ZenStack policy
predicate expanded by hand, and timed in a `DO` block against power-law-distributed
parameters. Index usage was attributed by running the whole workload after
`pg_stat_reset()` and reading `pg_stat_user_indexes.idx_scan`.

### Dataset

| Table | Rows | Total |
| --- | ---: | ---: |
| `analyses` | 2 773 235 | 2871 MB |
| `audit_logs` | 2 970 357 | 2670 MB |
| `documents` | 1 335 561 | 1606 MB |
| `notifications` | 2 804 475 | 1142 MB |
| `pull_request_comments` | 2 796 031 | 827 MB |
| `chat_messages` | 2 552 519 | 823 MB |
| `pull_request_analyses` | 809 169 | 524 MB |
| `repos` | 200 397 | 182 MB |
| `sessions` | 400 000 | 149 MB |

Indexes: 2861 MB, **34.3 % of heap**. Distribution is deliberately skewed — one user owns
5476 repos, the median owns 3, and the busiest repo carries 4976 analyses — because that is
what breaks the planner.

### What the clone cannot tell you

`idx_scan = 0` on a synthetic clone is meaningless; it means "not exercised", not "dead".
Statements below about redundant indexes are derived structurally (leftmost-prefix
overlap) plus code references, not from the counter. **Confirming unused indexes requires
weeks of production observation.** Likewise the concurrency numbers are single-session:
this harness could not drive parallel sessions, so write-contention, lock waits, and
pooling under load are untested here.

## Headline results

- **41 of 64 shapes run under 1 ms.** The per-row paths are genuinely well indexed;
  `sessions.token_hash` is 0.05 ms, `api_keys.hashed_key` 0.48 ms, every
  `analyses.findFirst` 0.4–0.7 ms.
- **The cost is concentrated in aggregation and search**, not in point lookups.
- **Trigram indexes are not the fix for the audit search.** Verified experimentally
  (below) — adding three GIN indexes moved the number by 0.6 %.

## Slower than 100 ms — 9 of 64

| ID | Query | Source | avg ms | max ms | rows |
| --- | --- | --- | ---: | ---: | ---: |
| L3 | `audit_logs` search `model/operation/requestId ILIKE` | `admin-audit.service.ts:16-44` | **8824** | 9602 | 1 095 817 |
| — | dashboard stats (single call) | `prisma/sql/getDashboardStats.sql` | **4840** | 16214 | — |
| L2 | `adminAudit.list` + 2× `count()` | `admin-audit.service.ts:55-64` | **584** | 620 | 3 000 000 |
| P5 | `adminReview.list` + 2× `count()` | `admin-review.service.ts:86-94` | **582** | 1104 | 809 242 |
| N2 | `getStats` `groupBy(isRead)` with no `where` | `notifications.service.ts:134-137` | **473** | 768 | — |
| N3 | notification search `title/body ILIKE` | `notifications.service.ts:14-31` | **380** | **5757** | — |
| U7 | admin user search `email ILIKE` | `admin-user.service.ts:79-90` | **205** | 225 | 1 |
| U4 | `adminUser.getAll` + 2× `count()` | `admin-user.service.ts:193-202` | 41 | 50 | 50 001 |
| N1 | `notification.getAll` + 2× `count()` | `notifications.service.ts:109-119` | 21 | 412 | 20 062 |

## The dashboard query — JIT is the real cost

Measured on the real `getDashboardStats.sql` for a user with 5476 repos.

| Configuration | avg ms |
| --- | ---: |
| Baseline | 6012 |
| + query rewrite | 5775 (−4 %) |
| Baseline, `jit = off` | 670 |
| **Rewrite, `jit = off`** | **485** |

An earlier version of this section claimed the rewrite alone was worth 4×. **That was
wrong.** It was measured with the candidate indexes dropped, which changed the plan enough
that the cost estimate stopped crossing the JIT threshold, and the JIT saving got credited
to the rewrite. Re-measured with everything else held constant: the rewrite is 28 %, and
the rewrite plus `jit = off` is 12×.

Where the time actually goes:

- **JIT is ~5300 ms of the 5775 ms baseline — 88 % of the query.** The plan cost sits far
  above `jit_above_cost` (100000) and `jit_optimize_above_cost` (500000), so the planner
  compiles 91 LLVM functions before executing anything. On a query that touches thousands of
  rows that is a pure loss.
- The rewrite cuts **buffers from 274 964 to 150 065 (−45 %)** — five `Aggregate` nodes each
  running a 5449-row nested loop collapse into one materialised `status_agg` CTE.
- What is left once JIT is gone: the `latest_per_repo` `DISTINCT ON` sort (6207 rows) and the
  nested loop over the user's repos.

The rewrite is still worth shipping — half the I/O for nothing. But the lever that matters
is JIT, and that is a server setting rather than a query change.
## Trigram indexes on `audit_logs` do not help — measured

The obvious hypothesis was "the audit search needs `gin_trgm_ops`". Tested both ways:

| | without trgm | with 3× GIN trgm (375 MB) |
| --- | ---: | ---: |
| L3 broad OR, 1.1M matching | 8824 ms | 8087 ms (−8 %) |
| selective term, 461k matching | 3543 ms | 3523 ms (**−0.6 %**) |

At 15–36 % selectivity a sequential scan is the correct plan and the planner knows it. The
query returns over a million rows; the cost is the result set, not the access path. Those
three indexes were dropped again — 375 MB of write overhead for no gain.

This is also why the existing trigram indexes look dead: the ZenStack policy usually narrows
by `user_id` first, which is more selective than any `contains` predicate.
`users_name_trgm_idx` is the exception and does work — `users.name` is TEXT, and a single
column hits a bitmap index scan in 1.03 ms.

### Correction: the trigram indexes must be kept

An earlier version of this document recommended dropping all six trigram indexes, based on
`idx_scan = 0` plus a 0.6 % measurement. **That measurement was invalid.** It used a term
matching 461 000 rows out of 2 970 000 — 16 % selectivity, where a sequential scan is
genuinely the right plan and no index can help. It proved only that a broad search does not
benefit, not that the indexes are useless.

Re-measured with genuinely selective terms (1 row matched) against the same database:

| Query | with trigram | without | |
| --- | ---: | ---: | --- |
| `notifications.title ILIKE '%Bench A 92403%'` | **9.7 ms** | 1222 ms | **126× for** |
| `notifications.body ILIKE '%Repository 156506 produced…%'` | **1089 ms** | 3406 ms | **3.1× for** |
| `repos.name ILIKE '%repo_199999%'` | **87 ms** | 137 ms | **1.6× for** |
| `notifications` broad, 2M rows (`OR` over title+body) | 7566 ms | **4163 ms** | 1.8× against |

The index is chosen correctly and returns the right rows; on the `notifications` body case it
reads 14 509 buffers to reach one row because the trigram posting lists are long, but a
sequential scan of 2.8M rows is worse still.

So all six stay. There is a real cost to keeping them — removing them raised `notifications`
insert throughput by 58 % in the same harness — so this is a read-latency versus write-volume
trade-off, not a free win. It was resolved in favour of reads because a 126× regression on a
user-facing admin search is worse than slower writes on a table that is not on a hot path.


## `users.email` cannot be trigram-indexed

`adminUser` search is `email contains`. The column is `@db.Citext` **and**
`@encrypted` — values look like `v1.aesgcm256.90d8776c....`.

```
users.name  ILIKE '%48213%'  →  Bitmap Index Scan,   1.03 ms
users.email ILIKE '%48213%'  →  Seq Scan,           64.00 ms
```

`gin_trgm_ops` does not match citext's `~~*` operator, so no index on that column is
reachable — and plaintext search over a ciphertext column is meaningless anyway.

An expression index does work:

```sql
CREATE INDEX users_email_trgm_idx ON users USING gin ((email::text) gin_trgm_ops);
```

| | avg ms |
| --- | ---: |
| current `email ILIKE` | 212 |
| expression trigram index | **0.22** (969×) |

The lasting fix is a normalised plaintext column, or dropping email search from the admin
list — the data is encrypted and there is nothing to search.

## Deep offset pagination — now bounded

Originally `utils/pagination.ts` set `MAX_PAGE = 1_000_000` while `PaginationSchema` capped
`limit` at 100, so `skip = (page - 1) * limit` could reach 99 999 900:

| skip | avg ms |
| ---: | ---: |
| 0 | 64 |
| 10 000 | 81 |
| 100 000 | 146 |
| 199 900 | 161 |

`MAX_PAGE` is now **100**, which caps `skip` at 9 900. Re-measured on the same database:

| Query | no supporting index | with index |
| --- | ---: | ---: |
| `audit_logs`, skip 9900 | 10.9 ms (already indexed) | — |
| `repos`, admin path, skip 9900 | 150 ms | **12.4 ms** (7.9 MB index) |
| `pull_request_analyses`, admin path, skip 9900 | 989 ms | **11.1 ms** (31 MB index) |
| `audit_logs`, skip 100 000 (no longer reachable) | 466 ms | — |

The two admin paths were not suffering from deep offset at all — they were **sorting the whole
table**, because no index matched their sort order. `repos` had only `repos_user_id_updated_at_idx`,
which a policy-filtered per-user query can use but an admin query cannot; `pull_request_analyses`
had only `(repo_id, created_at DESC)`. Adding `(created_at DESC, id DESC)` and
`(updated_at DESC, id DESC)` turned a parallel sequential scan plus top-N sort into an index scan.

The `id` column is part of both indexes because every list orders by `(createdAt DESC, id DESC)`;
without the tiebreaker the planner has to fall back to an incremental sort.

### Pagination architecture

Offset pagination is kept deliberately, not converted to cursors:

- With `MAX_PAGE = 100` the worst reachable offset is 9 900, and after the indexes above every
  list answers in 11–13 ms. There is nothing left for a cursor to fix.
- `repo.getAll` sorts by a **user-chosen** column (`name | updatedAt | createdAt`) and
  direction — six combinations. A cursor would need a different key per combination, including
  a composite `(name, id)` for the name sort.
- Admin UIs rely on jumping straight to a page number. Keyset pagination gives up that ability.

What a cursor *would* buy is the GitHub-style endless-scroll UX, which is a product decision
rather than a performance fix. Note that `repos.getSlim` sorted by `updatedAt DESC` with no
`id` tiebreaker, which made its ordering non-deterministic and its pagination unstable; that
is fixed.


## Unbounded queries

Confirmed by reading every call site. None are slow at current volume; all grow without
limit.

| Query | Source | Note |
| --- | --- | --- |
| `analyses.findMany` by repo, no `take` | `analysis-lifecycle.service.ts:166` | 3022 rows on a hot repo |
| `documents[]` nested in `getRepoSnapshot`, no `take` | `analysis.repository.ts:50-65` | reachable from 9 procedures |
| `generatedFixes.findMany` by repo, no `take` | `analysis.repository.ts:188` | |
| `pullRequestAnalyses.findMany` by repo, no `take` | `pr-impact.service.ts:130` | plus `_count.comments` per row |
| `pullRequestComments.findMany` by analysis, no `take` | `pr-comments.service.ts:11` | |
| `chatMessages.findMany` by session, no `take` | `agent.service.ts:42` | pulls encrypted `parts` blobs |
| `apiKey.findMany` by user, no `take` | `api-key.service.ts:53` | |
| `sessions.findMany` by user, no `take` | `admin-user.service.ts:230` | |

`workspaceService` holds no queries of its own — all six of its procedures funnel through
`getRepoSnapshot`, whose nested `documents` relation has no `take`.

## Correctness bugs found while auditing

These are not performance issues and were confirmed by reading the code.

1. **`github_id` is not unique, but four webhook handlers treat it as if it were.**
   `20260528164259_add_agent_chat_and_auth_hardening/migration.sql:20` dropped
   `repos_github_id_idx`; the only unique index left is `(github_id, user_id)`.
   `push-webhook-handler.ts:26`, `issue-comment-webhook-handler.ts:16`,
   `review-comment-webhook-handler.ts:20` and `pr-webhook-handler.ts:42` all use
   `findFirst({ githubId })` with no `orderBy`. `repository-webhook-handler.ts:19` uses
   `deleteMany({ githubId })` and `sync-repo-metadata.ts:32` uses
   `updateMany({ githubId })` across 15 columns. Measured: **2 rows affected per event**.
   One GitHub repo connected by two users means one deletion removes both.

2. **Keyset pagination is semantically wrong.**
   `audit.service.ts:20-28` uses `cursor: { id }` together with
   `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`, which Prisma compiles to
   `id > $cursor` against a descending sort. Rows are skipped and repeated. This is the
   only keyset pagination in the app.

3. **`repo.deleteMany()` with no `where`** — `repo.service.ts:148`. Only the ZenStack policy
   prevents a global wipe. `deleteByOwner` at `:157` also omits `user_id`.

4. **Audit rows outlive rolled-back transactions.** `db.ts:202` writes through
   `baseClient` — the raw client captured before `$extends` — and is deferred via
   `runAsBackgroundTask`. The audit trail records attempts, not outcomes.

5. **`passkeys` has no index on `user_id`.** `trpc/init.ts:165-168` runs
   `_count.passkeys` in the admin gate on every admin request. Cheap here (0.02 ms) only
   because the table is tiny.

6. **`getRepoBySha` loses its `orderBy`** — `analysis.repository.ts:228-232` overrides the
   base select and drops `createdAt: "desc"`, so "latest DONE analysis for this SHA" is
   chosen non-deterministically.

7. **Failsafe guard checks the wrong field.** `init.ts:140` tests
   `safePayload?.analysisId != null` while `:141` reads `safePayload.prAnalysisId`.
   `analyze-pr` payloads carry no `analysisId`, so cleanup never fires.

8. **ZenStack policies are bypassed in several places** — `ctx.prisma` is the un-enhanced
   client. Used by `user.service.ts:97,198`, `admin-user.service.ts:255`, all of
   `github-app.service.ts`, `cleanup-db.task.ts`, and `agent-github-reply.task.ts:30`,
   which reads `github_installations` with no `user_id` scoping at all.

## Changes applied to the stress database

Applied and left in place so the behaviour can be reproduced by hand.

```sql
CREATE INDEX analyses_repo_id_status_created_at_idx ON analyses(repo_id, status, created_at DESC); -- 131 MB
CREATE INDEX audit_logs_operation_created_at_idx   ON audit_logs(operation, created_at DESC);      --  95 MB
CREATE INDEX documents_repo_id_created_at_idx       ON documents(repo_id, created_at);               --  44 MB
CREATE INDEX users_email_trgm_idx ON users USING gin ((email::text) gin_trgm_ops);                -- 1.9 MB
```

Nine indexes with zero measured usage were dropped: `audit_logs_model_request_id_idx` (211 MB,
superseded by `audit_logs_request_id_idx`), `notifications_body_trgm_idx` (191 MB),
`notifications_title_trgm_idx` (38 MB), `repos_{name,owner,description}_trgm_idx` (14 MB),
`repos_topics_idx` (496 kB), `chat_sessions_user_id_idx`
(strict prefix of `chat_sessions_user_id_updated_at_idx`).

**That list was wrong, and the drops were reverted.** `users_name_trgm_idx` was named here as
dropped while the section above said it works — it does, and it is still present. The five
trigram indexes were also restored after re-measurement showed they are worth 1.6×–126× on
selective searches; see "Correction: the trigram indexes must be kept". Only
`audit_logs_model_request_id_idx`, `repos_topics_idx` and `chat_sessions_user_id_idx` are
genuinely redundant and remain dropped in migration `20261011191213`.

**Write throughput improved 58 %** from removing them alone: 400k `notifications` inserts
took 64 894 ms with all indexes, 41 098 ms without (6164 → 9734 rows/s). With the trigram
indexes restored, expect the slower figure.

`audit_logs_operation_created_at_idx` is the single best-value index in the set:
`adminAudit.list` goes **359 → 8 ms (44×)** for 95 MB.

## Recommendations, in order

Status column reflects what is actually in the tree now, not what was intended.

| # | Recommendation | Status |
| --- | --- | --- |
| 1 | Rewrite `getDashboardStats.sql` — collapse the five `COUNT(CASE …)` subqueries into one pass | **done**, buffers −45 %, equivalence proven 240/240 |
| 2 | Stop running unfiltered `count()` in `admin-audit`, `banned-email` and `admin-review` | **done** in all three; the audit count additionally became capped (see below) |
| 3 | Fix the audit search — bound it, drop the unbounded count, do **not** add trigram indexes | **done** via a capped count: 2774 ms → 38 ms, and 378 ms → 9 ms unfiltered. No trigram index added |
| 4 | Add the `where` to `notification.getStats` | **done** |
| 5 | Make `github_id` unique in intent — scope the webhook lookups | **done** in all four handlers |
| 6 | Fix the keyset cursor in `audit.service.ts` | **not a bug** — retracted, see the board |
| 7 | Cap `MAX_PAGE` well below 1 000 000 | **done**, now 100 |
| 8 | Add `(user_id, created_at DESC, id DESC)` for `sessions`, `users`, `banned_emails`, `api_keys` | **dropped** — those tables are small and every affected query is already under 10 ms. The admin paths that *were* slow needed the un-scoped indexes added in migration `20261012072030` instead |
| 9 | Decide what to do with the encrypted `email` | **done** — email search removed from the admin list |
| 10 | Approximate count from `pg_class.reltuples` | **not adopted** — accuracy measured at 0.003 % on a quiesced table, but `autovacuum_analyze_scale_factor = 0.1` allows 340 050 rows of drift on `audit_logs`, and it cannot estimate a *filtered* count at all, which is the expensive one |
| 11 | Deferred join — select ids first, then the page | **not adopted** — after the indexes a page costs 11–13 ms, so a second round trip buys nothing |

## Correctness status

Of the eight defects recorded above, five are fixed (1, 5, 6, 7 in the bug list) and three are
reclassified:

- **Defect 2 (keyset cursor)** — retracted. Prisma compiles a `cursor` on a unique field with a
  composite `orderBy` into the correct tuple comparison. `audit-pagination.test.ts` exists to
  guard it.
- **Defect 3 (`deleteMany()` with no `where`)** — **not a data-loss bug.** `Repo` carries
  `@@allow('read,delete', auth() == user || auth().role == 'ADMIN')`, so the policy already
  scopes both `deleteAll` and `deleteByOwner` to the caller's own rows. Worth an explicit
  `where` as defence in depth, not as a correctness fix.
- **Defect 8 (ZenStack policies bypassed via `ctx.prisma`)** — **still open**, and the only
  item on this list with security rather than performance weight. Live sites:
  `core/trpc/init.ts:165` (the admin gate), `repos/github-browse.router.ts` (4 uses),
  `repos/github-app.router.ts` (3 uses).


## Reproducing

```bash
DATABASE_URL=postgresql://postgres:123456@localhost:5432/dxnx_web_stress bun run dev # secretlint-disable-line -- compose.yml dev credentials
```

Per-shape timings for all 5355 executions are stored in the `_bm` table in
`dxnx_web_stress`. The clone is disposable; `DROP DATABASE dxnx_web_stress` removes it.
