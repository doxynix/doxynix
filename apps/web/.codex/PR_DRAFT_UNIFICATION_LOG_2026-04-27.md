# PR Draft Unification Log

Date: 2026-04-27

Goal:
- Make `PR Draft` a shared staging basket not only for documented/manual changes, but also for completed AI-generated fixes.

What changed:
- Added `prStaging.stageGeneratedFix`.
- The mutation reads the cached fix result from Redis, validates `fixedFiles`, and stages them into the same Redis basket used by `stageFile`.
- Added an `Add to PR Draft` action for completed fixes in the PR detail surface (`Linked Fixes`).

Behavior:
- `document-file-preview -> accept` still stages a single file directly.
- `generated fix -> completed` can now be pushed into the same staging basket.
- `PR Draft` remains the single place where mixed staged changes are reviewed and opened as one PR.

Result:
- `GeneratedFix` no longer has to be opened immediately through its own isolated apply path.
- Manual edits, documented files, and AI fixes can converge into one coherent draft PR flow.

Validation:
- Ran `pnpm typecheck`.
- Result: passed.
