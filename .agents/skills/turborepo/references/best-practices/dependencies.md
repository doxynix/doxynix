# Dependency Management

Best practices for managing dependencies in the Doxynix monorepo. Bun only — `npm`, `pnpm` and
`yarn` are forbidden here.

## Core Principle: Install Where Used

Dependencies belong in the workspace that uses them, not in the root.

```bash
# Good: install into the consuming workspace
bun add zod --cwd apps/web

# Avoid: hoisting an application dependency to the root
bun add zod            # at the repo root — only for repo-level tooling
```

Bun's hoisted root `node_modules` makes phantom dependencies *work* locally and fail on a clean
install or in CI. Installing where used is what keeps the manifest honest.

## Benefits of Local Installation

### 1. Clarity

Each workspace's `package.json` lists exactly what it needs:

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "react": "catalog:",
    "zod": "catalog:"
  }
}
```

### 2. Flexibility

Different workspaces may use different versions when there is a real reason (see "Version
Conflicts" below).

### 3. Better Caching

Changing a dependency rewrites `bun.lock`, which invalidates the whole graph. Editing one
workspace's `package.json` invalidates that workspace and its dependents only. **Keep the blast
radius small.**

### 4. Pruning Support

`turbo prune` can remove unused dependencies for container builds.

## What Belongs in Root

Only repository-level tooling:

```jsonc
// Root package.json
{
  "devDependencies": {
    "@biomejs/biome": "2.5.14",
    "cspell": "10.3.4",
    "jscpd": "5.3.2",
    "knip": "6.38.0",
    "lefthook": "2.1.14",
    "oxlint": "1.85.0",
    "secretlint": "13.0.6",
    "turbo": "2.11.4",
    "typescript": "7.0.2"
  },
  "overrides": { "hono": "4.13.9", "ws": "8.22.0" },
  "trustedDependencies": ["prisma", "zenstack", "esbuild", "sharp"]
}
```

**NOT** application dependencies: `react`, `next`, `zod`, `es-toolkit`, testing libraries.

Three root-only blocks, and they are not interchangeable:

| Block | Purpose |
| --- | --- |
| `devDependencies` | tools that run at the repo root |
| `overrides` | pins for **transitive** dependencies (security) — force one version repo-wide |
| `trustedDependencies` | packages Bun may run install scripts for |

## Installing Dependencies

### One workspace

```bash
bun add zod --cwd apps/web
bun add -d lefthook --cwd packages/cli
```

or from inside the directory:

```bash
cd apps/web && bun add zod
```

### Root only

```bash
bun add -d turbo
```

### Remove

```bash
bun remove pkg --cwd apps/web
```

### After any install

```bash
bun run clean:symlinks
```

`postinstall` does this, but `bun install --ignore-scripts` (what CI runs) does not, and the stale
circular `tree-sitter-wasms` symlink breaks WASM grammar loading.

## Internal Packages

Use `workspace:*`:

```jsonc
{
  "dependencies": {
    "@doxynix/shared": "workspace:*"
  }
}
```

Bun resolves it to the workspace directory. Turborepo reads the workspace graph from this and
orders builds accordingly. **Never** point an internal dep at a `file:` path, a tarball or a git
URL — the graph silently stops reflecting reality and `dependsOn: ["^build"]` stops ordering.

### The one cross-app import

```jsonc
// packages/cli/package.json — devDependency, types only
{
  "devDependencies": { "@doxynix/web": "workspace:*" }
}
```

```ts
import type { AppRouter } from "@doxynix/web/trpc";
```

`apps/web` exposes it through the `"./trpc"` export mapping to
`src/server/modules/index.ts`. This is the only permitted cross-app import and it is types-only.
A runtime import fails `bun run arch:check`.

## Keeping Versions in Sync

### The catalog (what this repo uses)

Root `package.json` holds a `catalog` block; workspaces reference `"catalog:"`.

```jsonc
// package.json
{
  "catalog": {
    "@tanstack/react-query": "5.102.2",
    "@trpc/client": "11.18.0",
    "@trpc/server": "11.18.0",
    "react": "19.2.8",
    "zod": "4.5.4"
  }
}
```

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "@tanstack/react-query": "catalog:",
    "@trpc/client": "catalog:",
    "react": "catalog:",
    "zod": "catalog:"
  }
}
```

Bumping a shared dep is a **single edit to the catalog** plus `bun install`. That is the whole
point — do not hand-edit the version in six `package.json` files.

**Not every dep goes in the catalog.** Put a package there when more than one workspace consumes
it. A dep used by exactly one workspace gets a literal version in that workspace.

### Updating

```bash
# Change the catalog entry, then:
bun install

# See what drifted:
bun outdated
```

Renovate handles the bump itself (`renovate.yml`, `.github/workflows/renovate.yml`) — it
understands both `catalog:` and `overrides`. Do not fight it by pinning a literal version in a
workspace.

### Auditing mismatches

`bun run knip` finds unused dependencies; `bun run lint` (type-aware Oxlint) catches a lot of
phantom-import cases. There is no syncpack/manypkg equivalent in this repo — the catalog is the
mechanism.

## Internal vs External Dependencies

```jsonc
// Internal
{ "@doxynix/shared": "workspace:*" }

// External — literal version, or "catalog:" when shared
{ "zod": "4.5.4" }
```

## Peer Dependencies

For `packages/*` that expect the consumer to supply a framework:

```jsonc
{
  "peerDependencies": {
    "react": "catalog:"
  },
  "devDependencies": {
    "react": "catalog:"   // for local dev/test
  }
}
```

## Common Issues

### "Module not found" that works locally

1. Is the dep declared in the importing workspace's `package.json`, or only hoisted at the root?
2. Did you run `bun install` after editing the manifest?
3. Does the target package define the subpath in its `exports` map?
4. Are you importing through a `"./trpc"`-style export that only declares `types`?

### Version conflicts

Different workspaces *can* use different versions, and that is sometimes correct (e.g. a legacy
consumer). But accidental divergence is a bug:

1. Move the dependency into the `catalog` — that forces one resolution.
2. Or, if it is genuinely transitive, add a root `overrides` entry.
3. `bun why <pkg>` shows who pulled it in and from where.

### "Installed but the binary is missing"

A native dependency (Prisma engines, sharp, esbuild) whose postinstall did not run. Two causes:

- it is missing from root `trustedDependencies`, or
- the install ran with `--ignore-scripts` and something needed the script anyway.

Add it to `trustedDependencies`; do not work around it by hand-copying binaries.

### Stale `dist/` type errors

`packages/cli` type-checks against `apps/siem-server`'s **built** `dist/` (types only).
A stale `dist/` produces phantom errors. Run through Turbo (`bun run type-check`) or build
siem-server first.

## Lockfile

**Required** for reproducible builds, Turborepo dependency analysis, and cache correctness.

The only lockfile is **`bun.lock`** (text format — the binary `bun.lockb` is not supported by
Turborepo; use `bun install --save-text-lockfile`). Lefthook pre-commit runs
`bun install --frozen-lockfile`, so an out-of-date lockfile fails the commit.

```bash
git add bun.lock
```

Never hand-edit it — run `bun install`.