---
name: github-actions-templates
description: GitHub Actions workflow patterns as they actually exist in this repo — Bun setup via oven-sh/setup-bun, SHA-pinned actions, turbo task invocation, path filters, change detection, secrets and permissions. Use when adding or editing a file in `.github/workflows/`, debugging a CI job, or wiring a new app into CI.
---

# GitHub Actions Templates

How CI works in this repository. Every pattern below is taken from a live file in
`.github/workflows/` — copy the shape, do not invent one.

## Non-negotiables

| Rule | Why |
| --- | --- |
| `oven-sh/setup-bun` with `bun-version-file: "package.json"` | reads `packageManager: "bun@1.4.0"`; never hardcode a version |
| `bun install --ignore-scripts` then `bun run clean:symlinks` | skips untrusted postinstall; `clean:symlinks` replaces what `postinstall` would have done |
| **Never** `actions/setup-node`, `npm ci`, `pnpm`, `yarn` | the repo is Bun-only; the agent hook rejects the others |
| Actions pinned to a **commit SHA** with the human version in a trailing comment | a floating tag is a supply-chain hole |
| Explicit `permissions:` at workflow level | default token scopes are too broad |
| `bun --filter <pkg> <script>` or a root `bun run <script>` | keeps the turbo task graph in play |

## Canonical job skeleton

From `web-ci.yml`:

```yaml
jobs:
  quality:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Checkout repo
        uses: actions/checkout@0c366fd6a839edf440554fa01a7085ccba70ac98

      - name: Setup Bun
        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6
        with:
          bun-version-file: "package.json"

      - name: Install dependencies
        run: bun install --ignore-scripts

      - name: Clean tree-sitter symlinks
        run: bun run clean:symlinks

      - name: Linting
        run: bun --filter @doxynix/web lint
```

`global-ci.yml` uses the identical three-step preamble before `bun run spellcheck`,
`bun run dup`, `bun run knip` and `bun run secretlint`. Reuse it verbatim.

## Workflow-level scaffolding

```yaml
name: <Name>

permissions:
  contents: read
  pull-requests: write
  statuses: write

on:
  push:
    branches: ["main", "develop"]
    paths: ["apps/web/**", "packages/**", "package.json", "bun.lock", "turbo.json"]
  pull_request:
    branches: ["main", "develop"]
    paths: ["apps/web/**", "packages/**", "package.json", "bun.lock", "turbo.json"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

defaults:
  run:
    shell: bash
```

`paths:` at the workflow level is the cheap filter — an unrelated PR never wakes the Next.js build.
Reach for a per-job filter only when one workflow legitimately covers several unrelated areas.

## Change detection inside a workflow

When one workflow serves multiple areas, `dorny/paths-filter` narrows the jobs:

```yaml
- uses: dorny/paths-filter@61f87a10cd2c304679af17bb73ef192addf33c1c
  id: filter
  with:
    base: ${{ github.base_ref || 'main' }}
    filters: |
      backend:
        - 'package.json'
        - 'bun.lock'
        - 'apps/web/**'
        - 'src/server/**'
```

Gate the job with `if: steps.filter.outputs.backend == 'true'`, or pass the flag forward as a job
output for downstream `needs:`.

## Services: Postgres for tests and type-check

```yaml
types:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:18@sha256:<digest>
      env:
        POSTGRES_USER: user
        POSTGRES_PASSWORD: password
        POSTGRES_DB: test_db
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  steps:
    # ... checkout / setup-bun / install / clean:symlinks ...
    - name: Prepare Database Schema
      run: bun --filter @doxynix/web db:push
      env:
        DATABASE_URL: postgresql://user:password@localhost:5432/test_db
        DIRECT_URL: postgresql://user:password@localhost:5432/test_db

    - name: Type Checking
      run: bun --filter @doxynix/web type-check
```

The service image is digest-pinned, not tag-pinned. Integration tests need a real database —
`apps/web`'s `test:int` refuses to run against any database whose name does not contain `test`.

## Environment variables in CI

Two distinct groups, and mixing them up causes flaky "works locally" failures.

**Workflow-level `env`** — non-secret placeholders so validation passes at import time:

```yaml
env:
  NODE_ENV: test
  CI: "true"
  SKIP_ENV_VALIDATION: "true"
  NEXT_TELEMETRY_DISABLED: 1
  NODE_OPTIONS: "--max-old-space-size=6144"
  DATABASE_URL: postgresql://user:password@localhost:5432/test_db
  RESEND_API_KEY: "re_dummy_123"
```

`apps/web` `type-check` needs `--max-old-space-size`; 6144 is the CI value.

**Step-level `env`** — real secrets, one step at a time:

```yaml
- name: Prisma Generate
  run: bun --filter @doxynix/web db:generate
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    PRISMA_FIELD_ENCRYPTION_KEY: ${{ secrets.PRISMA_FIELD_ENCRYPTION_KEY }}
```

Never put a secret in workflow-level `env`: it is visible to every job in the file and is echoed in
logs on any failing step.

### Doppler locally, not in CI

`db:generate`, `build`, `dev`, `lint`, `type-check`, `test` and `validate` all transitively run
`db:generate`, which goes through the `with-doppler` wrapper. `scripts/doppler.ts` passes straight
through when `CI=true`, so CI steps call the script directly and never touch Doppler. `with-doppler`
exists only inside `apps/web` and `apps/siem-server` — there is no such script at the repo root.

## Failure reporting and notification

`global-ci.yml` splits this into a dedicated `notify` job so it always runs:

```yaml
notify:
  needs: [init, quality, security]
  if: always()
  runs-on: ubuntu-latest
  steps:
    - name: Collect CI metadata
      id: collect
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        QUALITY_RESULT: ${{ needs.quality.result }}
        SECURITY_RESULT: ${{ needs.security.result }}
        CI_STARTED_AT: ${{ needs.init.outputs.started_at }}
      run: python3 .github/scripts/ci-notify.py

    - uses: appleboy/telegram-action@847a2d3240d33a6137191cc89b3ad7f53e427c06
      if: github.actor != 'ImgBotApp' && !contains(github.actor, '[bot]')
      with:
        to: ${{ secrets.TELEGRAM_TO }}
        token: ${{ secrets.TELEGRAM_TOKEN }}
        format: markdown
        message: ${{ steps.collect.outputs.message }}

    - name: Check Final Status
      if: steps.collect.outputs.is_success == 'false'
      run: exit 1
```

Two ideas worth copying: an `init` job that stamps `started_at` so the message can report duration,
and `if: github.actor != 'ImgBotApp' && !contains(github.actor, '[bot]')` to stop bots from
notifying about themselves.

## Security scanning

`global-ci.yml` composes several tools; each is SHA-pinned and scoped to `contents: read`:

```yaml
- name: Run Secretlint
  run: bun run secretlint

- name: Secret Scanning (TruffleHog)
  uses: trufflesecurity/trufflehog@bff3d2670b362bbb4a0bcdeffea146cbc2ad3abd
  with:
    path: ./
    extra_args: --only-verified

- name: Security audit
  run: bun audit
  continue-on-error: true
```

`codeql.yml`, `sonar.yml`, `dependency-review.yml` and `stale.yml` are single-purpose workflows
kept separate for exactly this reason — one tool, one failure surface, one place to look.

`continue-on-error: true` is used deliberately for advisory scans (`bun audit`, `knip`,
`spellcheck`) so an informational finding never blocks a merge. Anything gating a merge must not
carry it.

## Reusable workflows

The repo does **not** currently use `workflow_call`. The equivalent reuse is the
`shared-ci.yml` + `cli-ci.yml` / `web-ci.yml` / `siem-ci.yml` split: one shared workflow per
concern, and per-app workflows that add the app-specific jobs. Follow that shape rather than
introducing a `workflow_call` matrix.

```yaml
# existing shape — shared steps once, app-specific jobs in the app's own workflow
# .github/workflows/shared-ci.yml   (checkout + bun setup + install + clean)
# .github/workflows/web-ci.yml      (quality / types / tests / build for @doxynix/web)
# .github/workflows/siem-ci.yml     (same shape for @doxynix/siem-*)
```

If you do need parameterisation later, the `workflow_call` shape is:

```yaml
on:
  workflow_call:
    inputs:
      package:
        required: true
        type: string
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"
      - run: bun install --ignore-scripts
      - run: bun run clean:symlinks
      - run: bun --filter ${{ inputs.package }} test
```

## Bot token pattern

Release-please and Renovate both mint a GitHub App token rather than using `GITHUB_TOKEN`, so the
bot can push to release branches:

```yaml
- name: Generate Bot Token
  id: app-token
  uses: actions/create-github-app-token@f8d387b68d61c58ab83c6c016672934102569859
  with:
    app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
    private-key: ${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}

- uses: googleapis/release-please-action@5c625bfb5d1ff62eadeeb3772007f7f66fdcf071
  id: release
  with:
    token: ${{ steps.app-token.outputs.token }}
```

The workflow then needs elevated scopes (`contents: write`, `issues: write`,
`pull-requests: write`, `id-token: write`) — grant them only in the workflows that actually push.

## Publishing

Only `packages/cli` is published, from the release-please workflow, and only when the release
actually touched it:

```yaml
publish-cli:
  needs: release-please
  if: ${{ needs.release-please.outputs.cli_released == 'true' }}
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@<sha>
    - uses: oven-sh/setup-bun@<sha>
      with:
        bun-version-file: "package.json"
    - run: bun install
    - name: Build CLI bundle
      run: cd packages/cli && bun run build
    - name: Publish @doxynix/cli to npm
      env:
        NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
      run: cd packages/cli && bun publish --access public --provenance
```

Note: this job uses a plain `bun install`, **not** `--ignore-scripts` — it needs the real postinstall
(Prisma/ZenStack codegen) to build. `--provenance` links the publish to the workflow run.

## Chained workflows

`relative-ci.yml` reacts to another workflow's completion rather than duplicating its steps:

```yaml
on:
  workflow_run:
    workflows: ["Web CI"]
    types:
      - completed

jobs:
  send-stats:
    if: >-
      github.event.workflow_run.conclusion == 'success' &&
      github.event.workflow_run.head_repository.full_name == github.repository &&
      github.event.workflow_run.actor.type != 'Bot'
```

`head_repository.full_name == github.repository` is the guard that stops a fork's `Web CI` from
running privileged follow-up jobs. Copy it whenever you use `workflow_run`.

## Review checklist

1. SHA-pinned actions with a version comment?
2. `bun-version-file: "package.json"` rather than a literal version?
3. `bun install --ignore-scripts` + `bun run clean:symlinks` (unless publishing, which needs scripts)?
4. Explicit `permissions:` at workflow level?
5. `concurrency` group so superseded PR runs get cancelled?
6. Secrets at step level, placeholders at workflow level?
7. `timeout-minutes` set on every job?
8. `paths:` filter if the workflow only covers part of the repo?
9. Nothing merged can break main without a required check — check `required_status_checks` when
   adding a new workflow.

## Related

- Turborepo task graph and caching: `.agents/skills/turborepo/`
- Workspace layout and version pinning: `.agents/skills/monorepo-management/`
- Release automation and commit conventions: `.agents/skills/release-please/`