---
name: monorepo-management
description: Bun-workspaces + Turborepo monorepo practices for this repo — workspace layout, `catalog:` version pinning, `bun --filter` / `turbo` task running, turbo.json `tasks` configuration, cache hygiene and CI wiring. Use when adding a workspace, touching turbo.json, wiring a build/lint/type-check task, or debugging task-graph and cache behaviour.
---

# Monorepo Management

The repo is a **Bun workspaces + Turborepo** monorepo. `npm`, `yarn` and `pnpm` are forbidden —
the agent hook rejects them with *"Package manager npm is forbidden"*. Every install and script
invocation goes through `bun install` / `bun run` / `bun add` / `bun --filter`.

Nx, Lerna and pnpm workspaces are **not** used here. Do not introduce them.

## When to Use

- Adding or removing a workspace (`apps/*`, `packages/*`)
- Adding a turbo task, or changing `dependsOn` / `outputs` / `inputs`
- Introducing a dependency that must resolve to a single version
- Debugging "task ran when it should have been cached" or "cache miss" issues
- Deciding what belongs in `packages/shared` vs an app

## Actual Layout

```
package.json          # private, workspaces: ["apps/*", "packages/*"]
turbo.json            # turbo 2.11.4 — key is `tasks`, NOT `pipeline`
biome.json            # single root config, no per-package biome.json
.oxlintrc.json        # single root config, type-aware
lefthook.yml          # pre-commit / commit-msg / pre-push gates
bun.lock              # the only lockfile
```

| Workspace | Name | Notes |
| --- | --- | --- |
| `apps/web` | `@doxynix/web` | Next.js App Router, tRPC, ZenStack/Prisma, Trigger.dev |
| `apps/siem-server` | `@doxynix/siem-server` | Hono + Drizzle, ships `dist/` consumed via `exports` |
| `apps/siem-client` | `@doxynix/siem-client` | Vite + React + TanStack Router (FSD) |
| `packages/cli` | `@doxynix/cli` | `dxnx` binary; built `dist` is consumed by apps |
| `packages/config` | `@doxynix/config` | shared tsconfig / dep-cruiser base config |
| `packages/shared` | `@doxynix/shared` | pure types + Zod schemas; only runtime dep is `zod` |

Turbo cannot run `packages/cli` scripts before `packages/config` is built, and
`apps/siem-client` / `packages/cli` type-check against **`apps/siem-server`'s built `dist/`** —
that is why `build`, `type-check` and `test` all declare `dependsOn: ["^build"]`.

## Running Tasks

Root `package.json` scripts already call `turbo <task>` (not `turbo run <task>` — both work, but
keep the existing form so diffs stay small):

```bash
bun run build            # turbo build
bun run lint             # turbo lint
bun run dev              # turbo dev --filter=!@doxynix/cli
bun run test             # turbo test
bun run type-check       # turbo type-check
bun run validate         # turbo validate — the gate to run before claiming done
```

Scope to one workspace with `bun --filter`:

```bash
bun --filter @doxynix/web lint
bun --filter @doxynix/siem-client type-check
bun --filter '@doxynix/*' build
bun --filter @doxynix/siem-server... build    # siem-server and everything it depends on
```

Prefer `bun run <script>` over an ad-hoc `bun x <binary>`: `lint` transitively runs
`db:generate`, which is what gives type-aware Oxlint the generated Prisma client. `bun x oxlint`
skips that and reports phantom errors.

> `with-doppler` only exists **inside** `apps/web` and `apps/siem-server`. There is no such script
> at the repo root, so `bun with-doppler "..."` from the root fails. Use
> `bun --filter @doxynix/web db:generate` — that script already wraps Doppler itself.

## Dependency Management

### One version per dependency, via `catalog:`

Root `package.json` has a `catalog` block. Workspaces reference `"catalog:"` instead of a literal
range, so a transitive version bump is a single edit:

```jsonc
// root package.json
"catalog": {
  "@trpc/client": "11.18.0",
  "react": "19.2.8",
  "zod": "4.5.4"
}
```

```jsonc
// apps/web/package.json
"dependencies": {
  "@trpc/client": "catalog:",
  "react": "catalog:"
}
```

For security pins that must apply even to transitive dependencies, use root `overrides`
(the repo already overrides `hono`, `ws`, `cookie`, `uuid`, `esbuild`, …).

### Install / add / remove

```bash
bun add zod --cwd apps/web                    # or: cd apps/web && bun add zod
bun add -d lefthook                           # root devDependency
bun remove pkg
bun install                                   # resolve everything
bun install --frozen-lockfile                 # what Lefthook pre-commit runs
```

After any `bun install`, run `bun run clean:symlinks`. `postinstall` does it, but
`bun install --ignore-scripts` (what CI uses) does not, and the stale circular
`tree-sitter-wasms` symlink breaks WASM grammar loading.

### Workspace-internal deps

Internal packages use `workspace:*`. The single deliberate cross-app import is
`packages/cli` importing `type { AppRouter } from "@doxynix/web/trpc"` — a devDependency, types
only, exposed through the `"./trpc"` export that maps to `src/server/modules/index.ts`. Do not
extend it to a runtime import; `apps/*` must never import each other.

## turbo.json

Turbo 2.x: the task key is **`tasks`**. `pipeline` is the 1.x name and is ignored.

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "cacheDir": ".turbo/cache",
  "concurrency": "4",
  "globalDependencies": [".gitignore", "biome.json", ".oxlintrc.json", "lefthook.yml", "turbo.json"],
  "globalEnv": ["NODE_ENV", "CI", "SKIP_ENV_VALIDATION"],
  "tasks": {
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["db:generate"] }
  }
}
```

Task-graph conventions this repo relies on:

- **`db:generate` is a hub.** `build`, `lint`, `type-check`, `test`, `arch:baseline`, `validate`
  and `dev` all `dependsOn` it. It has an explicit `inputs`/`outputs` list (ZenStack `.zmodel`,
  Prisma schema, Drizzle `schema.ts`, generated output paths) — extend those lists when you add a
  generator, otherwise the cache goes stale silently.
- **`db:*` tasks are `cache: false`** except `db:generate`. Migrations and pushes are side-effecting.
- **`dev` is `persistent: true` and uncached** — a cached `dev` is an infinite "task never
  finishes" hang.
- **`test` outputs** must list every artifact you want restored: `coverage/**`,
  `test-results/**`, `reports/**`.
- **`globalDependencies`** is for files outside any workspace that still invalidate everything
  (`lefthook.yml`, `biome.json`, `packages/config/depcruise-base.json`, `**/.env.*local`). Adding a
  root config file there invalidates the entire graph — that is the intent, not a bug.

### Env vars

Turbo hashes only the env vars a task declares. A secret read inside a task but missing from that
task's `env` array is a cache-poisoning bug: the cached result replays with a stale secret.
`globalEnv` covers cross-cutting ones (`CI`, `NODE_ENV`, `SKIP_ENV_VALIDATION`).

## Architecture Boundaries

The monorepo is a modular monolith per app plus FSD on the clients. These are enforced by
`dep-cruiser` (`bun run arch:check`), not by convention:

- `apps/*` must not import each other.
- Client FSD (`apps/web/src/{app,entities,features,widgets,shared}`, `apps/siem-client`):
  imports flow **downward only**; no cross-slice imports. Gate: `bun --filter @doxynix/web lint:fsd`
  (steiger).
- Server modules (`apps/web/src/server/modules`, `apps/siem-server/src/modules`,
  `packages/cli/src/commands`): one folder per feature, imports flow **downward only**. `core`,
  `utils` and `ui` sit *below* slices and must never import up into one.
- Shared domain code goes in `packages/shared`, never in an app.

`arch:check` compares against a known-violations baseline — new violations fail, old ones do not.
After a deliberate refactor, refresh it with `bun --filter @doxynix/<app> arch:baseline` and read
the diff before committing.

See `.agents/skills/architecture/SKILL.md` for the full rule set.

## Tooling: Bun only

| Concern | Tool | Where |
| --- | --- | --- |
| Package manager | Bun 1.4.0 | `bun.lock` |
| Task runner / cache | Turborepo 2.11.4 | `turbo.json` |
| Formatter + assists | Biome 2.5.14 | `biome.json` (root only) |
| Linter | Oxlint 1.85.0, type-aware | `.oxlintrc.json` (root only) |
| Architecture gate | dependency-cruiser | `packages/config/depcruise-base.json` |
| Hooks | Lefthook 2.1.14 | `lefthook.yml` |
| Duplication | jscpd 5.3.2 | `bun run dup` |
| Dead code | knip 6.38.0 | `bun run knip` |
| Spelling / secrets | cspell 10.3.4 / secretlint 13.0.6 | `cspell.json` |

ESLint and Prettier are banned. If a workspace needs a lint rule, add it to the root
`.oxlintrc.json`; if it needs formatting config, extend the root `biome.json` via `overrides`.

## Best Practices

1. **One version per dep.** Use `catalog:` for anything with more than one consumer; use root
   `overrides` only for transitive pins.
2. **Never hand-edit a lockfile entry** that `bun install` produces — run the install.
3. **Keep `dependsOn: ["^build"]`** on anything that consumes a workspace's `dist/`.
4. **Declare every secret in `env`/`globalEnv`** for the task that reads it.
5. **Put shared code in `packages/shared`**; if only one app needs it, it belongs in that app.
6. **Run `bun run validate`** before declaring work done.
7. **Refresh `arch:baseline` deliberately**, never as a reflex, and review the diff.

## Common Pitfalls

- **Phantom dependency.** Importing a package that is in the root `node_modules` but not in your
  workspace's `package.json`. It works locally and breaks on a clean install.
- **Cache that misses constantly.** A missing `inputs` entry, or a file that should be in
  `globalDependencies`.
- **Cache that hits when it shouldn't.** A secret or generated file read by the task but absent
  from `env`/`inputs`.
- **Importing a sibling app.** Works in dev because Bun hoists; fails the `arch:check` gate.
- **Running `bun with-doppler` from the repo root.** The script does not exist there.
- **Forgetting `bun run clean:symlinks`** after an `--ignore-scripts` install.
- **Adding a workspace with no `build` script** that dependents import from — they will read a
  stale `dist/`.

## Publishing

The repo is private and publishes **only** `packages/cli` (`@doxynix/cli`) to npm. Versioning is
driven by **release-please**, not changesets — see `.agents/skills/release-please/SKILL.md` and
`release-please-config.json` / `.release-please-manifest.json`. Do not add changesets config or
hand-edit versions.