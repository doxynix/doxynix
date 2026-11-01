# Database tooling: what is here, and what is worth adding

## The four harnesses in the repository

| command | question it answers | needs |
| --- | --- | --- |
| `bun run bench:queries` | what does this shape cost **in the database** | `DATABASE_URL` |
| `bun run bench:concurrency` | how does it behave **under parallel load** | `DATABASE_URL` |
| `bun run bench:driver` | what does it cost **through the application client** | `BENCH_DATABASE_URL` |
| `bun run bench:http` | what does it cost **end to end over HTTP** | running server, session cookie, podman |
| `bun run bench:stats` | what does the server **actually run** | `pg_stat_statements` |

A sixth, `bun run check:index-parity`, is not a benchmark: it refuses to let the two databases
drift apart, which is the precondition for every number above being comparable.

The layers are described, with the measured gap between them, in
[`db-measurement-layers.md`](./db-measurement-layers.md).

## `pgbench` — verified working

The plan stated that `pgbench` is **not present** in `postgres:18-alpine`, that the image ships
client tools only, and that adopting it needs a second Postgres install or a different image.
Both halves are false.

```
$ podman exec doxynix-postgres pgbench --version
pgbench (PostgreSQL) 18.6
```

**The obstacle is a different one.** `pgbench` reads its branch and teller counters at startup
from `pgbench_branches` and `pgbench_tellers`, and those tables have to live in the database it
connects to:

```
pgbench: error: could not count number of branches:
ERROR:  relation "pgbench_branches" does not exist
pgbench: hint: Perhaps you need to do initialization ("pgbench -i") in database "dxnx_web_stress".
```

There is no flag pointing the counters elsewhere — `-D` is `--define`, for script variables.
`pgbench -i -s 1` against the clone takes **0.21 seconds** and about 15 MB, and the four tables
are dropped afterwards.

### Measured with app-shaped SQL

Three real shapes, one per transaction, four clients for ten seconds:

| statement | latency |
| --- | ---: |
| `audit_logs` page 1 | 0.122 ms |
| `notifications` per-user page 1 | 0.160 ms |
| capped count | 0.480 ms |

**4619 tps, 0.761 ms average, zero failed transactions** — on a table of 3.4M rows, against
shapes `bench:queries` reports at 2–3 ms. Under real concurrency they are three times cheaper.

### The most useful thing it produced

The first run of that shape file came back at **3.7 tps and 915 ms average**, against the same
data. The difference was one line: the hot key had been resolved with an inline

```sql
WHERE user_id = (SELECT user_id FROM notifications GROUP BY 1 ORDER BY count(*) DESC LIMIT 1)
```

— a subquery over 2.8M rows re-executed on every transaction. Removing it took the run from
3.7 tps to **4619 tps, ×1250**. That is the same defect `assertNoSubqueryInWhere` guards against in
`bench:queries.ts`, now confirmed by two independent harnesses rather than by argument.

**Adopted**, with the caveat that it needs `pgbench -i` in the target database and cleanup after.

## External tools

Adopted:

- **k6** — via `podman run grafana/k6`, no system install. It is the only way to see
  serialization, tRPC routing and the encryption extension in one number, and `bench:http` is
  built on it. Requires `--network=host`, since `localhost` inside the container is the container.

Not adopted, with reasons:

| tool | verdict |
| --- | --- |
| PEV2 / explain.dalibo.com | Probably the right answer for plan analysis: free, open source, and it parses `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, which `bench-queries` can emit today via `BENCH_EXPLAIN=1`. **Not evaluated in this session** — the claim comes from the plan and was not independently checked. |
| pgMustard | The plan calls it unmaintained. **Not evaluated in this session.** |
| pganalyze | Commercial. Its hosted query-analytics tier overlaps what `pg_stat_statements` gives for free, and this project has not outgrown that. |
| Artillery | Overlaps k6. No reason to run two load generators. |

## What is deliberately not being automated

- **Exact `COUNT` on multi-million-row tables.** O(n) at any Postgres version. Measured 313 ms at
  3.4M rows, which extrapolates to roughly 76 hours at 3 trillion. The capped count and the
  `reltuples` estimate are the answers; making an exact count fast is impossible, so testing
  that it is fast is not a meaningful goal.
- **Automatic index recommendations.** On a synthetic clone `idx_scan = 0` means "not exercised",
  never "dead". An index may only be removed on production evidence.
- **Alerting on `db.slow` thresholds taken from these numbers.** The telemetry measures around
  Prisma, so it carries a 2–3 ms constant the database never spent. See
  [`runbooks/db-telemetry.md`](./runbooks/db-telemetry.md).

## Integration tests: `bun run test:int` works out of the box now

It used not to. The script inherits `DATABASE_URL` from Doppler, which points at the development
database, and the suite refuses to run against anything whose name lacks `test` because
`cleanupDatabase()` truncates shared tables between files. The guard was right and the wiring was
wrong, so every invocation failed.

`scripts/with-test-db.ts` rewrites the URL before the runner starts:

```
dxnx_web → dxnx_web_test        (derived)
dxnx_web_test → unchanged
anything without "test" → refused
```

Override with `TEST_DATABASE_URL`. 113 of 114 tests pass; the one failure was the better-auth rate
limiter tripping because the endpoint had just been hammered, not a code fault.
