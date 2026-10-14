# Migrations: Workflow

## Why It Matters

Drizzle Kit provides multiple commands for managing schema changes. Choosing the right
workflow prevents data loss, keeps your team in sync, and makes deployments predictable.
The two main approaches are migration files (`generate` + `migrate`) and direct push (`push`).

## In this repo: always go through the package scripts

`drizzle-kit` in `apps/siem-server` is wrapped in `with-doppler` (which injects the DB env vars),
and **there is no `with-doppler` script at the repo root**. Run the workspace scripts:

| Task | Command |
|---|---|
| Generate a migration | `bun --filter @doxynix/siem-server db:generate` |
| Apply migrations | `bun --filter @doxynix/siem-server db:migrate` |
| Push schema directly | `bun --filter @doxynix/siem-server db:push` |
| Studio | `bun --filter @doxynix/siem-server db:studio` |
| Drop a migration | `bun --filter @doxynix/siem-server db:drop-migration` |

Config lives in `apps/siem-server/drizzle.config.ts`: `dialect: "postgresql"`, `casing:
"snake_case"`, `schema: "./src/core/db/schema.ts"`, `out: "./src/core/db/migrations"`, `strict: true`,
`breakpoints: true`.

`bun with-doppler "bun --filter @doxynix/siem-server db:generate"` — the form printed in some
upstream docs — **fails from the repo root**; `with-doppler` only exists inside `apps/web` and
`apps/siem-server`. Likewise, `bun x` needs a shell approval in this session; prefer the scripts above.

The full workflow: `.agents/skills/drizzle-migration/SKILL.md`. The short version is below.

## The Two Approaches

### Migration Files (recommended for production)

```bash
# 1. Make changes to src/core/db/schema.ts
# 2. Generate a migration (SQL lands in src/core/db/migrations/)
bun --filter @doxynix/siem-server db:generate
# 3. Review the generated SQL
# 4. Apply
bun --filter @doxynix/siem-server db:migrate
```

The files are committed to version control and applied in order during deployment. **Never
hand-edit generated migration SQL** — regenerate instead.

### Direct Push (good for development / prototyping)

```bash
bun --filter @doxynix/siem-server db:push
```

Applies schema changes directly without generating migration files. Fast for development but
provides no migration history and isn't suitable for production.

## When to Use Which

| Scenario | Command |
|----------|---------|
| Production deployments | `generate` + `migrate` |
| CI/CD pipelines | `migrate` |
| Local development / prototyping | `push` |
| Syncing schema to a new database | `push` |

## Command Reference (generic)

Run these only outside this repo, where the wrappers above do not apply. Replace `npx` with
`bun x`:

- `drizzle-kit generate` — diff the schema against the last migration state and write SQL files.
  Always review the output.
- `drizzle-kit migrate` — apply all unapplied migrations in order; state is tracked in
  `__drizzle_migrations`.
- `drizzle-kit push` — sync the schema with no migration files; prompts on destructive changes
  when `strict: true`.
- `drizzle-kit pull` — introspect an existing database into schema TypeScript. Adopting Drizzle on a
  populated database only.
- `drizzle-kit studio` — web-based database browser.
- `drizzle-kit check` — verify the consistency of the migration folder.

`drizzle-kit up` converts a migration folder to a newer on-disk format. **Do not run it here**:
this repo is on `drizzle-kit@0.31.11`, where the folder already uses the current format (flat SQL
files plus `meta/journal.json` and `meta/*_snapshot.json`, under
`apps/siem-server/src/core/db/migrations`). The reworked per-migration folder is a Drizzle v1
feature.

## Applying Migrations in Code

`apps/siem-server` runs migrations through `scripts/migrate.ts` (`db:migrate`), not from the app
boot path. In a generic project you would call the migrator directly:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const db = drizzle(process.env.DATABASE_URL!);

await migrate(db, { migrationsFolder: './drizzle' });
```

The migrator import path matches your driver:

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
// or
import { migrate } from 'drizzle-orm/postgres-js/migrator';
// or
import { migrate } from 'drizzle-orm/neon-http/migrator';
```

## Incorrect Patterns

```typescript
// Wrong: running push in production
// push doesn't create migration files and can't be rolled back

// Wrong: editing generated migration files
// If you need to modify a migration, delete it and regenerate

// Wrong: not committing migration files to version control
// Migration files should be committed so all team members and CI/CD stay in sync

// Wrong: calling `bun with-doppler "…"` from the repo root — that script does not exist there
```

## References

- https://orm.drizzle.team/docs/kit-overview
- https://orm.drizzle.team/docs/drizzle-kit-generate
- https://orm.drizzle.team/docs/drizzle-kit-migrate
- https://orm.drizzle.team/docs/drizzle-kit-push
- https://orm.drizzle.team/docs/drizzle-kit-pull