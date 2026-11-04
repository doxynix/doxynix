# Backend error i18n — implementation report

**Date:** 2026-11-04
**Status:** DONE_WITH_CONCERNS
**Branch:** `feat/dxnx-303-backend-error-i18n` (renamed by the controller; not renamed or switched by me)

## Commits (oldest first)

| SHA | Subject |
| --- | --- |
| `ecc5927c` | feat(shared): add message codes for user-facing errors |
| `e6c7c8fa` | refactor(web): carry message codes on AppError |
| `8eef1df0` | refactor(web): serialize message codes through tRPC |
| `ad1aae98` | refactor(web): serialize message codes over HTTP |
| `7274b821` | feat(web): add error message hook |
| `cca12cc3` | refactor(web): attach message codes to core errors |
| `55a6570c` | refactor(web): attach message codes to module errors |
| `c7c0b6a2` | refactor(web): attach message codes to route handlers |
| `58f039c2` | refactor(web): localize client error toasts |
| `b711d08d` | feat(web): localize backend errors across locales |

The first two commits predate the branch rename and therefore have no `Closes DXNX-303` footer (the
controller said it would handle them). The last commit was amended locally to drop an accidentally
staged scratch file; its message and footer were preserved.

## Verification

Every command below was run in this environment. Doppler-wrapped forms were replaced with the
direct commands permitted here (`CI=true` or the local `vitest` binary).

| Command | Exit | Result |
| --- | --- | --- |
| `TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts src/errors/index.test.ts` (packages/shared) | 0 | 1 file, 4 tests |
| full shared suite (`packages/shared`, same vitest command) | 0 | 2 files, 7 tests |
| `TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts src/server/core src/server/utils` | 0 | 49 files, 466 tests |
| `TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts src/server/modules` | 0 | 141 files, 1465 tests |
| `TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts src/app/api` | 0 | 4 files, 35 tests |
| `TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts src/features src/entities src/widgets` | 0 | 26 files, 228 tests |
| full `apps/web` unit suite (`TZ=UTC ./node_modules/.bin/vitest run --config vitest.config.ts`) | 0 | 266 files, 2601 tests |
| `CI=true bun run type-check` (apps/web) | 0 | “No type errors in 1,209 files” |
| `bun run lint:locales` | 0 | 12 locale files, 23,112 leaf values |
| `bun run lint:i18n` | 0 | 7 orphan-message warnings (see concerns) |
| `bun run lint:message-codes` | 0 | 239 files OK |
| guard negative test (deleted one `messageCode` from `fixes.service.ts`, then restored) | 1 then 0 | failed with `fixes.service.ts:264 — public PRECONDITION_FAILED without messageCode`, restored → 239 files OK |
| `CI=true bun run validate` (apps/web, final run) | 0 | format, lint, steiger, eloqnt, locales, message codes, i18n usage, arch, index parity, type-check |

`bun run validate` without `CI=true` is blocked by the session permission policy (it is detected as
Doppler-wrapped), so the secrets-free `CI=true` form above is the authoritative run. It completed all
stages and exited 0.

## Deviations from the plan

1. **`TRPCError` cannot carry `messageCode`.** For every user-facing throw the plan told me to “add
   `messageCode`” to a `TRPCError`, I converted the throw to `AppError` (which already carries the
   code/params through `normalizeError`). Catch blocks that re-threw `instanceof TRPCError` in the
   touched files now check `instanceof AppError`.
2. **Task 6 `utils/pagination.ts:43,54`.** Those are Zod `.refine` / `addIssue` messages, not
   throws. Zod messages are explicitly out of scope, so they were left untouched.
3. **Task 7 `users/admin-user.schemas.ts:41`.** A Zod refine message (“Banning a user requires a
   confirmation code”), not a throw. Left untouched.
4. **Task 7 `tasks/handle-task-error.ts:29` and `analysis-lifecycle.service.ts:232`.** Both are
   stored `analysis.message` labels written to the DB, not `AppError` throws. A `messageCode` cannot
   be attached there, so they were left alone.
5. **The param message location.** The plan attributes `GitHub App is not installed for ${repo.owner}`
   to `pr-comments.service.ts`; it actually lives in `fixes.service.ts:258`. The code + `params`
   were added there (`GITHUB_APP_NOT_INSTALLED_OWNER`, `{ owner: repo.owner }`).
6. **Extra public throws not in the tables.** To keep the module-wide verification honest I also
   coded: the dynamic browse-access branch in `github-content.ts`, `PR_ANALYSIS_NOT_FOUND` in
   `pr-comments.service.ts`, the two `RATE_LIMITED` throws in `workspace.router.ts` and
   `analysis-core.router.ts` (`MEMBER_RATE_LIMITED`), and `CONCURRENT_WORKSPACE_UPDATE`
   (`REQUEST_INVALID`).
7. **Guard exclusions.** `scripts/check-message-codes.ts` ignores `audit-logs`, `notifications`,
   `analysis/engine`, `app/api/webhooks`, plus `billing/**` and `users/owned-subscription.ts`.
   The first four are the hard scope boundaries; billing/owned-subscription already expose stable
   client codes (mapped in `features/manage-subscription/model/billing-errors.ts`) instead of English
   copy, so localizing them is a separate change. The reason is a two-line comment in the script.
8. **Locale count.** There are 12 locale files in `apps/web/messages`, not 13. All 12 received the
   `Errors` namespace. The namespace was added in the Task 5 commit (not Task 10) because
   `check-locales.ts` requires key parity across locales and would have failed otherwise; Task 10
   then only verified it.
9. **Task 10 Step 1’s “authoritative” block** omits `member_add_failed`, `member_already_exists`,
   `member_last_owner` and `member_rate_limited`, although Task 5 Step 0 and `ERROR_MESSAGE_KEYS`
   require them. I kept all 82 codes plus `generic`; dropping them would fail both type-check and the
   guard.
10. **Task 9’s file list missed 14 `toast.error(err.message)` sites** in `features/settings/**` and
    `widgets/welcome-flow/**`. They were converted too, otherwise the plan’s own Step 5
    (`rg 'toast\.error\((error|ctx\.error|err)\.message\)' apps/web/src`) would still produce output.
11. **`app/api/[...all]/route.ts`** now returns `toErrorResponse(new AppError({ code: "NOT_FOUND",
    messageCode: NOT_FOUND }))` instead of the bare `{ error: "Not found" }`, so the 404 carries the
    standard envelope.
12. **Existing tests updated for the wider envelope.** Exact-body assertions in
    `with-api-handler.test.ts`, `proxy/route.test.ts`, `realtime/auth/route.test.ts` now include
    `messageCode`/`params`; three tRPC caller tests assert the `AppError` on `cause` because a direct
    caller does not run `errorFormatter`.

## Concerns for review

- `Auth.sign_out_failed` is now unused (both consumers were switched to `useErrorMessage`). `eloqnt`
  reports it as a new orphan-message warning. The key is still present in all 12 locales; removing it
  is a one-line cleanup per file.
- `MEMBER_RATE_LIMITED` is used for the analysis-start rate limit too, and `REQUEST_INVALID` for the
  workspace write-conflict retry. Both are the closest existing copy, but the code names are now
  slightly wider than their original meaning.
- The plan’s Octokit 429 → `API_KEY_SCOPE_MISSING` mapping is semantically odd (“GitHub API limit
  exceeded” localized as “This API key lacks the required scope”). It was implemented as specified;
  a dedicated `GITHUB_RATE_LIMITED` code would be better.
- The guard’s throw regex only matches multi-line `new AppError/TRPCError({ ... })` blocks. A
  single-line public throw is invisible to it. This matches the plan’s script but is worth tightening
  later.
- Billing still renders its own client-side codes; it was intentionally left out of this change.

## Environment notes

- `bun run validate`, `bun run type-check` and `bun --filter … test` are blocked by the permission
  policy unless prefixed with `CI=true`; `CI=true bun run validate` is the green run above.
- The untracked plan file `docs/2026-11-04-backend-error-i18n.md` was deliberately left uncommitted.
