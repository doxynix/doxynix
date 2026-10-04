# Reading DB telemetry

## Fields on `db.slow` and `db.write`

- `durationMs` — wall-clock around the Prisma call. Contains pool acquisition,
  network round-trip, query execution, and decryption of `@encrypted` columns.
  It is **not** server-side query time.
- `fields.path` — the tRPC procedure that issued the query. Since the fix in
  `request-context.ts`, batching no longer overwrites this: every procedure in
  a batch gets its own scope.
- `poolConnects` — connections opened since this instance started. Flat on a warm instance, `1`
  on a cold serverless container, so a slow query logged with `poolConnects: 1` is mostly
  connection setup rather than query cost.
- `poolWaiting` / `poolTotal` / `poolIdle` — `poolWaiting` counts requests queued for a
  connection; `0` means nobody waited, `poolTotal` is the pool ceiling.

## Triage

| Symptom | Reading | Next step |
| --- | --- | --- |
| `durationMs` high, `poolWaiting` 0, `poolConnects` 1 | Cold serverless start | Move behind PgBouncer / Accelerate / Neon |
| `durationMs` high, `poolWaiting` high | Pool starvation | Size the pool, or cut query count |
| `durationMs` high, `poolWaiting` 0, `poolConnects` > 1 | Real DB cost | `EXPLAIN (ANALYZE, BUFFERS)` the query |
| `durationMs` high on `Document`/`ChatMessage` only | Decryption cost | Move decryption out of the hot path |
| Many models slow at one timestamp | Instance-level stall | Check provider-side, not indexes |

`poolConnects` counts connections opened since the instance started. On a long-lived
instance it stays flat; a fresh serverless container starts at 1. A slow query logged
with `poolConnects: 1` was the first query the instance ever ran, and its `durationMs`
is mostly TCP+TLS+auth rather than query cost — `poolWaiting` cannot show this, because
a cold start has one caller and no queue.

Read it as a ratio, not an absolute: group by instance via `fields.instance` if present,
otherwise compare the first slow query of a burst against later ones in the same burst.

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