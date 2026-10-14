---
name: trigger-tasks
description: >
  Deprecated alias for trigger-authoring-tasks. Use trigger-authoring-tasks instead — it holds the
  full guidance for defining task() / schemaTask(), retries, waits, queues and concurrency,
  idempotency, metadata, scheduled tasks, and triggering other tasks in this repo.
---

# trigger-tasks (deprecated)

This skill and **trigger-authoring-tasks** were duplicates. **trigger-authoring-tasks** is the one
to use; this folder is kept only so an older reference to `trigger-tasks` still resolves.

→ **trigger-authoring-tasks** — read `.agents/skills/trigger-authoring-tasks/SKILL.md`, which
points at the version-pinned upstream reference in
`apps/web/node_modules/@trigger.dev/sdk/skills/trigger-authoring-tasks/SKILL.md`.

Quick facts, so this page is not useless on its own:

- Tasks live in `apps/web/src/server/modules/<slice>/tasks/*.task.ts` — there is **no** `trigger/`
  directory in this repo.
- `trigger.config.ts` uses `dirs: ["./src/server/**/tasks"]` and `runtime: "node-22"`.
- SDK is `4.6.4`; the reference path is per-workspace
  (`apps/web/node_modules/@trigger.dev/sdk/...`), not the repo root.