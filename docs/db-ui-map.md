# Procedure → screen map — `apps/web`

Which tRPC procedure backs which visible element, and what a user sees when that procedure is
slow. Companion to [`db-index-audit.md`](./db-index-audit.md) (what the queries cost) and
[`db-optimization-progress.md`](./db-optimization-progress.md) (what was changed). This one
answers the third question: *where does the latency land*.

## Scope and method

| | |
| --- | --- |
| Target | `apps/web` — tRPC 11 + TanStack Query 5 |
| Procedures | 93 across 18 router files (count corrected below) |
| Consumer traced | `src/app`, `src/entities`, `src/features`, `src/widgets`, `src/shared` |

Every claim about a query cites `file:line`; every claim about UI cites a component path. Where
I could not establish what renders a procedure's data, the row says **unresolved** rather than
guessing.

### How statements are counted

Counts are **Prisma operations**, i.e. logical database calls, not TCP round trips. The relevant
mechanical fact: `relationJoins` is enabled in the generator config
(`apps/web/prisma/models/base.zmodel:10`, `apps/web/prisma/schema.prisma:15`), and under
`relationJoins` Prisma's `join` relation-load strategy is the default — nested relations are
resolved with LATERAL joins inside **one** statement rather than as follow-up queries. So
`repo.findUnique` with nested `analyses` and `documents`
(`apps/web/src/server/modules/analysis/analysis.repository.ts:240-243`) is **one** statement, not
three.

**Unresolved:** I did not instrument a running Prisma client to confirm the effective strategy at
runtime. The conclusion above is derived from the preview-feature flag plus Prisma's documented
default, not observed. If the strategy were `query`, every `getRepoSnapshot`-backed procedure in
this document would cost one extra statement per nested relation. The relative ranking of the
procedures would not change.

Two counts the guard chain adds to every call:

- `contextMiddleware` (`apps/web/src/server/core/trpc/init.ts:63`) issues **no** query.
- `isAdmin` (`apps/web/src/server/core/trpc/init.ts:154-176`) issues **one** —
  `ctx.prisma.user.findUnique({ _count: { select: { passkeys: true } }, twoFactorEnabled: true })`
  at `:163-166`, on the *un-enhanced* client (the C13 finding). Every `adminProcedure` below
  carries it.

## Count verification — the figure of 111 is wrong

```
grep -rhoE "(admin|protected|public)Procedure" apps/web/src/server/modules/*/*.router.ts | wc -l
→ 111
```

That is arithmetically right and semantically misleading: **18 of the 111 are `import` statements.**

```
grep -rhE "^import.*(admin|protected|public)Procedure" …/*.router.ts | wc -l   → 18
grep -rhE "(admin|protected|public)Procedure" …/*.router.ts | grep -v "^import" | wc -l   → 93
```

Confirmed two independent ways: counting terminal handlers (`grep -c "\.query(\|\.mutation("`
summed across the same glob) gives **93**, and `apps/web/public/openapi.json` carries exactly
**93** paths, one per procedure, with no spec entry lacking a matching router key. Breakdown of
the 93: **77 `protectedProcedure`, 15 `adminProcedure`, 1 `publicProcedure`** (54 queries, 39
mutations). The quoted "90 protected, 19 admin, 2 public" is the naive split of all 111 and does
not correspond to any real procedure.

`analysisRouter` (`analysis/analysis.router.ts`) contributes **zero** of them — it is a
composition root that spreads four sub-routers.

### `webhooks` is outside the 111 entirely

There is no `webhooks/*.router.ts`. `apps/web/src/server/modules/webhooks/` contains seven
handler modules and is **not registered** in `appRouter`
(`apps/web/src/server/modules/index.ts:18-33`). Its handlers are mounted as Next.js route handlers
at `apps/web/src/app/api/webhooks/github/route.ts` and `.../github/action/route.ts`. So `webhooks`
contributes **0 to the 111 and 0 to the 93** — it is not tRPC at all, and this document does not
cover it.

---

## analytics

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `analytics.getDashboardStats` | protected | **1** raw statement: `$queryRawTyped(getDashboardStats(...))` at `analytics/analytics.service.ts:58-60`, expanded from `apps/web/prisma/sql/getDashboardStats.sql`. One statement, but the CTEs (`user_repos`, `base_data`, `latest_per_repo`, `status_agg`, `doc_agg`) each rescan the user's analyses. | **The whole dashboard page.** Three components call it with byte-identical inputs, so React Query collapses them to one request: `widgets/dashboard/ui/stat-card-container.tsx:21` → 8 `StatCard`s (`health`, `security`, `complexity`, `onboarding`, `loc`, `techDebt`, `queue`, `criticalRepoCount` — `widgets/dashboard/model/get-stats.ts:27-90`); `widgets/dashboard/ui/dashboard-action-container.tsx:15` → `RefactoringTargetsWidget` (`widgets/dashboard/ui/analytics-widgets.tsx:106`); `widgets/dashboard/ui/dashboard-insights-container.tsx:27` → `EcosystemStatusWidget`, `SystemRisksWidget`, `HealthExtremesWidget`, `LanguagesWidget`, `RecentActivityWidget`. All mounted at `app/[locale]/(private)/dashboard/page.tsx:29,44,48`. | **The entire page is one skeleton.** All three containers gate on `isLoading \|\| data == null`, so a slow query shows `StatCardSkeleton` ×8 + `RefactoringTargetsSkeleton` + `EcosystemStatusSkeleton`/`SystemRisksSkeleton`/`HealthExtremesSkeleton`/`LanguagesSkeleton`/`RecentActivitySkeleton` simultaneously. Nothing partial ever renders — there is no per-widget loading state to lose. At the measured 485 ms post-JIT this is invisible; at the 5775 ms pre-JIT it was the whole dashboard blank. |
| `analytics.getTrends` | protected | **1** raw statement, `getTrends.sql` (`DISTINCT ON (repo_id, DATE(created_at))` over the user's analyses in the window). `analytics.service.ts:147-149`. | A per-repo trend chart: `features/repo-analytics/ui/repo-trends-widget.tsx`. | Chart area holds empty / shows a skeleton until the series lands; the rest of the repo page is unaffected. Scoped to one repo when `repoId` is passed, so far cheaper than the dashboard query. |

**Correction to the brief:** the languages widget is **not a donut**. `LanguagesWidget`
(`widgets/dashboard/ui/analytics-widgets.tsx:221-272`) renders a vertical list of `<Progress>`
bars, one per language, each coloured by `lang.color`. There is no chart library and no pie.

---

## analysis — core (`analysis/analysis-core.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `analysis.analyze` | protected (mutation) | 2: `repo.findFirst` access check (`services/analysis-lifecycle.service.ts:110`), then `analysis.create` (`:62`). Then a Trigger.dev task trigger — no DB. | "Analyse" button in the repo setup flow: `entities/repo/model/use-repo-setup.ts` → `features/repo-setup/ui/`. | Button stays pending. Nothing else on screen depends on it. Cheap. |
| `analysis.cancel` | protected (mutation) | 1–2: `analysis.findFirst` (`analysis-lifecycle.service.ts:120`), conditional `analysis.update` (`:131`), then a Trigger.dev `runs.cancel`. | Cancel button on the live progress view: `features/repo-setup/ui/repo-analysis-live.tsx`. | Click feels dead. The user cannot tell whether the abort landed. |
| `analysis.getDetailedMetrics` | protected | **1** (2 with `aid`): `analysisRepo.getRepoSnapshot` → `repo.findUnique` + LATERAL joins on `analyses` (`take: 1`) and **`documents` with no `take`** (`analysis.repository.ts:50-65`, `:240`); plus `analysis.findFirst` when `aid` is set (`:250`). | The metrics panel: `features/repo-analytics/ui/repo-metrics-container.tsx`, also pulled by `features/repo-docs-viewer/ui/repo-docs.tsx`. | Score panel skeleton. Note the second consumer makes this fire on the docs page too, where it is not the visible subject. |
| `analysis.getHistory` | protected | **1**, `analysis.findMany` at `services/analysis-lifecycle.service.ts:166-176`, `where: { repo: { id: repoId } }`, `orderBy: createdAt desc`, **no `take`**. | The version dropdown: `features/repo/ui/repo-version-selector.tsx:27` → a `<Select>` of commit SHAs with `TimeAgo` and a `FAILED` badge (`:46-70`). | `<Skeleton className="h-9 w-60" />` stands in for the whole trigger (`:29-31`) — the dropdown is unclickable until it resolves. |
| `analysis.getLatest` | protected | **1**, `analysis.findFirst` (`analysis-lifecycle.service.ts:187-195`). | Live progress view: `features/repo-setup/ui/repo-analysis-live.tsx`. | Progress bar and status text stall at their previous values. |
| `analysis.getWorkspace` | protected | **1** (2 with `aid`): `getRepoSnapshot` (`services/workspace.service.ts:103`). | The repo overview tab (`features/repo-analytics/ui/repo-overview-container.tsx`) **and** the map sidebar's empty state (`features/repo-map/ui/repo-map-sidebar.tsx:22`, gated on `nodeId == null`). | Two screens degrade together because they share the procedure. `RepoMapSidebarSkeleton` in the map sidebar; the overview pane blanks. |

### `getHistory` is genuinely unbounded — the docs' claim holds

`analysis-lifecycle.service.ts:166` has no `take`. The audit lists this at
`db-index-audit.md:229` and it is still true in the tree. Growth is one row per analysis run per
repo; the stress clone's hot repo holds 3022 of them. It is fast today because it reads six
scalar columns off `analyses`, but the *response* grows without limit and the client maps the
whole array into `<SelectItem>`s (`repo-version-selector.tsx:46`) — a repo with thousands of runs
renders thousands of DOM rows in one dropdown.

### `getRepoSnapshot` is the shared cost centre

**Eight procedures** funnel through `analysisRepo.getRepoSnapshot`: `getDetailedMetrics`
(`services/workspace.service.ts:16`), `getNodeContext` (`:29`), `getStructureMap` (`:81`),
`getStructureNode` (`:90`), `getWorkspace` (`:103`), `getAvailableDocs`
(`services/docs.service.ts:56`), `getDocumentContent` (`:70`) and `searchWorkspace`
(`services/workspace-search.service.ts:26`). On top of those,
`getByPRNumber`/`getImpactByPRNumber` reach the same select through `getRepoBySha`
(`analysis.repository.ts:225`) and its `getRepoSnapshot` fallback
(`services/pr-impact.service.ts:46`) — so the audit's "reachable from 9 procedures"
(`db-index-audit.md:230`) is conservative; I count **10**.

The audit's claim that the nested `documents` relation has no `take` is correct
(`analysis.repository.ts:50-65`). What it does not say is that the select carries document
*metadata* only — `id`, `path`, `type`, `version`, `createdAt`, `updatedAt` and the parent
`analysis.id` (`:52-64`) — not `content`. So the unbounded row count is real but the payload per
row is small, and the cost is the row multiplication, not the bytes. **Unresolved:** no
per-shape timing exists for this specific nested read on the stress clone, so whether it is
material at 1 335 561 `documents` rows is unmeasured.

## analysis — docs (`analysis/analysis-docs.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `analysis.getAvailableDocs` | protected | **1** (2 with `aid`): `getRepoSnapshot` (`services/docs.service.ts:56`). | The docs tab's file list: `features/repo-docs-viewer/ui/repo-docs-container.tsx`. | Doc-type tabs render empty; the panel shows its loading state. |
| `analysis.getDocumentContent` | protected | **2** (3 with `aid`): `getRepoSnapshot` (`docs.service.ts:70`) + `document.findFirst` (`:80`). The Markdown→HTML render is behind `unstable_cache` (`:100`), so it is cached across requests but not part of the query count. | The rendered document body: `features/repo-docs-viewer/ui/repo-docs.tsx`. | Document pane blank while the type list above it is already populated — this is the one place in the docs tab where a partial render is actually possible. |
| `analysis.documentFile` | protected (mutation) | ≥2: `buildFileActionRuntimeContext` (`services/file-actions.service.ts:33-40`) fires `analysisContext.build` (a `getRepoSnapshot`) and `analysisRepo.getLatestRef` **concurrently**, then a write. | "Document this file" in the code browser: `features/repo-code-viewer/ui/repo-code-browser.tsx`. | Mutation pending state on the button; no blocking read. |
| `analysis.quickFileAudit` | protected (mutation) | Same shape as `documentFile` (`file-actions.service.ts:85-89`). | "Quick audit" in the code browser: `repo-code-browser.tsx`. | Same. |
| `analysis.getFileActionResult` | protected | **0 DB.** Redis `get` + Shiki render (`file-actions.service.ts:62-74`). | Polls the audit result into the code browser: `features/repo-code-viewer/ui/repo-code-browser.tsx`. | No database cost. A slow result here is a slow analysis, not a slow query. |
| `analysis.pinAuditToDocs` | protected (mutation) | 1–2: Redis `get` (`:177`), optional `analysis.findUnique` (`:189`), `document.create` (`:198`). | "Pin to docs" in the code browser: `repo-code-browser.tsx`. | Button pending. |
| `analysis.getWithGraphLinks` | protected | **1**, `document.findFirst` (`docs.service.ts:127`). | **Unresolved** — see below. | Unknown; no in-app caller found. |
| `analysis.highlightFile` | protected | **0 DB.** Pure function (`docs.service.ts:163`). | **Unresolved** — no in-app caller found. | N/A. |

**`getWithGraphLinks` and `highlightFile`:** grep across `apps/web/src` (excluding `*.test.ts`)
finds no caller for either, and neither appears in `packages/cli/src`. They remain reachable over
the tRPC HTTP endpoint, so they are not dead code — but nothing in the UI exercises them, so I
cannot say what a slow response would damage.

## analysis — PR fixes (`analysis/analysis-pr-fixes.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `analysis.getRepoConfig` | protected | **1**, `pullRequestAnalysisConfig.findUnique` (`logic/pr-config.ts:34`). This is P5, "done" at `db-optimization-progress.md:19` — 0.228 ms → 0.068 ms. | The PR-analysis settings card: `features/repo-settings/ui/pr-analysis-config-card.tsx`. | Settings card defaults render; a slow read shows the toggle in its unset state rather than the stored one. Cheap enough to be invisible. |
| `analysis.configureRepository` | protected (mutation) | **2**: `repo.update` with a nested upsert (`pr-config.ts:78-95`), then `getConfig` re-reads (`:97`). | Same settings card. | Pending state on save. |
| `analysis.getById` | protected | **1** `generatedFix.findUnique` (`services/fixes.service.ts:182`) + Redis `get` (`:196`). | The fix detail panel: `features/repo-analytics/ui/repo-metrics.tsx`. | Fix card empty. |
| `analysis.getByRepository` | protected | **1**, `generatedFix.findMany` by repo, **no `take`** (`analysis.repository.ts:188`). Matches the unbounded list at `db-index-audit.md:231`. | Fix list — **in the web app only as an invalidation target** (`repo-pull-details-content.tsx:115`, `pr-draft-sheet.tsx:71`); the real consumer is `packages/cli/src/core/fixes.ts:6`. | In the web UI: no visible effect from the query itself (no `useQuery` calls it). In the CLI: the interactive fix picker is empty. |
| `analysis.getStagedFiles` | protected | **0 DB.** Redis `hgetall` (`services/staging.service.ts:22`). | The PR draft sheet's staged-file list: `features/repo/ui/pr-draft-sheet.tsx`. | No database cost. |
| `analysis.stageFile` / `analysis.unstageFile` | protected (mutation) | **0 DB**, Redis only (`staging.service.ts:26`, `:89`). | Staging add/remove in `pr-draft-sheet.tsx` and `features/repo-code-viewer/ui/repo-docs.tsx`. | No database cost. |
| `analysis.stageGeneratedFix` | protected (mutation) | **1** `generatedFix.findUnique` (`staging.service.ts:39`) + Redis `get` (`:62`). | Stage-from-fix buttons: `features/repo-analytics/ui/repo-metrics.tsx`, `features/repo-pulls/model/use-pr-stage.ts`. | Button pending. |
| `analysis.clearStaging` | protected (mutation) | **0 DB**, Redis `del` (`staging.service.ts:17`). | Clear-staging in the PR draft sheet. | No database cost. |
| `analysis.openPullRequest` | protected (mutation) | **3**: `repo.findUnique` (`fixes.service.ts:223`), `githubInstallation.findFirst` (`:234`), Redis `hgetall` (`:251`), then GitHub API calls. | "Open pull request" in the PR draft sheet: `pr-draft-sheet.tsx`. | Button pending; dominated by the GitHub API, not the database. |
| `analysis.applyFix` | protected (mutation) | **3**: `repo.findUnique` (`fixes.service.ts:37`), `analysisRepo.getById` (`:50`), `analysisRepo.updateStatus` (`:68`), plus Redis (`:73`) and GitHub API calls. | **No web caller.** Only `server/modules/agent/agent.tools.ts:35`. | Not a web failure mode. |
| `analysis.createFix` | protected (mutation) | **2–3**: optional `pullRequestAnalysis.findUnique` (`fixes.service.ts:118`), `repo.findUnique` (`:128`), `analysisRepo.create` → `generatedFix.create` (`:139`, `analysis.repository.ts:130`). | "Create fix" in the PR detail content: `features/repo-pulls/ui/repo-pull-details-content.tsx`, and `features/repo-analytics/ui/repo-metrics.tsx`. | Button pending while a fix is generated. |

## analysis — repo (`analysis/analysis-repo.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `analysis.getNodeContext` | protected | **4–5 statements across 3 sequential await phases**, with **2 concurrent** in the middle phase. Detail below. | The node detail panel, in **three** places: `features/repo-map/ui/repo-map-sidebar.tsx:29` (gated `enabled: shouldLoadNodeContext`, i.e. only when a node is selected), `features/repo-code-viewer/ui/repo-code-container.tsx:31`, `features/repo-docs-viewer/ui/repo-docs-container.tsx:39`. All three render `RepoNodeInspector`. | Not on every mount — the map sidebar gates it on `nodeId != null`, so the cost lands on click, not on page load. The damage is **click-to-inspect latency**: the user selects a node and waits out 3 serial round trips before the panel appears. Because it is its own query, the surrounding view (`getStructureMap`, `getWorkspace`) is already drawn — so the visible symptom is one pane lagging inside an otherwise-complete screen, which is harder to diagnose than a blank page. |
| `analysis.getStructureMap` | protected | **1** (2 with `aid`): `getRepoSnapshot` (`workspace.service.ts:81`). | The repo map canvas: `features/repo-map/ui/repo-map-container.tsx`. | The whole map is one loading state. |
| `analysis.getStructureNode` | protected | **1** (2 with `aid`): `getRepoSnapshot` (`workspace.service.ts:90`). | The floating node card in the map (`features/repo-docs-viewer/ui/repo-floating-card.tsx`) and the map container itself. | Floating card lags behind the click that spawned it. |
| `analysis.searchWorkspace` | protected | **2** (3 with `aid`): `getRepoSnapshot` (`services/workspace-search.service.ts:26`) + `loadLatestDocumentsWithContent` → `document.findMany` (`:39`, take 24 = `MAX_SEARCHABLE_DOCUMENT_FETCH`). The scan itself is in-process over the graph, not SQL. | The workspace search box: `features/repo-analytics/ui/repo-workspace-search.tsx:58`. Also an agent tool (`agent.tools.ts:526`, `server/domain/ai/ai-tools.ts:280`). | `isFetching` toggles on every keystroke. Because the whole snapshot is refetched per query, a slow read makes typing feel laggy rather than the results being wrong. |
| `analysis.listByRepository` | protected | **1**, `pullRequestAnalysis.findMany` by repo, **no `take`**, plus a per-row `_count.comments` (`services/pr-impact.service.ts:130-148`). This is the unbounded list at `db-index-audit.md:232`. | The PR list table: `features/repo-pulls/ui/repo-pulls-list-container.tsx`. | Whole table empty. Grows with the number of analysed PRs, and each row carries an aggregate. |
| `analysis.getAnalysis` | protected | **1**, `pullRequestAnalysis.findUnique` (`pr-impact.service.ts:14`). | **No web caller.** CLI only (`packages/cli/src/commands/pr/pr.service.ts:23`). | Not a web failure mode. |
| `analysis.getByPRNumber` | protected | **2–3**: `loadImpactAnalysis` → `pullRequestAnalysis.findFirst` with LATERAL joins on `comments` and `generatedFixes` (`analysis.repository.ts:274-312`) = 1 statement; then `getRepoBySha` (`pr-impact.service.ts:45`, `analysis.repository.ts:225`) = 1 statement carrying the same unbounded `documents` relation; falls back to `getRepoSnapshot` (`:46`) when the SHA lookup misses. | The PR detail panel: `features/repo-pulls/ui/repo-pull-details-container.tsx:24`. | Full PR detail pane blank — affected zones, affected nodes, top findings, fixes — and it waits on the duplicate request too (see below). |
| `analysis.getImpactByPRNumber` | protected | **Identical to `getByPRNumber`** — see the duplication finding below. Called **unconditionally with the same arguments** at `features/repo-pulls/ui/repo-pull-details-container.tsx:28`, so the same 2–3 statements run twice per render. | The **same** component, `repo-pull-details-container.tsx`. | The pane waits on `isAnalysisLoading \|\| isImpactLoading` (`:33`), so the user pays for both requests before anything renders. |
| `analysis.getComments` | protected | **1**, `pullRequestComment.findMany` by analysis, **no `take`** (`services/pr-comments.service.ts:11-34`). Unbounded, matches `db-index-audit.md:233`. Per-comment HTML is behind `unstable_cache` (`:36-41`), not a query. | The review-comment list in the PR detail pane: `features/repo-pulls/ui/repo-pull-details-content.tsx:74`. | Comment list empty while the rest of the PR panel is populated — the clearest partial-render degradation in the app. |
| `analysis.postCommentToPR` | protected (mutation) | ≥1 write plus GitHub API. | Post-review-comment action: `repo-pull-details-content.tsx`. | Button pending; dominated by GitHub. |

### `getNodeContext` — the "5 queries, 3 concurrent" claim

Partly right, and the wrong half matters. Trace:

| phase | source | statements | concurrent? |
| --- | --- | --- | --- |
| 1 | `getRepoSnapshot` — `repo.findUnique` + LATERAL joins (`analysis.repository.ts:240`); `+1` `analysis.findFirst` when `aid` is set (`:250`) | 1–2 | no |
| 2 | `Promise.all` at `services/workspace.service.ts:50-60` — `document.findMany` (`analysis.repository.ts:316`) ‖ `pullRequestComment.findMany` (`:367`) | 2 | **2 concurrent** |
| 3 | `generatedFix.findMany` (`analysis.repository.ts:342`, skipped when no finding carries a `prAnalysisId`, `:338`) | 0–1 | no |

**4–5 statements, 3 sequential await phases, 2 concurrent — not 5-and-3.** The "5" is right by
coincidence; the *shape* is wrong in the way that costs latency, because phase 3 is strictly
serial after phase 2 even though it depends only on `findings`, not on `docs`. Phase 3 could
join phase 2's `Promise.all` — it is held back only because the author wanted the PR-finding ids
first. That is a real, if small, serialisation.

The row-count risk in this procedure is the nested `documents` relation inside `getRepoSnapshot`
(`analysis.repository.ts:50-65`, no `take`) — the same one the audit flags.

## analysis — admin review (`analysis/admin-review.router.ts`, `adminProcedure`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `adminReview.list` | **admin** (+1 gate query) | **2 unfiltered, 3 filtered**: `fetchItems` + `countFiltered` + optional `countUnfiltered`, all in one `Promise.all` (`admin-review.service.ts:99-112`). Counts are `cappedCount`, not `count()` — `findMany({ select: { id: true }, take: cap })` (`:92-97`). | The admin PR-review table: `features/admin/ui/admin-review-container.tsx` → table + `AppPagination`. | Table and paginator arrive together or not at all. The `admin-audit` table's failure mode applies identically; see the admin-audit row for the detail. |
| `adminReview.detail` | **admin** (+1) | **1** `pullRequestAnalysis.findUnique` + a nested `generatedFixes` read (`admin-review.service.ts:118-125`). | The review detail sheet: `features/admin/ui/admin-review-sheet.tsx:29`, gated on `enabled: open`. | Sheet opens empty after the click; the list behind it is already rendered. |

## repos (`repos/repo.router.ts`, `github-browse.router.ts`, `github-app.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `repo.getSlim` | protected | **1**, `repo.findMany` with `cursor`, `orderBy: [{updatedAt:"desc"},{id:"desc"}]`, `take: limit + 1` (`repo.service.ts:262-274`). Keyset, not offset. **No count at all.** | Four consumers: the sidebar repo list (`widgets/app-sidebar/ui/app-sidebar.tsx:40`, `limit: 5`, **no `enabled` — fires on sidebar mount**); the command menu (`widgets/app-header/ui/app-command-menu.tsx:70`, `enabled: open`); the notifications repo filter (`features/notifications/ui/notifications-repo-filter.tsx:33`, `enabled: open`); and a `limit: 1` existence probe behind the delete-all button (`features/repo/ui/delete-all-repos-card.tsx:13`). | See the correction below — the brief's "every sidebar and command-menu open" is only half right. The real damage is that the sidebar's repo section renders `SidebarMenuSkeleton` rows on every full page load, and the command menu shows an empty list for the debounce window plus the fetch. |
| `repo.getAll` | protected | **2 unfiltered, 3 filtered**: `fetchItems` (`repo.service.ts:196-213`, with a nested `analyses take: 1` at `:199-208`) + counts (`repo.service.ts:183-185`). The second count is skipped unless `owner != null` *and* the where-clause is non-empty (`:194`). | The main repositories table: `features/repo/ui/repo-list-container.tsx`. | Whole table + paginator skeleton. `AppPagination` disables itself on `isFetching`, so the paginator greys out rather than mis-counting. |
| `repo.getByName` | protected | **1** `repo.findFirst` + nested `analyses take: 1` (`repo.service.ts:225-227`). | Server-component fetch, not a client hook: `server/modules/repos/repo.fetchers.ts:20`, wrapped in React `cache` and `notFound()`. | The repo page itself fails to render. A slow read here blocks the whole route, not one pane. |
| `repo.getByOwner` | protected | **1** `repo.findFirst` (`repo.service.ts:242`). | Server-component fetch: `repo.fetchers.ts:9`. | Same — owner page blocks. |
| `repo.create` | protected (mutation) | GitHub API `getRepoInfo` first, then 1 `repo.create` (`repo.service.ts:107-129`). | Create-repo dialog: `features/repo/ui/create-repo-dialog.tsx`. | Dialog pending; dominated by GitHub, not the DB. |
| `repo.delete` / `deleteByOwner` / `deleteAll` | protected (mutation) | 1 each: `repo.delete` (`:143`), `repo.deleteMany` (`:164`), `repo.deleteMany` **with no `where`** (`:155`). | `entities/repo/model/use-repo-actions.ts` → delete dialogs, delete-all card. | Button pending. The unbounded `deleteAll` is reclassified as *not* a data-loss bug at `db-index-audit.md:342-345` (the ZenStack `@@allow` scopes it). |
| `githubBrowse.getBranches` | protected | Resolves an installation, then GitHub API. No hand-written Prisma read in the procedure. | Branch dropdown during repo setup: `entities/repo/model/use-repo-setup.ts:49`. | Dropdown empty; dominated by GitHub. |
| `githubBrowse.getRepoFiles` | protected | Same — GitHub API only. | The file-selection tree during setup: `use-repo-setup.ts`. | Empty tree. |
| `githubBrowse.getFileContent` | protected | Same, plus the `resolveClientContext` lookup. | The file viewer: `features/repo-code-viewer/ui/repo-code-container.tsx`. | File pane empty. |
| `githubBrowse.searchGithub` | protected | Same — GitHub API only. | The GitHub repo search in the create dialog: `create-repo-dialog.tsx`. | Empty results. |
| `githubApp.getGithubInstallUrl` | protected | **2 writes in one transaction**: `verification.deleteMany` + `verification.create` (`github-app.service.ts:22`, `:25`). Runs on every open of the connections page. | The "Install GitHub App" button: `features/connections/ui/connections-list-container.tsx`. | Button href appears late. Also generates a throwaway row and a delete on every visit. |
| `githubApp.getMyGithubRepos` | protected | **1 + unbounded loop**: `syncInstallations` (`github-app.service.ts:248-300`) paginates the GitHub API and issues one `githubInstallation.updateMany` per installation (`:291`), then `findMany` (`:40`). | The connected-repositories list and the create dialog: `connections-list-container.tsx`, `create-repo-dialog.tsx`. | List empty. Statement count scales with the number of orgs the user has installed the app into, so it is bounded by GitHub, not by the table. |
| `githubApp.saveInstallation` | protected (mutation) | `prisma.$transaction` + `verification.deleteMany` (`:176`) + `githubInstallation.updateMany` (`:190`). | Install callback only. | Not a latency-visible surface. |

### `repo.getSlim` — the brief's claim is half wrong

The brief says it is "fetched on every sidebar and command-menu open". Precisely:

- `app-sidebar.tsx:40` has **no `enabled` option**. `AppSidebar` is mounted once in the private
  layout (`app/[locale]/(private)/layout.tsx:45`), so it fires **on every full page load**, and
  not on client-side navigation within the layout. It is not "on every sidebar open" — the
  sidebar never unmounts to be re-opened.
- `app-command-menu.tsx:70` **does** have `enabled: open`, so it genuinely fires on every command
  menu open.

Two further consumers the brief does not mention: the notifications repo filter
(`notifications-repo-filter.tsx:33`, also `enabled: open`) and the delete-all existence probe
(`delete-all-repos-card.tsx:13`, `limit: 1`, unconditional on the settings page).

Because all four share one query key per distinct input and React Query dedupes, the honest cost
is **one request per distinct input per cache window**, not four.

## users (`users/user.router.ts`, `admin-user.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `user.getActiveSessions` | protected | Not a hand-written query — `auth.api.listSessions` (`user.service.ts:156`), behind Better Auth. | The sessions list: `features/sessions/ui/sessions-list.tsx:27`. | List skeleton. |
| `user.revokeSession` | protected (mutation) | Same path (`user.service.ts:222`). | Revoke button: `sessions-list.tsx:48`. | Button pending. |
| `user.getLinkedAccounts` | protected | **2 concurrent**: `account.findMany` ‖ `user.findUnique` (`user.service.ts:165`, `:176`). | The connections list: `features/connections/ui/connections-list-container.tsx`. | Connections list skeleton. |
| `user.me` | protected | **1** `user.findUnique` (`user.service.ts:187`). | **No web caller.** Only `utils.user.me.invalidate()` in the web app; the real consumers are `packages/cli/src/commands/{auth,profile}`. | In the web app the identity comes from the session, not this call. |
| `user.updateUser` / `removeAvatar` / `deleteAccount` / `disconnectAccount` | protected (mutation) | 1–2 writes each: `user.update` (`:235`), `user.update` (`:205`), `user.delete` (`:106`), and a serializable transaction (`:121`). `removeAvatar` reads through the **raw** `prisma` client (`:198`) — the C13 finding. | Profile form: `features/profile/model/use-profile-actions.ts`; the disconnect control is `features/connections/ui/auth-providers-list.tsx`. | Save pending. |
| `adminUser.list` | **admin** (+1) | **2 unfiltered, 3 filtered** via `getPaginatedList` (`admin-user.service.ts:205-218`). Counts are capped (`:199-203`). | The admin users table: `features/admin/ui/admin-users-container.tsx`. | Table + paginator together. |
| `adminUser.getDetail` | **admin** (+1) | **1** `user.findUnique` with a five-relation `_count` (`admin-user.service.ts:224-227`) — one statement, six aggregates. | The user detail sheet: `features/admin/ui/admin-user-sheet.tsx`. | Sheet empty after click. |
| `adminUser.listSessions` | **admin** (+1) | **1**, `session.findMany` by user, **no `take`** (`admin-user.service.ts:238-248`) — the unbounded list at `db-index-audit.md:236`. | The sessions block inside the user sheet: `features/admin/ui/admin-user-sessions.tsx`. | The sheet's lower half stays empty while the header (from `getDetail`) is already drawn. **The clearest partial-render case in the admin UI**, because it is a second, independent request inside an already-open panel. |
| `adminUser.setRole` / `setBanned` | **admin** (mutation, +1) | **2–3** each. `findTarget` (1, `admin-user.service.ts:100`) always. `countActiveAdmins` (`:96`) is conditional but not on the target's role the way it first looks: `setBanned` runs it only when `input.banned` is true (`:291`), `setRole` only when **demoting** an admin (`:328`). Then `persistUserUpdate` → `user.update` (`:115`). | Role/ban controls: `features/admin/model/use-admin-user-actions.ts`. | Button pending. |
| `adminUser.revokeSession` | **admin** (mutation, +1) | Reads through the **raw** `prisma.session.findUnique` (`admin-user.service.ts:263`) then `session.deleteMany` (`:280`). | Revoke button in `admin-user-sessions.tsx`. | Button pending. |
| `adminUser.deleteUser` | **admin** (mutation, +1) | **3**: `findTarget` (1) + `countActiveAdmins` — **unconditional** here (`:172`) + `user.delete` (`:184`). TOTP reauth is not a DB call in this path. | Delete confirm: `use-admin-user-actions.ts`. | Confirm pending. |

## notifications (`notifications/notifications.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `notification.getStats` | protected | **1**, `notification.groupBy({ _count: { _all: true }, by: ["isRead"], where: { userId } })` at `notifications.service.ts:140-144`. | The unread badge, in **three** components: the sidebar nav item count (`widgets/app-sidebar/ui/app-sidebar.tsx:50` → `SidebarLink notificationsCount`), the header bell dot (`widgets/app-header/ui/notifications-nav.tsx:33`), and the notifications page header (`features/notifications/ui/notifications-list-container.tsx:44` → `NotificationsHeader`). The bell renders its dot only when `unread > 0`, so a slow read is **invisible absence** — no badge, no spinner, no error. | **The badge silently shows nothing.** Unlike every other row in this document there is no skeleton and no error state: a slow read means the dot does not appear, and the user concludes they have no unread notifications. The notifications page header renders with `stats === undefined` rather than a spinner. All three call sites pass no input, so they share one query key and collapse to a single request per cache window — but three components are affected by that one request. |
| `notification.getAll` | protected | **2 unfiltered, 3 filtered** via `getPaginatedList` (`notifications.service.ts:120-133`); counts capped at `MAX_PAGE * limit` (`:113`). The nested `repo` select is a join, not a second round trip. | The notifications page list (`features/notifications/ui/notifications-list-container.tsx`, which renders `NotificationCardSkeleton` × page size at `:50-55` while loading) **and** the header bell's 5-item dropdown (`widgets/app-header/ui/notifications-nav.tsx:31`). Two different page sizes, so two distinct query keys. | The bell dropdown is the more damaging of the two — it is opened by a click that produces no feedback at all, because the dropdown body has no loading state, only an empty list. The page list at least shows skeletons, and uses `placeholderData: previousData` (`:42`) so page changes hold the old rows. |
| `notification.markAs` / `markAllAsRead` / `deleteOne` / `deleteRead` | protected (mutation) | 1 each (`:174`, `:159`, `:87`, `:99`). | `features/notifications/model/use-notification-actions.ts`; every mutation invalidates `getStats` (`use-notification-actions.ts:11`) and `getAll`. | Optimistic UI covers the button; the **badge** waits for the refetch, so it can lag a second behind the click that should have cleared it. |

### `getStats` — what P2 actually fixed

**Verified.** `notifications.service.ts:140-144` reads:

```ts
const groups = await db.notification.groupBy({
  _count: { _all: true },
  by: ["isRead"],
  where: { userId },
});
```

P2 (`db-optimization-progress.md:15`, 483 ms → 1.9 ms) added `where: { userId }`. That closed the
cross-user leak recorded as C5. **The `groupBy` is still unbounded by date** — there is no
`createdAt` predicate anywhere in the call. So the answer to the brief's question is: *it is
unbounded in time, scoped in tenancy.* The cost now tracks a single user's lifetime notification
volume rather than the whole table. At two rows per group it will stay cheap for a long time, but
nothing bounds it structurally, and unlike `notification.getAll` it is not served by the capped
count either. It is the one read in the app that is neither paged, capped, nor date-bounded.

## audit logs

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `audit.getActivityLogs` | protected | **1**, `auditLog.findMany` with `cursor: { id }`, `orderBy: [{createdAt:"desc"},{id:"desc"}]`, `take: limit + 1`, `where: { model: { in: AUDIT_BUSINESS_MODELS }, userId }` (`audit.service.ts:20-28`). Keyset, and **no count of any kind** — the return has only `hasNextPage` and `nextCursor` (`:39-42`). | The activity feed: `features/audit-logs/ui/audit-logs-container.tsx` → `useInfiniteQuery` (`:17`) → `AuditLogList` plus a "Load more" button. | Confirmed as the brief states. A centred `<Spinner />` for the first page, then the "Load more" button sits in its `isLoading` state. Because there is no count, nothing in the UI can show a total — and there is nothing for a slow count to delay. This is the design the other six lists are moving away from. |
| `audit.getLogPayloadHtml` | protected | **1** `auditLog.findUnique({ select: { payload } })` (`audit.service.ts:47`) + a Shiki highlight (`:60`). | The payload sheet opened from a feed row: `entities/audit-log/ui/audit-log-sheet.tsx`. | Sheet opens with a blank code area. |
| `adminAudit.list` | **admin** (+1) | **2 unfiltered, 3 filtered** via `getPaginatedList` (`admin-audit.service.ts:80-92`); counts are `cappedCount` (`:74-78`), which is P12/P16. | The admin audit table **and** the paginator counts — both from this one response. `features/admin/ui/admin-audit-container.tsx:27` renders `data.meta.filteredCount`/`totalCount` in the header line (`:53`), `AdminAuditTable` (`:55`) and `AppPagination` (`:57`). | **Confirmed: table rows and paginator counts are one query.** There is no separate count request, so the counts can never disagree with the rows — and they cannot arrive separately either. A slow call holds the header count, all 20 rows, and the page buttons together. On page changes `placeholderData: previousData` (`:35`) keeps the old rows on screen while `isFetching` greys the paginator, so the user sees the table go inert rather than blank. |
| `adminAudit.payloadHtml` | **admin** (+1) | **1** `auditLog.findUnique` + Shiki (`admin-audit.service.ts:108-117`). | The payload sheet: `features/admin/ui/admin-audit-payload-sheet.tsx`. | Sheet blank after click. |
| `adminAudit.detail` | **admin** (+1) | **1** `auditLog.findUnique` (`admin-audit.service.ts:98`). | **Unresolved** — no caller in `apps/web/src` (grep, excluding tests) and none in `packages/cli/src`. The admin audit UI uses `payloadHtml` instead. Reachable over HTTP only. | Unknown. |

## banned emails (`banned-emails/banned-email.router.ts`, `adminProcedure`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `bannedEmail.list` | **admin** (+1) | **2 unfiltered, 3 filtered** via `getPaginatedList`, counts capped (`banned-email.service.ts:91-104`). P4b, done. | The banned-emails table: `features/admin/ui/admin-banned-emails-container.tsx`. | Table + paginator together. Measured 6.7 → 4.9 ms (`db-optimization-progress.md:21`), so effectively invisible. |
| `bannedEmail.create` | **admin** (mutation, +1) | 2: `bannedEmail.create` (`:59`) then `revokeAccessForEmail` (`:64`) — C10 reduced this from 3. | Add-banned-email form: `features/admin/model/use-banned-email-actions.ts`. | Form pending; correct, since the revoke must land. |
| `bannedEmail.remove` | **admin** (mutation, +1) | **1** `bannedEmail.delete` (`:111`). | Remove button: `use-banned-email-actions.ts`. | Button pending. |

## api keys (`api-keys/api-key.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `apikey.list` | protected | **1**, `apiKey.findMany` by user, **no `take`** (`api-key.service.ts:53-65`) — the unbounded list at `db-index-audit.md:235`. No `where` on `revoked`; the service splits active/archived in JS afterwards (`:68-69`). | The API-keys page: `features/api-keys/ui/api-keys-list-container.tsx`. | Whole list skeleton. Because every key is fetched to split two lists, the page costs O(all keys ever issued) on every visit. |
| `apikey.create` / `update` / `revoke` | protected (mutation) | 1 each (`:30`, `:100`, `:75`). | `features/api-keys/model/use-api-key-actions.ts`. | Button pending. |
| `apikey.touch` | protected (mutation) | **1** `apiKey.updateMany` (`:84`). | **Unresolved** — no caller in `apps/web/src` or `packages/cli/src`. | Unknown. |

## agent (`agent/agent.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `agent.listSessions` | protected | **1–2**: optional `repo.findUnique` when `currentRepo` is passed (`agent.service.ts:54-67`), then `chatSession.findMany` with a nested `repo` select (`:69-73`), **no `take`**. | The chat session rail: `features/agent/ui/agent.tsx`. | Session list skeleton. |
| `agent.getSessionHistory` | protected | **1**, `chatMessage.findMany` by session, **no `take`** (`agent.service.ts:42-45`), pulling encrypted `parts` blobs — the unbounded list at `db-index-audit.md:234`. | The chat transcript: `features/agent/ui/agent.tsx`. | Transcript empty. Unbounded in both row count and payload size, which makes this the one procedure where a slow read is plausibly a slow *response*, not just a slow query. |
| `agent.createSession` | protected (mutation) | **1–2**: optional `repo.findFirst` (`:21`) then `chatSession.create` (`:36`). | New-chat button. | **No web caller** — CLI only (`packages/cli/src/commands/agent/agent.service.ts:24`). |

## system (`system/health.router.ts`)

| procedure | guard | queries it issues | what the UI renders | failure mode if slow |
| --- | --- | --- | --- | --- |
| `health.check` | **public** | **1**, `ctx.prisma.$queryRaw\`SELECT 1\`` (`health.router.ts:16`). | **Unresolved** — no caller in `apps/web/src`. The public status widget reads BetterStack over HTTP instead (`app/api/status/route.ts:21`), so `health.check` is not what backs the status indicator. Only consumer is `packages/cli/src/commands/system/system.service.ts:5`. | Unknown, and not user-visible in the web app. |

---

## The failures a user would actually notice

Ranked by how much of the screen goes wrong, not by milliseconds.

1. **`analytics.getDashboardStats`** — one statement behind the entire dashboard. All three
   containers share it, so a slow read replaces the whole page with skeletons at once; there is no
   partial state to degrade into. Already down to 485 ms by P1b.
2. **`notification.getStats`** — the unread badge. It is the only procedure here whose slow
   failure mode is **silence**: no skeleton, no error, just an absent badge and an absent bell
   dot, so the user is told they have no unread notifications when they may have hundreds.
3. **`repo.getSlim`** — the repo switcher in the sidebar. Fires unconditionally on every full page
   load of the private layout, so it taxes every navigation, not just the switcher.
4. **`adminAudit.list`** — the admin audit table *and* its paginator counts are one request, so
   rows, header count and page buttons all stall as a unit. `adminReview.list`,
   `adminUser.list`, `bannedEmail.list`, `notification.getAll` and `repo.getAll` share the shape.
5. **`adminUser.listSessions`** — a slow read leaves the top half of an already-open admin sheet
   drawn and the sessions block blank, because it is a second independent request.
6. **`analysis.getComments`** — same partial-render pattern: the PR panel is populated, the
   comment list is not.
7. **`analysis.getNodeContext`** — not on every mount (it is gated on node selection), so the
   damage is click-to-inspect latency across 3 serial round trips, replicated into three
   components that all render the same inspector.

Not user-visible even when slow: `audit.getActivityLogs` (no count to delay),
`health.check`, `apikey.touch`, `analysis.highlightFile` and the four Redis-only staging
procedures.

## Duplication — `getByPRNumber` and `getImpactByPRNumber` are the same query, and both run

Verified at the source level.

```ts
// analysis/analysis-repo.router.ts:21-30
getByPRNumber: protectedProcedure
  .input(z.object({ prNumber: z.number().int().positive(), repoId: z.string() }))
  .query(async ({ ctx, input }) =>
    prImpactService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber)),

// analysis/analysis-repo.router.ts:36-45
getImpactByPRNumber: protectedProcedure
  .input(z.object({ prNumber: z.number().int().positive(), repoId: z.uuid() }))
  .query(async ({ ctx, input }) =>
    prImpactService.getByRepoAndPRNumber(ctx.db, input.repoId, input.prNumber)),
```

Same service method, same two arguments in the same order, no `.output()` schema on either, no
middleware between the guard and the resolver. Both therefore execute the identical sequence:
`loadImpactAnalysis` (`analysis.repository.ts:274`) then `getRepoBySha`
(`analysis.repository.ts:225`), with the `getRepoSnapshot` fallback at `pr-impact.service.ts:46`.

**The only difference is input validation: `repoId: z.string()` vs `z.uuid()`.** So the accepted
input *domain* differs — `getByPRNumber` will let a non-UUID string through validation and fail
at the Postgres cast instead — but for every input both accept, the statements are identical by
construction.

**Unresolved:** "byte-identical SQL" is not something I could observe. Prisma composes the
statement from the same call arguments, so identical SQL is the strong inference, but I did not
run Prisma's query compiler on both to compare the emitted text.

One naming trap for whoever picks this up: there are **two different methods called
`getByRepoAndPRNumber`**. `prImpactService.getByRepoAndPRNumber` (`pr-impact.service.ts:36`) is
the one both procedures call, and it delegates to `loadImpactAnalysis`. The identically-named
`analysisRepo.getByRepoAndPRNumber` (`analysis.repository.ts:169`) is a *different* query — it
selects `comments: true, generatedFixes: true` with no projections — and its only caller is the
PR webhook handler (`logic/pr-webhook-handler.ts:25`), outside the tRPC surface entirely. Merging
the two procedures does not touch it.

### This is not latent — it is a doubled round trip on every render

```tsx
// features/repo-pulls/ui/repo-pull-details-container.tsx:24-31
const { data: analysis, isLoading: isAnalysisLoading } = trpc.analysis.getByPRNumber.useQuery({
  prNumber,
  repoId,
});
const { data: impact, isLoading: isImpactLoading } = trpc.analysis.getImpactByPRNumber.useQuery({
  prNumber,
  repoId,
});

if (isAnalysisLoading || isImpactLoading) { /* spinner */ }
```

Both are called **unconditionally**, in the same render, with **identical arguments**. Because the
two procedures have different names they produce different query keys, so React Query cannot
dedupe them — two independent HTTP requests, each issuing the same 2–3 statements. And the
component gates on `isAnalysisLoading || isImpactLoading` (`:33`), so the user waits for **both**
before anything renders. `analysis` is consumed as `analysis` and `impact` as `impact` in the
render below, but the two service calls return the same `PRImpactPayload`, so the duplication is
in the resolver, not in the consuming template.

Each of the two requests also carries the unbounded nested `documents` relation via
`getRepoBySha`, so the row count is duplicated too.

**No code was changed.** Recorded as an observation only.

## Unresolved

Listed rather than guessed.

- **Statement counts assume Prisma's `join` relation-load strategy** (the default once
  `relationJoins` is on). Derived from the preview-feature flag plus Prisma's documented default,
  not instrumented against a running client. Under the `query` strategy every
  `getRepoSnapshot`-backed row above gains one statement per nested relation.
- **What renders `analysis.getWithGraphLinks`, `analysis.highlightFile`, `apikey.touch`,
  `adminAudit.detail` and `health.check`** — no in-app caller found. All five remain reachable
  over the tRPC HTTP endpoint, so none is dead code; they are simply unexercised by any UI I
  could find, and I will not assert a failure mode for them.
- **The `documents` row explosion inside `getRepoSnapshot`.** The nested relation has no `take`
  (confirmed), and the select carries metadata but not `content` (confirmed). Whether this
  materially slows a hot repo is a measurement question — the audit recorded 1 335 561 `documents`
  rows on the clone but no per-shape timing for this specific nested read.
- **`getMyGithubRepos` statement count.** `syncInstallations` issues one `updateMany` per
  installation in a paginated loop over the GitHub API (`github-app.service.ts:290-297`), so the
  count is bounded by the user's GitHub orgs rather than by the database. Not measured.
- **Per-request session resolution.** Every procedure resolves a session before the handler runs;
  whether that is a database round trip, a cookie decode, or a cache hit is not visible from the
  router files and is not counted anywhere above.

## See also

- [`db-index-audit.md`](./db-index-audit.md) — per-shape timings, index changes, correctness bugs
- [`db-optimization-progress.md`](./db-optimization-progress.md) — the P/C change board
- [`runbooks/db-telemetry.md`](./runbooks/db-telemetry.md) — reading production telemetry