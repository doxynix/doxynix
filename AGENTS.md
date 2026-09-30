# AGENTS.md — Doxynix Monorepo

Bun + Turborepo + TypeScript (strict). Bun workspaces: `apps/web`, `apps/siem-server`,
`apps/siem-client`, `packages/{cli,config,shared}`. Postgres 18, Valkey 9, ZenStack/Prisma (web),
Drizzle (siem-server).

`CLAUDE.md` is a symlink to this file. `.cursor/rules/global.mdc` is a stale copy — this file wins.

---

## Commands

Bun only. `npm` / `yarn` / `pnpm` are prohibited. Never introduce ESLint or Prettier (Biome +
Oxlint only).

| Task | Command |
| --- | --- |
| Full gate (run before claiming done) | `bun run validate` then `bun run type-check` then `bun run arch:check` |
| Format | `bun run format` (writes) · `bun run format:check` |
| Lint / fix | `bun run lint` · `bun run lint:fix` |
| Tests | `bun run test` — **only `apps/web` has tests**; the other workspaces have no `test` script |
| One test file | `bun --filter @doxynix/web test src/server/modules/analysis/analysis.mapper.test.ts` |
| Duplication / dead code | `bun run dup` (jscpd, fails over 5%) · `bun run knip` |
| Spelling / secrets | `bun run spellcheck` (cspell) · `bun run secretlint` |

### Things that will bite you

- **Doppler.** `db:generate`, `build`, `dev`, `lint`, `type-check`, `test` and `validate` all
  transitively run `db:generate`, which goes through the `with-doppler` wrapper. Locally that means
  the Doppler CLI must be installed and logged in. `scripts/doppler.ts` passes straight through when
  `CI=true`.
- **`with-doppler` only exists inside `apps/web` and `apps/siem-server`.** There is no such script at
  the repo root, so `bun with-doppler "bun --filter @doxynix/web db:generate"` (as printed in
  `README.md`, `apps/web/README.md` and the `zenstack-migration` skill) fails from the root. Use
  `bun --filter @doxynix/web db:generate` — that script already wraps Doppler.
- **`bunx` needs shell approval** in this session's `opencode.jsonc` permissions. Prefer
  `bun run <script>` / `bun --filter <pkg> <script>`.
- **Prefer `bun run` over ad-hoc binaries** even outside the permission gate: `lint` depends on
  `db:generate` (so type-aware Oxlint has the Prisma client), while `bunx oxlint` skips that.
- **`apps/web` `type-check` is memory-heavy** (`NODE_OPTIONS=--max-old-space-size=8192`).
- `bun run dev` runs the Turborepo TUI and **excludes `@doxynix/cli`**. Infra: `docker compose up -d`
  (postgres 5432 `postgres/123456`, valkey 6379 pass `123456`).
- After `bun install`, run `bun run clean:symlinks` — it deletes the circular `tree-sitter-wasms`
  symlink that breaks WASM grammar loading. `postinstall` does this, but `bun install
  --ignore-scripts` (what CI does) does not.

### Integration tests (`apps/web` only)

`test:int` hits a **real** Postgres, exercises ZenStack policies, and `cleanupDatabase()` `TRUNCATE`s
shared tables between files. It refuses to run against a database whose name does not contain `test`.
Setup is in `CONTRIBUTING.md` (create `dxnx_web_test`, point Doppler config `tst` at it, then
`bun --filter @doxynix/web db:push:test` — `push`, not `migrate deploy`, because the DB is disposable).

`bun run test` is the unit suite only; the unit config *excludes* `src/tests/integration`, so a CLI
path filter can never reach those files — hence the separate `vitest.integration.config.ts`.

---

## Architecture boundaries

- **`apps/*` must not import each other.** The one deliberate exception: `packages/cli` imports
  `type { AppRouter } from "@doxynix/web/trpc"` (a devDependency, types only, via the `./trpc`
  export). Do not extend it to runtime imports.
- Shared domain code and schemas go in `packages/shared` (`workspace:*`), not in an app.
- **Client FSD** (`apps/web/src/{app,entities,features,widgets,shared}`, `apps/siem-client`):
  imports flow downward only; no cross-slice imports. `steiger` is the methodology gate
  (`lint:fsd`).
- **Server modules** (`apps/web/src/server/modules`, `apps/siem-server/src/modules`,
  `packages/cli/src/commands`): a modular monolith — one folder per feature, imports flow
  **downward only**. A slice must not import another slice's internals, and `core`/`utils`/`ui`
  sit *below* slices so they must never import up into one.
- `dep-cruiser` (`arch:check`) is the hard gate, run in pre-commit and CI. It compares against a
  known-violations baseline — new violations fail, old ones do not. After deliberate refactors,
  refresh it with `bun --filter @doxynix/<app> arch:baseline` and review the diff.
- Path ops use `pathe` (never `node:path`), collection helpers use `es-toolkit`, file search uses
  `fast-glob`.

Detail: `.agents/skills/architecture/SKILL.md`.

---

## Generated code — never hand-edit

| Path | Source of truth |
| --- | --- |
| `apps/web/prisma/schema.prisma` | ZenStack compiler; edit `prisma/models/*.zmodel` + `schema.zmodel` |
| `apps/web/src/server/core/field-encryption/config.generated.ts` | `prisma/field-encryption-generator.ts` (DMMF annotations) |
| `packages/shared/src/enums/index.ts` | `prisma/enum-generator.ts`, run by `db:generate` |
| `apps/siem-client/src/routeTree.gen.ts` | TanStack Router plugin |
| `apps/web/messages/en.d.json.ts` | next-intl type generation |
| `apps/siem-client/dist`, `apps/siem-server/dist` | build output consumed via package `exports` |

`packages/cli` and `apps/siem-client` type-check against `apps/siem-server`'s **built** `dist/`, so
run through Turbo (`bun run type-check`) or build siem-server first.

---

## App-specific hard rules

### `apps/web` (Next.js 16, React 19, tRPC, ZenStack 2 / Prisma 6, Trigger.dev 4)

- Trigger tasks live in `src/server/modules/<slice>/tasks/*.task.ts` (discovered by
  `dirs: ["./src/server/**/tasks"]` in `trigger.config.ts`) — not a top-level `tasks/` dir.
- Server slices are wired into `src/server/modules/index.ts`, which exports `AppRouter`; that type is
  the client/CLI contract.
- Prisma keys: `id String @id @default(dbgenerated("uuidv7()")) @db.Uuid` — always `@db.Uuid`, never
  `text`, never generated in application code. `@omit` belongs on secrets and `*Id` FK columns
  only, never on `id` (it hides the field from the policy layer, making the row unreadable).
  `uuidv7()` is `VOLATILE`, so order/filter on `createdAt`, not on the key. GitHub natural keys
  (`GithubInstallation.id`, `Repo.githubId`, `PullRequestComment.githubCommentId`) stay integer.
- `validate` also runs `lint:i18n` (eloqnt) and `lint:locales`
  (`scripts/check-locales.ts`, which enforces the `en.json` key shape across all 12 locales in
  `messages/`). New copy must be added to every locale.

Workflow: `.agents/skills/zenstack-migration/SKILL.md`, `.agents/skills/analysis-engine/SKILL.md`.

### `apps/siem-server` (Hono, Drizzle, UUIDv7)

- Schema changes only in `src/core/db/schema.ts`; PKs must be
  `uuid("id").primaryKey().default(sql\`uuidv7()\`)`. Never hand-edit generated migration SQL.
- `AppType` / `hcWithType` are exported from `src/client.ts` and consumed as
  `@doxynix/siem-server/client`.
- Each slice owns `<slice>.schema.ts` / `<slice>.service.ts` / `<slice>.router.ts` (not all three
  exist everywhere — e.g. `admin` has no service, `stream-logs` has no schema). Inbound payloads go
  through `zValidator("json", Schema)`; protected routes use `requireAuth`. Routers must be chained
  into `app` in `src/index.ts` or `AppType` inference breaks.

Workflow: `.agents/skills/drizzle-migration/SKILL.md`, `.agents/skills/hono-rpc-endpoint/SKILL.md`.

### `apps/siem-client` (Vite 8, React 19, TanStack Router)

- FSD only: `routes → widgets → features → entities → shared`. Compose in a widget instead of
  cross-importing features.
- Consume the API through `hcWithType` from `@doxynix/siem-server/client` — never raw `fetch`, never
  deep imports into server files.

### `packages/cli` (`dxnx`)

- Command slices over `src/commands`; `src/core` + `src/ui` are shared and must not import command slices.

### `packages/shared`

- Pure types, Zod schemas, auth contracts. Its only runtime dependency is `zod`.

---

## Lint / format gotchas

- Biome runs **assist** actions on write: `useSortedKeys`, `useSortedProperties`,
  `useSortedPackageJson`, `useSortedAttributes`, `useSortedEnumMembers`, plus a custom
  `organizeImports` group order (`bun/node` → react → next → hono → packages → `@doxynix/*` →
  `@/shared` → `@/entities` → `@/features` → `@/widgets` → `@/app` → aliases → relative). Expect it
  to rewrite your object literals and imports; run `bun run format` and re-read the result.
- Oxlint runs **type-aware** (`oxlint-tsgolint`) with `correctness: error` plus a long `plugins`/
  `rules` set. Frequent trip-ups: `no-console` (only `warn`/`error`/`info` allowed),
  `typescript/no-non-null-assertion`, `typescript/no-floating-promises`, `no-param-reassign`,
  `unicorn/filename-case` (kebab-case), `unicorn/error-message`, `no-underscore-dangle` (allowlist is
  small). Tests get a relaxed override; `vitest/no-focused-tests` and `vitest/expect-expect` are
  errors, so no `.only` and every test needs an `expect`-family call.
- `cspell` runs on staged files in pre-commit — unusual product words need a `cspell.json` entry.

### Comments

Default to no comment. Write one only when the code is misread without it, and keep
it to at most two lines within the 100-column `lineWidth`.

- Never repeat the identifier, the next line, or a nearby string literal.
- No file-header boilerplate, no `// ====` section banners, no git-history narration.
- JSDoc blocks only for the exported API of a workspace package (`packages/shared`,
  `apps/siem-server/src/client.ts`). Inside `apps/*/src` the types are the contract.
- Keep every `TODO:` / `FIXME:` / `NOTE:` / `HACK:` marker, and give it a ticket or
  an owner. An undated, ownerless TODO is deleted, not kept.
- Functional directives (`oxlint-disable`, `@ts-expect-error`, `biome-ignore`,
  `/// <reference>`) must carry a one-line reason. The directive goes on the line
  immediately before the code it suppresses.

---

## Git workflow

Full detail in `.agents/skills/linear-git-workflow/SKILL.md`. The essentials, all enforced by
Lefthook:

- Branch off `main`: `<type>/dxnx-<n>-<kebab-description>`. The hook only checks for a `dxnx`
  prefix (`main`/`master`/`dev`/`development` bypass it).
- Commit subject: `type(scope): description`, ≤ 72 chars, no trailing period. Allowed types
  `feat fix docs style refactor perf test build ci chore revert`. Scope is optional but, if present,
  must be one of `ci cli config db deps root security shared siem-client siem-server skills tooling
  web` (`scripts/check-commit-name.ts`).
- **Never put the ticket in the subject.** `prepare-commit-msg` reads `dxnx-<n>` off the branch and
  appends `Closes DXNX-NNN` itself.
- Pre-commit runs branch check, `bun install --frozen-lockfile`, Biome `--write` (re-staged),
  Oxlint, `arch:check`, cspell, secretlint. Pre-push runs branch check + `bun run type-check`.
- **Never `--no-verify`.** If a hook rejects you, fix the branch name or message.
- Mergify squash-merges into `main`, so the PR title becomes the commit subject. Link the Linear
  issue in the PR body. Release-please versions the workspaces from Conventional Commits — do not
  hand-edit versions or changelogs.

---

## Skills

`.agents/skills/` is registered via `opencode.jsonc` (`"skills": ["./.agents/skills"]`), so use the
`skill` tool rather than reading files by hand. The repo-specific ones worth knowing:
`architecture`, `zenstack-migration`, `drizzle-migration`, `hono-rpc-endpoint`, `analysis-engine`,
`linear-git-workflow`, `verification-before-completion`, `systematic-debugging`, `ponytail`,
`writing-plans`, `code-review`.

`opencode.jsonc` also defines slash commands: `/git-linear` (ticket → branch → PR), `/review`,
`/validate`.
