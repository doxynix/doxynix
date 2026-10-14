# GitHub Actions

How this repo runs turbo in CI. The package-manager setup is **Bun**; `actions/setup-node`,
`npm ci`, `pnpm` and `yarn` are not used anywhere in `.github/workflows/`.

See `.agents/skills/github-actions-templates/` for the full workflow conventions (SHA pinning,
permissions, path filters, notification). This file covers only the turbo-specific parts.

## Basic job

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

`bun-version-file: "package.json"` reads `packageManager: "bun@1.4.0"`. Never hardcode a version —
bumping Bun is a one-line edit and every workflow follows.

`--ignore-scripts` skips untrusted postinstall code; `bun run clean:symlinks` is what
`postinstall` would have done (it deletes the circular `tree-sitter-wasms` symlink that breaks
WASM grammar loading). Any install that needs real scripts — the CLI publish job — uses plain
`bun install`.

`fetch-depth: 2` is enough for `--affected` and for diff-based path filters. A full history is
only needed by the workflows that shell out to git log (`codeql`, `sonar`, `global-ci`'s
trufflehog job) — those pass `fetch-depth: 0`.

## Remote Cache

Two ways to authenticate to Vercel Remote Cache from GitHub Actions:

- **OpenID Connect (recommended)** — exchange the runner's OIDC token for a short-lived
  Turborepo access token.
- **Personal Access Token** — a long-lived, team-scoped secret.

Either way, `TURBO_TOKEN` and `TURBO_TEAM` must reach the job; both are already declared in
`turbo.json`'s `globalEnv`, so turbo picks them up automatically once they exist in the
environment.

### Option A: OpenID Connect

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write      # required for the OIDC exchange
    steps:
      - uses: actions/checkout@<sha-pinned>
        with:
          fetch-depth: 2

      - uses: vercel/setup-turborepo-remote-cache-action@<sha-pinned>
        with:
          team: ${{ vars.TURBO_TEAM }}
```

The action runs before any `turbo` step and exports `TURBO_TOKEN` / `TURBO_TEAM` for them.

### Option B: Personal Access Token

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

## Alternative: actions/cache

If remote cache is unavailable, cache the local cache directory:

```yaml
- uses: actions/cache@<sha-pinned>
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ hashFiles('**/turbo.json', 'bun.lock') }}
    restore-keys: |
      turbo-${{ runner.os }}-
```

Hash **`bun.lock`**, not `package-lock.json` — this repo has no npm lockfile. Note this is
per-branch and less effective than remote cache.

## Running affected packages

```bash
turbo build test lint --affected
```

`--affected` needs a git base. Set it explicitly when the default is wrong:

```bash
TURBO_SCM_BASE=origin/main turbo build --affected
TURBO_SCM_HEAD=HEAD turbo build --affected
```

This repo's workflows mostly avoid `--affected` and instead use **workflow-level `paths:`
filters** (`web-ci.yml` triggers on `apps/web/**`, `packages/**`, `package.json`, `bun.lock`,
`turbo.json`), which is cheaper than letting turbo compute a diff. Both are legitimate; pick the
path filter for a per-app workflow and `--affected` when one workflow spans several areas.

## Database-backed tasks in CI

`type-check`, `test`, `test:int` and `db:generate` all reach the database. `postgres:18` runs as a
digest-pinned service, and `DATABASE_URL` / `DIRECT_URL` are passed at **step** level:

```yaml
- name: Type Checking
  run: bun --filter @doxynix/web type-check
  env:
    DATABASE_URL: postgresql://user:password@localhost:5432/test_db
    DIRECT_URL: postgresql://user:password@localhost:5432/test_db
```

`scripts/doppler.ts` passes straight through when `CI=true`, so CI steps never invoke Doppler.

## Complete example

```yaml
name: Turbo CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@<sha-pinned>
        with:
          fetch-depth: 2

      - uses: oven-sh/setup-bun@<sha-pinned>
        with:
          bun-version-file: "package.json"

      - uses: vercel/setup-turborepo-remote-cache-action@<sha-pinned>
        with:
          team: ${{ vars.TURBO_TEAM }}

      - name: Install dependencies
        run: bun install --ignore-scripts

      - name: Clean tree-sitter symlinks
        run: bun run clean:symlinks

      - name: Build
        run: bun run build

      - name: Lint
        run: bun run lint

      - name: Type check
        run: bun run type-check
```