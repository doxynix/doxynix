---
description: Load the Turborepo skill for task orchestration in this monorepo. Use when asked to "create a task", "add a turbo task", "configure turbo.json", or set up build orchestration.
---

Load the Turborepo skill and help with task orchestration: configuring tasks, wiring the task
graph, and debugging caching.

## Workflow

### Step 1: Load the turborepo skill

```
skill({ name: 'turborepo' })
```

### Step 2: Identify the task type

Classify the request:

- **Topic**: configuration, caching, filtering, environment, CI, or CLI
- **Task type**: new setup, debugging, optimisation, or implementation

Use the decision trees in `SKILL.md` to pick the reference files.

### Step 3: Read the relevant references

| Task                    | Files to read                                              |
| ----------------------- | ---------------------------------------------------------- |
| Configure `turbo.json`  | `references/configuration/RULE.md` + `references/configuration/tasks.md` |
| Debug cache issues      | `references/caching/gotchas.md`                             |
| Set up remote cache     | `references/caching/remote-cache.md`                        |
| Filter workspaces       | `references/filtering/RULE.md` + `references/filtering/patterns.md` |
| Environment problems    | `references/environment/gotchas.md` + `references/environment/modes.md` |
| Set up CI               | `references/ci/RULE.md` + `references/ci/github-actions.md` (or `vercel.md`) |
| CLI usage               | `references/cli/commands.md`                                |

For anything touching `.github/workflows/`, also read
`.agents/skills/github-actions-templates/`. For workspace layout and dependency pinning, read
`.agents/skills/monorepo-management/`.

### Step 4: Execute

**When creating a task:**

1. **Prefer workspace tasks over Root Tasks.** Root Tasks (`//#taskname`) are only for things that
   genuinely cannot be per-workspace — Vitest Projects' `//#test`, repo-wide release scripts,
   tooling that does not invoke `turbo` itself.
2. Add the script to each relevant workspace's `package.json`
   (`apps/web/package.json`, `apps/siem-server/package.json`, …).
3. Register the task in root `turbo.json` — under **`tasks`**, never `pipeline`.
4. Root `package.json` only delegates (`turbo <task>`), never task logic.

**Verify before finishing:**

- `outputs` declared for every cacheable task
- `dependsOn` uses the right prefix (`^task` for dependencies, `task` for same-workspace)
- every environment variable the task reads is in that task's `env`
- `.env` files in `inputs` if the task reads them
- the existing root scripts still read `turbo build` / `turbo lint` — **do not** rewrite them to
  `turbo run`, that is churn, not a fix

### Step 5: Summarise

```
=== Turborepo Task Complete ===

Topic: <configuration|caching|filtering|environment|ci|cli>
Files referenced: <reference files consulted>

<brief summary of what was done>
```

<user-request>
$ARGUMENTS
</user-request>