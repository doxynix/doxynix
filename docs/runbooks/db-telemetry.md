# Reading DB telemetry

## Fields on `db.slow` and `db.write`

- `durationMs` — wall-clock around the Prisma call. Contains pool acquisition,
  network round-trip, query execution, and decryption of `@encrypted` columns.
  It is **not** server-side query time.
- `fields.path` — the tRPC procedure that issued the query. Since the fix in
  `request-context.ts`, batching no longer overwrites this: every procedure in
  a batch gets its own scope.
- `poolWaiting` / `poolTotal` / `poolIdle` — present **only** when at least one
  request was queued for a connection at log time. Absence means no queueing.

## Triage

| Symptom | Reading | Next step |
| --- | --- | --- |
| `durationMs` high, `poolWaiting` absent | Real DB cost | `EXPLAIN (ANALYZE, BUFFERS)` the query |
| `durationMs` high, `poolWaiting` high | Pool starvation | Size the pool, or cut query count |
| `durationMs` high on `Document`/`ChatMessage` only | Decryption cost | Move decryption out of the hot path |
| Many models slow at one timestamp | Instance-level stall | Check provider-side, not indexes |

## Queries

Slow queries, worst first:

```
['web-production']
| where message == "Slow DB Query"
| extend poolBound = isnotnull(['fields.poolWaiting'])
| summarize count() by entity_action, poolBound, max(['fields.durationMs']) as worst
| sort by worst desc
```

Pool-bound share:

```
['web-production']
| where message == "Slow DB Query"
| summarize count() as total, countif(isnotnull(['fields.poolWaiting'])) as poolBound
```

## Why the pre-2026-10 numbers were untrustworthy

`fields.path` was last-writer-wins across a whole tRPC batch, so per-procedure
attribution was arbitrary, and `durationMs` had no pool-wait breakdown. Any
conclusion drawn from those two fields before this change should be re-derived.