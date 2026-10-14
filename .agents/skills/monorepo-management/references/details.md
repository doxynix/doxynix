# monorepo-management — detailed patterns and worked examples

Worked examples for the Bun + Turborepo setup described in `SKILL.md`. Everything here is
repo-shaped; Nx, Lerna, pnpm workspaces and non-JS package publishing are out of scope.

## Bun Workspaces

### Layout

The root `package.json` declares `"private": true` and
`"workspaces": ["apps/*", "packages/*"]`. Bun creates the root `node_modules` with hoisted deps
and symlinks each workspace under `node_modules/@doxynix/*`. There is no `pnpm-workspace.yaml` and
no `.npmrc`.

### Version pinning with `catalog:`

Anything consumed by more than one workspace goes in the root `catalog` and is referenced as
`"catalog:"`. This is the repo's answer to "one version per dependency" — Renovate understands it,
and it removes the `--filter` dance when bumping.

```jsonc
// package.json (root)
{
  "devDependencies": { "@biomejs/biome": "2.5.14", "turbo": "2.11.4" },
  "catalog": {
    "@trpc/client": "11.18.0",
    "@trpc/server": "11.18.0",
    "@tanstack/react-query": "5.102.2",
    "react": "19.2.8",
    "zod": "4.5.4"
  },
  "overrides": { "hono": "4.13.9", "ws": "8.22.0" },
  "trustedDependencies": ["prisma", "@prisma/client", "zenstack", "esbuild", "sharp"]
}
```

Three tiers, and they are not interchangeable:

| Tier | Use for | Example |
| --- | --- | --- |
| `catalog` | direct deps in ≥1 workspace | `react`, `zod`, `@trpc/client` |
| `overrides` | transitive-only pins (security) | `cookie`, `undici`, `mermaid` |
| `trustedDependencies` | packages allowed to run postinstall | `prisma`, `zenstack`, `@parcel/watcher` |

`trustedDependencies` is not a version pin — it is the allowlist of packages Bun will run install
scripts for. Dropping a native dep out of it produces a silent "binary missing" failure at runtime.

### Dependency commands

```bash
bun add zod --cwd apps/web
bun add -d lefthook
bun remove pkg
bun install                 # full resolve
bun install --frozen-lockfile  # CI / pre-commit
bun outdated                 # what drifted
```

Keep internal deps on `workspace:*`. Never point at a `file:` or a git URL — the arch gate expects
workspace resolution.

### Running scripts

```bash
bun --filter @doxynix/web lint
bun --filter @doxynix/siem-server build
bun --filter '@doxynix/*' test          # glob over workspace names
bun --filter @doxynix/siem-server... build   # the package and its dependencies
bun run lint                             # root -> turbo lint -> every workspace
```

`bun --filter` (space-separated form) and `bun --filter=<pkg>` are both valid; the repo's docs use
the space form.

### Version pinning for published binaries

`packages/cli` is the only workspace published to npm, and it is versioned by release-please.
Its `package.json` version is **not** hand-edited — release-please's `node-workspace` plugin bumps
it and updates `.release-please-manifest.json`.

## Shared Configurations

There is exactly one `tsconfig.json`, one `biome.json` and one `.oxlintrc.json`, all at the repo
root. `packages/config` holds the shared base configs that apps *reference* (not extend-and-fork):
`packages/config/depcruise-base.json` is listed in `turbo.json`'s `globalDependencies`.

```
packages/config/
  depcruise-base.json   # dependency-cruiser base rules, extended by each app
```

Each app keeps its own `.dependency-cruiser.ts` and its own known-violations baseline, because
FSD and modular-monolith rules differ per app.

ESLint and Prettier are banned repo-wide. Do not add a `packages/config/eslint-preset.js`; add an
override to `.oxlintrc.json` instead.

## Code Sharing Patterns

### Where does shared code go?

1. One consumer → keep it in that app.
2. Two or more **apps** → `packages/shared`.
3. Two or more **slices of the same app** → that app's `src/shared` (client) or a shared module
   folder (server).
4. Public npm material → a dedicated `packages/*` with a `build` script.

`packages/shared` is intentionally narrow: pure types, Zod schemas, auth contracts. Its only
runtime dependency is `zod`. If you find yourself adding `react` there, the code belongs in an app.

### Types across the client/server boundary

The tRPC `AppRouter` type is the client/CLI contract. `apps/web` exposes it through the `"./trpc"`
package export:

```jsonc
// apps/web/package.json
"exports": { "./trpc": { "types": "./src/server/modules/index.ts" } }
```

`packages/cli` imports it as a **devDependency, types only**:

```ts
import type { AppRouter } from "@doxynix/web/trpc";
```

This is the one permitted cross-app import. A runtime import breaks `arch:check`.

### Built-artifact contracts

`apps/siem-server` ships `dist/` and consumers read it through the package `exports` map.
Consequences:

- `apps/siem-client` and `packages/cli` **type-check against the built output**, not `src/`.
- That is why `build`, `type-check` and `test` all declare `dependsOn: ["^build"]` in `turbo.json`.
- Running `bun --filter @doxynix/siem-client type-check` against a stale `dist/` produces phantom
  type errors. Run through Turbo (`bun run type-check`) or build siem-server first.

## Build Optimization

### Caching

Turbo hashes the task's `inputs` (default: every file in the package), its dependency tasks' hashes,
and the `env` vars it declares. Anything else is invisible to the cache.

```jsonc
// turbo.json — the shapes this repo actually uses
{
  "tasks": {
    "build": {
      "dependsOn": ["^build", "db:generate"],
      "env": ["APP_VERSION", "PORT", "NEXT_PUBLIC_*", "VITE_*"],
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**", "dist/**", "build/**", ".output/**"]
    },
    "db:generate": {
      "cache": true,
      "env": ["DATABASE_URL", "DIRECT_URL", "PRISMA_FIELD_ENCRYPTION_KEY"],
      "inputs": ["prisma/**/*.zmodel", "src/core/db/schema.ts"],
      "outputs": ["node_modules/.prisma/**", "prisma/generated/**", "src/core/db/migrations/**"]
    },
    "test": {
      "dependsOn": ["^build", "db:generate"],
      "env": ["DATABASE_URL", "DIRECT_URL", "PRISMA_FIELD_ENCRYPTION_KEY"],
      "outputs": ["coverage/**", "test-results/**", "reports/**"]
    }
  }
}
```

Three failure modes to watch:

- **Misses with no cause.** Usually a missing `inputs` entry for a file outside the package, or a
  root config that belongs in `globalDependencies`.
- **Hits that shouldn't happen.** A secret read inside the task but missing from `env`. Turbo hashes
  only what you declare, so the stale secret is replayed from cache.
- **`outputs` missing an artifact.** The task succeeds, the artifact is not restored, and the next
  step fails confusingly.

### Remote caching

```bash
bun x turbo login
bun x turbo link
```

The remote token is supplied in CI via `TURBO_TOKEN` / `TURBO_TEAM`, which are declared in
`turbo.json`'s `globalEnv`. `cacheMaxAge: "14d"` and `cacheMaxSize: "5GB"` bound the local
`.turbo/cache` directory.

There is no `remoteCache` block in `turbo.json` — the `signature` / `enabled` keys are a 1.x-era
configuration and are ignored by Turbo 2.x.

## CI/CD

CI never installs with `npm`/`pnpm`/`yarn` and never uses `actions/setup-node`. The canonical job
skeleton, matching `.github/workflows/web-ci.yml`:

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@<sha-pinned>

      - name: Setup Bun
        uses: oven-sh/setup-bun@<sha-pinned>
        with:
          bun-version-file: "package.json"

      - name: Install dependencies
        run: bun install --ignore-scripts

      - name: Clean tree-sitter symlinks
        run: bun run clean:symlinks

      - name: Linting
        run: bun --filter @doxynix/web lint
```

Rules that follow from the existing workflows:

- `bun-version-file: "package.json"` reads `packageManager: "bun@1.4.0"`. Do not hardcode a version.
- `--ignore-scripts` is mandatory (faster, and untrusted postinstall code does not run); the
  `clean:symlinks` step replaces what `postinstall` would have done.
- Every action is **SHA-pinned** with the human version in a trailing comment. A floating tag is a
  supply-chain hole.
- Jobs declare `permissions:` explicitly at workflow level; `contents: read` is the default.
- `concurrency` groups cancel superseded PR runs.

### Running only what changed

```yaml
- uses: dorny/paths-filter@<sha>
  id: filter
  with:
    base: ${{ github.base_ref || 'main' }}
    filters: |
      backend:
        - 'apps/web/**'
        - 'package.json'
        - 'bun.lock'
        - 'turbo.json'

- run: bun run lint
  if: steps.filter.outputs.backend == 'true'
```

`web-ci.yml` triggers on `paths:` directly (`apps/web/**`, `packages/**`, `package.json`,
`bun.lock`, `turbo.json`) so unrelated PRs do not wake the Next.js build at all. That is cheaper
than a per-job filter and is the pattern to copy for a new workspace.

## Releasing

Release-please, not changesets:

```jsonc
// release-please-config.json — shape, not the full file
{
  "packages": {
    ".": { "package-name": "doxynix", "release-type": "node" },
    "packages/cli": { "package-name": "@doxynix/cli", "release-type": "node" }
  },
  "plugins": [{ "type": "node-workspace" }]
}
```

`.release-please-manifest.json` tracks the current version per workspace. Both files are
maintained by the bot — read them, never write them. Full detail in
`.agents/skills/release-please/SKILL.md`.