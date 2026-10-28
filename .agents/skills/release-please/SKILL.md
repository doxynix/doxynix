---
name: release-please
description: release-please as configured in this repo — `release-please-config.json` + `.release-please-manifest.json`, the `node-workspace` plugin, seven tracked packages, a Bun-based CLI publish job, and the Conventional Commits contract enforced by `scripts/check-commit-name.ts`. Use when writing a commit message, bumping or tagging a version, changing the release config, or debugging why a release PR was or was not created.
---

# release-please

[release-please](https://github.com/googleapis/release-please) drives releases from Conventional
Commit messages:

1. Conventional commits land on `main`
2. release-please opens/updates a **Release PR** with the version bump and changelog
3. Merging that PR publishes GitHub Releases and tags
4. A **publish job** runs when a release actually touches a published package

release-please owns versioning, changelogs and tags. You write good commit messages; it does the
rest.

## This repo's setup

| File | Role |
| --- | --- |
| `release-please-config.json` | package list, release types, plugins |
| `.release-please-manifest.json` | current version per package |
| `.github/workflows/release-please.yml` | the bot + the CLI publish job |
| `.github/workflows/release.yml` | **legacy changesets workflow — do not extend it** |
| `CHANGELOG.md`, `apps/web/CHANGELOG.md`, `packages/cli/CHANGELOG.md` | generated |

> `release.yml` still calls `changesets/action`. There is **no `.changeset/` directory** and no
> changesets dependency in any `package.json` — that workflow is dead. release-please
> (`release-please.yml`) is the live pipeline. Do not add changesets config or run `changeset`
> commands.

### Tracked packages

```jsonc
// release-please-config.json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": { "package-name": "doxynix", "release-type": "node" },
    "apps/siem-server": { "package-name": "@doxynix/siem-server", "release-type": "node",
      "bump-minor-pre-major": true, "bump-patch-pre-major": true },
    "apps/web": { "package-name": "@doxynix/web", "release-type": "node" },
    "packages/cli": { "package-name": "@doxynix/cli", "release-type": "node" },
    "packages/config": { "package-name": "@doxynix/config", "release-type": "node" },
    "packages/shared": { "package-name": "@doxynix/shared", "release-type": "node" }
  },
  "plugins": [{ "type": "node-workspace" }]
}
```

Notes on what is actually set:

- **`node-workspace` plugin.** Keeps the root and workspace versions in sync and updates the
  inter-workspace `workspace:*` ranges when a package is versioned. This is why you must not
  hand-edit a `version` field — the bot owns it.
- **`bump-minor-pre-major` / `bump-patch-pre-major`** are set only for `apps/siem-server`, which is
  still pre-1.0 (`0.4.3`). A `feat` on it yields a patch, not `0.5.0`. The other five are past 1.0
  and use normal semver.
- **Every workspace is tracked, including private ones.** `packages/config` and `packages/shared`
  get releases even though they are never published. That is intentional — they are consumed
  through `workspace:*`.

### Publishing

The repo is private and publishes **exactly one** package: `@doxynix/cli`. Everything else gets a
tag and a changelog entry, nothing more.

```yaml
# .github/workflows/release-please.yml
permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release-please:
    outputs:
      cli_released: ${{ steps.release.outputs['packages/cli--release_created'] }}

  publish-cli:
    needs: release-please
    if: ${{ needs.release-please.outputs.cli_released == 'true' }}
    steps:
      - uses: actions/create-github-app-token@<sha>
        with:
          app-id: ${{ secrets.RELEASE_PLEASE_APP_ID }}
          private-key: ${{ secrets.RELEASE_PLEASE_PRIVATE_KEY }}

      # release-please job runs with that app token, not GITHUB_TOKEN

      - uses: oven-sh/setup-bun@<sha>
        with:
          bun-version-file: "package.json"

      - run: bun install          # NOT --ignore-scripts: the CLI build needs real postinstall

      - name: Build CLI bundle
        run: cd packages/cli && bun run build

      - name: Publish @doxynix/cli
        env:
          NPM_CONFIG_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: cd packages/cli && bun publish --access public --provenance
```

Two things to preserve if you touch this workflow:

1. **Per-package output gating.** `packages/cli--release_created` is what makes the publish job a
   no-op for every release that does not touch the CLI. A blanket `release_created == 'true'` gate
   would republish on every release.
2. **A GitHub App token, not `GITHUB_TOKEN`.** The bot needs to push to its own release branches.

`bun publish --provenance` links the publish to the workflow run; `--access public` is required for
the first publish of a scoped package.

## Commit Message Contract

This is the part that actually matters day to day. `scripts/check-commit-name.ts` runs from
Lefthook's `commit-msg` hook and **rejects** anything that does not match.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Enforced rules:

| Rule | Detail |
| --- | --- |
| Subject length | **≤ 72 characters** |
| Trailing period | forbidden |
| Type | `feat fix docs style refactor perf test build ci chore revert` |
| Scope | optional, but if present must be in the allowlist |
| Merges | `Merge branch`, `Rebase`, `fixup!`, `squash!` are exempt |

### Scope allowlist

Copied verbatim from `scripts/check-commit-name.ts`:

```
ci  cli  config  db  deps  root  security  shared
siem-server  skills  tooling  web
```

Anything else is rejected. Omitting the scope entirely is always valid — `type: description` never
fails.

### The DXNX ticket is injected, never typed

**Never put the ticket in the subject.** Lefthook's `prepare-commit-msg` hook reads `dxnx-<n>` off
the current branch and appends `Closes DXNX-NNN` as a footer:

```
feat(web): add repo selector to the dashboard
```

becomes

```
feat(web): add repo selector to the dashboard

Closes DXNX-1234
```

`scripts/inject-ticket.ts` skips merge/revert/fixup/squash messages and is idempotent (it checks
for the key first). A hand-written `DXNX-NNN` in the subject duplicates the footer and, worse,
counts as part of the 72-character budget for no benefit.

### Type → version bump

| Type | Bump | Release? |
|------|------|-----------|
| `feat` | minor | yes |
| `fix` | patch | yes |
| `perf` | patch | yes (upstream default) |
| `revert` | patch | yes |
| `chore`, `ci`, `docs`, `style`, `refactor`, `test`, `build`, `deps` | — | no |

**Breaking changes** — any type with `!` after the scope/type, or a `BREAKING CHANGE:` footer —
force a major bump.

```
feat(shared)!: drop the legacy v1 enums

BREAKING CHANGE: import from "@doxynix/shared/enums/v2" instead. The v1 exports are removed.
```

`apps/siem-server` is pre-1.0 with
`bump-minor-pre-major: true`, so a breaking change there still lands as a minor bump — expected,
not a bug.

### Special footers

| Footer | Purpose |
|--------|---------|
| `BREAKING CHANGE: <desc>` | forces a major bump |
| `Closes DXNX-NNN` | added automatically by Lefthook — do not type it |
| `Release-As: x.y.z` | force a specific version, bypassing the computed bump |

`Release-As` is the escape hatch for a bad bump; prefer fixing the commit type.

### Examples

```
feat(cli): add --json flag to `dxnx analysis run`
fix(web): resolve token refresh race on 401 replay
chore(deps): update dependency motion to v14
test(siem-server): cover the stream-logs router
refactor(shared): extract the api-error normaliser
ci: pin the postgres service image by digest
docs: document the Doppler prerequisite
```

### No AI co-author trailers

**Never add `Co-Authored-By` trailers.** They end up in the changelog.

### Dependency bumps

Renovate opens `chore(deps): ...` / `fix(deps): ... [security]` PRs, which do not trigger a
release by themselves. That is intentional — a security bump should also carry a `fix` commit
alongside it if a release is warranted.

## Writing a commit message

When someone asks for help with a message (not with the pipeline):

1. **Ask what changed** — "what did you change and why?" (skip if already described)
2. **Pick the type** — from the table, and say why
3. **Pick the scope** — from the allowlist, or omit it
4. **Draft** — subject ≤ 72 chars, no trailing period, no ticket in the subject
5. **Confirm** — present it for approval

If the change is breaking, add the `!` and a `BREAKING CHANGE:` footer.

## Best Practices

### Squash merges

Mergify squash-merges into `main`, so the **PR title becomes the commit subject**. Write the PR
title as a conventional commit subject (≤ 72 chars, valid type and scope) — it is not a summary,
it is the changelog line.

### Never hand-edit versions

`package.json` `version` fields, `.release-please-manifest.json` and the `CHANGELOG.md` files are
all bot-owned. Edit `release-please-config.json` only for genuine config changes (adding a package,
changing release type, adding a plugin), and leave versioning to the bot.

### Never `--no-verify`

If a hook rejects a commit message, the message is wrong, not the hook. Fix the subject. The same
applies to the branch-name check.

### Permissions and concurrency

The release workflow needs `contents: write`, `issues: write`, `pull-requests: write` and
`id-token: write`. Do not set `cancel-in-progress: true` on a release workflow — cancelling
mid-flight can leave a tag without a release.

## Troubleshooting

### No release PR appeared

- Are there any releasable commits (`feat`, `fix`, `perf`, `revert`, or a `BREAKING CHANGE:`
  footer) on `main` since the last release? A PR of only `chore`/`ci` produces nothing.
- Are they on the branch the workflow watches? `release-please.yml` triggers on `push` to `main`.
- Are the subjects actually conventional? `feat web: thing` (no parens, unlisted scope) parses as
  type `feat`, no scope — it will release, but the component routing will be wrong.
- Is `release-please-config.json` valid JSON? A malformed config fails the action outright.

### Wrong bump

- `chore:` never releases; `feat:` is minor; `perf:` is patch.
- A `BREAKING CHANGE:` footer you did not intend forces a major.
- On a pre-1.0 package with `bump-minor-pre-major`, a `feat` is a patch — that is configured
  behaviour, not a bug.
- Override a bad bump with a `Release-As: x.y.z` footer.

### The CLI did not publish

- Did the release actually touch `packages/cli`? Check `packages/cli--release_created`.
- `NPM_TOKEN` present and not expired?
- The publish job runs a **full** `bun install` (scripts enabled) — if you change it to
  `--ignore-scripts`, the build fails because Prisma/ZenStack codegen never ran.

### Version and changelog out of sync

Almost always a hand-edited `package.json` version. Do not fix it by editing the manifest — merge
the Release PR as-is, or revert the hand edit so the next release recomputes from the tag.

## References

| Reference | Contents |
|-----------|----------|
| `references/commit-conventions.md` | Full Conventional Commits spec, examples, anti-patterns |
| `references/config-options.md` | release-please configuration options |
| `references/workflow-templates.md` | Workflow shapes: monorepo, per-package publish, pre-release |
| [release-please](https://github.com/googleapis/release-please) | Upstream docs |
| [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) | Specification |
| `.agents/skills/linear-git-workflow/SKILL.md` | Branch naming, PR creation, the DXNX ticket flow |