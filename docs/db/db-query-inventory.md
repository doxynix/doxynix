# Database query inventory — `apps/web`

Every place `apps/web` touches PostgreSQL, classified and attributed to whatever
reads or writes it. Companion to [`db-index-audit.md`](./db-index-audit.md) (what the
shapes cost) and [`db-optimization-progress.md`](./db-optimization-progress.md)
(what has been changed). This document is the *obligation list*: it says what each
query is for, who consumes it, and what it must cost.

Scope is `apps/web/src/server` and `apps/web/src/app/api`. `*.test.ts`,
`src/tests/**`, `prisma/seed.ts` and `scripts/**` are excluded.

---

## Method and counts

Three numbers, because the naive grep overstates badly.

| | count | what it is |
| --- | ---: | --- |
| Raw grep hits | **269** | `rg` for the operation names across both trees, one line per match |
| Rejected on inspection | **53** | opened and confirmed non-Prisma (breakdown below) |
| Sites the raw grep *misses* | **15** | multi-line method chains, `$transaction`, `$queryRawTyped` |
| **Verified Prisma call sites** | **231** | 216 (raw hits that survived) + 15 (missed) |

Arithmetic checks: 216 + 53 = 269 raw hits accounted for; 216 + 15 = 231 verified.

**The plan assumed 189. That number is wrong, and I could not reproduce it from
any boundary.** The closest cut that produces a number near 189 is dropping the
better-auth adapter's generic delegate (15 sites, `core/auth/auth-adapter.ts`) and
the 13 `databaseHooks` reads in `core/auth/index.ts` — 28 sites, 231 − 28 = 203 —
and then also dropping the 13 webhook-delivery bookkeeping writes. I am not
asserting that is what produced 189. The defensible figure is **231**, and every
one of them is in the tables below with a `file:line`.

### The 53 rejections

| count | what | examples |
| ---: | --- | --- |
| 10 | `_count` read off an already-fetched row | `admin-review.service.ts:48`, `pr-impact.service.ts:152`, `user.mapper.ts:63-67`, `trpc/init.ts:171` |
| 9 | WebCrypto / Cipher `.update()` | `hash.ts:20`, `cipher.ts:74`, `config.ts:51`, `comment-poster.ts:14` |
| 9 | tree-sitter `tree.delete()` / `parser.delete()` / `Map.delete` | `optimizers.ts:157-165`, `tree-sitter/index.ts:463`, `tree-sitter-signals.ts:221-222` |
| 9 | tRPC / Octokit client objects: `initTRPC(...).create()`, `trpc.repo.create(`, `octokit.rest.pulls.update(` | `trpc/init.ts:21`, `agent.tools.ts:88`, `analyze-pr.task.ts:179` |
| 9 | service methods whose *name* is `create`/`update`/`delete`, not a query | `api-key.service.ts:15`, `repo.service.ts:141`, `analysis.repository.ts:119`, `fixes.service.ts:139,260`, `fix-generator.ts:100` (es-toolkit `groupBy`) |
| 3 | second line of a multi-line chain, already counted above it | `github-content.ts:69`, `api-key.service.ts:85,101` |
| 2 | the word `count()` inside a comment | `pagination.ts:113`, `pagination.ts:120` |
| 1 | `delete` on a plain object property | `field-encryption/rewrite.ts:266` |

### The 15 the raw grep misses

`rg '\b\$transaction'` cannot match `prisma.$transaction`, because `$` is not a
word character and there is no word boundary between `.` and `$`. All eight
`$transaction` sites and all four `$queryRaw*` sites were found only by anchoring
on the receiver (`prisma.`, `db.`, `tx.`, `baseClient.`, `ctx.prisma.`,
`delegate.`) rather than on the method name. `api-key.service.ts:84,100` and
`github-content.ts:68` are multi-line chains whose receiver is on one line and
the method on the next.

One of the fifteen was missed on the first pass of this document too —
`github-access-token.ts:33`, which neither the name-anchored nor the
receiver-anchored grep surfaced, because the receiver-anchored pattern listed
the read operations but not `$queryRawTyped`. It was caught by a third pass that
anchored on *any* identifier before the method name and then diffed the result
against the manual list. The 255 `file:line` entries that pass produces minus the
24 known false positives and the 3 multi-line duplicates is exactly the 231 above.

### Classification conventions

The taxonomy in the brief covers reads and bulk writes. Three conventions fill
the gaps; they are stated here so the counts are auditable rather than
convenient.

- **Single-row writes** (`create`, `update`, `delete`, `upsert` on a unique key)
  are classed `point`. They address one row and the obligation is the same one:
  under 2 ms at any volume.
- **`point` means "returns at most one row", not "the key is unique".** Two sites
  return one row through a key that is not unique; both say so in their row and
  both appear in the risk section — `repo.service.ts:225` and `:242`.
- **`$transaction` rows** take the class of the write body they wrap. They are
  listed as their own sites because the transaction boundary changes statement
  count and rollback semantics, which is the whole point of the class.

Facets beyond the primary class are noted in the row, not given a second line.
`findMany` with a nested `_count`, or a `findMany` inside a `Promise.all`, is one
site with two properties.

---

## 1. core & transport — 76 sites

`src/server/core`, `src/server/utils`, `src/server/domain`, `src/app/api`.
Everything here is on the request path of somebody else's procedure.

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `core/db.ts:202` | AuditLog | `create` | — | — | — | — | point | none — the `$allOperations` interceptor itself; see *The `db.ts` audit amplifier* |
| `core/trpc/init.ts:165` | User | `findUnique` | — | — | `_count.passkeys` | — | point | `isAdmin` middleware: **every** `adminProcedure` call |
| `core/trpc/server.ts:23` | User | `findUnique` | — | — | — | — | point | `apiForUser` — once per Trigger.dev task, then `React.cache`d |
| `core/auth/verify-api-key.ts:18` | ApiKey | `findUnique` `include user` | — | — | — | — | point | `POST /api/webhooks/github/action`, MCP/CLI bearer auth |
| `core/auth/verify-api-key.ts:28` | ApiKey | `update` | — | — | — | fire-and-forget off `:18` | point | same; errors swallowed into the log |
| `core/auth/auth-adapter.ts:76` | any (better-auth) | `findFirst` | — | — | — | `consumeOne` | point | better-auth `consumeOne` |
| `core/auth/auth-adapter.ts:81` | any | `delete` | — | — | — | `consumeOne` | point | better-auth `consumeOne` |
| `core/auth/auth-adapter.ts:91` | any | `count` | — | — | yes | — | count | better-auth `count` — **model and predicate come from the caller** |
| `core/auth/auth-adapter.ts:106` | any | `create` | — | — | — | — | point | every sign-up / link / session insert |
| `core/auth/auth-adapter.ts:117` | any | `findFirst` | — | — | — | — | point | better-auth `delete` |
| `core/auth/auth-adapter.ts:119` | any | `delete` | — | — | — | — | point | better-auth `delete` |
| `core/auth/auth-adapter.ts:129` | any | `deleteMany` | — | — | yes | — | bulk-write | better-auth `deleteMany` — predicate supplied by caller |
| `core/auth/auth-adapter.ts:150` | any | `findMany` | `take` = caller `limit`, `skip` = caller `offset`; **both omitted when the caller omits them** | caller-supplied, none set here | — | — | list | better-auth `findMany`; a caller that passes no `limit` gets an unbounded read |
| `core/auth/auth-adapter.ts:163` | any | `findFirst` | — | — | — | — | point | better-auth `findOne` |
| `core/auth/auth-adapter.ts:186` | any | `findFirst` | — | — | — | — | point | better-auth `incrementOne` |
| `core/auth/auth-adapter.ts:200` | any | `update` | — | — | — | — | point | better-auth `incrementOne` |
| `core/auth/auth-adapter.ts:213` | any | `$transaction` | — | — | — | tx | bulk-write | better-auth `transaction` passthrough; body is caller's |
| `core/auth/auth-adapter.ts:236` | any | `findFirst` | — | — | — | — | point | better-auth `update` |
| `core/auth/auth-adapter.ts:241` | any | `update` | — | — | — | — | point | better-auth `update` |
| `core/auth/auth-adapter.ts:254` | any | `updateMany` | — | — | yes | — | bulk-write | better-auth `updateMany` — predicate supplied by caller |
| `core/auth/index.ts:69` | BannedEmail | `findUnique` | — | — | — | — | point | `assertEmailNotBanned`, on every OAuth session create |
| `core/auth/index.ts:89` | BannedEmail | `findUnique` | — | — | — | `Promise.all` with `:90` | point | `assertNotBannedOnSignIn` — sign-in email / magic link |
| `core/auth/index.ts:90` | User | `findUnique` | — | — | — | `Promise.all` with `:89` | point | same |
| `core/auth/index.ts:161` | User | `findUnique` | — | — | — | — | point | `databaseHooks.account.create.after` |
| `core/auth/index.ts:166` | User | `update` | — | — | — | — | point | same, conditional on `image == null` |
| `core/auth/index.ts:181` | User | `findUnique` | — | — | — | — | point | `databaseHooks.account.create.before` |
| `core/auth/index.ts:195` | User | `update` | — | — | — | — | point | same, conditional |
| `core/auth/index.ts:212` | User | `findUnique` | — | — | — | — | point | `databaseHooks.session.create.after` |
| `core/auth/index.ts:241` | User | `findUnique` | — | — | — | — | point | `databaseHooks.session.create.before` |
| `core/auth/index.ts:248` | Account | `findFirst` | — | `{updatedAt: "desc"}` | — | — | point | same; no `take`, but `orderBy` + `findFirst` narrows to the top row |
| `core/auth/index.ts:267` | User | `update` | — | — | — | — | point | same, conditional |
| `core/auth/index.ts:302` | BannedEmail | `findUnique` | — | — | — | — | point | `databaseHooks.user.create.before` — every registration |
| `core/auth/index.ts:402` | User | `findUnique` | — | — | — | — | point | magic-link send |
| `core/github/github-api.ts:104` | GithubInstallation | `findMany` | **no take** | none | — | — | unbounded | `repo.create` → `getRepoInfo`; also `githubApp.getMyGithubRepos` |
| `core/github/github-api.ts:107` | Account | `findMany` | **no take** | none | — | — | unbounded | same |
| `core/github/github-api.ts:348` | Account | `findMany` | **no take** | none | — | — | unbounded | `executeWithFallback` retry path |
| `core/github/github-client.ts:117` | GithubInstallation | `findFirst` | — | none | — | — | point | `getClientContext`, `{accountLogin, isSuspended, userId}` |
| `core/github/github-client.ts:141` | GithubInstallation | `findFirst` | — | none | — | — | point | same, owner-less fallback |
| `core/github/github-access-token.ts:13` | Account | `findFirst` | — | none | — | — | point | `githubTokenService.getValidToken` — on every GitHub API call |
| `core/github/github-access-token.ts:32` | — | `$transaction` | — | — | — | tx | bulk-write | refresh path |
| `core/github/github-access-token.ts:33` | — | `$queryRawTyped(getAccountForUpdate(userId, "github"))` | — | `FOR UPDATE` row lock | — | tx | raw | same. The lock that makes the refresh single-winner; `SELECT … FOR UPDATE` on `accounts` |
| `core/github/github-access-token.ts:34` | Account | `findFirst` | — | none | — | tx, immediately after the lock | point | same |
| `core/github/github-access-token.ts:72` | Account | `update` | — | — | — | tx | point | same |
| `core/github/github-access-token.ts:93` | Account | `updateMany` | — | — | yes | — | bulk-write | poison-token cleanup; `where {providerId, userId}` — bounded |
| `core/github/github-content.ts:68` | Repo | `findUnique` | — | — | — | memoised across a file batch | point | `githubBrowse.getFileContent`; also `generate-fix.task` autofetch loop |
| `utils/access-revocation.ts:15` | Session | `deleteMany` | — | — | yes | — | bulk-write | `adminUser.setBanned`, `bannedEmail.create` |
| `utils/access-revocation.ts:21` | User | `findUnique` | — | — | — | — | point | `revokeAccessForEmail`; was a `findMany`, now unique on `emailHash` (C10) |
| `utils/access-revocation.ts:28` | ApiKey | `updateMany` | — | — | yes | — | bulk-write | same |
| `domain/ai/ai-tools.ts:78` | Repo | `findUnique` | — | — | — | — | point | agent tool `getBranches` |
| `domain/ai/ai-tools.ts:116` | Repo | `findUnique` | — | — | — | — | point | agent tool `listFiles` |
| `domain/ai/ai-tools.ts:239` | Repo | `findUnique` | — | — | — | — | point | agent tool `readPreviousDocument` |
| `domain/ai/ai-tools.ts:244` | Document | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | same |
| `app/api/webhooks/github/route.ts:87` | WebhookDelivery | `create` | — | — | — | — | point | GitHub → `/api/webhooks/github` |
| `app/api/webhooks/github/route.ts:97` | WebhookDelivery | `findUnique` | — | — | — | P2002 path | point | same |
| `app/api/webhooks/github/route.ts:123` | WebhookDelivery | `update` | — | — | — | P2002 path | point | same |
| `app/api/webhooks/github/route.ts:146` | WebhookDelivery | `update` | — | — | — | — | point | same, on success |
| `app/api/webhooks/resend/route.ts:97` | WebhookDelivery | `create` | — | — | — | — | point | Resend bounce webhook |
| `app/api/webhooks/resend/route.ts:107` | WebhookDelivery | `findUnique` | — | — | — | P2002 path | point | same |
| `app/api/webhooks/resend/route.ts:116` | WebhookDelivery | `update` | — | — | — | P2002 path | point | same |
| `app/api/webhooks/resend/route.ts:159` | WebhookDelivery | `update` | — | — | — | — | point | same, missing-recipient path |
| `app/api/webhooks/resend/route.ts:173` | — | `$transaction` | — | — | — | tx | bulk-write | same |
| `app/api/webhooks/resend/route.ts:174` | BannedEmail | `upsert` | — | — | — | tx | point | same |
| `app/api/webhooks/resend/route.ts:179` | WebhookDelivery | `update` | — | — | — | tx | point | same |
| `app/api/webhooks/resend/route.ts:199` | WebhookDelivery | `update` | — | — | — | — | point | same, non-bounce events |
| `app/api/agent/chat/route.ts:58` | Repo | `findUnique` | — | — | — | — | point | `POST /api/agent/chat` |
| `app/api/agent/chat/route.ts:66` | Repo | `findUnique` | — | — | — | — | point | same, `(owner, name, userId)` |
| `app/api/agent/chat/route.ts:89` | — | `$transaction` | — | — | — | tx | bulk-write | same |
| `app/api/agent/chat/route.ts:90` | ChatSession | `findUnique` | — | — | — | tx | point | same |
| `app/api/agent/chat/route.ts:95` | ChatSession | `create` | — | — | — | tx | point | same — the only place a chat session is created from the UI |
| `app/api/agent/chat/route.ts:105` | ChatMessage | `create` | — | — | — | tx | point | same; `parts` is `@encrypted` |
| `app/api/agent/chat/route.ts:145` | ChatMessage | `create` | — | — | — | — | point | same, assistant turn, in `onEnd` |
| `app/api/agent/chat/route.ts:154` | ChatSession | `findUnique` | — | — | — | — | point | same, title-generation branch |
| `app/api/agent/chat/route.ts:181` | ChatSession | `update` | — | — | — | — | point | same |
| `app/api/blob/upload/route.ts:75` | User | `findUnique` | — | — | — | — | point | Vercel Blob `onUploadCompleted` |
| `app/api/blob/upload/route.ts:82` | User | `update` | — | — | — | — | point | same |
| `app/api/webhooks/github/action/route.ts:56` | Repo | `findFirst` | — | none | — | — | point | `POST /api/webhooks/github/action` (CLI `dxnx analyze`) |
`/api/mcp`, `/api/docs`, `/api/realtime/auth` and `/api/trpc/[trpc]` contain no
database call sites. `system/health.router.ts:16` is also reachable from `core` by
dependency but is counted once, under §11.

---

## 2. analysis — 64 sites

The largest slice. Nine of the 22 unbounded `findMany` calls in the whole app
live here; one more is in §3.

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `analysis.repository.ts:107` | PullRequestComment | `createMany` | — | — | returns `{count}` | — | bulk-write | analysis pipeline (`addComments`); `where` is implicit via `analysisId` |
| `analysis.repository.ts:130` | GeneratedFix | `create` | — | — | — | — | point | `fixesService.createFix`, `openPullRequest`; `docSyncService` → `analysis.createFix` (agent tool) |
| `analysis.repository.ts:146` | PullRequestAnalysis | `create` | — | — | — | — | point | `pull_request` webhook → `pr-webhook-handler.ts:43` |
| `analysis.repository.ts:164` | GeneratedFix | `findUnique` | — | — | — | — | point | `analysis.getById` → `repo-metrics.tsx:46`; `applyFix` |
| `analysis.repository.ts:170` | PullRequestAnalysis | `findFirst` | nested `comments: true`, `generatedFixes: true` — **no take on either** | `{createdAt: "desc"}` | — | — | unbounded | `pull_request` webhook, `pr-webhook-handler.ts:25` |
| `analysis.repository.ts:188` | GeneratedFix | `findMany` | **no take** | `{createdAt: "desc"}` | — | — | unbounded | `analysis.getByRepository` → `repo-pull-details-content.tsx`, `pr-draft-sheet.tsx` |
| `analysis.repository.ts:199` | Analysis | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | `analysis.quickFileAudit` / `documentFile` via `getLatestRef` |
| `analysis.repository.ts:225` | Repo | `findUnique` | nested `documents` **no take**; nested `analyses` `take: 1` | analyses `{createdAt: "desc"}`, documents `{updatedAt: "desc"}` | — | — | unbounded | `getRepoBySha` → `analysis.getByPRNumber` + `getImpactByPRNumber` |
| `analysis.repository.ts:240` | Repo | `findUnique` | nested `documents` **no take**; nested `analyses` `take: 1` | as above | — | — | unbounded | `getRepoSnapshot` — reachable from 10 procedures; see *Highest-risk sites* |
| `analysis.repository.ts:250` | Analysis | `findFirst` | — | none | — | — | point | `getRepoSnapshot(aid)` — historic-version path |
| `analysis.repository.ts:274` | PullRequestAnalysis | `findFirst` | nested `comments` **no take**, `generatedFixes` **no take** | `{createdAt: "desc"}` | — | — | unbounded | `loadImpactAnalysis` → `getByPRNumber`, `getImpactByPRNumber` |
| `analysis.repository.ts:316` | Document | `findMany` | `take: 24` (`MAX_SEARCHABLE_DOCUMENT_FETCH`) | `[{type:"asc"},{updatedAt:"desc"}]` | — | — | list | `searchWorkspace` → `repo-workspace-search.tsx`; `getNodeContext` |
| `analysis.repository.ts:342` | GeneratedFix | `findMany` | `take: 8` | `{createdAt: "desc"}` | — | — | list | `loadRelatedFixes` → `analysis.getNodeContext` (code/docs/map views) |
| `analysis.repository.ts:367` | PullRequestComment | `findMany` | `take: 12` | `[{analysis:{createdAt:"desc"}},{riskLevel:"desc"}]` | — | — | list | `loadRelatedPrFindings` → `analysis.getNodeContext` |
| `analysis.repository.ts:403` | PullRequestAnalysis | `update` | — | — | — | — | point | `storeChangedFilesSnapshot` ← `analyze-pr.task.ts:129` |
| `analysis.repository.ts:412` | PullRequestAnalysis | `update` | — | — | — | — | point | `updatePRAnalysis` ← `pull_request` webhook re-sync |
| `analysis.repository.ts:431` | PullRequestAnalysis | `update` | — | — | — | — | point | `updatePRAnalysisStatus` ← `analyze-pr.task.ts:103` and pipeline |
| `analysis.repository.ts:453` | GeneratedFix | `update` | — | — | — | — | point | `updateStatus` — `applyFix`, `openPullRequest`, `docSyncService` |
| `admin-review.service.ts:95` | PullRequestAnalysis | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:104` | count | `adminReview.list` → `admin-review-container.tsx:27` |
| `admin-review.service.ts:104` | PullRequestAnalysis | `findMany` | `skip`, `take` = `limit` | `ORDER_CREATED_AT_DESC` | `_count.generatedFixes` per row | — | list | same |
| `admin-review.service.ts:118` | PullRequestAnalysis | `findUnique` | nested `generatedFixes` **no take** | `{createdAt: "desc"}` | `_count.generatedFixes` | — | unbounded | `adminReview.detail` → `admin-review-sheet.tsx:29` |
| `services/analysis-lifecycle.service.ts:58` | Analysis | `create` | — | — | — | — | point | `analysis.analyze` → `use-repo-setup.ts:59`; `POST /api/webhooks/github/action` |
| `services/analysis-lifecycle.service.ts:87` | Analysis | `update` | — | — | — | — | point | same, stores the Trigger job id |
| `services/analysis-lifecycle.service.ts:109` | Repo | `findFirst` | — | none | — | — | point | `assertRepoAccess`; `{id, userId}` |
| `services/analysis-lifecycle.service.ts:121` | Analysis | `findFirst` | — | none | — | — | point | `analysis.cancel` → `repo-analysis-live.tsx:44` |
| `services/analysis-lifecycle.service.ts:133` | Analysis | `update` | — | — | — | — | point | same |
| `services/analysis-lifecycle.service.ts:166` | Analysis | `findMany` | **no take** | `{createdAt: "desc"}` | — | — | unbounded | `analysis.getHistory` → `repo-version-selector.tsx:27` |
| `services/analysis-lifecycle.service.ts:190` | Analysis | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | `analysis.getLatest` → `repo-analysis-live.tsx:42` + RSC `analyze/page.tsx:18` |
| `services/analysis-lifecycle.service.ts:295` | — | `$transaction` | — | — | — | tx | bulk-write | `analyze-repo` task, `saveResults` |
| `services/analysis-lifecycle.service.ts:296` | Analysis | `update` | — | — | — | tx | point | same; writes `metricsJson` + `resultJson` |
| `services/analysis-lifecycle.service.ts:330` | Document | `upsert` | — | — | — | tx, inside `Promise.all` over ≤ 5 docs | N+1 | same; **hard-bounded at 5 iterations** (`analysis-lifecycle.service.ts:314-326`) |
| `services/analysis-lifecycle.service.ts:351` | Notification | `create` | — | — | — | tx | point | same; drives the realtime notification |
| `services/docs.service.ts:80` | Document | `findFirst` | — | none | — | — | point | `analysis.getDocumentContent` → `repo-docs.tsx:106`; agent tool |
| `services/docs.service.ts:127` | Document | `findFirst` | — | none | — | — | point | `analysis.getWithGraphLinks` — **no client caller found** |
| `services/docs.service.ts:189` | Analysis | `findUnique` | — | — | — | — | point | `analysis.pinAuditToDocs` → `repo-code-browser.tsx:220` |
| `services/docs.service.ts:198` | Document | `create` | — | — | — | — | point | same |
| `services/doc-sync.service.ts:63` | GithubInstallation | `findFirst` | — | none | — | — | point | post-analysis doc auto-sync, fire-and-forget (`analysis-lifecycle.service.ts:370`) |
| `services/pr-comments.service.ts:11` | PullRequestComment | `findMany` | **no take** | `[{filePath:"asc"},{line:"asc"}]` | — | — | unbounded | `analysis.getComments` → `repo-pull-details-content.tsx:74`; agent tool |
| `services/pr-comments.service.ts:70` | Repo | `findUnique` | — | — | — | — | point | `analysis.postCommentToPR` — **no client caller found** |
| `services/pr-comments.service.ts:78` | GithubInstallation | `findFirst` | — | none | — | — | point | same; `{accountLogin, isSuspended}`, **no `userId`** |
| `services/pr-comments.service.ts:98` | PullRequestAnalysis | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | same |
| `services/pr-comments.service.ts:114` | PullRequestComment | `create` | — | — | — | — | point | same |
| `services/pr-impact.service.ts:14` | PullRequestAnalysis | `findUnique` | — | — | — | — | point | `analysis.getAnalysis` — **no client caller found** |
| `services/pr-impact.service.ts:130` | PullRequestAnalysis | `findMany` | **no take** | `{createdAt: "desc"}` | `_count.comments` per row | — | unbounded | `analysis.listByRepository` → `repo-pulls-list-container.tsx:20` |
| `services/staging.service.ts:39` | GeneratedFix | `findUnique` | — | — | — | — | point | `analysis.stageGeneratedFix` → `repo-metrics.tsx:59`, `use-pr-stage.ts:13` |
| `services/fixes.service.ts:37` | Repo | `findUnique` | — | — | — | — | point | `analysis.applyFix` (agent tool) |
| `services/fixes.service.ts:118` | PullRequestAnalysis | `findUnique` | — | — | — | — | point | `analysis.createFix` → `repo-metrics.tsx:34`, `repo-pull-details-content.tsx:99` |
| `services/fixes.service.ts:128` | Repo | `findUnique` | — | — | — | — | point | same |
| `services/fixes.service.ts:223` | Repo | `findUnique` | — | — | — | — | point | `analysis.openPullRequest` → `pr-draft-sheet.tsx:52` |
| `services/fixes.service.ts:234` | GithubInstallation | `findFirst` | — | none | — | — | point | same; `{accountLogin, isSuspended}`, **no `userId`** |
| `tasks/generate-fix.task.ts:33` | Repo | `findUnique` | — | — | — | — | point | `generate-fix` Trigger task |
| `tasks/generate-fix.task.ts:51` | PullRequestAnalysis | `findUnique` | — | — | — | — | point | same |
| `tasks/handle-task-error.ts:26` | Analysis | `update` | — | — | — | — | point | `analyze-repo` error path |
| `tasks/analyze-pr.task.ts:66` | Repo | `findUnique` | — | — | — | — | point | `analyze-pr` Trigger task |
| `tasks/analyze-pr.task.ts:89` | Analysis | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | same, previous full analysis for diff context |
| `tasks/init.ts:117` | Analysis | `update` | — | — | — | — | point | Trigger `onComplete`/`onCancel`/`onFailure` failsafe |
| `tasks/init.ts:143` | PullRequestAnalysis | `update` | — | — | — | — | point | same |
| `tasks/init.ts:164` | GeneratedFix | `update` | — | — | — | — | point | same |
| `ai/writer-tasks.ts:296` | Analysis | `findFirst` | — | `{createdAt: "desc"}` | — | — | point | changelog generation inside `analyze-repo` |
| `logic/pr-config.ts:34` | PullRequestAnalysisConfig | `findUnique` | — | — | — | — | point | `analysis.getRepoConfig` → `pr-analysis-config-card.tsx:73`; `analyze-pr.task.ts:101`; PR webhook |
| `logic/pr-config.ts:78` | Repo | `update` | — | — | — | — | point | `analysis.configureRepository` → `pr-analysis-config-card.tsx:75`; nested `prAnalysisConfig.upsert` |
| `logic/pr-webhook-handler.ts:111` | Repo | `findMany` | **no take** | none | — | feeds `repos.map(...)` at `:127` — **2–3 further queries per repo** | N+1 | `pull_request` webhook |
| `logic/analysis-progress.ts:39` | Analysis | `update` | — | — | — | — | point | every analysis finalisation |
| `logic/analysis-context.ts:44` | Analysis | `findUnique` | nested `repo.analyses` `take: 1` | `{createdAt: "desc"}` | — | — | point | `analyze-repo` task |

---

## 3. repos — 22 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `repo.service.ts:109` | Repo | `create` | — | — | — | — | point | `repo.create` → `use-repo-actions.ts:19`; agent tool |
| `repo.service.ts:143` | Repo | `delete` | — | — | — | — | point | `repo.delete` → `delete-repo-dialog.tsx:22`; agent tool |
| `repo.service.ts:155` | Repo | `deleteMany` | — | — | yes | — | bulk-write | `repo.deleteAll` → `delete-all-repos-dialog.tsx`. **`where` is absent** — see *Highest-risk sites* §2 |
| `repo.service.ts:164` | Repo | `deleteMany` | `where {owner: equals insensitive}` | — | yes | — | bulk-write | `repo.deleteByOwner` → `delete-by-owner-dialog.tsx`. Owner-wide, not user-wide |
| `repo.service.ts:185` | Repo | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:197` | count | `repo.getAll` → `repo-list-container.tsx:57` |
| `repo.service.ts:197` | Repo | `findMany` | `skip`, `take` = `limit` | `orderWithTiebreak(sortBy, sortOrder)` — user-chosen column + `id` | — | — | list | same |
| `repo.service.ts:225` | Repo | `findFirst` | — | none | — | — | point | `repo.getByName` — **no client caller found**. Key is `(name, owner)` without `userId`, so it is **not** the `@@unique([owner,name,userId])` key |
| `repo.service.ts:242` | Repo | `findFirst` | — | none | — | — | point | `repo.getByOwner` — **no client caller found**. Key is `owner` alone, **not unique** for an org with many repos, and there is no `orderBy` |
| `repo.service.ts:262` | Repo | `findMany` | `cursor: {id}`, `take: limit + 1` | `[{updatedAt:"desc"},{id:"desc"}]` | — | — | keyset | `repo.getSlim` → `app-sidebar.tsx:40` (infinite), `app-command-menu.tsx:70`, `notifications-repo-filter.tsx:33`, `delete-all-repos-card.tsx:13` |
| `github-app.service.ts:21` | — | `$transaction` | — | — | — | tx | bulk-write | `githubApp.getGithubInstallUrl` → `create-repo-dialog.tsx:49`, `connections-list-container.tsx:21` |
| `github-app.service.ts:22` | Verification | `deleteMany` | — | — | yes | tx | bulk-write | same; `{identifierHash}` — bounded |
| `github-app.service.ts:25` | Verification | `create` | — | — | — | tx | point | same |
| `github-app.service.ts:40` | GithubInstallation | `findMany` | **no take** | `{createdAt: "asc"}` | — | — | unbounded | `githubApp.getMyGithubRepos` → `create-repo-dialog.tsx:112`, `connections-list-container.tsx:19` |
| `github-app.service.ts:103` | Verification | `findFirst` | — | none | — | — | point | `githubApp.saveInstallation` |
| `github-app.service.ts:175` | — | `$transaction` | — | — | — | tx | bulk-write | same |
| `github-app.service.ts:176` | Verification | `deleteMany` | — | — | yes | tx | bulk-write | same |
| `github-app.service.ts:190` | GithubInstallation | `updateMany` | `where {id, OR:[userId null, userId]}` | — | yes | tx | bulk-write | same; `id` is the PK so ≤ 1 row. Ownership guard (C15) |
| `github-app.service.ts:206` | GithubInstallation | `findUnique` | — | — | — | tx, only when `:190` matched 0 | point | same |
| `github-app.service.ts:218` | GithubInstallation | `create` | — | — | — | tx | point | same |
| `github-app.service.ts:291` | GithubInstallation | `updateMany` | `where {id, OR:[userId null, userId]}` | — | yes | **inside `for (const inst of ourInstallations)` at `:270`** | bulk-write | `syncInstallations`, run by `getMyRepos` at `:38` |
| `github-app.service.ts:297` | GithubInstallation | `findUnique` | — | — | — | same loop | point | same |
| `github-app.service.ts:312` | GithubInstallation | `create` | — | — | — | same loop | point | same |

`syncInstallations` issues 1–3 queries per installation returned by
`GET /user/installations`. The loop bound is the number of GitHub App
installations a user has — tens, not thousands — but it is a per-iteration count
that is not currently asserted anywhere.

---

## 4. users — 23 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `user.service.ts:82` | — | `$transaction` | — | — | — | tx, `Serializable`, retried ≤ 3× on P2034 | bulk-write | `user.disconnectAccount` → `auth-providers-list.tsx:60` |
| `user.service.ts:97` | User | `findUnique` | — | — | — | — | point | `user.deleteAccount` → `use-profile-actions.ts:72` |
| `user.service.ts:106` | User | `delete` | — | — | — | — | point | same; cascades to sessions, keys, repos, notifications |
| `user.service.ts:122` | Account | `findUnique` | — | — | — | tx | point | `user.disconnectAccount` |
| `user.service.ts:133` | Account | `count` | `where {userId}` | — | yes | tx | count | same; one user's own accounts, a handful of rows |
| `user.service.ts:135` | User | `findUnique` | — | — | — | tx | point | same |
| `user.service.ts:144` | Account | `delete` | — | — | — | tx | point | same |
| `user.service.ts:165` | Account | `findMany` | **no take** | `{providerId: "asc"}` | — | `Promise.all` with `:176` | unbounded | `user.getLinkedAccounts` → `connections-list-container.tsx:35`. Bounded in practice: ≤ 1 row per provider |
| `user.service.ts:176` | User | `findUnique` | — | — | — | `Promise.all` | point | same |
| `user.service.ts:187` | User | `findUnique` | — | — | — | — | point | `user.me` → `use-profile-actions.ts` |
| `user.service.ts:198` | User | `findUnique` | — | — | — | — | point | `user.removeAvatar` → `use-profile-actions.ts:87` |
| `user.service.ts:205` | User | `update` | — | — | — | — | point | same |
| `user.service.ts:235` | User | `update` | — | — | — | — | point | `user.updateUser` → `use-profile-actions.ts:38`; agent tool |
| `admin-user.service.ts:96` | User | `count` | `where {banned: false, role: "ADMIN"}` | — | yes | — | count | `adminUser.setRole` / `setBanned` / `deleteUser`. **Unbounded exact count**, re-run on each |
| `admin-user.service.ts:100` | User | `findUnique` | — | — | — | — | point | all three |
| `admin-user.service.ts:115` | User | `update` | — | — | — | — | point | same |
| `admin-user.service.ts:184` | User | `delete` | — | — | — | — | point | `adminUser.deleteUser` → `use-admin-user-actions.ts:40` |
| `admin-user.service.ts:201` | User | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:210` | count | `adminUser.list` → `admin-users-container.tsx:30` |
| `admin-user.service.ts:210` | User | `findMany` | `skip`, `take` = `limit` | `ORDER_CREATED_AT_DESC` | — | — | list | same |
| `admin-user.service.ts:224` | User | `findUnique` | — | — | `_count` on `apiKeys`, `chatSession`, `notifications`, `repos`, `sessions` | — | point | `adminUser.getDetail` → `admin-user-sheet.tsx:34` |
| `admin-user.service.ts:238` | Session | `findMany` | **no take** | `[{createdAt:"desc"},{id:"desc"}]` | — | — | unbounded | `adminUser.listSessions` → `admin-user-sessions.tsx:36` |
| `admin-user.service.ts:263` | Session | `findUnique` | — | — | — | — | point | `adminUser.revokeSession` → `use-admin-user-actions.ts:16` |
| `admin-user.service.ts:280` | Session | `deleteMany` | `where {id}` | — | yes | — | bulk-write | same; PK key, ≤ 1 row |

---

## 5. notifications — 7 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `notifications.service.ts:87` | Notification | `delete` | — | — | — | — | point | `notification.deleteOne` → `use-notification-actions.ts:23` |
| `notifications.service.ts:99` | Notification | `deleteMany` | `where {…filters, isRead: true}` | — | yes | — | bulk-write | `notification.deleteRead` → `use-notification-actions.ts:19`; agent tool. **`where` can be just `{isRead:true}`** when the caller passes no filter |
| `notifications.service.ts:116` | Notification | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:125` | count | `notification.getAll` → `notifications-list-container.tsx:31`, `notifications-nav.tsx:30` |
| `notifications.service.ts:125` | Notification | `findMany` | `skip`, `take` = `limit` | `ORDER_CREATED_AT_DESC` | — | — | list | same |
| `notifications.service.ts:140` | Notification | `groupBy` | `by: ["isRead"]`, `where {userId}` | — | `_count._all` | — | count | `notification.getStats` → `notifications-nav.tsx:33`, `app-sidebar.tsx:50`, `notifications-list-container.tsx:44`; agent tool. **Runs on every page load** |
| `notifications.service.ts:159` | Notification | `updateMany` | `where {…filters, isRead: false}` | — | yes | — | bulk-write | `notification.markAllAsRead` → `use-notification-actions.ts:15`; agent tool. Same empty-filter exposure as `:99` |
| `notifications.service.ts:174` | Notification | `update` | — | — | — | — | point | `notification.markAs` → `use-notification-actions.ts:27`; agent tool |

---

## 6. audit-logs — 6 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin-audit.service.ts:76` | AuditLog | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:85` | count | `adminAudit.list` → `admin-audit-container.tsx:28`. Was 2774 ms exact, 38 ms capped (P12/P16) |
| `admin-audit.service.ts:85` | AuditLog | `findMany` | `skip`, `take` = `limit` | `ORDER_CREATED_AT_DESC` | — | — | list | same |
| `admin-audit.service.ts:98` | AuditLog | `findUnique` | — | — | — | — | point | `adminAudit.detail` — **no client caller found** (only `payloadHtml` is used) |
| `admin-audit.service.ts:108` | AuditLog | `findUnique` | — | — | — | — | point | `adminAudit.payloadHtml` → `admin-audit-payload-sheet.tsx:27` |
| `audit.service.ts:20` | AuditLog | `findMany` | `cursor: {id}`, `take: limit + 1` | `[{createdAt:"desc"},{id:"desc"}]` | — | — | keyset | `audit.getActivityLogs` → `audit-logs-container.tsx:15` (`useInfiniteQuery`). The only keyset list over a hot table |
| `audit.service.ts:47` | AuditLog | `findUnique` | — | — | — | — | point | `audit.getLogPayloadHtml` → `audit-log-sheet.tsx:38`; `where {id, userId}` is user-scoped |

---

## 7. api-keys — 5 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `api-key.service.ts:30` | ApiKey | `create` | — | — | — | — | point | `apikey.create` → `use-api-key-actions.ts:12`; agent tool |
| `api-key.service.ts:53` | ApiKey | `findMany` | **no take**, **no `where`** | `{createdAt: "desc"}` | — | — | unbounded | `apikey.list` → `api-keys-list-container.tsx:10`; agent tool. Scoped only by the ZenStack policy `auth() == user \|\| ADMIN` (`prisma/models/core.zmodel:59`) — see *Highest-risk sites* §6 |
| `api-key.service.ts:75` | ApiKey | `update` | — | — | — | — | point | `apikey.revoke` → `use-api-key-actions.ts:21`; agent tool |
| `api-key.service.ts:84` | ApiKey | `updateMany` | `where {id}` | — | yes | — | bulk-write | `apikey.touch` — **no client caller found**; PK key |
| `api-key.service.ts:100` | ApiKey | `updateMany` | `where {id}` | — | yes | — | bulk-write | `apikey.update` → `use-api-key-actions.ts:30`; agent tool. PK key |

---

## 8. banned-emails — 4 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `banned-email.service.ts:59` | BannedEmail | `create` | — | — | — | — | point | `bannedEmail.create` → `use-banned-email-actions.ts:16`; then calls `revokeAccessForEmail` |
| `banned-email.service.ts:87` | BannedEmail | `findMany` (`cappedCount`) | `take` = `MAX_PAGE × limit` ≤ 10000 | none | yes | parallel with `:96` | count | `bannedEmail.list` → `admin-banned-emails-container.tsx:32` |
| `banned-email.service.ts:96` | BannedEmail | `findMany` | `skip`, `take` = `limit` | `ORDER_CREATED_AT_DESC` | — | — | list | same |
| `banned-email.service.ts:111` | BannedEmail | `delete` | — | — | — | — | point | `bannedEmail.remove` → `use-banned-email-actions.ts:24` |

---

## 9. agent — 6 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `agent.service.ts:21` | Repo | `findFirst` | — | none | — | — | point | `agent.createSession` — **no client caller found**; the chat UI creates sessions through `app/api/agent/chat/route.ts:95` |
| `agent.service.ts:36` | ChatSession | `create` | — | — | — | — | point | same |
| `agent.service.ts:42` | ChatMessage | `findMany` | **no take** | `{createdAt: "asc"}` | — | — | unbounded | `agent.getSessionHistory` → `agent.tsx:83`. Selects the encrypted `parts` blob (`prisma/models/core.zmodel:142-143`) for the whole session |
| `agent.service.ts:54` | Repo | `findUnique` | — | — | — | — | point | `agent.listSessions` → `agent.tsx:79`; `(owner, name, userId)` |
| `agent.service.ts:69` | ChatSession | `findMany` | **no take** | `{updatedAt: "desc"}` | — | — | unbounded | same; one row per session, grows with chat history |
| `tasks/agent-github-reply.task.ts:32` | GithubInstallation | `findFirst` | — | none | — | — | point | `agent-github-reply` task, fired from the `issue_comment.created` and `pull_request_review_comment` webhooks. `userId` added as part of C11 |

---

## 10. analytics — 2 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `analytics.service.ts:58` | raw | `$queryRawTyped(getDashboardStats(userId, currentStart, previousStart, currentEnd))` | n/a | in SQL | five `Aggregate` nodes collapsed to one CTE (P1) | — | raw | `analytics.getDashboardStats` → `stat-card-container.tsx:21`, `dashboard-action-container.tsx:15`, `dashboard-insights-container.tsx:27`; agent tool. **The heaviest single shape in the app** — 6012 ms baseline, 485 ms with `jit=off` |
| `analytics.service.ts:147` | raw | `$queryRawTyped(getTrends(userId, startDate, endDate, repoId))` | n/a | in SQL | aggregation | — | raw | `analytics.getTrends` → `repo-trends-widget.tsx:26` |

Both are `@prisma/client/sql` generated from `prisma/sql/*.sql`, whose only
`@param` markers are `$1…$n` positional binds. Neither `.sql` file contains a
`${`. Both are fully parameterised.

---

## 11. system — 4 sites

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `health.router.ts:16` | — | `$queryRaw\`SELECT 1\`` | — | — | — | — | raw | `health.check`. **No client caller found** — presumably an uptime probe or the CLI. Constant SQL, no interpolation |
| `tasks/cleanup-db.task.ts:21` | Verification | `deleteMany` | `where {expiresAt < now}` | — | yes | — | bulk-write | `daily-database-maintenance`, cron `0 3 * * *` |
| `tasks/cleanup-db.task.ts:24` | Session | `deleteMany` | `where {expiresAt < now}` | — | yes | — | bulk-write | same. Bounds itself by the session TTL |
| `tasks/cleanup-db.task.ts:28` | WebhookDelivery | `deleteMany` | `where {createdAt < now − 14d}` | — | yes | — | bulk-write | same. Bounds itself by the retention window |

---

## 12. webhooks — 12 sites

All four `repo.findMany({githubId})` fan-outs return **one row per Doxynix account
that connected the repo**. `github_id` is not unique — the index audit measured
2 rows per event at P5-style data.

| file:line | model | operation | take/skip/cursor | orderBy | count / per-row agg | loop / tx | class | consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `installation-webhook-handler.ts:30` | GithubInstallation | `upsert` | — | — | — | — | point | GitHub `installation.created` |
| `installation-webhook-handler.ts:58` | GithubInstallation | `deleteMany` | `where {id}` | — | yes | — | bulk-write | `installation.deleted`; PK key |
| `installation-webhook-handler.ts:67` | GithubInstallation | `updateMany` | `where {id}` | — | yes | — | bulk-write | `installation.suspend` |
| `installation-webhook-handler.ts:78` | GithubInstallation | `updateMany` | `where {id}` | — | yes | — | bulk-write | `installation.unsuspend` |
| `repository-webhook-handler.ts:19` | Repo | `deleteMany` | `where {githubId}` | — | yes | — | bulk-write | `repository.deleted`. Cross-tenant by design: every connected copy goes, which the board records as correct |
| `review-comment-webhook-handler.ts:20` | Repo | `findMany` | **no take**, `where {githubId}` | none | — | — | unbounded | `pull_request_review_comment.created`; then one `agentGithubReplyTask.trigger` per row (`api/webhooks/github/route.ts:54`) |
| `push-webhook-handler.ts:26` | Repo | `findMany` | **no take**, `where {githubId}` | none | — | — | unbounded | `push` to the default branch. Currently returns without acting — the analysis trigger is commented out at `:35-40` |
| `issue-comment-webhook-handler.ts:17` | Repo | `findMany` | **no take**, `where {githubId}` | none | — | — | unbounded | `issue_comment.created` |
| `issue-comment-webhook-handler.ts:27` | PullRequestAnalysis | `findMany` | **no take**, `where {prNumber, repoId in […]}` | none | — | — | unbounded | same; fanned out from `:17` — this is the C1 fix (3 queries, was 201) |
| `issue-comment-webhook-handler.ts:49` | PullRequestComment | `createManyAndReturn` | N rows = connected accounts | — | returns ids | — | bulk-write | same; P2002 treated as an idempotent no-op (C1b) |
| `sync-repo-metadata.ts:32` | Repo | `updateMany` | `where {githubId}` | — | yes | — | bulk-write | `repository` rename/edit/transfer/visibility events. Writes 15 columns across every connected copy |
| `webhook-delivery-failure.ts:5` | WebhookDelivery | `update` | — | — | — | — | point | both webhook routes, on failure |

---

## Class summary

| class | sites | obligation |
| --- | ---: | --- |
| point | 147 | under 2 ms at any volume |
| bulk-write | 34 | `where` bounded; ≥ 2 statements each after the audit interceptor |
| unbounded | 22 | must be justified per row |
| count | 10 | bounded cost, or capped |
| list | 10 | page latency must not grow with `skip` |
| raw | 4 | parameterised, not interpolated |
| keyset | 2 | latency must not grow with depth |
| N+1 | 2 | per-iteration count stated |
| **total** | **231** | |

By module:

| module | point | bulk-write | unbounded | count | list | raw | keyset | N+1 | total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| core & transport | 61 | 9 | 3 | 1 | 1 | 1 | 0 | 0 | 76 |
| analysis | 46 | 2 | 9 | 1 | 4 | 0 | 0 | 2 | 64 |
| repos | 10 | 8 | 1 | 1 | 1 | 0 | 1 | 0 | 22 |
| users | 15 | 2 | 2 | 3 | 1 | 0 | 0 | 0 | 23 |
| notifications | 2 | 2 | 0 | 2 | 1 | 0 | 0 | 0 | 7 |
| audit-logs | 3 | 0 | 0 | 1 | 1 | 0 | 1 | 0 | 6 |
| api-keys | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 5 |
| banned-emails | 2 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 4 |
| agent | 4 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 6 |
| analytics | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 2 |
| system | 0 | 3 | 0 | 0 | 0 | 1 | 0 | 0 | 4 |
| webhooks | 2 | 6 | 4 | 0 | 0 | 0 | 0 | 0 | 12 |

---

## Highest-risk sites

Ranked by what actually breaks first, not by raw latency.

### 1. Unbounded reads reachable from a user-facing procedure — 10 sites

The index audit found eight; this sweep finds ten, because it counts the two
nested relations the previous pass described only in prose.

| site | bound today | what breaks it |
| --- | --- | --- |
| `analysis.repository.ts:240` — `documents[]` nested in `getRepoSnapshot` | documents per repo × versions | **reachable from 10 tRPC procedures**: `getWorkspace`, `getStructureMap`, `getStructureNode`, `getNodeContext`, `getDetailedMetrics`, `getAvailableDocs`, `getDocumentContent`, `getByPRNumber`, `getImpactByPRNumber`, `searchWorkspace`. The index audit says 9; the tenth is `searchWorkspace`, whose service path (`workspace-search.service.ts:26`) is the same `getRepoSnapshot` call |
| `analysis.repository.ts:225` — same nested `documents`, via `getRepoBySha` | same | `getByPRNumber`, `getImpactByPRNumber` |
| `services/pr-impact.service.ts:130` — `pullRequestAnalysis.findMany` + `_count.comments` | PRs per repo | `analysis.listByRepository`; **an N-count-per-row aggregate on top of an unbounded row set** |
| `services/pr-comments.service.ts:11` — `pullRequestComment.findMany` | findings per PR | `analysis.getComments`, and an agent tool |
| `services/analysis-lifecycle.service.ts:166` — `analysis.findMany` | analyses per repo | `analysis.getHistory`; 3022 rows measured on a hot repo |
| `analysis.repository.ts:188` — `generatedFix.findMany` | fixes per repo | `analysis.getByRepository` |
| `agent.service.ts:42` — `chatMessage.findMany` | messages per session, **all encrypted `parts`** | `agent.getSessionHistory`, on every chat panel open |
| `agent.service.ts:69` — `chatSession.findMany` | sessions per user | `agent.listSessions` |
| `analysis.repository.ts:170`, `:274` — nested `comments` / `generatedFixes` | findings per PR | PR webhook + `getByPRNumber` / `getImpactByPRNumber` |
| `admin-review.service.ts:118` — nested `generatedFixes` in the detail view | fixes per PR | `adminReview.detail` |

None is slow at current volume. All grow without limit, and `agent.service.ts:42`
grows in bytes rather than rows because the payload is ciphertext.

### 2. Bulk writes whose `where` can be empty

| site | worst case |
| --- | --- |
| `repo.service.ts:155` | `db.repo.deleteMany()` with **no `where`**. `Repo` carries `@@allow('read,delete', auth() == user \|\| ADMIN)` (`prisma/models/github.zmodel:50`), so ZenStack scopes it to the caller — but the obligation rests entirely on a policy, not on the query. Defence in depth, not a live data-loss bug |
| `notifications.service.ts:99` | `deleteMany({ ...filters, isRead: true })`; filters come from `NotificationsBulkFilterInput` and are all optional, so the empty case is reachable |
| `notifications.service.ts:159` | same shape with `isRead: false` |
| `repository-webhook-handler.ts:19`, `sync-repo-metadata.ts:32` | `where {githubId}` is not unique — measured 2 affected rows per event, and that is by design (one repo, several Doxynix users) |

Every one of these is a `bulk-write`, so each also costs an `auditLog` insert —
see *The `db.ts` audit amplifier*. `repo.service.ts:155` deletes N rows and
writes exactly **one** audit row for the whole `deleteMany`: the payload records
the call, not the rows.

### 3. Counts that are not capped

| site | class | scope |
| --- | --- | --- |
| `admin-user.service.ts:96` | count | `count({banned:false, role:"ADMIN"})` — unbounded exact count, run on every `setRole` / `setBanned` / `deleteUser` |
| `auth-adapter.ts:91` | count | `delegate.count({where})` — model and predicate are supplied by better-auth, so the bound is not visible in this repo |
| `notifications.service.ts:140` | count | `groupBy(by: ["isRead"])` scoped to `userId`. Fixed by P2 (483 ms → 1.9 ms), but it is on every page load via the sidebar and header |
| `auth-adapter.ts:150` | list | `findMany` with `take`/`skip` only when the caller passes them; a caller that omits `limit` gets an unbounded read |
| `trpc/init.ts:165` | point | `_count.passkeys` in the admin gate — on **every** admin request. 0.02 ms because the table is tiny; would not stay cheap if it grew |

The remaining six `count`-class sites are the `cappedCount` fetches —
`admin-review.service.ts:95`, `notifications.service.ts:116`,
`repo.service.ts:185`, `admin-user.service.ts:201`, `admin-audit.service.ts:76`,
`banned-email.service.ts:87` — each bounded at `MAX_PAGE × limit` = 10000 ids by
construction. The tenth is `user.service.ts:133`, a `count` over one user's own
accounts inside the disconnect transaction.

### 4. N+1 loops

| site | per-iteration queries | bound |
| --- | --- | --- |
| `pr-webhook-handler.ts:111` | `analyzeRepoForEvent` issues `pr-config.ts:34` + `analysis.repository.ts:170` + (`analysis.repository.ts:146` or `:412`) = 2–3 per connected account | accounts per GitHub repo. Concurrent via `Promise.allSettled` at `:126`, so wall-clock is flat, statement count is not |
| `github-app.service.ts:291,297,312` | 1–3 per installation | GitHub App installations per user |
| `analysis-lifecycle.service.ts:330` | 1 per generated doc | **hard-bounded at 5**, stated at `:314-326` |

The loop at `generate-fix.task.ts:64` over `uniqueFiles` no longer queries per
file — `github-content.ts:68` is memoised through `BrowseMemo`. That was C9.

### 5. Raw SQL — 4 sites, none interpolated

`analytics.service.ts:58`, `analytics.service.ts:147`, `health.router.ts:16` and
`github-access-token.ts:33`. The three parameterised statements come from
`prisma/sql/getDashboardStats.sql`, `prisma/sql/getTrends.sql` and
`prisma/sql/getAccountForUpdate.sql` via `@prisma/client/sql`. All three `.sql`
files use `$1`-style positional binds behind `-- @param` markers and contain no
`${`. **There is no unparameterised raw SQL in `apps/web`.** The risk here is
cost, not injection: `getDashboardStats` is the 6012 ms shape, and
`getAccountForUpdate` holds a row lock for the length of a GitHub token refresh.

### 6. `point` calls that are not point lookups

`repo.service.ts:225` (`getByName`) filters `(name, owner)` and omits `userId`, so
it does not hit the `@@unique([owner, name, userId])` key. `repo.service.ts:242`
(`getByOwner`) filters `owner` alone — an org can own thousands of repos — and has
no `orderBy`, so the row it returns is arbitrary. Neither has a client caller
found today, which is why they are cheap to fix and worth fixing before someone
calls them.

---

## The `db.ts` audit amplifier

`apps/web/src/server/core/db.ts`, lines 158-263. This is the single largest
multiplier in the inventory: it applies to **every** mutation on **every** model.

### What it intercepts

`db.ts:161` registers `async $allOperations({ args, model, operation, query })`
under `$allModels` (`:160`), so it sees every operation the extended client
issues. It runs the query (`:165`), times it (`:162`, `:176`), and on failure
logs `DB Error: ${model}.${operation}` and rethrows (`:166-174`).

`db.ts:177-187` lists nine mutations:

```
create  createMany  createManyAndReturn
update  updateMany  updateManyAndReturn
upsert  delete      deleteMany
```

`db.ts:189` gates the audit path on `mutationOps.includes(operation) && model !== "AuditLog"`.
Reads and `$queryRaw*` are not in the list, so they are untouched.

### The recursion guard — it holds, and it is not the `model` check

For each intercepted mutation, `db.ts:194-198` sanitises `args` into a payload
and `db.ts:200-234` defines `logAuditTask`, which at `db.ts:202` runs:

```ts
await baseClient.auditLog.create({ … })
```

`baseClient` is declared at `db.ts:112` and assigned at `:130` (edge) or `:139`
(node) — the bare `new PrismaClient(...)`. The extensions are layered on
**afterwards**: field encryption at `:151-156`, the audit interceptor at
`:158`. So `baseClient.auditLog.create` never re-enters `$allOperations`.

**The guard is `baseClient`, and it works.** The `model !== "AuditLog"` test at
`db.ts:189` is a second, redundant check: no code path writes an `AuditLog`
through the extended client, so that branch cannot fire today. It is
defence-in-depth against a future caller, not the mechanism preventing the
recursion. Worth stating precisely because the two are easy to confuse.

Two further consequences of using `baseClient`:

- **ZenStack policies are bypassed for the audit insert**, same as for every
  other `ctx.prisma` site (C13 on the board).
- **Field encryption is bypassed** — `baseClient` predates
  `fieldEncryptionExtension` at `:151`.

### The cost

| | statements |
| --- | ---: |
| 1 intercepted mutation, outside a transaction | 2 — the mutation + one `auditLog` insert |
| a transaction whose body is N intercepted mutations | up to 2N |
| `analysis-lifecycle.service.ts:295-360` | up to 14 — 1 `analysis.update` + 5 `document.upsert` + 1 `notification.create` = 7 in the transaction, 7 audit rows |
| `github-app.service.ts:175-232` | 5 — `verification.deleteMany` + `githubInstallation.updateMany` (+ `findUnique` + `create` on the cold path) |
| `github-app.service.ts:21-32` | 4 — array-form `$transaction` over 2 mutations |
| `user.service.ts:82-147` | 2 per attempt, up to 3 attempts on P2034 |
| `app/api/agent/chat/route.ts:89-112` | 4 |
| `app/api/webhooks/resend/route.ts:173-183` | 4 |

Of the 34 `bulk-write` sites and the 64 single-row writes in the `point` class,
**none** of them is one statement in practice.

### Two things about the audit rows that are not costs

**They outlive a rollback.** `db.ts:202` runs through `baseClient` — outside the
transaction — and `db.ts:236` defers it via `runAsBackgroundTask`, which prefers
Next.js `after()` (`:49`) and otherwise fires and forgets in dev/test (`:63`) or
awaits after the transaction resolves in production (`:69`). So the trail records
attempts, not outcomes. This is C4, still open, and it is a design change rather
than a query change.

**Mutations never reach the slow-query log.** `db.ts:247` is an `else if` on the
mutation test, so a 5-second `update` produces a `db.write` info line at
`db.ts:238-246` with `durationMs` but no `db.slow` warning and no
`poolQueueSnapshot`. Read paths that exceed 200 ms get both; writes get neither.

Also on the write path, per mutation and not per request: `sanitizePayload(args)`
and `maskSensitiveFields(...)` at `db.ts:194-198`, `crypto.randomUUID()` at
`:192` when no request id is in the store, and an Ably publish at `db.ts:215-217`
when the model is in `AUDIT_BUSINESS_MODELS` (`server/utils/constants.ts:1-15` —
14 models; `Session`, `WebhookDelivery`, `Verification` and `Passkey` are **not**
in the list, so those mutations get an audit row but no realtime event).

---

## Reproducing the sweep

Three passes. The first is the naive one; the second catches what it cannot see;
the third catches what the second still cannot.

```bash
cd apps/web

# Pass 1 — 269 raw hits
rg -n -g '!*.test.ts' -g '!src/tests/**' -g '!prisma/seed.ts' -g '!scripts/**' \
  '\b(findMany|findFirst|findUnique|create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany|count|aggregate|groupBy|\$queryRaw|\$queryRawTyped|\$queryRawUnsafe|\$transaction|_count)\s*[\(\{.]' \
  src/server src/app/api

# Pass 2 — anchor on the receiver, not the method name.
# 255 file:line entries; still misses a $queryRawTyped on its own receiver.
rg -n -U -o '\b\w+\s*(?:\.\w+\s*)*\.\s*(findMany|findFirst|findUnique|create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany|count|aggregate|groupBy|\$queryRawTyped|\$queryRaw|\$queryRawUnsafe|\$transaction)\s*[({\[]' \
  src/server src/app/api \
  | awk -F: '{print $1":"$2}' | sort -u

# Pass 3 — what found github-access-token.ts:33.
# Take any identifier before the method, raw ops included, then diff the
# result against the hand-verified list to surface whatever no pattern caught.
```

Consumer traces are `rg -n 'trpc\.<namespace>\.<procedure>' src --glob
'!src/server/**'` against `AppRouter` in `src/server/modules/index.ts:18-34`.
Where that returned nothing the row says **no client caller found** rather than
guessing. Nine procedures have no client caller — `analysis.getAnalysis`,
`analysis.getWithGraphLinks`, `analysis.postCommentToPR`, `repo.getByName`,
`repo.getByOwner`, `adminAudit.detail`, `apikey.touch`, `agent.createSession`,
`health.check` — which accounts for 13 of the 231 sites.