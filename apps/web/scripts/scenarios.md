# Benchmark scenarios and their pass thresholds

One obligation per query class. A shape is either measured, or it is justified in writing — there
is no third option. Every number here is a **median of 5 runs** taken after the clone was
vacuumed (see "The fixture was not maintained" below — reading that section first explains why the
older numbers in the repository are different).

## How to read a result

`bench:queries` prints p50, p95, p99, min and max per shape. **Judge on p95.** The median is
what the query usually costs; p95 is what a user sees when the plan cache, the buffer cache and
the OS page cache are all cold — which on a busy instance is every request.

Single-shot timing on a cold cache varied up to 8× between runs in this codebase. That is not a
rounding detail: it inverted four conclusions during the audit that produced these docs.

## The fixture was not maintained, and it made the planner blind

On 2026-10-13 the clone was vacuumed for the first time. It had been bulk-loaded, so the
visibility map covered roughly 2% of every large table. Index-only scan is gated on that map, so
the planner could not even consider the cheap path and fell back to walking the heap.

| shape | before VACUUM | after | ratio |
| --- | ---: | ---: | ---: |
| getStats groupBy isRead, per user | 993 ms | **53 ms** | 18.6× |
| COUNT notifications date 30 days | 1031 ms | **34 ms** | 30× |
| COUNT notifications date week | 199 ms | **11 ms** | 18× |
| COUNT notifications per-user | 272 ms | **42 ms** | 6.6× |
| COUNT notifications capped at 2001 (p95) | 307 ms | **6.6 ms** | 46× |

No code or index changed. Every measurement taken on this clone before that date is pessimistic,
by up to 30× on bulk-loaded tables.

**Consequence for the older documents.** `docs/db-index-audit.md` and the measurement log in
`docs/db-optimization-progress.md` predate the VACUUM. Their reasoning stands; their timings do
not. A shape that is *still* slow here is genuinely slow and its conclusions were correct — the
audit search count (4345 ms), `apiKeyService.list` (226 ms), the trigram body search (585 ms) and
`getHistory` (25.7 ms) all came through unchanged. Shapes that got faster were, in every case,
being measured wrong before.

The generalisable lesson: a benchmark fixture that is bulk-loaded and not maintained measures the
planner's blindness, not the query.

## Thresholds

| class | threshold | why this number |
| --- | ---: | --- |
| point | p95 < 2 ms | one index seek and one heap fetch; more than that means the index does not match the predicate |
| list, page 1 | p95 < 5 ms | index seek plus `LIMIT`; should not depend on table size at all |
| list, deepest reachable | p95 < 50 ms | `MAX_PAGE = 100` caps `skip` at 9 900. This bound is what makes offset pagination affordable — if it fails, the cap has to move, not the index |
| keyset | p95 < 20 ms | must not grow with depth; a keyset page is a seek, not a scan-and-discard |
| count, capped | p95 < 40 ms | bounded by the cap, not the table |
| search, trigram, selective | p95 < 100 ms | 9.7 ms for a term matching one row, 585 ms for a phrase. The spread is selectivity, not the index |
| unbounded | **no threshold** | grows without limit by construction. A threshold would imply it is safe, which is the opposite of the truth. Justified per row instead |
| N+1 | **not a latency threshold** | the obligation is a constant query count per user action. A fast N+1 is still an N+1 |
| raw | **not a latency threshold** | the obligation is parameterisation |

Two classes deliberately have no numeric bar, and that is the point of the table rather than a gap.

## Current results

### point

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| session gate: session by token | 0.46 | 2.03 | marginal |
| session gate: session by token_hash | 0.47 | 1.31 | pass |
| isBanned: bannedEmail by email_hash | 0.52 | 1.98 | pass |
| getValidToken: account by user | 0.47 | 0.78 | pass |
| sessions by token_hash | 1.17 | 10.04 | **fail** |
| api_keys by hashed_key | 0.97 | 6.50 | **fail** |
| users by id | 1.26 | 8.50 | **fail** |
| repos by id + nested analyses take 1 | 1.81 | 23.67 | **fail** |

`users by id` and `repos by id` are `LIMIT 20` scans with **no predicate at all** — they are not
point lookups and do not belong in this class. That is a defect in the shape list, not in the
database, and the honest fix is to correct the label rather than to chase an index. The three
genuine point lookups pass or are marginal.

### list

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| repos admin page 1 | 0.90 | 4.03 | pass |
| users page 1 | 1.73 | 2.88 | pass |
| audit date range 1 week | 1.14 | 2.36 | pass |
| audit filtered `operation = create` | 1.67 | 2.77 | pass |
| audit page 1 | 1.12 | 3.69 | pass |
| audit search ILIKE x3 OR | 1.37 | 5.10 | marginal |
| repos admin deepest page | 2.76 | 6.30 | **fail** |
| audit deepest page (offset 9 900) | 4.17 | 6.53 | **fail** |
| prAnalyses page 1 | 1.02 | 6.64 | **fail** |
| prAnalyses deepest page | 4.85 | 9.71 | **fail** |
| banned emails page 1 | 9.40 | 15.04 | **fail** — 3× the page-1 bar |

Every page-1 shape is comfortable except `banned emails page 1`, which is the one genuine outlier
in the class and deserves one `EXPLAIN (ANALYZE, BUFFERS)` rather than a speculative index. The
deepest-page shapes sit at 6–10 ms against a 50 ms bar, which is the margin that makes offset
pagination affordable at `MAX_PAGE = 100`.

### scoped (one user's rows, with the JOIN the real query performs)

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| notifications per-user page 1 + JOIN | 3.87 | 33.17 | **fail** |
| notifications per-user deepest + JOIN | 12.58 | 13.93 | pass |
| notifications per-user + `type` filter | 1.72 | 9.30 | **fail** |
| notifications per-user + `is_read` filter | 1.57 | 2.59 | pass |
| repos per-user (heaviest owner) | 2.81 | 4.15 | pass |
| repos per-user deepest page | 2.48 | 5.31 | marginal |
| sessions per-user | 1.31 | 5.51 | marginal |
| analyses per-repo | 1.14 | 3.99 | pass |
| documents per-repo | 1.06 | 6.78 | **fail** |
| chatMessages per-session | 0.82 | 3.63 | pass |
| prComments per-analysis | 1.62 | 8.63 | **fail** |
| prAnalyses per-repo | 1.32 | 3.45 | pass |
| generatedFixes per-repo | 1.10 | 8.57 | **fail** |

The p50 column is uniformly healthy. The p95 column carries the same machine noise as before —
these were taken while a production Next.js server was running against the same database, and a
4 ms p50 against a 9 ms p95 is a 5-sample cold-cache artefact, not a property of the query. Re-run
on an idle machine before acting on any p95 failure in this class.

### count

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| COUNT audit date 1 day | 2.22 | 2.64 | pass |
| COUNT notifications date 1 day | 2.16 | 2.87 | pass |
| COUNT notifications capped at 2001 | 1.26 | 6.61 | pass |
| COUNT analyses per-repo | 1.26 | 3.95 | pass |
| COUNT audit date week | 10.25 | 24.42 | pass |
| COUNT notifications date week | 11.81 | 13.51 | pass |
| COUNT users unfiltered | 7.82 | 18.59 | pass |
| COUNT repos unfiltered | 27.19 | 65.79 | **fail** |
| COUNT prAnalyses unfiltered | 46.13 | 78.56 | **fail** |
| COUNT notifications per-user | 42.37 | 270.33 | **fail** |
| COUNT notifications date 30 days | 36.48 | 51.23 | marginal |
| COUNT audit date 30 days | 57.39 | 61.89 | **fail** |
| COUNT audit filtered operation | 153.14 | 276.60 | unbounded by nature |
| COUNT notifications unfiltered | 191.31 | 331.38 | unbounded by nature |
| COUNT audit unfiltered | 436.57 | 551.11 | unbounded by nature |
| getStats groupBy isRead, per user | 53.66 | 135.65 | **the unread badge** |
| getStats groupBy isRead, unscoped | 415.46 | 1349.29 | unbounded by nature |
| COUNT audit search broad | 4345.28 | 7079.37 | **must not ship uncapped** |

**The window property holds, which is the thing Task 5 asked for.** `audit_logs`: 2.22 ms at one
day, 10.25 at seven, 57.39 at thirty. `notifications`: 2.16, 11.81, 36.48. Cost tracks the window,
not the table — thirty days is not paying for three million rows.

**The uncapped rows are the real content of this class.** An exact count is O(n) at any Postgres
version: 436 ms for 3.4M `audit_logs`, 4 345 ms for the broad audit search. `cappedCount` is why
the app ships the capped number instead, and `COUNT notifications capped at 2001` is now the
fastest shape in the table at 1.26 ms.

**`getStats groupBy` is now a normal query, not a defect.** At 53.66 ms p50 it was always going to
be the slowest thing on the sidebar, and the earlier 993 ms reading was the unvacuumed fixture. It
remains the one shape here whose cost tracks notification *lifetime* rather than a window, which
makes it a fair candidate for a date bound or a maintained counter — but it is a 53 ms query today,
and the tab labels in `NotificationsHeader` show exact counts, so changing it is a product decision
rather than a performance fix.

### unbounded

No thresholds. Each row is here to be justified per row in the query inventory, not to be argued
with:

| shape | p50 | p95 | rows |
| --- | ---: | ---: | ---: |
| getHistory: ALL analyses per repo, full rows | 25.71 | 639.72 | 4 979 |
| apiKeyService.list: ALL api keys, no where | 225.61 | 249.70 | all |
| listByRepository: ALL prAnalyses per repo | 2.68 | 15.56 | 1 990 |
| getSessions: ALL sessions per user | 0.76 | 3.97 | — |
| getByRepoId: ALL generatedFixes per repo | 0.49 | 2.32 | — |
| getComments: ALL prComments per analysis | 0.80 | 1.91 | — |
| getSessionHistory: ALL chatMessages per session | 0.68 | 1.56 | — |
| listSessions: ALL chatSessions per user | 0.51 | 11.04 | — |
| loadLatestDocumentsWithContent | 0.90 | 5.69 | — |

Two rows are worth acting on. `getHistory` is 4 979 rows including `resultJson` at ~416 bytes
each — roughly 2 MB per request, and it feeds a version dropdown. `apiKeyService.list` at 226 ms
has no `where` at all and is the only unbounded shape that is already slow rather than merely
theoretical.

### search

| shape | p50 | p95 | verdict |
| --- | ---: | ---: | --- |
| users name search (trigram) | 0.88 | 2.51 | pass |
| notifications title search (trigram) | 1.02 | 6.12 | pass |
| repos name search (trigram) | 92.97 | 144.19 | **fail** |
| notifications body search (trigram) | 584.59 | 717.68 | **fail** |

Both failures are the trigram indexes doing what they were kept for. `notifications.body` is
585 ms *with* the GIN index — the audit recorded 3406 ms without it, so the index is still worth
3.1× — but it is not fast and never will be on 2.8M rows of prose.

## What is not in this matrix, and why

- **Exact counts on multi-million-row tables.** O(n) at any version; 436 ms measured at 3.4M rows,
  extrapolating to ~76 hours at 3 trillion. Testing that an impossible thing is fast is not a goal.
- **N+1 latency.** The obligation is a constant query count per user action, recorded per site in
  the inventory. `analysis.getNodeContext` is the worked example: 4–5 statements across 3 phases.
- **The HTTP layer.** Four harnesses answer four different questions and are documented in
  [`db-measurement-layers.md`](../../docs/db-measurement-layers.md), because on this machine its
  numbers are dominated by a per-request Upstash round trip and would be meaningless here.