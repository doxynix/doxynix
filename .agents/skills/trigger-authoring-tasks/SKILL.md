---
name: trigger-authoring-tasks
description: >
  Covers writing backend Trigger.dev tasks with @trigger.dev/sdk: defining task() and
  schemaTask(), the run function and its ctx, retries, waits, queues and concurrency,
  idempotency keys, run metadata, logging, triggering other tasks (and the Result shape),
  scheduled/cron tasks, and the essentials of trigger.config.ts. Load this whenever you are
  defining or editing a task under apps/web/src/server/modules/<slice>/tasks/, or writing
  backend code that triggers tasks. Realtime/React hooks are trigger-realtime-and-frontend;
  AI chat is trigger-authoring-chat-agent.
---

# Authoring Trigger.dev Tasks

The full, version-pinned reference ships **inside the installed `@trigger.dev/sdk`**. Read it before
writing code — it always matches the SDK version in this project, so it never drifts.

## Where the reference actually lives

Bun installs per workspace, so there is **no root `node_modules/@trigger.dev`**. The path is
relative to `apps/web`:

- **Skill:** `apps/web/node_modules/@trigger.dev/sdk/skills/trigger-authoring-tasks/SKILL.md` — the
  complete guide (setup, `schemaTask`, retries, triggering + the Result shape, idempotency, waits,
  metadata, scheduled tasks, queues/concurrency, `trigger.config.ts`).
- **Docs:** `apps/web/node_modules/@trigger.dev/sdk/docs/` — the skill's frontmatter lists the exact
  pages it draws from. Grep for an API, e.g.
  `grep -rl "schemaTask" apps/web/node_modules/@trigger.dev/sdk/docs/`.

Sibling skills in the same directory: `trigger-authoring-chat-agent`,
`trigger-chat-agent-advanced`, `trigger-realtime-and-frontend`, `trigger-cost-savings`.

## Repo facts that change the defaults

| Fact | Value |
|---|---|
| SDK version | `4.6.4` (`@trigger.dev/sdk`, `@trigger.dev/build`, `@trigger.dev/react-hooks`) |
| Where tasks live | `apps/web/src/server/modules/<slice>/tasks/*.task.ts` |
| `dirs` in `trigger.config.ts` | `["./src/server/**/tasks"]` |
| Runtime | `runtime: "node-22"` — **not** `bun` |
| Naming | kebab-case filenames, `*.task.ts`; task `id` must be project-unique |

**There is no `trigger/` directory in this repo.** Tasks belong to the server module that owns them,
because `src/server/modules/<slice>/` is the modular-monolith boundary that `dep-cruiser`
(`arch:check`) enforces — a top-level `trigger/` folder would sit outside the module graph. Put
`analysis.mapper.task.ts` in `src/server/modules/analysis/tasks/`, not in a global task folder.

`apps/web/trigger.config.ts` also carries build extensions that matter when you add a task using a
new native/WASM dependency: a `zenstack-generate` `onBuildStart` extension, `additionalFiles` +
`additionalPackages` for the tree-sitter WASM grammars, `prismaExtension({ mode: "legacy" })`, and
a `build.external` list (`ioredis`, `bottleneck`, `web-tree-sitter`, `jscpd`, `colors`, …). A
dependency that fails to bundle in the cloud build usually belongs in that list or in an extension.

## Triggering a task from app code

Use a **type-only** import so the task body never gets bundled into a route handler, and trigger by
id rather than by calling the task object:

```ts
import { tasks } from "@trigger.dev/sdk";
import type { myTask } from "@/server/modules/<slice>/tasks/<name>.task";

const handle = await tasks.trigger<typeof myTask>("my-task-id", payload);
```

`TRIGGER_SECRET_KEY` must be set wherever this runs.

## Commands

Bun only — the other package managers are rejected by the agent hook, and `bun x` needs a shell
approval, so invoke the CLI as:

```bash
bun x trigger.dev@latest dev      # run from apps/web, the dir holding trigger.config.ts
```

There is no root `with-doppler` script, so `bun with-doppler "bun --filter @doxynix/web …"` fails
from the repo root — use `bun --filter @doxynix/web <script>`.

## Other rules

- `.agents/skills/analysis-engine/SKILL.md` carries the repo-specific rules for the analysis pipeline
  tasks (Sentinel / Mapper / Architect stages, AST scanning, GitHub PR review comments). Read it
  before touching those tasks — it is stricter than the upstream SDK skill.

## Version

Pinned to `@trigger.dev/sdk` 4.6.4 as installed in `apps/web`.