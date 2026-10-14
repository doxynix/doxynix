# Where the app depends on ZenStack, and what happens when it goes

Produced 2026-10-13 by tracing every client-supplied identifier from its router input down to the
terminal Prisma call. Written because the stated plan is to remove ZenStack eventually, and
because one finding turned out not to be about ZenStack at all.

## Method and the distinction that matters

Every tRPC procedure that accepts an id was traced to the query it ends in, and each classified:

- **A — already scoped**: the query, or a step earlier in the same request, constrains the row to
  `userId === session.user.id` — directly, or through a relation whose `userId` was checked first.
- **B — policy-only**: no user constraint anywhere in the chain. ZenStack is the only thing
  stopping it.
- **C — not reachable / no identifier / admin by design.**

The distinction that decides urgency is *which client runs the query*:

| client | today | after ZenStack is removed |
| --- | --- | --- |
| `db` (policy-enhanced) | safe | becomes a leak |
| raw `prisma` / `ctx.prisma` | **can already be wrong** | unchanged |

| | user-facing | admin |
| --- | ---: | ---: |
| A — already scoped | **33** | 0 |
| B — policy-only | **41** | 0 (15 by design) |
| C | 2 | 15 |

The 15 admin procedures are unscoped because that is what an admin console is. They stay
"whoever holds an admin session may do everything", which is the intent. Their lever is the
`adminProcedure` middleware, not the queries.

**No model in the leak set needs a schema change.** `Repo.userId`, `Notification.userId`,
`ApiKey.userId`, `Document.repoId`, `Analysis.repoId`, `GeneratedFix.repoId`,
`PullRequestAnalysis.repoId`, `ChatSession.userId` all exist and are indexed. Nothing here is
blocked on a missing ownership column.

## The one finding that is live today

`src/app/api/agent/chat/route.ts` is not a ZenStack-removal problem. It is reachable now.

`sessionId` arrives in the request body (`:34`), the route never required a session
(`userId` was `session?.user.id ?? null`), and the session was looked up by id alone before a
message was appended to it — through the **raw** client, so the `ChatMessage @@allow` policy was
never consulted. A caller supplying another tenant's session id wrote into that session.

**Fixed.** `userId == null` now throws `UNAUTHORIZED`; `repo.findUnique`, `chatSession.findUnique`
and `chatSession.update` all take `userId` in their `where`. The repository read mattered as much
as the session one: `resolvedRepoId` reaches both the system prompt and `getAgentTools`, so an
unchecked read handed the agent another tenant's repository.

## Fixed in the same pass — policy-only, not currently exploitable

These were safe only because the policy layer said so. Stating the scope in the query means the
protection no longer depends on a layer scheduled for removal.

| site | was | is |
| --- | --- | --- |
| `repos/repo.service.ts:163` `deleteByOwner` | `deleteMany({ owner })` — **every tenant's** repos for that GitHub owner, analyses and documents cascading | `where: { owner, userId }` |
| `repos/repo.service.ts:140` `delete` | `delete({ where: { id } })` | `where: { id, userId }` |
| `repos/repo.service.ts:194` `getAll` | no owner filter | `where: { userId, … }` |
| `repos/repo.service.ts:252` `getSlim` | no owner filter — the UUID oracle | `where: { userId, … }` |
| `api-keys/api-key.service.ts:53` `list` | `findMany({})`, **no predicate at all** | `where: { userId }` |
| `api-keys/api-key.service.ts:76,86,102` `revoke`, `touch`, `update` | `where: { id }` | `where: { id, userId }` |
| `notifications/notifications.service.ts:40` `buildWhereClause` | `deleteRead({})` compiled to `deleteMany({ isRead: true })` | builder always emits `userId`; 5 procedures affected |

`getSlim` is the load-bearing one: it hands the caller every repository UUID the policy allowed
through, and those UUIDs are what the remaining `repoId`-driven paths take. Fixing it turns
"trivially reachable" into "requires guessing a uuidv7".

A regression the tests caught while adding this: `isUnfiltered` was
`Object.keys(where).length === 0`, which became permanently false once `where` always carried
`userId`, and `notification.getAll` started running its second count on every call.

## Left for the migration, on purpose

Roughly twenty `repoId`-anchored reads across `analysis.repository.ts`,
`analysis-lifecycle.service.ts`, `docs.service.ts`, `workspace.service.ts` and
`workspace-search.service.ts`. Each goes through `getRepoSnapshot` or a `repo: { id }` join.

They do not need twenty edits. **Three guards** — `assertRepoAccess` at the entry of
`getRepoSnapshot`, `getRepoSnapshotWithDocuments` and `resolveTargetAnalysis`
(`analysis.repository.ts:249,271,426`) — cover the majority. Doing that per-procedure now would
be churn against code that is provably protected, and it would make the migration diff unreadable.

Sequenced after the guards:

- `analysis.openPullRequest`, `postCommentToPR`, `applyFix` — the two direct
  `githubInstallation.findFirst` calls at `fixes.service.ts:234` and `pr-comments.service.ts:78`
  need `userId`. `GithubInstallation.userId` is nullable, so this is not a mechanical `where`; route
  them through `getClientContext`, which already scopes it.
- `analysis.stageGeneratedFix` — `fix.repo.id !== input.repoId` compares two client-supplied values
  to each other, so it is not an ownership check. Replace with `fix.repo.userId === session.user.id`.

## Practical note on `@omit`

`userId` is `@omit` on the foreign keys, so it is absent from `select` results. Every guard added
during the migration must either include `userId` explicitly or live in the `where` clause. Budget
for that when writing them.

## What is not actionable here

- The 15 admin procedures — unscoped by design.
- `analysis.highlightFile`, `health.check` — no identifier, no query.
- `app/api/blob/upload` — `userId` comes from a Vercel-signed token, not the request.
- `app/api/webhooks/**` — authenticated by GitHub signature.

## One structural note

The protection was never really in the queries. It lived in a policy file that no reviewer reads
when editing a service, which is exactly why 41 sites could accumulate without anyone noticing
that their safety depended on a second file. Moving the scope into the queries does not just
prepare for the migration — it makes the guarantee visible at the place a reviewer is already
looking.