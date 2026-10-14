# The four measurement layers, and why they disagree

Every query in `apps/web` can be timed four ways. They disagree by 3–5×, and they disagree in a
consistent direction: each layer adds a roughly constant overhead on top of the one below it.
A number taken from the wrong layer is not a smaller error — it is a different question, and
the four answers are not comparable to each other.

| layer | harness | what it includes | what it excludes |
| --- | --- | --- | --- |
| 1. database | `bench:queries` | server-side execution, planning, index access, row transfer | Prisma, the app, the network |
| 2. client | `bench:driver` | the above plus the driver adapter, Prisma's query engine | the app's own code, HTTP, serialization |
| 3. HTTP | `bench:http` (k6) | the above plus tRPC routing, ZenStack policy evaluation, the field-encryption extension, JSON serialization, middleware | nothing — this is the whole request |
| 4. production | `bench:stats` | what actually ran, weighted by real call volume | the workload you chose; only as good as the reset discipline |

## Measured gap between layers 1 and 2

2026-10-12, `limit` 20, median of 20, single session, `dxnx_web_stress`:

| shape | raw pg | app Prisma | gap |
| --- | ---: | ---: | ---: |
| audit page 1 | 0.82 ms | 4.21 ms | +412 % |
| session by token | 0.67 ms | 3.01 ms | +348 % |
| users page 1 | 0.78 ms | 3.62 ms | +367 % |
| notifications capped count | 8.44 ms | 8.95 ms | +6 % |

Prisma's constant overhead is ~2–3 ms. It doubles a fast query and vanishes on a slow one, so
the *relative* severity of two shapes is preserved while the absolute numbers are not.

### What this means for `db.slow`

`docs/runbooks/db-telemetry.md` measures **around Prisma**. A reported 4 ms may be 0.8 ms of
database and 3.2 ms of client. Any threshold set against that log must subtract the layer, or it
will reject healthy queries and accept sick ones. A 2 ms database query and a 2 ms application
bug produce the same telemetry line.

## The HTTP layer, and the constant it hides

2026-10-12, production build (`next build` + `next start`), single VU, 150 ms pacing, the account
has no repos and no notifications, so the database side is trivial:

| endpoint | p50 | p95 | p99 | min | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| `notification.getStats` | 532 | 752 | 784 | 508 | 792 |
| `notification.getAll` | 535 | 728 | 977 | 518 | 1039 |
| `repo.getSlim` | 528 | 621 | 639 | 509 | 643 |
| `repo.getAll` | 532 | 575 | 583 | 519 | 585 |
| `analytics.getTrends` | 530 | 618 | 639 | 503 | 644 |
| `analytics.getDashboardStats` | 544 | 636 | 668 | 520 | 676 |

All milliseconds. Every endpoint lands within 16 ms of every other one, while layer 1 puts the
same shapes at single-digit milliseconds. **The request cost is a per-request constant, not the
query.**

### Where the constant is

| request | bypasses the global limiter | time to first byte |
| --- | --- | ---: |
| `/robots.txt` | yes | 3 ms |
| `/api/trpc/…` | no | 530 ms |
| `/api/status` | no | 810 ms |

`proxy.ts` builds a global rate limiter when `IS_PROD`, and `isBypassRoute` exempts only
`/api/auth`, `/api/webhooks`, `/_axiom`, the analytics tunnels and four static paths — `/api/trpc`
is not among them. The limiter is configured with `enableProtection: true`, and in
`@upstash/ratelimit` that forces an extra `checkDenyList(this.primaryRedis, …)` on every
`limit()` call, alongside the sliding window:

```js
this.enableProtection ? checkDenyList(this.primaryRedis, this.prefix, definedMembers) : …
```

That call goes to Redis and cannot be served from `ephemeralCache`, so every non-exempt request
pays one round trip to Upstash. Measured from this host, a single Upstash pipeline costs 0.95 s,
then 4.64 s, then 17.8 s. The limiter's own `timeout: 800` is what turns that into a bounded
~530 ms rather than a 17-second hang.

### What this measurement is and is not

It is **not** a statement that the app spends 530 ms per request in production. The constant is
this machine's network path to Upstash; from Vercel the same call is a different number. It is
a statement that on this path the database is not the bottleneck, and that a per-request external
call sits in front of every non-exempt route.

The honest conclusion is a ratio, not a level: **of a ~530 ms request, the query is under 1 %.**
Any optimisation aimed at the indexes will not be visible at this layer until the middleware cost
is addressed.

### A hypothesis that was wrong

An unpaced run fires 24 requests per iteration against a `slidingWindow(20, "10 s")` limiter and
returned 4 non-200 responses, which looked like throttling and would have explained the whole
constant. It was tested by adding a 150 ms pause: latency did not move (p50 530 → 544), but all
four failures disappeared and the run reported 90/90. The limiter was rejecting the unpaced run
and was not the source of the latency. Recorded because the unpaced numbers are still in the
first version of this document's table above.

## What could not be measured

`src/server/core/db.ts` cannot be imported from a bare script. The chain is `next/axiom` →
`next/navigation` → `app-router-context` → `react.createContext`, which does not exist outside a
React renderer; `bun --conditions react-server` clears `server-only` but not this. `bench-driver`
therefore rebuilds the client directly and **omits the field-encryption extension**, because
importing it pulls `env.server.ts` whose zod schema rejects a bare script. Layer 2 is therefore
not a measurement of `db.ts` as written, and should not be cited as one.

The HTTP layer is the only harness that observes the encryption extension, which is part of why
it is worth having despite the constant above.

## Running the harnesses

```bash
cd apps/web
export DATABASE_URL=postgresql://postgres:123456@localhost:5432/dxnx_web_stress # secretlint-disable-line -- compose.yml dev credentials

bun run bench:queries                                  # layer 1
bun run bench:concurrency                              # behaviour under parallel load
bun run bench:driver                                   # layer 2
bun run bench:stats                                    # layer 4

# layer 3 — needs the server already running and pointed at the same database:
#   doppler run -- bash -c 'DATABASE_URL=…dxnx_web_stress bun x next start'
BENCH_SESSION_COOKIE='<value of __Secure-doxynix.session_token>' bun run bench:http
```

`bench:http` runs k6 through podman and passes `BENCH_SESSION_COOKIE`, `BENCH_BASE_URL`,
`BENCH_ITERS`, `BENCH_WARMUP` and `BENCH_PACE_MS` through with `-e`. `--network=host` is
required: `localhost` inside the container is the container.

### Layer 4 needs a reset

`pg_stat_statements` accumulates, and on a long-lived clone the list fills with statements from
tooling that is no longer in the repository — including, on this clone, a one-off data-generation
query costing 7.4 s that appears nowhere in the tree. Without a reset the "top statements" list
is a history of every experiment ever run, not of the app.

```bash
STATS_RESET=1 bun run bench:stats   # then generate the workload, then read it
```

It is also worth knowing that the benchmark harness outranks the app in that list. Resolving the
hot keys was fourteen full-table `GROUP BY` scans costing ~13 s in total — orders of magnitude
more than the shapes being measured. Those keys are now cached in
`/tmp/opencode/bench-hot-keys.json` (`BENCH_REKEY=1` forces a refresh), which took a filtered run
from 10.14 s to 0.16 s and removed the harness from the top of its own profile.
