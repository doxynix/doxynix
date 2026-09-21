---
name: linear-git-workflow
description: End-to-end Linear ↔ Git workflow for the Doxynix monorepo. Use whenever the user mentions Linear, DXNX tasks/issues, ticket IDs like DXNX-123, creating or renaming branches, branch naming conventions, commit message conventions, Conventional Commits with Linear tickets, opening a PR linked to a Linear issue, or asks to "take a task from Linear and implement it" — even if they don't name Linear explicitly. Also use before writing issue descriptions in Linear or when Linear MCP calls fail.
---

# Linear ↔ Git Workflow (Doxynix)

## Why this skill exists

Doxynix tracks all work in **Linear**, and every piece of code work is tied to a
Linear issue via its identifier (`DXNX-<n>`). Branch names, commit footers, and PR
descriptions all reference that identifier so the work is traceable end‑to‑end. Git
commits **must not** embed the ticket in the commit subject — the ticket goes into the
**footer** (`Closes DXNX-NNN`), and a lefthook hook injects it automatically. If an AI
treats Linear and Git as two unrelated worlds, it will produce branches and commits
that the repo's hooks reject. This skill wires them together.

---

## How Linear and Git are connected in this repo

| Piece | What it is |
| --- | --- |
| **Linear MCP** | `@touchlab/linear-mcp-integration`, launched via Doppler (`--project doxynix-siem --config dev_personal`) in `opencode.jsonc`. Exposes `linear_*` tools. |
| **Linear team** | Team **Doxynix** with key **DXNX** (issues get identifiers like `DXNX-224`). Always resolve the team ID dynamically with `linear_get_teams`. |
| **Git local MCP** | `@cyanheads/git-mcp-server` (`local-git` tools) for repo operations in-agent. |
| **Hooks** | Lefthook (`lefthook.yml`) validates branch names (pre-commit / pre-push / post-checkout), injects the ticket footer (prepare-commit-msg), validates the commit message (commit-msg), runs Biome/Oxlint/arch-check/cspell/secretlint. |
| **Validation scripts** | `scripts/check-branch-name.ts`, `scripts/check-commit-name.ts`, `scripts/inject-ticket.ts` (in repo root). |
| **PR merge** | Mergify **squash-merges** PRs into `main`; the squash commit subject is the **PR title**, so the ticket lives in the PR body / Linear link, never in the commit subject. |

### Linear MCP tool map

- `linear_get_teams` — list teams (resolve `DXNX` team ID).
- `linear_get_user` — current user (assignee ID for created issues).
- `linear_search_issues` — find issues (`query`, `teamIds`, `assigneeIds`, `states`, `priority`, `first`, `after`, `orderBy`). Prefer rich text / exact `DXNX-NNN` query for a known ticket.
- `linear_get_project`, `linear_search_projects` — read projects.
- `linear_create_issue` / `linear_create_issues` — create one or many issues (`title`, `description`, `teamId`, `assigneeId?`, `priority?`, `projectId?`).
- `linear_create_project_with_issues`, `linear_delete_issue` — project batch creation / deletion.
- `linear_auth` / `linear_auth_callback` — OAuth (only when the session is unauthenticated).

### Known Doxynix Linear shape (verify dynamically, don't hardcode)

- **Workflow states**: `Backlog` → `To Do` → `Doing` / `In Progress` → `In Review` → `Testing` → `Done 🎉`; also `Design`, `Todo`, `Duplicate`, `Canceled`, `Done`.
- **Labels in use**: `Bug`, `Feature`, `Improvement`, `fix` (plus `DO NOT DELETE` — never remove/rename it).
- **Priority**: 0–4 in the Linear API: `0` = No priority, `1` = Urgent (highest), `2` = High, `3` = Medium, `4` = Low. Observed issues in this project commonly sit at `0` (No priority) with no explicit labels.

---

## Workflow

### Step 1 — Read or find a task

1. If the user gives a ticket (`DXNX-224`), call `linear_search_issues({ query: "DXNX-224" })` and read the returned issue: title, description, state, assignee, priority, labels.
2. If the user describes work without a ticket, search for it: `linear_search_issues({ query: "<keywords>", states: ["To Do", "Doing", "In Progress"] })`. Match by intent, not only keywords.
3. If the ticket is missing, does not exist, or is already `Done 🎉`, tell the user before inventing work.

**Issue style** (match it when reading and creating): title is a short imperative or
noun-phrase in English (`"Fix CLI publishing"`, `"Expand CLI Commands"`); description
is 1–3 sentences or a bulleted task list, English or Russian; the identifier prefix is
always uppercase `DXNX-`.

### Step 2 — Create an issue (only if needed and user asked for it)

```text
Resolve team ID:      linear_get_teams()        → pick node.key == "DXNX"
Resolve assignee ID:  linear_get_user()         → viewer.id
Create:               linear_create_issue({ title, description, teamId, assigneeId?, priority? })
```

Outcome: Linear returns the new identifier (e.g. `DXNX-225`) — **use it for the branch**.

### Step 3 — Cut a feature branch

Standard per `CONTRIBUTING.md`, enforced by `scripts/check-branch-name.ts`:

```
<type>/dxnx-<n>-<short-kebab-description>
```

Real examples from the repo history:
- `fix/dxnx-208-web-build-and-runtime-config`
- `feat/dxnx-213-expand-cli-commands`
- `chore/dxnx-214-add-new-agent-skills`
- `refactor/dxnx-223-consolidate-arch-gates-prune-tests`

The hook accepts (case-insensitive) any branch that *starts with* `dxnx/`, or has
`dxnx-`/`dxnx_` right after the first `/` segment, or starts with `dxnx-`/`dxnx_`;
only `main`, `master`, `dev`, `development` bypass the check. Prefer the
`<type>/dxnx-<n>-description` form — it carries both the Conventional Commits type and the ticket.

```
git checkout main && git pull --ff-only origin main
git checkout -b feat/dxnx-225-add-thing
```

Branch **from `main`**, keep the description short and kebab-case (lowercase, `-`).

### Step 4 — Commit (Conventional Commits, ticket in footer)

Format validated by `scripts/check-commit-name.ts`:

```
<type>(<scope>): <description>        e.g. feat(cli): add scan verb
```

Rules the hook enforces:
- Subject ≤ **72 chars**, **no trailing period**, non-empty.
- Allowed types: `feat fix docs style refactor perf test build ci chore revert`.
- Optional scope `(...)` and breaking-change `!` allowed. Scope **must be one of**:
  `ci`, `cli`, `config`, `db`, `deps`, `root`, `security`, `shared`,
  `siem-client`, `siem-server`, `skills`, `tooling`, `web`
  (mirrors `conventionalCommits.scopes` in `.vscode/settings.json`). Omitting the
  scope entirely is always allowed; any other scope is rejected.
- Merge / Revert / `fixup!` / `squash!` subjects are permitted bypass.
- **Never** append the ticket to the subject (no `feat: add thing DXNX-225`).

The `prepare-commit-msg` hook (`scripts/inject-ticket.ts`) reads `dxnx-<n>` from the
branch and appends a footer automatically:

```
feat(cli): add scan verb

Closes DXNX-225
```

So write a clean conventional subject; the ticket footer appears on its own. Commit
normally — the hooks run on their own (`bun` only, never npm/yarn/pnpm).

### Step 5 — Push and open a PR

- `git push -u origin <branch>` triggers pre-push `branch-check` + `type-check`.
- Open the PR against **`main`**. In the PR body, link the Linear issue (URL or
  `Closes DXNX-NNN`) — this is what makes the work traceable after the squash merge.
- Title: clean conventional subject (it becomes the squash commit subject on `main`).

---

## What the hooks enforce at each step (lefthook.yml)

| Hook | Checks |
| --- | --- |
| pre-commit | branch-check, frozen `bun.lock`, Biome check --write, Oxlint, `arch:check`, cspell, secretlint |
| prepare-commit-msg | ticket-inject (`Closes DXNX-NNN` footer from branch) |
| commit-msg | Conventional Commits check |
| pre-push | branch-check + `bun run type-check` |
| post-checkout | branch-check |
| post-merge | `bun install` (frozen lockfile sync) |

If a hook rejects your commit/branch, fix the message or rename the branch
(`git branch -m <new-name>`) and retry — do not bypass with `--no-verify`.

---

## Verification before claiming completion

Per AGENTS.md, before saying a task with code changes is done:

1. `bun run validate` (Biome + Oxlint)
2. `bun run type-check` (Turbo TS across workspaces)
3. `bun run arch:check` (dependency-cruiser boundaries)

And confirm: branch name satisfies `check-branch-name.ts`, commit subjects pass
`check-commit-name.ts`, and the Linear issue identifier is present in the branch name
and the PR body.

---

## Quick reference

| Item | Accepted pattern | Rejected example |
| --- | --- | --- |
| Branch | `feat/dxnx-225-add-thing` | `feature/225/thing`, `add-thing`, `dxnx/225` (missing ticket in path form is allowed but off-standard) |
| Commit subject | `feat(cli): add scan verb` | `add scan verb`, `feat: add scan verb DXNX-225` (ticket in subject) |
| Commit footer | `Closes DXNX-225` (auto-injected) | — |
| Issue identifier | `DXNX-225` (always uppercase when referencing) | `dxnx-225` in prose/title |
| PR base | `main` | — |