# PR Draft Flow Refactor Log

Date: 2026-04-27

Issue:
- `PR Draft` tried to open a pull request through `generatedFix.applyFix`.
- The UI sent a hardcoded fake `fixId`, which only made sense for real generated fixes.
- This broke the intended flow for staged manual/documented file changes because draft PR creation was conceptually tied to a `GeneratedFix` record that did not exist.

Fix:
- Added a proper staging-based PR opening flow in `pr-staging.router.ts`.
- New `openPullRequest` mutation now:
  - reads staged files from Redis,
  - resolves repo + GitHub client context,
  - creates a real `GeneratedFix` metadata record with `createdByUser: true`,
  - opens the PR using the staged file contents,
  - updates the record with GitHub PR metadata,
  - clears staging after success.
- Added `unstageFile` mutation so the trash button in the draft sheet is no longer a dead control.
- Updated `pr-draft-sheet.tsx` to use `prStaging.openPullRequest` instead of `generatedFix.applyFix`.

Result:
- Manual/documentation-based staged changes now open PRs through their own consistent draft flow.
- Generated fixes remain a separate flow and still use `generatedFix.applyFix`.
- Database metadata is no longer empty for PRs created from staged workspace changes.

Validation:
- Ran `pnpm typecheck`.
- Result: passed.
