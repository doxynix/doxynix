# Repository Structure

Detailed guidance on structuring a Turborepo monorepo.

## Workspace Configuration

This repo is a **Bun** workspace. There is no `pnpm-workspace.yaml`; the root `package.json`
declares the workspace globs directly:

```json
// package.json
{
  "name": "doxynix",
  "private": true,
  "packageManager": "bun@1.4.0",
  "workspaces": ["apps/*", "packages/*"]
}
```

`packageManager` is what `oven-sh/setup-bun` reads in CI (`bun-version-file: "package.json"`), so
bumping Bun is a one-line edit that every workflow picks up.

The only lockfile is `bun.lock`. Turborepo 2 understands it; the binary `bun.lockb` is **not**
supported — use `bun install --save-text-lockfile`.

## Root package.json

```json
{
  "name": "doxynix",
  "private": true,
  "packageManager": "bun@1.4.0",
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev --filter=!@doxynix/cli",
    "lint": "turbo lint",
    "test": "turbo test",
    "type-check": "turbo type-check",
    "validate": "turbo validate"
  },
  "devDependencies": {
    "turbo": "2.11.4"
  }
}
```

Key points:

- `private: true` - prevents accidental publishing of the root
- `packageManager` - pins the Bun version and is read by CI
- **Scripts only delegate to turbo** - no actual build logic at the root
- `dev` excludes `@doxynix/cli`: the CLI has no dev server and would otherwise occupy a slot
- Minimal devDependencies (turbo and repo tooling only)

## Always Prefer Package Tasks

**Always use package tasks. Only use Root Tasks if you cannot succeed with package tasks.**

```jsonc
// apps/web/package.json
{
  "scripts": {
    "build": "next build",
    "lint": "oxlint",
    "format": "biome check --write .",
    "test": "vitest",
    "type-check": "bun check"
  }
}

// apps/siem-server/package.json
{
  "scripts": {
    "build": "tsc",
    "lint": "oxlint",
    "format": "biome check --write .",
    "type-check": "bun check -b"
  }
}
```

Package tasks enable Turborepo to:

1. **Parallelize** - Run `web#lint` and `api#lint` simultaneously
2. **Cache individually** - each workspace's task output is cached separately
3. **Filter precisely** - run `bun --filter @doxynix/web test` (or `turbo test --filter=@doxynix/web`)

**Root Tasks are a fallback** for tasks that truly cannot run per-package:

```jsonc
// AVOID unless necessary - sequential, not parallelized, can't filter
{
  "scripts": {
    "lint": "cd apps/web && oxlint && cd ../../apps/siem-server && oxlint"
  }
}
```

## Root turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

With `futureFlags.globalConfiguration`, global settings move under a `global` key:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "futureFlags": { "globalConfiguration": true },
  "global": {
    "inputs": ["tsconfig.json"],
    "env": ["CI"]
  },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "!.next/dev/**"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

## Directory Organization

### Grouping Packages

You can group workspaces by adding more globs to the root `workspaces` array:

```json
// package.json
{
  "workspaces": ["apps/*", "packages/*", "packages/features/*"]
}
```

This allows:

```
packages/
├── shared/
├── config/
│   ├── depcruise-base.json
│   └── tsconfig base configs
└── features/
    ├── auth/
    └── payments/
```

**Keep the globs shallow.** A nested wildcard like `packages/**` makes membership ambiguous and
breaks Turbo's package detection.

### What NOT to Do

```json
// BAD: nested wildcards cause ambiguous package detection
{
  "workspaces": ["apps/*", "packages/**"] // Don't do this!
}
```

## Package Anatomy

### Minimum Required Files

```
packages/ui/
├── package.json    # Required: Makes it a package
├── src/            # Source code
│   └── button.tsx
└── tsconfig.json   # TypeScript config (if using TS)
```

### package.json Requirements

```jsonc
{
  // Unique, namespaced name
  "name": "@doxynix/ui",
  // Version (0.0.0 is fine for an internal package; release-please owns published ones)
  "version": "0.0.0",
  // Prevents accidental publishing
  "private": true,
  // Entry points
  "exports": {
    "./button": "./src/button.tsx"
  }
}
```

## TypeScript Configuration

This repo has **one root `tsconfig.json`** plus per-workspace configs that extend it, and the shared
base lives in `packages/config`. There is no separate `typescript-config` package.

```
packages/config/
├── depcruise-base.json    # dependency-cruiser base rules
└── ...                    # shared tsconfig base
tsconfig.json              # the single root config
```

```jsonc
// packages/cli/tsconfig.json — shape, not verbatim
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Root `tsconfig.json` is listed in `turbo.json`'s `globalDependencies`, so editing it invalidates
every task's cache. That is intended.

## Lint and Format Configuration

There is **no ESLint in this repo** and none may be added. The equivalents:

| Concern | Tool | Config |
| --- | --- | --- |
| Linting | Oxlint 1.85.0 (type-aware via `oxlint-tsgolint`) | `.oxlintrc.json`, root only |
| Formatting + assists | Biome 2.5.14 | `biome.json`, root only |
| FSD boundaries | steiger | `bun --filter @doxynix/web lint:fsd` |
| Architecture boundaries | dependency-cruiser | `bun run arch:check` |

Both configs are single-root files with `overrides` / per-path blocks — there is no
`packages/eslint-config` package and no per-workspace config to drift.

`bun run lint` (i.e. `turbo lint`) depends on `db:generate`, because type-aware Oxlint needs the
generated Prisma client. A bare `bun x oxlint` skips that and reports phantom errors.



## Lockfile

A lockfile is **required** for reproducible builds, for Turborepo to understand package
dependencies, and for cache correctness.

This repo has exactly one: **`bun.lock`** (text format). There is no `package-lock.json`,
`pnpm-lock.yaml` or `yarn.lock`, and adding one would give you conflicting resolutions.

Bun's `trustedDependencies` allowlist controls which packages may run install scripts; it is not a
version constraint. Adding a dependency with native build steps (Prisma engines, sharp, esbuild)
usually means adding it there too, or the install succeeds and the binary is missing at runtime.
