# Workflow Templates

release-please workflow shapes relevant to this repo. Everything is **Bun** — there is no
`actions/setup-node`, no `npm ci`, no `npm publish`, and no `NODE_AUTH_TOKEN`.

This repo has one publishable package (`packages/cli`) in a seven-package monorepo. The templates
below cover: the shape actually in use, the single-package variant, adding a second publishable
package, and the pre-release flow.

---

## 1. This repo's shape: monorepo, one publishable package

The live file is `.github/workflows/release-please.yml`.

```yaml
name: doxynix-release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      cli_released: ${{ steps.release.outputs['packages/cli--release_created'] }}
    steps:
      - name: Generate Bot Token
        id: app-token
        uses: actions/create-github-app-token@<sha>
        with:
          app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@<sha>
        id: release
        with:
          token: ${{ steps.app-token.outputs.token }}

  publish-cli:
    needs: release-please
    if: ${{ needs.release-please.outputs.cli_released == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>

      - name: Setup Bun
        uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"

      - name: Install dependencies
        run: bun install

      - name: Build CLI bundle
        run: |
          cd packages/cli
          bun run build

      - name: Publish @doxynix/cli to npm
        env:
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          cd packages/cli
          bun publish --access public --provenance
```

Four decisions worth preserving:

1. **A GitHub App token, not `GITHUB_TOKEN`.** The bot must push to its own release branch.
2. **Per-package gating.** `packages/cli--release_created` keeps the publish job a no-op for the
   six other packages.
3. **Full `bun install`, not `--ignore-scripts`.** The CLI build needs real postinstall (Prisma /
   ZenStack codegen). Every other workflow in the repo uses `--ignore-scripts`; this one is the
   exception and it is deliberate.
4. **The token env var is `NPM_CONFIG_TOKEN`.** That is what `bun publish` reads, not
   `NODE_AUTH_TOKEN`.

### Config and manifest

```jsonc
// release-please-config.json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": { "package-name": "doxynix", "release-type": "node" },
    "apps/siem-client": {
      "package-name": "@doxynix/siem-client",
      "release-type": "node",
      "bump-minor-pre-major": true,
      "bump-patch-pre-major": true
    },
    "apps/siem-server": {
      "package-name": "@doxynix/siem-server",
      "release-type": "node",
      "bump-minor-pre-major": true,
      "bump-patch-pre-major": true
    },
    "apps/web": { "package-name": "@doxynix/web", "release-type": "node" },
    "packages/cli": { "package-name": "@doxynix/cli", "release-type": "node" },
    "packages/config": { "package-name": "@doxynix/config", "release-type": "node" },
    "packages/shared": { "package-name": "@doxynix/shared", "release-type": "node" }
  },
  "plugins": [{ "type": "node-workspace" }]
}
```

```json
// .release-please-manifest.json
{
  ".": "6.2.0",
  "apps/siem-client": "0.4.0",
  "apps/siem-server": "0.3.2",
  "apps/web": "5.2.0",
  "packages/cli": "5.1.0",
  "packages/config": "1.2.0",
  "packages/shared": "0.3.0"
}
```

The `node-workspace` plugin keeps the root version and the inter-workspace `workspace:*` ranges
consistent. **Both files are bot-owned** — read them, never write them.

Note that private packages (`packages/config`, `packages/shared`) are tracked: they get tags and
changelogs but are never published.

---

## 2. Single publishable package, no other workspaces

The minimal shape, if the monorepo grows a second publishable package:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      released: ${{ steps.release.outputs.releases_created }}
    steps:
      - uses: actions/create-github-app-token@<sha>
        id: app-token
        with:
          app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@<sha>
        id: release
        with:
          token: ${{ steps.app-token.outputs.token }}

  publish:
    needs: release-please
    if: needs.release-please.outputs.released == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@<sha>
      - uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"
      - run: bun install
      - run: bun run build
      - env:
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: bun publish --access public --provenance
```

In a single-package repo `releases_created` is the right gate; in a monorepo use the per-package
output so a docs-only release does not trigger a publish.

---

## 3. Adding a second publishable package

Two changes, both mechanical.

**a) Expose the per-package output on the release job:**

```yaml
outputs:
  cli_released: ${{ steps.release.outputs['packages/cli--release_created'] }}
  sdk_released: ${{ steps.release.outputs['packages/sdk--release_created'] }}
```

The key format is `<package-path>--<output>`, where the path is exactly the key used in
`release-please-config.json`'s `packages` map — `packages/cli`, not `@doxynix/cli`.

**b) Add a sibling publish job:**

```yaml
  publish-sdk:
    needs: release-please
    if: needs.release-please.outputs.sdk_released == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"
      - run: bun install
      - run: cd packages/sdk && bun run build
      - name: Publish
        env:
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: cd packages/sdk && bun publish --access public --provenance
```

And add the package to **both** `release-please-config.json` and `.release-please-manifest.json`
(initially at the current version, or `0.0.0` for a brand-new package).

**Do not** collapse the jobs into a matrix unless every package builds the same way — the build
step differs per package and a matrix turns that into conditionals.

---

## 4. Pre-release pattern (manual dispatch)

Pre-releases are opt-in and identifier-driven. Not used in this repo today; the shape is here for
when a `next` channel is needed.

```yaml
name: Release (pre-release)

on:
  workflow_dispatch:
    inputs:
      prerelease:
        description: 'Prerelease identifier (alpha, beta, rc). Leave empty for a stable release.'
        required: false
        type: string
      use_latest:
        description: 'Publish to the latest dist-tag instead of next'
        required: false
        type: boolean

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      prerelease: ${{ steps.release.outputs.prerelease }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
    steps:
      - uses: actions/create-github-app-token@<sha>
        id: app-token
        with:
          app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}

      - uses: googleapis/release-please-action@<sha>
        id: release
        with:
          token: ${{ steps.app-token.outputs.token }}
          prerelease: ${{ inputs.prerelease }}
          prerelease-type: ${{ inputs.prerelease }}

  publish:
    needs: release-please
    if: needs.release-please.outputs.prerelease != ''
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"
      - run: bun install
      - run: bun run build
      - name: Publish pre-release
        env:
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: bun publish --provenance --tag next --access public
```

Usage: Actions → Release (pre-release) → Run workflow → enter `alpha`, `beta` or `rc`. The
identifier is appended to the current version (`5.1.0-rc.1`). Pre-releases go to the `next`
dist-tag; stable releases go to `latest`.

Leaving `prerelease` empty produces a normal stable release, so one workflow serves both.

---

## 5. Adding a new package to release-please

Checklist:

1. Add the path to `release-please-config.json`'s `packages` map with at least
   `"release-type": "node"` and a `package-name`.
2. Add the same path to `.release-please-manifest.json` at its current version (or `0.0.0`).
3. If it is publishable: add a per-package output on the release job and a gated publish job.
4. Confirm the package has a `CHANGELOG.md` path that is not ignored — `biome.json`'s
   `files.includes` excludes generated files, and `CHANGELOG.md` is generated by the bot.
5. Do **not** hand-edit the manifest to "seed" a version after the fact; merge the Release PR.

---

## Checklist for any change to the release workflow

- [ ] Actions SHA-pinned, with the version in a trailing comment
- [ ] `bun-version-file: "package.json"` rather than a literal Bun version
- [ ] `bun install` (scripts enabled) — the build needs codegen
- [ ] `NPM_CONFIG_TOKEN`, not `NODE_AUTH_TOKEN`
- [ ] Per-package output gate, not a blanket `releases_created`
- [ ] `bun publish --access public --provenance`
- [ ] `permissions:` scoped per job
- [ ] `cancel-in-progress: false` on the release workflow
- [ ] No changesets anywhere (`.changeset/` does not exist; `release.yml` is legacy and dead)