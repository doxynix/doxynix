---
name: trigger-getting-started
description: >
  Bootstrap Trigger.dev into an existing project: authenticate the CLI, install
  @trigger.dev/sdk and @trigger.dev/build, write trigger.config.ts with the project
  ref and task dirs, scaffold a first task, set TRIGGER_SECRET_KEY, and run the dev
  server. Load when a project has no trigger.config.ts yet and the user asks to "add
  Trigger.dev", "set up Trigger.dev", or get a first task running. In this repo
  Trigger.dev already lives in apps/web, so this skill is mainly reference for adding a
  new app or re-deriving the existing setup — see the "Already set up in this repo"
  section first.
---

# Getting started with Trigger.dev

**Read the "Already set up in this repo" section before doing anything.** In Doxynix, Trigger.dev
is configured and running; bootstrapping it again would break working config.

## Already set up in this repo

| Fact | Value |
|---|---|
| Workspace | `apps/web` only |
| SDK / build / react-hooks | `@trigger.dev/sdk`, `@trigger.dev/build`, `@trigger.dev/react-hooks` — all pinned to `4.6.4` |
| Config | `apps/web/trigger.config.ts` |
| `dirs` | `["./src/server/**/tasks"]` |
| Runtime | `runtime: "node-22"` (not `"bun"`) |
| Task files | `apps/web/src/server/modules/<slice>/tasks/*.task.ts` (kebab-case) |
| Project ref | `proj_whmkduzdqfzcgoyuhdyp` |

There is **no `trigger/` directory in this repo and none is needed.** A `/trigger` directory is the
upstream convention; Doxynix puts tasks inside the server module that owns them, because the
modular-monolith layout (`src/server/modules/<slice>/`) is what `dep-cruiser` enforces. Keep every
task under the slice it belongs to.

The full, version-pinned reference ships inside the installed SDK. Bun hoists it per workspace, so
the path is relative to `apps/web`:

- **Skills:** `apps/web/node_modules/@trigger.dev/sdk/skills/<name>/SKILL.md` — there is no
  root `node_modules/@trigger.dev`, so a bare `node_modules/@trigger.dev/...` path does not resolve.
  Available: `trigger-authoring-tasks`, `trigger-authoring-chat-agent`,
  `trigger-chat-agent-advanced`, `trigger-realtime-and-frontend`, `trigger-cost-savings`.
- **Docs:** `apps/web/node_modules/@trigger.dev/sdk/docs/` — e.g.
  `grep -rl "schemaTask" apps/web/node_modules/@trigger.dev/sdk/docs/`.

## Running the CLI

Bun only — the other package managers are rejected by the agent hook, and `bun x` needs a shell
approval, so invoke the CLI as:

```bash
bun x trigger.dev@latest login
bun x trigger.dev@latest dev      # run from apps/web, the dir holding trigger.config.ts
```

There is no root `with-doppler` script, so commands like
`bun with-doppler "bun --filter @doxynix/web …"` fail from the repo root. Use
`bun --filter @doxynix/web <script>` where a script exists.

## Adding Trigger.dev to another workspace

Only if the user actually wants a second Trigger app.

### 1. Authenticate (human step — you cannot do this)

`bun x trigger.dev@latest login` opens a browser. Ask the user to do it, then wait. Same for
creating the environment API key in step 6 — state exactly what you need and resume after.

### 2. Install the packages

`@trigger.dev/sdk` is a runtime dependency; `@trigger.dev/build` is a dev dependency. Pin both to
the same version as the `trigger.dev` CLI you run; a mismatch on a different major breaks
dev/deploy.

```bash
bun add @trigger.dev/sdk@latest
bun add --save-dev @trigger.dev/build@latest
```

### 3. Write `trigger.config.ts`

`project` (the `proj_…` ref from the dashboard) and `dirs` are the only required fields:

```ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "<project ref>",
  dirs: ["./src/server/modules/**/tasks"],
  runtime: "node-22",
  maxDuration: 1_000_000,
});
```

Build extensions (`prismaExtension`, `additionalFiles`, `additionalPackages`) come from
`@trigger.dev/build` and go in `build.extensions`. `apps/web/trigger.config.ts` is the worked
example — it generates the ZenStack/Prisma client in a `onBuildStart` extension, packages the
tree-sitter WASM grammars, and lists the native-ish deps under `build.external`.

### 4. Add a first task

Tasks must be **named exports** inside a configured directory, with a project-unique `id`:

```ts
// src/server/modules/<slice>/tasks/example.task.ts
import { task } from "@trigger.dev/sdk";

export const helloWorld = task({
  id: "hello-world",
  run: async (payload: { name: string }) => ({ message: `Hello ${payload.name}!` }),
});
```

Filename convention here is kebab-case `*.task.ts` — Oxlint's `unicorn/filename-case` and the
slice layout both expect it.

### 5. Wire tsconfig and gitignore

Add `trigger.config.ts` to `include` in `tsconfig.json`, and `.trigger` to `.gitignore` (the CLI
writes local dev state there).

### 6. Create an environment API key (human step)

Ask the user for a named key with **Trigger only** access in the Development environment, then set:

```bash
# .env.local (Next.js)
TRIGGER_SECRET_KEY=tr_dev_sk_xxxxxxxx
```

Self-hosted also needs `TRIGGER_API_URL`.

### 7. Run the dev server

```bash
bun --filter @doxynix/web exec trigger.dev dev   # or `bun x trigger.dev dev` from apps/web
```

Leave it running; tasks register with the dashboard and can be fired from their test page.

## Triggering from your app

Use a **type-only** import so task code is never bundled into the app, and trigger by id rather
than by calling the task object:

```ts
import { tasks } from "@trigger.dev/sdk";
import type { helloWorld } from "@/server/modules/example/tasks/example.task";

const handle = await tasks.trigger<typeof helloWorld>("hello-world", { name: "Ada" });
```

## Common mistakes

1. **Trying to do the human-only steps headlessly.** `trigger login` and creating the API key both
   need a person. Ask, wait, resume.
2. **Mismatched CLI and SDK versions** on a different major breaks dev/deploy. In this repo all
   three are `4.6.4`; keep them aligned.
3. **Importing from `@trigger.dev/sdk/v3` or calling `client.defineJob()`.** Both are old — import
   from `@trigger.dev/sdk` and define work with `task()`.
4. **Tasks not exported, or outside `dirs`.** A task that is not a named export under
   `src/server/**/tasks` is never picked up.
5. **Importing the task instance (not its type) into app code.** That bundles the task; use
   `import type` + `tasks.trigger<typeof …>(id, payload)`.
6. **Forgetting `TRIGGER_SECRET_KEY`.** Triggering from the app fails; the dev server still works.

## References

- `apps/web/trigger.config.ts` — the real, working config
- `.agents/skills/analysis-engine/SKILL.md` — repo rules for the analysis tasks themselves
- **trigger-authoring-tasks** — writing the tasks once setup is done
- **trigger-realtime-and-frontend** — live run status in a frontend
- **trigger-authoring-chat-agent** / **trigger-chat-agent-advanced** — AI chat agents

## Version

Pinned to `@trigger.dev/sdk` 4.6.4 as installed in `apps/web`. Re-read
`apps/web/node_modules/@trigger.dev/sdk/skills/` after upgrading.