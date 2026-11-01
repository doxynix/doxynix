# Audit trail architecture — review, options and migration plan (2026-11-01)

Everything `apps/web` does with audit data, what the industry does, and one recommended path.
Companion to [`db-query-review-2026-11.md`](./db-query-review-2026-11.md) (R1 measures what the
current interceptor costs per write), [`db-query-inventory.md`](./db-query-inventory.md) (call
sites) and [`db-optimization-progress.md`](./db-optimization-progress.md) (round 1).

**Scope: `apps/web` only.** `apps/siem-server` is explicitly out of scope for this design
(decision 2026-11-01); nothing here assumes a second database, a second service, or a new HTTP
surface between apps.

Written because the current design mixes three different jobs into one mechanism, and because the
question "should this be in Redis / should it be a global middleware at all" has a technical
answer, not a taste answer.

**Status: proposal. Nothing here is implemented.** The migration steps at the end are checkboxes
so they can be tracked like the round-2 list.

## Method and honesty section

- Read: `core/db.ts`, `prisma/models/core.zmodel`, `modules/audit-logs/*`,
  `entities/audit-log/*`, `modules/system/tasks/cleanup-db.task.ts`, both READMEs.
- Researched with Tavily and Context7; sources at the bottom. Nothing was benchmarked for this
  document — the per-write cost figures are *counts* of operations from R1, not timings.
- Two claims are explicitly **unverified** and marked as such below (whether `after()` is
  reachable in a Trigger.dev worker, and the real size of `resultJson`).

---

## 1. What exists today

| Piece | Where | State |
| --- | --- | --- |
| Writer | `src/server/core/db.ts:185-262` | Prisma `$allOperations` on every model. After each audited operation it calls `baseClient.auditLog.create` (`:200`) with `sanitizePayload(args)` (`:203`), and for 13 models in `AUDIT_BUSINESS_MODELS` also publishes an Ably event (`:212-218`). |
| Connection | `core/db.ts:82-90, 150-158` | `baseClient` is the **unextended** client over a `pg.Pool` (default max 10). Any open interactive transaction holds a different connection. |
| Table | `prisma/models/core.zmodel:78-98` | `model`, `operation`, `payload Json`, `requestId`, `userId`, `ip`, `userAgent`, `createdAt`. **No `workspaceId`.** Append-only (`@@allow('update,delete', false)`), but `@@allow('create', true)`. |
| Indexes | same | `requestId`; `(createdAt desc, id desc)`; `(userId, operation)`; `(operation, createdAt desc)`. |
| Reader (user) | `modules/audit-logs/audit.router.ts`, `audit.service.ts` | `getActivityLogs` — cursor feed of the caller's own rows; `getLogPayloadHtml` renders the raw `payload` JSON as highlighted HTML. |
| Reader (admin) | `modules/audit-logs/admin-audit.*` | `cappedCount` + `getPaginatedList`, filters by model/operation/date/search; detail returns the whole row. |
| Projection | `audit.mapper.ts` | Derives `targetName` by switching on `log.model` and reading `payload.data.*`; maps device from UA. |
| Cleanup | `modules/system/tasks/cleanup-db.task.ts` | Deletes `verification`, `sessions`, `webhook_deliveries`, and billing payloads. **`audit_logs` is never pruned.** |

Observations that follow directly:

1. The table is **user-scoped, not workspace-scoped**. A team member cannot see a colleague's
   actions; a workspace owner cannot audit their own workspace. For a product sold per workspace
   that is a product gap, not a preference.
2. `@@allow('create', true)` means any code path that writes through the *enhanced* client
   (`ctx.db`) may insert an audit row. The current writer bypasses policies (it uses `baseClient`),
   so the policy can be tightened to `false` with no behavioral change.
3. Retention does not exist. In the round-1 stress fixture `audit_logs` had the two largest
   indexes in the database (`created_at_id_idx` 171 MB, `request_id_idx` 204 MB) at ~3.4M rows.

---

## 2. Three jobs hiding behind one word

| Job | Audience | Question it answers | Shape it wants |
| --- | --- | --- | --- |
| **Product activity feed** | workspace members | "what happened in my project and who did it" | domain events, workspace-scoped, readable sentences |
| **Security / compliance trail** | admin, auditor, incident response | "who signed in, who changed roles/keys, who was denied" | append-only, IP/UA/outcome, admin-only, years of retention |
| **Row-level forensics** | engineer | "which request changed this row" | model + operation + row id + request id, no payload |

Today all three are written by the same interceptor into the same table and read by the same
projection. OWASP makes the same separation explicit: *"Process monitoring, audit, and transaction
logs/trails etc. are usually collected for different purposes than security event logging, and
this often means they should be kept separate."*
([OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html))

So the answer to "do I need audit logging at all" is yes — three times, with three budgets. The
answer to "should one mechanism produce all three" is no.

Is it worth it for *this* product? Yes, for two reasons beyond generic SaaS: the product audits
other people's code, so "our own audit trail can be inspected and is append-only" is a sales argument;
and the activity feed already ships in the UI, so the cost of doing it well is mostly re-labelling
what is already written.

---

## 3. Why the global Prisma interceptor cannot be the foundation

Not a style objection. Five hard limits, in order of severity.

### 3.1 It cannot participate in the caller's transaction

A Prisma query extension receives `{ model, operation, args, query }`. It does **not** receive the
transaction client, so an audit write from inside a hook always goes through the root client — a
different pooled connection. If the caller is inside `$transaction`, that connection is busy:

> "`await prisma.auditLog.create(...)` tries to insert an audit log entry, but it hangs until the
> transaction timeouts because it is not running within the transaction." — Prisma discussion
> [#20016](https://github.com/prisma/orm/discussions/20016), which reproduces exactly this pattern
> for an audit extension.

This repository has that exact structure (`baseClient.auditLog.create` while `tx` is open) and
compensates with generous limits — `transactionOptions: { maxWait: 20_000, timeout: 30_000 }`
(`core/db.ts:134-137`). Two things keep it from biting today:

- in HTTP requests `runAsBackgroundTask` defers the audit write into `after()`, i.e. after the
  response and after commit;
- most single-row mutations never open a transaction at all.

**Unverified:** the exact behaviour inside a Trigger.dev worker. `core/db.ts:24-40` documents that
`next/server` is "not always resolvable" there, and even when it resolves, `after()` outside a
request scope throws and is caught (`:57-70`). Either path lands on `await task()` in production
(`:73-80`) — synchronous audit inside the run. `saveResults`
(`analysis/services/analysis-lifecycle.service.ts:409-482`) performs **8** audited writes inside
one transaction, 7 of which also publish to Ably. With 10 pool connections and a few concurrent
analyses this is a queue on the pool, and the 30 s limit is the blast radius.

### 3.2 It is blind to batch operations

`createMany`, `updateMany`, `deleteMany` return a count. There is no row list, so there is nothing
to record beyond "something changed". This codebase uses `updateMany` for exactly the operations
one would want to audit (`access-revocation.ts:28`, billing projections, notification
`markAllAsRead`, admin bulk paths).

### 3.3 It has no domain meaning

`Document.upsert` is, at the same time, "the user published a doc", "the AI pipeline re-generated
the README", and "a migration rewrote a section". The user-facing feed needs a verb, not a table
name: *"audit logs should be thought in terms of the domain, not the storage model"*
([technowizardry](https://www.technowizardry.net/2022/05/how-to-build-a-useful-service-data-change-audit-log)).
This is why the current feed shows rows like `Modified · Document` and the detail sheet has to
show raw JSON to be useful at all.

### 3.4 It cannot see anything that is not a write

The most interesting security events are not writes: failed sign-ins, 403s on a foreign
workspace, denied tool calls, rate-limit hits, exports/downloads. Those never reach a query hook.
A security trail built on row writes is structurally incomplete.

### 3.5 It pays the serialization cost of the whole payload

`sanitizePayload` runs `safeJsonClone` over the entire `args` (`utils/sanitize-payload.ts:79-100`)
before truncating strings to 1 KB (`:46, 69-73`). For `analysis.update({ data: { resultJson: … } })`
that means serializing a multi-megabyte object so that at most ~1 KB per field survives. Cost is
paid at write time, benefit is capped at 1 KB.

**Conclusion:** keep the interceptor, but demote it. It is a *forensic safety net* — "this row was
touched by this request" — and nothing else. Payload, Ably and domain meaning belong somewhere
else.

---

## 4. Where to write: direct insert, outbox, or Redis

| | direct insert in the request | **Postgres outbox in the same transaction** | Redis buffer + cron flush |
| --- | --- | --- | --- |
| Atomic with the business write | only if it shares the transaction | **yes** | **no** — dual write |
| Loss on crash | none | **none** | yes (eviction, restart, network) |
| Ordering | by `uuidv7` / timestamp | same | not guaranteed across workers |
| Cost per mutation | +1 INSERT + payload serialization + Ably call | **+1 INSERT in an already-open transaction** (same connection, one WAL record) | +1 network hop to an external service |
| Fan-out (Ably, Axiom) | inside the request | outside, batched | outside, batched |
| Replay / idempotency | none | `delivered_at IS NULL` + batch | manual, at-least-once |
| Extra infrastructure | none | a scheduled task (already exists) | a new failure domain |

**Recommendation: Postgres outbox, one table, no Redis.**

- The transaction is already open in the cases that matter; a one-row insert is the cheapest
  durable thing available.
- `delivered_at` makes the audit table *also* the outbox — no second table, no dual-write problem.
- A Trigger.dev `schedules.task({ cron: "* * * * *" })` drains it. The repo already runs scheduled
  tasks (`daily-database-maintenance`), so this is not new infrastructure.
- The drainer is the right place for everything currently done in the hot path: Ably publish and
  the optional Axiom forward.

Redis is the wrong default because it breaks atomicity and durability. That is not a theoretical
worry: write-behind caches are documented as *"not a good fit … data where loss on Redis failure is
unacceptable without additional durability"*
([oneuptime](https://oneuptime.com/blog/post/2026-03-31-redis-write-buffer-database/view)), and
AOF syncs once per second by default, which still allows up to a second of loss. Audit data is
the one category where "we lost a second" is a finding, not an incident.

**Caveat that must be decided, not skipped:** outbox-in-the-same-transaction requires the business
write to *be* in a transaction. Most tRPC mutations are a single `create`/`update`. So each event
gets one of two contracts:

- **strict** — wrap mutation + event in `$transaction` (membership, roles, keys, billing, account
  deletion);
- **best-effort** — event written after the mutation, a lost event is acceptable ("analysis
  started", "document regenerated", "fix staged").

Writing that contract down per action is what prevents the current situation, where everything is
silently best-effort.

---

## 5. What to record

### 5.1 Table

One table, append-only, workspace-scoped, also the outbox, and the `stream` column that keeps the
three jobs of §2 apart without a second table:

```sql
create table audit_events (
  id            uuid        primary key default uuidv7(),
  created_at    timestamp with time zone not null default now(),
  stream        text        not null,       -- ACTIVITY | SECURITY | FORENSIC
  workspace_id  uuid,                       -- null only for platform-level events (sign-in)
  actor_type    text        not null,       -- USER | API_KEY | SYSTEM | WEBHOOK
  actor_id      text,                       -- user id / key id; no FK, survives deletion
  action        varchar(150) not null,      -- "workspace.member.invited" / "Analysis.update"
  outcome       text        not null,       -- SUCCESS | DENIED | FAILED
  target_type   varchar(50),
  target_id     text,
  target_label  text,                       -- "bob@acme.dev", "acme/api" — for the feed
  severity      text,                       -- INFO | WARNING | CRITICAL
  changes       jsonb,                      -- allow-listed diff, never the row
  context       jsonb,                      -- request_id, ip, ua, source, release
  delivered_at  timestamp with time zone    -- outbox flag
);
```

`target_label` is denormalized on purpose: the row must stay readable after the target is deleted
or renamed. `actor_id` deliberately has no FK for the same reason.

One table rather than three is a trade-off, stated plainly: retention is per *table*, so all
streams share one horizon. That is acceptable because every stream is small next to `analyses`,
and `DETACH PARTITION` + archive is available if a longer security horizon is ever required. If
the streams ever diverge in volume or retention, splitting `SECURITY` out is a partition-level
move, not a redesign.

### 5.2 Diff rules

Deltas, not snapshots ([1](https://thedatatrait.medium.com/audit-logs-are-not-optional-the-hidden-backbone-of-reliable-data-platforms-1824953762ab),
[2](https://www.technowizardry.net/2022/05/how-to-build-a-useful-service-data-change-audit-log)):

| Rule | Reason |
| --- | --- |
| Allow-list of fields per action | otherwise `changes` becomes the args dump we are replacing |
| Truncate values (the existing 1 KB cap is a fine start) | a 300 KB document is not an audit fact |
| Arrays as `{ "added": [...], "removed": [...] }` | a full array value is a snapshot of that field |
| Never: document/file contents, tokens, `hashedKey`, plain e-mail | already knowable from `@encrypted` + `SENSITIVE_KEYS` |
| `create` records 5–8 meaningful fields, not the row | creation is the only case where a snapshot is defensible, and rarely |
| Distinguish `null` from "absent" (`{"field": null}` ≠ no key) | otherwise the diff lies |

Shape:

```json
{ "action": "workspace.member.role.changed", "changes": { "role": ["MEMBER", "OWNER"] } }
{
  "action": "pr.config.updated",
  "changes": {
    "commentStyle": ["DETAILED", "CONCISE"],
    "focusAreas": { "added": ["PERFORMANCE"], "removed": ["SECURITY"] }
  }
}
```

### 5.3 Writers

Two entry points, both explicit:

```ts
export async function recordAudit(tx: DbClient, event: AuditEventInput): Promise<void>
export async function recordAuditBatch(tx: DbClient, events: AuditEventInput[]): Promise<void>
```

`recordAudit` takes the transaction client so the row commits with the mutation. Batch exists
because the pipeline already writes several audited rows in one transaction (`saveResults`), and
those should be one `ACTIVITY` event, not eight `FORENSIC` rows.

Call sites are use cases, not repositories: `workspace.member.invited/removed/role.changed`,
`repo.added/deleted`, `analysis.started/completed/cancelled`, `fix.applied`,
`apikey.created/rotated/revoked`, `github.installation.linked/unlinked`,
`billing.plan.changed/checkout.started`, `account.deleted`, `auth.signed_in/sign_in_denied`,
`doc.published`. That is ~15 actions to start; the feed becomes readable immediately.

The interceptor keeps writing `FORENSIC` rows (`action = "<Model>.<operation>"`,
`target_id` from `args.where` when present), without `payload`, for 30 days.

### 5.4 What NOT to record

- Reads (noise, cost, privacy).
- Bookkeeping writes: `lastUsed`, `revoked=false→true` on expiry, `progress`, `isRead`.
- Every `Document`/`Analysis` row write inside the AI pipeline. One `analysis.completed` event is
  worth more than 8 row-level rows.
- Full row snapshots as a substitute for thinking about what matters.

---

## 6. What the user sees

Today the detail sheet (`entities/audit-log/ui/audit-log-sheet.tsx:40`) fetches
`getLogPayloadHtml`, i.e. the raw Prisma args as highlighted JSON. That is a developer dump, and it
also leaks user text into a place the user can screenshot.

Target:

**Feed (all members of the workspace):**

```
Alice invited bob@acme.dev to the workspace          2 min ago
Analysis of acme/api finished · health 78            10 min ago
API key ci-runner created                            yesterday
```

**Details on click:**

- *what changed* — the allow-listed diff, humanized: `Comment style: DETAILED → CONCISE`;
- *who* — name and avatar, or `System (AI pipeline)`, or `API key ci-runner`;
- *when* — absolute time plus relative;
- admins additionally: `request_id`, masked IP, user agent, `outcome`;
- `FORENSIC` rows are admin-only and are shown as "touched by request X", not as a payload.

**Never** in the UI: raw args, document contents, tokens, `hashedKey`.

```ts
// feed query, after the migration
db.auditEvent.findMany({
  where: { workspaceId, stream: "ACTIVITY" },
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  take: limit + 1,
});
```

Two surfaces, one table, one endpoint family:

- **Activity** — `stream = ACTIVITY`, available to workspace members;
- **Security** — `stream = SECURITY`, admin-only, long retention, full context.

---

## 7. Retention, partitioning, indexes

Nothing prunes `audit_logs` today. At the round-1 fixture size the two biggest indexes in the
database belong to this table.

Recommendation, following the standard advice for event tables
([AppMaster](https://appmaster.io/blog/postgresql-partitioning-event-audit-tables),
[Evolveum](https://docs.evolveum.com/midpoint/reference/master/repository/native-audit)):

- declarative partitioning by month on `created_at`;
- retention by `DROP PARTITION`, never `DELETE` — instant, no bloat, no competition with traffic;
  12–13 months, with `DETACH` + archive if a longer security horizon is required;
- inside each partition: **BRIN** on `created_at`, btree on
  `(workspace_id, stream, created_at desc, id desc)` for the feed, btree on `(request_id)` for
  correlation, btree on `(action)` for the admin filter, btree on `(actor_id, created_at desc)` for
  "everything this actor did";
- create partitions ahead of time from a scheduled task and **alert** when creation fails;
- `uuidv7` already gives chronological ordering, which suits both the partition key and the cursor.

Two notes on the current schema: `(createdAt desc, id desc)` is the wrong lead column for a
workspace feed, and there is no `workspace_id` to lead with at all.

---

## 8. Migration plan

Each step ships on its own; step 1 stops the bleeding and changes no behaviour.

- [ ] **Step 1 — stop the damage (XS, ~half a day).**
  Remove the Ably publish from the audit hook; stop writing `payload` for noisy models
  (`Document`, `Analysis`, `ChatMessage`); exclude bookkeeping operations (`lastUsed`, `revoked`,
  `progress`, `isRead`); tighten the policy to `@@allow('create', false)` (the writer uses
  `baseClient`, so nothing breaks).
  *Effect:* −1 Ably REST call and −1 full-args serialization per audited business write; no
  product change.

- [ ] **Step 2 — domain events (M, 2–3 days).**
  Add `audit_events` (or extend `AuditLog` with `stream`, `workspace_id`, `action`, `outcome`,
  `changes`, `target_*`, `delivered_at`), the `recordAudit(tx, event)` helper, and ~15 call sites
  in the use cases listed in §5.3. Move the feed to `stream = ACTIVITY`; drop `getPayloadHtml`
  from the user-facing sheet.
  *Effect:* the feed becomes readable, and the raw-JSON detail disappears from the product.

- [ ] **Step 3 — outbox drain (S–M, 1–2 days).**
  A `schedules.task` every minute: select `delivered_at IS NULL` in batches, publish to Ably (and
  optionally to Axiom), mark delivered. Remove the `auditUpdated` per-write invalidation from the
  client provider (`app/_components/realtime-provider.tsx:237-239`) and publish once per drained
  batch instead.
  *Effect:* the audit insert joins the caller's transaction (same connection), no second pool
  connection, no Ably in the request path, replay possible.

- [ ] **Step 4 — partitions and retention (S, ~1 day).**
  Migrate to a partitioned table, add the partition-creation task, drop partitions past the
  retention horizon, add the workspace-first index.
  *Effect:* retention stops being a `DELETE` problem and the table stops growing forever.

### Decisions needed before step 2

- [ ] Retention horizon (12 vs 13 months) and whether `SECURITY` needs `DETACH` + archive.
- [ ] Which mutations are **strict** (transaction) vs **best-effort** (§4 caveat)?
- [ ] Does the row-level `FORENSIC` safety net survive at all once domain events exist? My
      recommendation: keep, without payload, for 30 days.
- [ ] Do `Account`/`Session` writes stay audited at row level, given that `revokeUserSessions` is
      the security-relevant path?

---

## 9. What the current interceptor actually costs

Repeated from R1 so this document stands alone. Counts are operations, not milliseconds.

| Cost | Where |
| --- | --- |
| One INSERT per audited write (8 per `saveResults`) | `core/db.ts:200` |
| A second pooled connection while a transaction is open → `waitingCount`, 30 s timeout risk | `core/db.ts:200` + `:134-137` |
| Full `JSON.stringify` of `args` before 1 KB truncation | `core/db.ts:203`, `utils/sanitize-payload.ts:79-100` |
| One Ably REST call per business-model write (7 per `saveResults`) | `core/db.ts:212-218` |
| Client-side invalidation of the audit feed on every such write | `app/_components/realtime-provider.tsx:237-239` |

So: the audit layer is not slow because it is asynchronous. It is slow because it adds a second
INSERT on another connection, serializes the entire payload, and makes a network call — on every
write, and synchronously inside Trigger.dev tasks.

---

## 10. Anti-patterns (do not do)

- **Redis as the source of truth for audit.** Dual write, loss window, ordering. Only acceptable
  as transport *after* a durable write.
- **Auditing reads.** Noise, cost, privacy.
- **Full row snapshots as the default shape.** Bloats the table and explains nothing.
- **Database triggers as the primary mechanism.** They know nothing about request context (actor,
  IP, UA, "why"), cannot be scoped per use case, and hide from the type system.
- **One stream for product activity and security events.** OWASP says to keep them separate; the
  audiences and retention differ.
- **`@@allow('create', true)` on an audit table** in a security product.
- **Showing `payload` to end users.** It is a developer dump and a screenshot-able leak.

---

## 11. Open questions

- Could the interceptor be made transaction-aware by threading a "current tx" through
  `AsyncLocalStorage` and having the hook prefer it? Technically yes; it still would not fix
  batches, domain meaning or refusals, so it only helps the safety net.
- Is `payload` used by anything other than `audit.mapper` and `getPayloadHtml`? (Grep says no, but
  it should be confirmed before removal.)
- Does the Activity feed need real-time updates at all, or is "refresh on navigation" enough once
  `auditUpdated` stops firing per write?

---

## Sources

- OWASP Logging Cheat Sheet — what to log, data to exclude, separation of audit vs security
  logging, retention: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Prisma Client extensions (the `$allOperations` audit example):
  <https://www.prisma.io/docs/orm/v7/prisma-client/client-extensions>
- Prisma discussion #20016 — audit extension with the base client inside an interactive
  transaction hangs until timeout: <https://github.com/prisma/orm/discussions/20016>
- Audit log via transactional outbox — V. Gaevoy:
  <https://gaevoy.com/2021/03/18/audit-log-via-transactional-outbox.html>
- Transactional outbox pattern — AWS Prescriptive Guidance:
  <https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html>
- Diff vs snapshot, domain vs storage model, array deltas:
  <https://www.technowizardry.net/2022/05/how-to-build-a-useful-service-data-change-audit-log>
- Log deltas, not full rows; append-only audit tables:
  <https://thedatatrait.medium.com/audit-logs-are-not-optional-the-hidden-backbone-of-reliable-data-platforms-1824953762ab>
- Monthly partitioning and retention by dropping partitions:
  <https://appmaster.io/blog/postgresql-partitioning-event-audit-tables>,
  <https://docs.evolveum.com/midpoint/reference/master/repository/native-audit>
- Redis write-behind buffering and when it is not appropriate:
  <https://oneuptime.com/blog/post/2026-03-31-redis-write-buffer-database/view>
