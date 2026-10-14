# release-please Configuration Reference

## release-please-config.json

The config file lives at the repository root and controls how release-please behaves.

### Full Schema

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      // All options below go here for single-package repos
    }
  }
}
```

### All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `release-type` | string | — | **Required.** Package ecosystem (see release types below) |
| `changelog-path` | string | `"CHANGELOG.md"` | Path to changelog file relative to package |
| `bump-minor-pre-major` | boolean | `false` | Treat `feat` as patch when version < 1.0.0 |
| `bump-patch-for-minor-pre-major` | boolean | `false` | Treat `feat` as patch when version < 1.0.0 (finer control) |
| `draft` | boolean | `false` | Create release PRs as draft |
| `prerelease` | boolean | `false` | Create pre-release GitHub releases |
| `versioning` | string | `"default"` | Versioning strategy (`"default"` or `"always-bump-patch"`) |
| `extra-files` | array | `[]` | Additional files to update version strings in |
| `include-component-in-tag` | boolean | `true` (monorepo) | Prefix tag with component name |
| `include-v-in-tag` | boolean | `true` | Prefix tag with `v` (e.g., `v1.2.3`) |
| `tag-separator` | string | `"-"` | Separator between component and version in tag |
| `changelog-type` | string | `"default"` | Changelog format (`"default"` or `"github"`) |
| `changelog-sections` | array | (see below) | Customize changelog section headers |
| `pull-request-title-pattern` | string | `"chore${scope}: release${component} ${version}"` | PR title template |
| `pull-request-header` | string | `":robot: I have created a release..."` | PR body header |
| `separate-pull-requests` | boolean | `false` | One PR per package (monorepo) |
| `skip-github-release` | boolean | `false` | Skip creating GitHub releases |
| `draft-pull-request` | boolean | `false` | Create release PRs as drafts |
| `component` | string | package name | Component name for tags/changelogs |
| `release-as` | string | — | Force next release to this version |
| `snapshot-labels` | array | `[]` | Labels for snapshot releases |
| `exclude-paths` | array | `[]` | Glob patterns to exclude from change detection |
| `initial-version` | string | — | Version to use for first release |

### Changelog Sections Customization

```json
{
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "deps", "section": "Dependencies" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "refactor", "section": "Code Refactoring", "hidden": true },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true },
    { "type": "chore", "section": "Miscellaneous Chores", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build System", "hidden": true },
    { "type": "ci", "section": "Continuous Integration", "hidden": true }
  ]
}
```

Set `"hidden": true` to exclude a commit type from the changelog entirely.

### Release Types

This repo is **Node/Bun only**. Every entry in `release-please-config.json` is `"release-type": "node"`,
which reads and writes the `version` field in `package.json`.

| Type | Ecosystem | Version file |
|------|-----------|--------------|
| `node` | Node / Bun | `package.json` |

Other release types (`python`, `java`, `go`, `rust`, `ruby`, `helm`, …) exist upstream but have no
place here — adding one means adding a non-JS package to a Bun workspace.

---

## .release-please-manifest.json

The manifest tracks the current version of each package. It must exist at the repository root.

### Single Package

```json
{
  ".": "1.0.0"
}
```

### Monorepo

```json
{
  "packages/core": "2.1.0",
  "packages/cli": "1.3.2",
  "packages/utils": "0.5.1"
}
```

**Important:** The keys must match the keys in `release-please-config.json`'s `packages` object. The version should reflect the current released version (release-please will bump from here).

### Bootstrapping

When adding release-please to an existing project:

1. Set the manifest version to your **current released version**
2. release-please will create a PR bumping FROM this version based on new commits
3. If you have no prior releases, use `"0.0.0"` and release-please will create `0.1.0` or `1.0.0` based on commits

Alternatively, use the `Release-As: x.x.x` footer in a commit to force a specific first version.

---

## GitHub Action: googleapis/release-please-action@v4

### Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `config-file` | string | `"release-please-config.json"` | Path to config file |
| `manifest-file` | string | `".release-please-manifest.json"` | Path to manifest file |
| `token` | string | `${{ secrets.GITHUB_TOKEN }}` | GitHub token for API access — **this repo passes a GitHub App token** so the bot can push to its release branch |
| `target-branch` | string | default branch | Branch to target for release PRs |
| `skip-github-release` | boolean | `false` | Skip creating GitHub releases |
| `skip-github-pull-request` | boolean | `false` | Skip creating release PRs |
| `fork` | boolean | `false` | Create PR from a fork |

### Outputs

| Output | Description |
|--------|-------------|
| `release_created` | `true` if a release was created |
| `releases_created` | `true` if any releases were created (monorepo) |
| `tag_name` | Git tag for the release (e.g., `v1.2.3`) |
| `version` | Semver version string (e.g., `1.2.3`) |
| `major` | Major version number |
| `minor` | Minor version number |
| `patch` | Patch version number |
| `sha` | Release commit SHA |
| `upload_url` | URL for uploading release assets |
| `html_url` | URL of the GitHub release page |
| `pr` | Release PR number |
| `prs_created` | `true` if release PRs were created |
| `paths_released` | JSON array of released package paths (monorepo) |

#### Monorepo Output Access

For monorepo packages, outputs are namespaced by path with `/` replaced by `--`:

```yaml
# For package at "packages/core":
steps.release.outputs['packages/core--release_created']
steps.release.outputs['packages/core--tag_name']
steps.release.outputs['packages/core--version']
```

---

## This repo's Configuration

**release-please-config.json:**

```jsonc
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

**.release-please-manifest.json:**

```json
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

`separate-pull-requests` is not set, so it defaults to `false` and all package releases are grouped
into a single Release PR. Setting it to `true` gives each package an independent PR — noisier, and
it would conflict with the single-PR convention the repo has.

### The `node-workspace` plugin

Keeps the root package version and the inter-workspace `workspace:*` ranges consistent when a
package is versioned. Without it, bumping `packages/shared` leaves every dependent workspace
pointing at a range that no longer matches the release.

Practical consequences:

- You cannot hand-edit a `version` field and expect the next release to build on it — the plugin
  reconciles from the tag.
- `bun install` must run after the bot's PR lands, or `bun.lock` will not match the bumped ranges.
  The bot's Release PR is the place where that lockfile update belongs.

### Pre-1.0 packages

`apps/siem-client` (0.4.0) and `apps/siem-server` (0.3.2) set both `bump-minor-pre-major` and
`bump-patch-pre-major`. A `feat` on either is a **patch**, not a minor — so `feat(siem-client): ...`
produces `0.4.1`, not `0.5.0`. That is intended: the public contract has not stabilised.

The other five packages are past 1.0 and use normal semver.

### Commit scopes

release-please routes a commit to a package by the commit scope matching the package path
(`packages/cli` ← `cli`). The scope allowlist in `scripts/check-commit-name.ts` and the release
paths are aligned deliberately:

| Scope | Routed to |
|-------|-----------|
| `cli` | `packages/cli` |
| `shared` | `packages/shared` |
| `config` | `packages/config` |
| `siem-client` | `apps/siem-client` |
| `siem-server` | `apps/siem-server` |
| `web` | `apps/web` |
| `ci`, `deps`, `db`, `root`, `security`, `skills`, `tooling` | repo-wide |

A scope that is in the allowlist but does not map to a package (`tooling`, say) still bumps the
root `"."` package.
