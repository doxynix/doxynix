# File Actions Debug Log

Date: 2026-04-26

Issue investigated:
- `quick-file-audit` result was visible in `repo-code-browser`.
- `document-file-preview` appeared to "not return a result".

Findings:
- Backend write path is symmetric:
  - `analyze-file.task.ts` writes to `REDIS_CONFIG.keys.fileAction(userId, path)` and then publishes `fileActionCompleted`.
  - `document-file.task.ts` writes to the same Redis key pattern and then publishes the same realtime event shape.
- A second backend bug was confirmed after manual runtime observation:
  - audit and document preview were stored under the exact same Redis key for the same file path;
  - whichever task finished last overwrote the previous file-action result.
- The stronger bug was in the client:
  - audit preview renders directly when `aiResult.action === "quick-file-audit"`;
  - document preview required `showDiff === true`;
  - `showDiff` was never turned on when the document task completed.
- `isAiLoading` also stayed `true` after successful file-action completion because it was only reset on error or path change.

Fix applied:
- Added local `pendingFileAction` tracking in `repo-code-browser.tsx`.
- When the invalidated `getFileActionResult` query returns the matching completed action:
  - reset `isAiLoading`;
  - auto-open diff for `document-file-preview`;
  - reopen audit panel for `quick-file-audit`;
  - clear pending action state to prevent re-trigger loops.
- Split file-action cache keys by action type:
  - `file-result:${userId}:quick-file-audit:${path}`
  - `file-result:${userId}:document-file-preview:${path}`
- Updated file-action reads and realtime invalidation to fetch/invalidate results per action instead of using one shared result bucket.

Operational note:
- `pnpm typecheck` could not be completed in the sandbox because `tsc` file access raised `EPERM`; out-of-sandbox rerun was not approved in this session.
